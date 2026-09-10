import {Component,useEffect,useMemo,useState,type ReactNode} from 'react';
import {Award,BookOpenCheck,BrainCircuit,CheckCircle2,Clock3,Flame,Layers3,RefreshCw,Sparkles,Stethoscope,Swords,Trophy,Zap} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';

type EngagementTab='daily'|'herb'|'busy'|'consult'|'collection';
type Mission={key:string;label:string;current:number;target:number;done:boolean};
type Engagement={date:string;xp:number;level:number;title:string;streak_days:number;last_claim_date?:string|null;daily_claimed:boolean;can_claim:boolean;missions:Mission[];mastery_unlocked:number;busy_shift_available:boolean};
type ChallengeQuestion={name:string;field:string;field_label:string;prompt:string;options:string[]};
type Challenge={session_id:string;challenge_date:string;expires_at:string;current_index:number;score:number;combo:number;best_combo:number;finished:boolean;expired?:boolean;correct?:boolean;xp_awarded?:number;xp?:number;question:ChallengeQuestion|null};
type ConsultOption={code:string;label:string};
type ConsultDistribution=ConsultOption&{votes:number;percent:number};
type Consult={consult_date:string;case_label:string;vong:string;van_am:string;van_hoi:string;thiet:string;options:ConsultOption[];voted:boolean;selected_code?:string|null;correct?:boolean|null;correct_code?:string;correct_label?:string;explanation?:string;distribution?:ConsultDistribution[]|null;total_votes?:number|null;xp_awarded?:number};
type CollectionCard={key:string;name:string;kind:'herb'|'syndrome';points:number;tier:number;unlocked:boolean;badge:string};
type CollectionState={xp:number;title:string;herbs:CollectionCard[];syndromes:CollectionCard[]};

type Props={member:Member;onClinicRefresh?:()=>void};
type BoundaryProps={children:ReactNode};
type BoundaryState={failed:boolean};

class V15Boundary extends Component<BoundaryProps,BoundaryState>{
  state:BoundaryState={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<section className="hyq-v15-fallback" role="status"><b>Thử thách V15 tạm thời chưa khả dụng.</b><span>HIU Y Quán cốt lõi vẫn hoạt động bình thường. Hãy tiếp tục khám bệnh và thử lại sau.</span></section>:this.props.children}
}

const tabs:{id:EngagementTab;label:string;sub:string}[]=[
  {id:'daily',label:'Ca trực hôm nay',sub:'3 nhiệm vụ · chuỗi ngày'},
  {id:'herb',label:'Tủ thuốc 60s',sub:'8 câu · combo · XP'},
  {id:'busy',label:'Đông khách',sub:'Tự chọn · tối đa 3 ca'},
  {id:'consult',label:'Hội chẩn HIU',sub:'1 ca chung mỗi ngày'},
  {id:'collection',label:'Bộ sưu tập',sub:'Mastery dược liệu · thể bệnh'}
];

const remainingSeconds=(iso?:string)=>iso?Math.max(0,Math.ceil((Date.parse(iso)-Date.now())/1000)):0;
const tierMarks=['Chưa mở','I','II','III','IV'];

function Inner({member,onClinicRefresh}:Props){
  const [tab,setTab]=useState<EngagementTab>('daily');
  const [engagement,setEngagement]=useState<Engagement|null>(null);
  const [challenge,setChallenge]=useState<Challenge|null>(null);
  const [consult,setConsult]=useState<Consult|null>(null);
  const [collection,setCollection]=useState<CollectionState|null>(null);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [lastAnswer,setLastAnswer]=useState<{correct:boolean;xp:number}|null>(null);
  const [nowTick,setNowTick]=useState(Date.now());

  const safeCall=async<T,>(name:string,args?:Record<string,unknown>):Promise<T>=>{
    const {data,error}=await supabase.rpc(name,args||{});
    if(error)throw error;
    return data as T;
  };
  const loadEngagement=async(silent=false)=>{try{const data=await safeCall<Engagement>('hiu_y_quan_engagement_v15');setEngagement(data);if(!silent)setMessage('')}catch(e){if(!silent)setMessage((e as Error).message||'Không tải được tiến độ V15.')}};
  const loadConsult=async(silent=false)=>{try{setConsult(await safeCall<Consult>('hiu_y_quan_consult_today_v15'));if(!silent)setMessage('')}catch(e){if(!silent)setMessage((e as Error).message||'Không tải được Hội chẩn HIU.')}};
  const loadCollection=async(silent=false)=>{try{setCollection(await safeCall<CollectionState>('hiu_y_quan_collection_v15'));if(!silent)setMessage('')}catch(e){if(!silent)setMessage((e as Error).message||'Không tải được bộ sưu tập.')}};

  useEffect(()=>{void loadEngagement(true);void loadConsult(true)},[]);
  useEffect(()=>{if(tab==='collection'&&!collection)void loadCollection()},[tab,collection]);
  useEffect(()=>{const t=window.setInterval(()=>setNowTick(Date.now()),1000);return()=>window.clearInterval(t)},[]);

  const timeLeft=useMemo(()=>challenge&&!challenge.finished?Math.max(0,Math.ceil((Date.parse(challenge.expires_at)-nowTick)/1000)):0,[challenge,nowTick]);
  const doneMissions=engagement?.missions.filter(x=>x.done).length||0;

  const startChallenge=async()=>{if(busy)return;setBusy('herb');setMessage('');setLastAnswer(null);try{const next=await safeCall<Challenge>('hiu_y_quan_herb_challenge_start_v15');setChallenge(next);if(next.finished)setMessage(next.expired?'Thử thách hôm nay đã hết 60 giây. Ngày mai sẽ có bộ câu mới.':'Thử thách chính thức hôm nay đã hoàn tất.');}catch(e){setMessage((e as Error).message)}finally{setBusy('')}};
  const answerChallenge=async(index:number)=>{if(!challenge||challenge.finished||busy||timeLeft<=0)return;setBusy('herb-answer');try{const next=await safeCall<Challenge>('hiu_y_quan_herb_challenge_answer_v15',{p_session_id:challenge.session_id,p_selected_index:index});setLastAnswer(typeof next.correct==='boolean'?{correct:next.correct,xp:Number(next.xp_awarded||0)}:null);setChallenge({...challenge,...next});if(next.finished){setMessage(next.expired?'Hết 60 giây. Kết quả đã khóa ở máy chủ.':`Hoàn tất thử thách: ${next.score}/8 · combo tốt nhất ${next.best_combo}.`);void loadEngagement(true);void loadCollection(true)}}catch(e){setMessage((e as Error).message)}finally{setBusy('')}};
  const claimDaily=async()=>{if(busy)return;setBusy('claim');setMessage('');try{const data=await safeCall<{ok:boolean;reason?:string;xp_awarded?:number;engagement?:Engagement}>('hiu_y_quan_daily_claim_v15');if(data.engagement)setEngagement(data.engagement);else await loadEngagement(true);setMessage(data.ok?data.xp_awarded?`Đã nhận +${data.xp_awarded} XP và cập nhật chuỗi ngày.`:'Phần thưởng hôm nay đã được nhận trước đó.':data.reason||'Chưa thể nhận phần thưởng.')}catch(e){setMessage((e as Error).message)}finally{setBusy('')}};
  const activateBusy=async()=>{if(busy)return;setBusy('busy');setMessage('');try{const data=await safeCall<{ok:boolean;added:boolean;message?:string;reason?:string;active_cases?:number}>('hiu_y_quan_busy_shift_v15');setMessage(data.message||data.reason||`Hiện có ${data.active_cases||0} ca trong giờ này.`);if(data.added)onClinicRefresh?.();}catch(e){setMessage((e as Error).message)}finally{setBusy('')}};
  const voteConsult=async(code:string)=>{if(!consult||consult.voted||busy)return;setBusy('consult');setMessage('');try{const data=await safeCall<Consult>('hiu_y_quan_consult_vote_v15',{p_selected_code:code});setConsult(data);setMessage(data.correct?`Hội chẩn chính xác · +${data.xp_awarded||10} XP.`:`Đã khóa lựa chọn hội chẩn · +${data.xp_awarded||5} XP tham gia.`);void loadEngagement(true);void loadCollection(true)}catch(e){setMessage((e as Error).message)}finally{setBusy('')}};
  const refreshAll=async()=>{if(busy)return;setBusy('refresh');await Promise.allSettled([loadEngagement(true),loadConsult(true),loadCollection(true)]);setBusy('');setMessage('Đã đồng bộ tiến độ V15 với máy chủ.')};

  return <section className="hyq-v15" aria-label="HIU Y Quán V15 tương tác hằng ngày">
    <header className="hyq-v15-head"><div><span className="hyq-v15-kicker"><Zap/> V15 · ENGAGEMENT LOOP</span><h3>Thử thách học tập HIU Y Quán</h3><p>XP và mastery tách biệt tín dụng Gia Viên. Tất cả ca, hội chẩn và thử thách là mô phỏng giáo dục.</p></div><button type="button" className="hyq-v15-refresh" disabled={Boolean(busy)} onClick={()=>void refreshAll()}><RefreshCw/>Đồng bộ</button></header>

    <div className="hyq-v15-status">
      <article><Trophy/><span><small>XP</small><b>{engagement?.xp??0}</b></span></article>
      <article><Award/><span><small>Cấp</small><b>{engagement?.level??1}</b></span></article>
      <article><Flame/><span><small>Chuỗi ngày</small><b>{engagement?.streak_days??0}</b></span></article>
      <article><Layers3/><span><small>Mastery mở</small><b>{engagement?.mastery_unlocked??0}</b></span></article>
      <div className="hyq-v15-rank"><span>{engagement?.title||'Học đồ HIU'}</span><small>{member.herbalAlias||member.fullName}</small></div>
    </div>

    {message&&<div className="hyq-v15-message" role="status">{message}</div>}

    <nav className="hyq-v15-tabs" role="tablist" aria-label="Các thử thách V15">{tabs.map(item=><button key={item.id} role="tab" aria-selected={tab===item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><b>{item.label}</b><small>{item.sub}</small></button>)}</nav>

    {tab==='daily'&&<section className="hyq-v15-panel hyq-v15-daily"><header><div><BookOpenCheck/><span><b>Ca trực hôm nay</b><small>{doneMissions}/3 nhiệm vụ hoàn tất · mốc ngày Việt Nam</small></span></div><strong>+25 XP</strong></header><div className="hyq-v15-missions">{(engagement?.missions||[]).map(m=><article key={m.key} className={m.done?'done':''}><span>{m.done?<CheckCircle2/>:<Clock3/>}</span><div><b>{m.label}</b><small>{m.current}/{m.target}</small><i><em style={{width:`${Math.min(100,m.current/m.target*100)}%`}}/></i></div></article>)}</div><button type="button" className="hyq-v15-primary" disabled={Boolean(busy)||!engagement?.can_claim||engagement?.daily_claimed} onClick={()=>void claimDaily()}>{engagement?.daily_claimed?'Đã nhận thưởng hôm nay':engagement?.can_claim?'Nhận +25 XP':'Hoàn tất đủ 3 nhiệm vụ để nhận'}</button></section>}

    {tab==='herb'&&<section className="hyq-v15-panel hyq-v15-herb"><header><div><Sparkles/><span><b>Thử thách Tủ thuốc 60 giây</b><small>1 lượt chính thức/ngày · 8 câu · +2 XP/câu đúng</small></span></div>{challenge&&!challenge.finished&&<strong className={timeLeft<=10?'urgent':''}>{String(Math.floor(timeLeft/60)).padStart(2,'0')}:{String(timeLeft%60).padStart(2,'0')}</strong>}</header>{!challenge?<div className="hyq-v15-empty"><BrainCircuit/><b>Sẵn sàng nhận diện dược liệu?</b><p>Câu hỏi dùng Tính vị, Quy kinh và Công năng từ tủ thuốc HIU Y Quán.</p><button type="button" className="hyq-v15-primary" disabled={Boolean(busy)} onClick={()=>void startChallenge()}>{busy==='herb'?'Đang tạo thử thách…':'Bắt đầu 60 giây'}</button></div>:challenge.finished?<div className="hyq-v15-score"><Trophy/><b>{challenge.score}/8 câu đúng</b><span>Combo tốt nhất: {challenge.best_combo} · lượt chính thức hôm nay đã khóa</span><button type="button" onClick={()=>setTab('collection')}>Xem mastery vừa mở</button></div>:<div className="hyq-v15-question"><div className="hyq-v15-question-meta"><span>Câu {challenge.current_index+1}/8</span><span>Điểm {challenge.score}</span><span>Combo ×{challenge.combo}</span></div><h4>{challenge.question?.name}</h4><p>{challenge.question?.prompt}</p>{lastAnswer&&<div className={`hyq-v15-answer-flash ${lastAnswer.correct?'ok':'miss'}`}>{lastAnswer.correct?`Chính xác · +${lastAnswer.xp} XP`:'Chưa đúng · combo về 0'}</div>}<div className="hyq-v15-options">{(challenge.question?.options||[]).map((option,index)=><button key={`${challenge.current_index}-${index}`} disabled={Boolean(busy)||timeLeft<=0} onClick={()=>void answerChallenge(index)}>{option}</button>)}</div>{timeLeft<=0&&<button type="button" className="hyq-v15-primary" onClick={()=>void startChallenge()}>Khóa kết quả hết giờ</button>}</div>}</section>}

    {tab==='busy'&&<section className="hyq-v15-panel hyq-v15-busy"><header><div><Swords/><span><b>Phòng khám đông khách</b><small>Chế độ tự chọn quản lý tải học tập · không phải phân loại cấp cứu</small></span></div><strong>Cấp {engagement?.level||1}</strong></header><div className="hyq-v15-busy-grid"><article><Stethoscope/><b>1 ca bổ sung</b><p>Thêm tối đa bệnh nhân mô phỏng thứ ba vào giờ hiện tại. Ca này dùng nguyên vòng Tứ chẩn → Dưỡng Trị → Sổ bệnh án V14.</p></article><article><Zap/><b>Không đổi luật thưởng</b><p>Chẩn đúng vẫn theo tín dụng hiện hữu; V15 không cộng thêm hay nhân đôi tín dụng Gia Viên.</p></article><article><Layers3/><b>Idempotent</b><p>Nhấn lại không sinh trùng. Nếu giờ này đã đủ 3 ca, hệ thống chỉ trả trạng thái hiện có.</p></article></div><button type="button" className="hyq-v15-primary" disabled={Boolean(busy)||!engagement?.busy_shift_available} onClick={()=>void activateBusy()}>{busy==='busy'?'Đang mở ca…':'Kích hoạt Ca đông khách giờ này'}</button></section>}

    {tab==='consult'&&<section className="hyq-v15-panel hyq-v15-consult"><header><div><BrainCircuit/><span><b>Hội chẩn HIU hôm nay</b><small>Một ca mô phỏng chung · mỗi thành viên khóa 1 lựa chọn/ngày</small></span></div>{consult?.voted&&<strong>{consult.correct?'Đúng':'Đã tham gia'}</strong>}</header>{!consult?<div className="hyq-v15-empty"><RefreshCw/><b>Đang chờ dữ liệu hội chẩn</b><button onClick={()=>void loadConsult()}>Tải lại</button></div>:<><div className="hyq-v15-four"><article><b>VỌNG</b><p>{consult.vong}</p></article><article><b>VĂN</b><p>{consult.van_am}</p></article><article><b>VẤN</b><p>{consult.van_hoi}</p></article><article><b>THIẾT</b><p>{consult.thiet}</p></article></div><div className="hyq-v15-consult-options">{consult.options.map(option=><button key={option.code} disabled={Boolean(busy)||consult.voted} className={consult.voted&&consult.selected_code===option.code?'selected':''} onClick={()=>void voteConsult(option.code)}>{option.label}</button>)}</div>{consult.voted&&<div className={`hyq-v15-consult-result ${consult.correct?'ok':'review'}`}><b>Đáp án chuẩn: {consult.correct_label}</b><p>{consult.explanation}</p><small>Tổng {consult.total_votes||0} lượt hội chẩn đã khóa.</small></div>}{consult.voted&&<div className="hyq-v15-distribution">{(consult.distribution||[]).map(row=><article key={row.code}><div><span>{row.label}</span><b>{row.percent}%</b></div><i><em style={{width:`${Math.min(100,row.percent)}%`}}/></i><small>{row.votes} lượt chọn</small></article>)}</div>}</>}</section>}

    {tab==='collection'&&<section className="hyq-v15-panel hyq-v15-collection"><header><div><Award/><span><b>Bộ sưu tập mastery</b><small>Thẻ học tập và danh hiệu trong V15 · không ghi vào kho Gia Viên</small></span></div><strong>{collection?.title||engagement?.title||'Học đồ HIU'}</strong></header>{!collection?<div className="hyq-v15-empty"><RefreshCw/><b>Đang tải bộ sưu tập…</b></div>:<><h4>Dược liệu</h4><div className="hyq-v15-card-grid">{collection.herbs.map(card=><article key={card.key} className={card.unlocked?'unlocked':'locked'}><span>{tierMarks[card.tier]||card.tier}</span><b>{card.name}</b><small>{card.badge} · {card.points} mastery</small></article>)}</div><h4>Thể bệnh</h4><div className="hyq-v15-card-grid syndrome">{collection.syndromes.map(card=><article key={card.key} className={card.unlocked?'unlocked':'locked'}><span>{tierMarks[card.tier]||card.tier}</span><b>{card.name}</b><small>{card.badge} · {card.points} mastery</small></article>)}</div></>}</section>}

    <footer className="hyq-v15-safety">HIU Y Quán V15 là mô phỏng học tập. Không sử dụng kết quả game để chẩn đoán, kê đơn hoặc quyết định xử trí cho người bệnh thực tế.</footer>
  </section>;
}

export default function HiuYQuanEngagementV15(props:Props){return <V15Boundary><Inner {...props}/></V15Boundary>}
