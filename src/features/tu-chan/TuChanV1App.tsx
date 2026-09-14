import {useEffect,useMemo,useRef,useState} from 'react';
import {buildDailyListeningPromptIds,createEmptySession,inquiryEngineV1,localFusionAdapterV1} from './engine';
import {inquiryBankV1,listeningPromptBankV1} from './data';
import {analyzeMicrophoneForPrompt,analyzeVideoFrame,captureVideoFrameDataUrl,openCamera} from './browserSensors';
import {localSessionStorageAdapterV1,mockTongueDiagnosisAdapterV1} from './localAdapters';
import type {FourExamSessionV1,InquiryAnswerValue,ListeningResultV1,TongueResultV1} from './types';
import './tu-chan-v1.css';

const todayLocal=()=>new Intl.DateTimeFormat('en-CA',{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).format(new Date());
const pct=(value:number)=>`${Math.round(value*100)}%`;

export default function TuChanV1App(){
  const localDate=useMemo(()=>todayLocal(),[]),userSeed='local-v1-user';
  const questionIds=useMemo(()=>inquiryEngineV1.buildDailyQuestionIds({userSeed,localDate}),[localDate]);
  const questions=useMemo(()=>questionIds.map(id=>inquiryBankV1.find(q=>q.id===id)!).filter(Boolean),[questionIds]);
  const promptIds=useMemo(()=>buildDailyListeningPromptIds(userSeed,localDate),[localDate]);
  const prompts=useMemo(()=>promptIds.map(id=>listeningPromptBankV1.find(p=>p.id===id)!).filter(Boolean),[promptIds]);
  const [session,setSession]=useState<FourExamSessionV1>(()=>createEmptySession(userSeed,localDate));
  const [step,setStep]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [answers,setAnswers]=useState<Record<string,InquiryAnswerValue>>({});
  const [voiceSamples,setVoiceSamples]=useState<ListeningResultV1['samples']>([]),[activeVoice,setActiveVoice]=useState<number|null>(null);
  const [tonguePreview,setTonguePreview]=useState('');
  const videoRef=useRef<HTMLVideoElement|null>(null),stopCameraRef=useRef<(()=>void)|null>(null);

  useEffect(()=>()=>stopCameraRef.current?.(),[]);
  useEffect(()=>{if(step!==1)stopCameraRef.current?.()},[step]);

  const startCamera=async()=>{if(!videoRef.current)return;setMessage('');setBusy(true);try{stopCameraRef.current?.();stopCameraRef.current=await openCamera(videoRef.current,'user')}catch{setMessage('Không mở được camera. Hãy cấp quyền camera và thử lại.')}finally{setBusy(false)}};
  const captureObservation=()=>{if(!videoRef.current)return;try{const result=analyzeVideoFrame(videoRef.current);setSession(s=>({...s,observation:result,providerVersions:{...s.providerVersions,observation:result.adapterVersion}}));stopCameraRef.current?.();stopCameraRef.current=null;setStep(2)}catch{setMessage('Khung hình chưa sẵn sàng. Hãy thử lại.')}};

  const recordVoice=async(index:number)=>{if(activeVoice!==null)return;setMessage('');setActiveVoice(index);try{const sample=await analyzeMicrophoneForPrompt(prompts[index].id);setVoiceSamples(prev=>[...prev.filter(x=>x.promptId!==sample.promptId),sample]);}catch{setMessage('Không ghi nhận được micro. Hãy cấp quyền micro và thử lại.')}finally{setActiveVoice(null)}};
  const finishVoice=()=>{if(voiceSamples.length!==5){setMessage('Cần hoàn tất đủ 5 câu đọc.');return}const confidence=Math.max(0.45,1-voiceSamples.reduce((sum,s)=>sum+(s.pauseRatio>0.65?0.08:0),0));const result:ListeningResultV1={provider:'web-audio-local',adapterVersion:'1.0.0',confidence,promptIds,samples:voiceSamples};setSession(s=>({...s,listening:result,providerVersions:{...s.providerVersions,listening:result.adapterVersion}}));setMessage('');setStep(3)};

  const setAnswer=(id:string,value:InquiryAnswerValue)=>setAnswers(prev=>({...prev,[id]:value}));
  const finishInquiry=()=>{if(questions.some(q=>answers[q.id]===undefined)){setMessage('Cần trả lời đủ 10 câu hỏi.');return}const result={provider:'thap-van-local',adapterVersion:'1.0.0',confidence:0.9,questionSetVersion:'1.0.0',answers:questions.map(q=>({questionId:q.id,domain:q.domain,value:answers[q.id],tags:q.tags}))};setSession(s=>({...s,inquiry:result,providerVersions:{...s.providerVersions,inquiry:result.adapterVersion}}));setMessage('');setStep(4)};

  const onTongueFile=async(file?:File)=>{if(!file)return;const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file)});setTonguePreview(dataUrl)};
  const finishTongue=async()=>{if(!tonguePreview){setMessage('Cần chụp hoặc chọn một ảnh lưỡi.');return}setBusy(true);try{const result:TongueResultV1=await mockTongueDiagnosisAdapterV1.analyze({imageDataUrl:tonguePreview,capturedAt:new Date().toISOString()});setSession(s=>({...s,tongue:result,providerVersions:{...s.providerVersions,tongue:result.adapterVersion}}));setMessage('');setStep(5)}finally{setBusy(false)}};

  const generateReport=async()=>{setBusy(true);setMessage('');try{const report=await localFusionAdapterV1.summarize(session);const completed={...session,fusionReport:report,completedAt:new Date().toISOString(),providerVersions:{...session.providerVersions,fusion:report.adapterVersion}};setSession(completed);await localSessionStorageAdapterV1.saveSession(completed)}catch{setMessage('Không thể tổng hợp phiên Tứ Chẩn.')}finally{setBusy(false)}};
  useEffect(()=>{if(step===5&&!session.fusionReport)void generateReport()},[step]);

  const reset=()=>{setSession(createEmptySession(userSeed,localDate));setAnswers({});setVoiceSamples([]);setTonguePreview('');setMessage('');setStep(0)};

  return <main className="tcv1-shell">
    <section className="tcv1-card tcv1-hero">
      <div><span className="tcv1-kicker">TỨ CHẨN YHCT · V1</span><h1>Theo dõi buổi sáng</h1><p>Vọng · Văn · Vấn · Thiệt trong một quy trình thống nhất.</p></div>
      <div className="tcv1-date">{localDate}</div>
    </section>

    {step>0&&<div className="tcv1-progress" aria-label="Tiến trình"><i style={{width:`${Math.min(100,step*25)}%`}}/></div>}
    {message&&<div className="tcv1-alert">{message}</div>}

    {step===0&&<section className="tcv1-card tcv1-start"><div className="tcv1-orbit"><span>望</span><span>聞</span><span>問</span><span>舌</span></div><h2>Bắt đầu Tứ Chẩn sáng nay</h2><p>Dữ liệu camera và micro được xử lý cục bộ trong V1; không tự động tải media thô lên cloud.</p><button className="tcv1-primary" onClick={()=>setStep(1)}>Bắt đầu</button></section>}

    {step===1&&<section className="tcv1-card"><header className="tcv1-stephead"><b>1/4</b><div><h2>Vọng</h2><p>Giữ mặt thẳng, đủ sáng, không ngược sáng.</p></div></header><div className="tcv1-camera"><video ref={videoRef} muted playsInline/><div className="tcv1-face-guide"/></div><div className="tcv1-actions"><button onClick={startCamera} disabled={busy}>Mở camera</button><button className="tcv1-primary" onClick={captureObservation}>Quét khuôn mặt</button></div>{session.observation&&<small>Chất lượng: {pct(session.observation.qualityScore)}</small>}</section>}

    {step===2&&<section className="tcv1-card"><header className="tcv1-stephead"><b>2/4</b><div><h2>Văn</h2><p>Đọc tự nhiên 5 câu, mỗi câu khoảng 4 giây.</p></div></header><div className="tcv1-voice-list">{prompts.map((prompt,index)=>{const done=voiceSamples.some(s=>s.promptId===prompt.id);return <article key={prompt.id} className={done?'done':''}><span>{index+1}</span><p>{prompt.text}</p><button onClick={()=>void recordVoice(index)} disabled={activeVoice!==null}>{activeVoice===index?'Đang nghe…':done?'Đọc lại':'Đọc câu'}</button></article>})}</div><button className="tcv1-primary wide" onClick={finishVoice}>Tiếp tục ({voiceSamples.length}/5)</button></section>}

    {step===3&&<section className="tcv1-card"><header className="tcv1-stephead"><b>3/4</b><div><h2>Vấn · Thập vấn</h2><p>10 câu được xoay theo ngày nhưng vẫn giữ đủ nhóm.</p></div></header><div className="tcv1-question-list">{questions.map((q,index)=><article key={q.id}><b>{index+1}. {q.prompt}</b>{q.type==='yes-no'?<div className="tcv1-choice"><button className={answers[q.id]===false?'selected':''} onClick={()=>setAnswer(q.id,false)}>Không</button><button className={answers[q.id]===true?'selected':''} onClick={()=>setAnswer(q.id,true)}>Có</button></div>:q.type==='scale'?<div className="tcv1-scale">{[1,2,3,4,5].map(n=><button key={n} className={answers[q.id]===n?'selected':''} onClick={()=>setAnswer(q.id,n)}>{n}</button>)}</div>:<div className="tcv1-choice"><button className={answers[q.id]==='low'?'selected':''} onClick={()=>setAnswer(q.id,'low')}>Thấp/lạnh hơn</button><button className={answers[q.id]==='normal'?'selected':''} onClick={()=>setAnswer(q.id,'normal')}>Bình thường</button><button className={answers[q.id]==='high'?'selected':''} onClick={()=>setAnswer(q.id,'high')}>Cao/nóng hơn</button></div>}</article>)}</div><button className="tcv1-primary wide" onClick={finishInquiry}>Tiếp tục</button></section>}

    {step===4&&<section className="tcv1-card"><header className="tcv1-stephead"><b>4/4</b><div><h2>Thiệt chẩn</h2><p>Chụp lưỡi rõ nét, ánh sáng trắng, không dùng filter.</p></div></header><label className="tcv1-upload">{tonguePreview?<img src={tonguePreview} alt="Ảnh lưỡi đã chọn"/>:<span>Chạm để chụp/chọn ảnh lưỡi</span>}<input type="file" accept="image/*" capture="environment" onChange={e=>void onTongueFile(e.target.files?.[0])}/></label><p className="tcv1-note">V1 giữ `TongueDiagnosisAdapter`; engine Thiệt chẩn hiện tại được nối tại adapter này mà không đổi UI.</p><button className="tcv1-primary wide" onClick={()=>void finishTongue()} disabled={busy}>Hoàn tất Thiệt chẩn</button></section>}

    {step===5&&<section className="tcv1-card tcv1-report"><header className="tcv1-stephead"><b>✓</b><div><h2>Tổng hợp hôm nay</h2><p>Báo cáo hỗ trợ theo dõi, không thay thế chẩn đoán y tế.</p></div></header>{busy&&!session.fusionReport&&<p>Đang tổng hợp…</p>}{session.fusionReport&&<><div className="tcv1-score"><strong>{Math.round(session.fusionReport.confidence*100)}</strong><span>độ tin cậy dữ liệu V1</span></div><h3>{session.fusionReport.summary}</h3>{session.fusionReport.signals.length>0&&<ul>{session.fusionReport.signals.map(signal=><li key={signal}>{signal}</li>)}</ul>}<p>{session.fusionReport.tcmInterpretation}</p><div className="tcv1-recs">{session.fusionReport.recommendations.map(item=><span key={item}>{item}</span>)}</div><button className="tcv1-primary wide" onClick={reset}>Kết thúc phiên</button></>}</section>}
  </main>;
}
