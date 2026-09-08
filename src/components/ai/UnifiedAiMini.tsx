import {useEffect,useMemo,useState} from 'react';
import {Bot,ChevronDown,History,MessageSquarePlus,Send,Sparkles,X} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import {askServerAi,renderAiAnswer} from '../../services/aiRuntimeService';
import {buildResearchLinks,checkDrlConversation} from '../../services/miniAiEngine';
import {referenceLabel,searchKnowledge} from '../../services/centralKnowledgeService';
import {askGemini,getGeminiStatus} from '../../services/geminiByok';

type HistoryItem={id:string;query:string;answer:string;at:string};
type StoredHistory={day:string;items:HistoryItem[]};
type Mode='assistant'|'feedback';
const HISTORY_KEY='yhct-ai-mini-visible-history-v1';
const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const safeHistory=():StoredHistory=>{const day=localDay();try{const raw=JSON.parse(localStorage.getItem(HISTORY_KEY)||'null') as StoredHistory|null;if(raw?.day===day&&Array.isArray(raw.items))return{day,items:raw.items.slice(0,3)};localStorage.removeItem(HISTORY_KEY)}catch{localStorage.removeItem(HISTORY_KEY)}return{day,items:[]}};
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();

function formatDrl(result:Awaited<ReturnType<typeof checkDrlConversation>>){if(!result)return'';if(result.mode==='mine')return result.items.length?`${result.semesterTitle||'Học kỳ hiện tại'}: ${result.total} điểm. ${result.items.slice(0,4).map(x=>`${x.label} ${x.points>=0?'+':''}${x.points}`).join(' · ')}`:`${result.semesterTitle||'Học kỳ hiện tại'}: chưa có hoạt động được công bố.`;const top=result.candidates?.[0];return top?`${top.full_name} · ${top.student_code_masked} · ${top.semester_title}: ${top.total_points} điểm.`:'Không tìm thấy kết quả điểm phù hợp.'}

export default function UnifiedAiMini({member,onLogin}:{member:Member|null;onLogin:()=>void}){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<Mode>('assistant'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[answer,setAnswer]=useState(''),[message,setMessage]=useState('');
  const [history,setHistory]=useState<StoredHistory>(()=>safeHistory());
  const [feedbackKind,setFeedbackKind]=useState<'suggestion'|'bug'|'other'>('suggestion'),[feedback,setFeedback]=useState('');
  const greeting=useMemo(()=>`Xin chào ${member?.herbalAlias||member?.fullName||'bạn'}! A.I Mini đã sẵn sàng. Bạn có thể hỏi nhanh về YHCT, điểm rèn luyện, tài liệu nghiên cứu hoặc gửi góp ý ngay tại đây.`,[member?.herbalAlias,member?.fullName]);
  useEffect(()=>{const id=window.setInterval(()=>{const day=localDay();setHistory(current=>{if(current.day===day)return current;localStorage.removeItem(HISTORY_KEY);setAnswer('');return{day,items:[]}})},60000);return()=>window.clearInterval(id)},[]);
  useEffect(()=>{if(open)setMessage('')},[open]);
  const saveHistory=(item:HistoryItem)=>setHistory(current=>{const day=localDay(),next:{day:string;items:HistoryItem[]}={day,items:[item,...(current.day===day?current.items:[])].slice(0,3)};localStorage.setItem(HISTORY_KEY,JSON.stringify(next));return next});
  const ask=async()=>{const text=clean(query);if(!text||busy)return;setBusy(true);setMessage('');try{
    let output='',runtimeStatus='';
    try{const drl=await checkDrlConversation(text,member);if(drl)output=formatDrl(drl)}catch(e){if(/đăng nhập/i.test((e as Error).message)){setMessage((e as Error).message);onLogin();return}}
    if(!output){
      const hits=await searchKnowledge(text,'all',5);
      if(hits.length){
        const names=hits.slice(0,4).map(h=>`${h.record.name} (${h.record.kind})`).join(' · '),central=hits.some(h=>h.source==='central');
        const evidence=hits.flatMap(h=>h.evidence),authoritySources=hits.flatMap(h=>h.authoritySources),citations=referenceLabel(evidence,authoritySources,4);
        output=central
          ?`Kết quả kho YHCT tập trung: ${names}. ${citations?`Nguồn đối chiếu đã xác minh: ${citations}.`:'Các mục khớp hiện chưa có nguồn authority/citation gắn trực tiếp.'} Nội dung dùng cho học tập; không thay thế đánh giá hoặc chỉ định lâm sàng.`
          :`Kết quả dữ liệu YHCT offline: ${names}. Đang dùng kho cục bộ vì Central RAG không khả dụng hoặc chưa có kết quả. Nội dung dùng cho học tập; hãy kiểm tra nguồn chuyên môn trước khi áp dụng lâm sàng.`;
        runtimeStatus=central?'Central RAG · PubMed/DOI + WHO/NCCIH/Cochrane':'Offline knowledge fallback';
      }
    }
    if(!output&&member){try{const result=await askServerAi(text,'fast');if(!result.degraded){output=renderAiAnswer(result);runtimeStatus=`A.I cloud · ${result.provider} · ${Math.max(0,Math.round(result.latencyMs))} ms`}else runtimeStatus='A.I cloud đang ở chế độ degraded; tiếp tục fallback an toàn.'}catch(e){runtimeStatus=(e as Error).message}}
    if(!output&&getGeminiStatus().configured){try{const result=await askGemini(text);output=`${result.text}\n\nNguồn AI: Gemini BYOK fallback. Cần kiểm tra tài liệu chuyên môn trước khi áp dụng.`;runtimeStatus=`Gemini BYOK fallback · ${result.model}`}catch{}}
    if(!output){const links=buildResearchLinks(text);output=`Chưa có câu trả lời đủ chắc chắn. Tôi đã chuẩn bị hướng tra cứu: ${links.slice(0,3).map(x=>x.provider).join(', ')}. Mở Trung tâm nghiên cứu để kiểm tra nguồn.`}
    setAnswer(output);if(runtimeStatus)setMessage(runtimeStatus);saveHistory({id:crypto.randomUUID(),query:text,answer:output,at:new Date().toISOString()});setQuery('');
  }catch(e){setMessage((e as Error).message||'A.I Mini chưa thể xử lý yêu cầu.')}finally{setBusy(false)}};
  const submitFeedback=async()=>{const body=clean(feedback);if(!member){onLogin();return}if(body.length<5){setMessage('Góp ý cần ít nhất 5 ký tự.');return}setBusy(true);setMessage('');try{const {error}=await supabase.rpc('feedback_submit_v1',{p_kind:feedbackKind,p_body:body,p_context:{surface:'ai-mini',path:location.pathname,day:localDay()}});if(error)throw error;setFeedback('');setMessage('Đã gửi góp ý tới Admin. Cảm ơn bạn.')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};
  return <div className={`ai-mini-unified ${open?'is-open':''}`}>
    {open&&<section className="ai-mini-panel" role="dialog" aria-label="A.I Mini"><header><div className="row"><Bot/><div><b>A.I Mini</b><small>Central RAG · authority sources · offline fallback</small></div></div><button className="icon-btn" onClick={()=>setOpen(false)} aria-label="Đóng A.I Mini"><X/></button></header>
      <div className="ai-mini-greeting"><Sparkles/><p>{greeting}</p></div>
      <div className="ai-mini-tabs"><button className={mode==='assistant'?'active':''} onClick={()=>setMode('assistant')}><Bot/>Trao đổi</button><button className={mode==='feedback'?'active':''} onClick={()=>setMode('feedback')}><MessageSquarePlus/>Góp ý</button></div>
      {mode==='assistant'?<>
        {history.items.length>0&&<div className="ai-mini-history"><div className="between"><span><History/> 3 lịch sử gần nhất</span><small>Tự xóa hiển thị mỗi ngày</small></div>{history.items.map(item=><button key={item.id} onClick={()=>{setAnswer(item.answer);setQuery(item.query)}}><b>{item.query}</b><span className="ai-mini-history-preview">{item.answer}</span></button>)}</div>}
        {answer&&<article className="ai-mini-answer"><b>A.I Mini</b><p>{answer}</p></article>}
        <div className="ai-mini-compose"><textarea maxLength={1200} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Hỏi A.I Mini…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void ask()}}}/><button disabled={busy||!clean(query)} onClick={()=>void ask()}><Send/></button></div>
      </>:<div className="ai-mini-feedback"><label>Loại góp ý<select value={feedbackKind} onChange={e=>setFeedbackKind(e.target.value as typeof feedbackKind)}><option value="suggestion">Đề xuất</option><option value="bug">Báo lỗi</option><option value="other">Khác</option></select></label><label>Nội dung<textarea maxLength={3000} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Mô tả góp ý hoặc vấn đề bạn gặp…"/></label><button disabled={busy||clean(feedback).length<5} onClick={()=>void submitFeedback()}><Send/>Gửi góp ý</button></div>}
      {message&&<div className="ai-note" role="status">{message}</div>}
    </section>}
    <button className="ai-mini-fab" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={open?'Ẩn A.I Mini':'Mở A.I Mini'}><Bot/><span>A.I Mini</span><ChevronDown/></button>
  </div>;
}
