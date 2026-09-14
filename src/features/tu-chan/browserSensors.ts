import type { ListeningPromptResultV1, ObservationResultV1 } from './types';

const clamp01=(value:number)=>Math.max(0,Math.min(1,value));

export async function openCamera(video:HTMLVideoElement,facingMode:'user'|'environment'='user'){
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode,width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;
  await video.play();
  return ()=>stream.getTracks().forEach(track=>track.stop());
}

export function analyzeVideoFrame(video:HTMLVideoElement):ObservationResultV1{
  const width=Math.max(1,video.videoWidth||640),height=Math.max(1,video.videoHeight||480);
  const canvas=document.createElement('canvas');
  canvas.width=320;canvas.height=Math.max(180,Math.round(320*height/width));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Không thể đọc khung hình camera.');
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
  let total=0,totalSq=0,clippedDark=0,clippedBright=0,count=0;
  const x0=Math.floor(canvas.width*0.25),x1=Math.floor(canvas.width*0.75),y0=Math.floor(canvas.height*0.16),y1=Math.floor(canvas.height*0.86);
  for(let y=y0;y<y1;y+=2){for(let x=x0;x<x1;x+=2){const i=(y*canvas.width+x)*4;const luma=(0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2])/255;total+=luma;totalSq+=luma*luma;if(luma<0.08)clippedDark++;if(luma>0.96)clippedBright++;count++;}}
  const mean=total/Math.max(1,count),variance=Math.max(0,totalSq/Math.max(1,count)-mean*mean),contrast=Math.sqrt(variance);
  const darkRate=clippedDark/Math.max(1,count),brightRate=clippedBright/Math.max(1,count);
  const lightingScore=clamp01(1-Math.abs(mean-0.52)*1.7-darkRate*1.8-brightRate*1.8);
  const contrastScore=clamp01(contrast/0.18);
  const qualityScore=clamp01(lightingScore*0.75+contrastScore*0.25);
  return {provider:'browser-quality-gate',adapterVersion:'1.0.0',confidence:0.72,facePresent:true,qualityScore,lightingScore,poseScore:0.75,regionMetrics:{centralLuma:mean,centralContrast:contrast,darkClipRate:darkRate,brightClipRate:brightRate}};
}

export function captureVideoFrameDataUrl(video:HTMLVideoElement,quality=0.88){
  const canvas=document.createElement('canvas');
  canvas.width=video.videoWidth||720;canvas.height=video.videoHeight||960;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Không thể chụp ảnh.');
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',quality);
}

export async function analyzeMicrophoneForPrompt(promptId:string,durationMs=4200):Promise<ListeningPromptResultV1>{
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
  const AudioContextCtor=window.AudioContext||((window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext);
  const context=new AudioContextCtor();
  const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();
  analyser.fftSize=2048;analyser.smoothingTimeConstant=0.25;source.connect(analyser);
  const time=new Float32Array(analyser.fftSize),freq=new Uint8Array(analyser.frequencyBinCount);
  let rmsSum=0,zcrSum=0,centroidSum=0,silentFrames=0,frames=0;
  const started=performance.now();
  await new Promise<void>((resolve)=>{
    const timer=window.setInterval(()=>{
      analyser.getFloatTimeDomainData(time);analyser.getByteFrequencyData(freq);
      let sq=0,zcr=0;for(let i=0;i<time.length;i++){sq+=time[i]*time[i];if(i&&((time[i-1]>=0)!==(time[i]>=0)))zcr++;}
      const rms=Math.sqrt(sq/time.length),zcrRate=zcr/time.length;
      let weighted=0,mag=0;for(let i=0;i<freq.length;i++){const m=freq[i]/255;weighted+=m*i;mag+=m;}
      const hzPerBin=context.sampleRate/analyser.fftSize,centroid=mag?weighted/mag*hzPerBin:0;
      rmsSum+=rms;zcrSum+=zcrRate;centroidSum+=centroid;if(rms<0.025)silentFrames++;frames++;
      if(performance.now()-started>=durationMs){window.clearInterval(timer);resolve();}
    },80);
  });
  stream.getTracks().forEach(track=>track.stop());source.disconnect();await context.close();
  return {promptId,durationMs:Math.round(performance.now()-started),rms:rmsSum/Math.max(1,frames),zeroCrossingRate:zcrSum/Math.max(1,frames),spectralCentroid:centroidSum/Math.max(1,frames),pauseRatio:silentFrames/Math.max(1,frames)};
}
