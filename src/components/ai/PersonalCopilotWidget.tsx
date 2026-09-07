import { useEffect,useMemo,useRef,useState } from 'react';
import { GripHorizontal,Mic,MicOff,Sparkles,X } from 'lucide-react';
import { checkHerbConflict } from '../../services/aiService';

declare global{interface Window{webkitSpeechRecognition?:new()=>any;SpeechRecognition?:new()=>any}}
type Pos={x:number;y:number;edge:'left'|'right'};
type Saved={open:boolean;x:number;y:number;edge:'left'|'right'};
const KEY='yhct-mini-ai-widget-v2';
const FAB=56;
const margin=12;
const clamp=(v:number,min:number,max:number)=>Math.min(Math.max(v,min),Math.max(min,max));
const mobile=()=>typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches;
const defaults=():Saved=>({open:false,x:typeof window==='undefined'?margin:Math.max(margin,window.innerWidth-FAB-margin),y:typeof window==='undefined'?180:Math.max(80,window.innerHeight-FAB-96),edge:'right'});
const read=():Saved=>{try{const parsed=JSON.parse(localStorage.getItem(KEY)||'null');return parsed&&typeof parsed==='object'?{...defaults(),...parsed}:defaults()}catch{return defaults()}};

export default function PersonalCopilotWidget(){
  const initial=useMemo(read,[]);
  const [open,setOpen]=useState(initial.open),[pos,setPos]=useState<Pos>({x:initial.x,y:initial.y,edge:initial.edge}),[isMobile,setIsMobile]=useState(mobile),[text,setText]=useState(''),[listening,setListening]=useState(false),[dragging,setDragging]=useState(false);
  const drag=useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number;moved:boolean}|null>(null);
  const recognition=useRef<any>(null);
  const bounds=()=>({maxX:Math.max(margin,window.innerWidth-FAB-margin),maxY:Math.max(72,window.innerHeight-FAB-(mobile()?88:margin))});
  const persist=(nextOpen=open,nextPos=pos)=>{try{localStorage.setItem(KEY,JSON.stringify({open:nextOpen,...nextPos}))}catch{}}
  const normalize=(p:Pos):Pos=>{const b=bounds();return{...p,x:clamp(p.x,margin,b.maxX),y:clamp(p.y,72,b.maxY)}};

  useEffect(()=>{const onResize=()=>{setIsMobile(mobile());setPos(current=>{const next=normalize(current);persist(open,next);return next})};window.addEventListener('resize',onResize,{passive:true});onResize();return()=>window.removeEventListener('resize',onResize)},[]);
  useEffect(()=>{persist(open,pos)},[open,pos]);
  useEffect(()=>()=>{try{recognition.current?.stop()}catch{}},[]);

  const onPointerDown=(e:React.PointerEvent<HTMLButtonElement>)=>{if(open&&isMobile)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:pos.x,originY:pos.y,moved:false};setDragging(false)};
  const onPointerMove=(e:React.PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;const dx=e.clientX-d.startX,dy=e.clientY-d.startY;if(!d.moved&&Math.hypot(dx,dy)>5){d.moved=true;setDragging(true)}if(!d.moved)return;const b=bounds();setPos(current=>({...current,x:clamp(d.originX+dx,margin,b.maxX),y:clamp(d.originY+dy,72,b.maxY)}))};
  const finishPointer=(e:React.PointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;drag.current=null;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}if(d.moved){const b=bounds();setPos(current=>{const edge=current.x+FAB/2<window.innerWidth/2?'left':'right';const next={x:edge==='left'?margin:b.maxX,y:clamp(current.y,72,b.maxY),edge} as Pos;persist(open,next);return next});setDragging(false);return}setOpen(v=>!v)};

  const speak=()=>{const C=window.SpeechRecognition||window.webkitSpeechRecognition;if(!C){alert('Trình duyệt này chưa hỗ trợ Web Speech API.');return}if(recognition.current){try{recognition.current.stop()}catch{}return}const r=new C();recognition.current=r;r.lang='vi-VN';r.continuous=false;r.interimResults=false;r.onstart=()=>setListening(true);r.onend=()=>{setListening(false);recognition.current=null};r.onerror=()=>{setListening(false);recognition.current=null};r.onresult=(e:any)=>setText((v:string)=>`${v} ${e.results[0][0].transcript}`.trim());r.start()};
  const warnings=checkHerbConflict(text);
  const boxStyle:React.CSSProperties=isMobile?{}:{left:clamp(pos.edge==='right'?pos.x-306:pos.x,margin,window.innerWidth-362),top:clamp(pos.y-330,72,window.innerHeight-390)};

  return <div className={`copilot copilot-v2 ${open?'is-open':''} ${isMobile?'is-mobile':''}`}>
    {open&&<section className="copilot-box copilot-panel" style={boxStyle} role="dialog" aria-label="Mini AI Copilot Y học cổ truyền">
      <header><div className="row"><GripHorizontal className="copilot-grip"/><b><Sparkles/> Mini AI Copilot</b></div><button className="copilot-close" aria-label="Đóng Mini AI" onClick={()=>setOpen(false)}><X/></button></header>
      <p className="copilot-disclaimer">Hỗ trợ học tập YHCT, không thay thế chẩn đoán, kê đơn hoặc quyết định điều trị của người hành nghề có thẩm quyền.</p>
      <label className="sr-only" htmlFor="mini-ai-text">Nội dung cần kiểm tra</label><textarea id="mini-ai-text" value={text} onChange={e=>setText(e.target.value)} placeholder="Nhập hoặc đọc Tứ Chẩn, phương dược, câu hỏi học thuật…"/>
      <div className="copilot-actions"><button onClick={speak}>{listening?<MicOff/>:<Mic/>} {listening?'Dừng nghe':'Nhập giọng nói'}</button><button className="secondary" onClick={()=>setText('')} disabled={!text}>Xóa nội dung</button></div>
      {warnings.map(w=><div className="warning" key={w}>{w}</div>)}
      {!warnings.length&&text&&<small>Không phát hiện cặp Thập Bát Phản trong từ khóa đã nhập. Kết quả chỉ là cảnh báo hỗ trợ học tập và không chứng minh phối ngũ an toàn.</small>}
    </section>}
    <button className={`float copilot-fab ${dragging?'dragging':''}`} style={{left:pos.x,top:pos.y}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} aria-label={open?'Đóng Mini AI':'Mở Mini AI'} title="Kéo để di chuyển · thả để hít vào mép màn hình"><Sparkles/></button>
  </div>
}
