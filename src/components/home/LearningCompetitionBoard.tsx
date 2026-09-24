import {useEffect,useMemo,useState} from 'react';
import {Award,RefreshCw,Trophy} from 'lucide-react';
import {supabase} from '../../services/authService';
import styles from './LearningCompetitionBoard.module.css';

type Entry={
  rank:number;
  member_id:string;
  full_name:string;
  avatar_url?:string|null;
  role:string;
  verified_points:number;
  verified_questions:number;
  verified_correct:number;
  accuracy:number;
  active_days:number;
  submissions:number;
  latest_activity?:string|null;
  synced_streak:number;
};

const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(-2).map(x=>x[0]).join('').toUpperCase();

export default function LearningCompetitionBoard({memberId}:{memberId:string|null}){
  const [rows,setRows]=useState<Entry[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const load=async()=>{
    if(!memberId){setRows([]);return}
    setLoading(true);setError('');
    try{
      const {data,error}=await supabase.rpc('learning_competition_leaderboard_v1',{p_days:30,p_limit:20});
      if(error)throw error;
      setRows(Array.isArray(data)?data as Entry[]:[]);
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không tải được bảng thi đua.');
    }finally{setLoading(false)}
  };

  useEffect(()=>{
    void load();
    const onSynced=()=>void load();
    window.addEventListener('yhct:learning-cloud-synced',onSynced);
    return()=>window.removeEventListener('yhct:learning-cloud-synced',onSynced);
  },[memberId]);

  const mine=useMemo(()=>rows.find(row=>row.member_id===memberId)||null,[rows,memberId]);
  const top=rows.slice(0,5);

  if(!memberId)return null;

  return <section className={styles.root} aria-label="Thi đua học tập toàn hệ thống">
    <header className={styles.header}>
      <div><span><Trophy/> THI ĐUA 30 NGÀY</span><h3>Bảng học tập toàn hệ thống</h3><p>Chỉ tính dữ liệu quiz đã được server xác minh.</p></div>
      <button onClick={()=>void load()} disabled={loading} aria-label="Làm mới bảng thi đua"><RefreshCw/></button>
    </header>

    {mine&&<article className={styles.mine}>
      <span className={styles.rank}>#{mine.rank}</span>
      <div><small>HẠNG CỦA BẠN</small><strong>{mine.verified_points} điểm xác minh</strong><em>{mine.verified_questions} câu · {mine.accuracy}% đúng · {mine.active_days} ngày hoạt động</em></div>
      <Award/>
    </article>}

    {error?<p className={styles.error}>{error}</p>:<div className={styles.list}>
      {top.map(row=><article key={row.member_id} className={row.member_id===memberId?styles.current:''}>
        <b className={styles.rank}>#{row.rank}</b>
        <span className={styles.avatar}>{row.avatar_url?<img src={row.avatar_url} alt=""/>:initials(row.full_name)}</span>
        <span className={styles.copy}><strong>{row.full_name}</strong><small>{row.verified_questions} câu · {row.accuracy}% đúng · {row.active_days} ngày</small></span>
        <em>{row.verified_points}</em>
      </article>)}
      {!loading&&!top.length&&<p className={styles.empty}>Chưa có lượt quiz đã xác minh trong 30 ngày gần đây.</p>}
      {loading&&<p className={styles.empty}>Đang cập nhật bảng thi đua…</p>}
    </div>}
  </section>;
}
