import {useEffect,useMemo,useState} from 'react';
import {Award,BookOpenCheck,Brain,Flame,GraduationCap,RefreshCw,Sparkles,Trophy} from 'lucide-react';
import type {Member} from '../../types';
import {readStudentJourney,subscribeStudentJourney,type StudentJourney} from '../../services/studentJourneyService';
import {fetchHiuYQuanProfileProgress,type HiuYQuanProfileProgress} from '../../services/profileAchievementService';
import './profile-achievements.css';

type Props={member:Member};

const moduleCount=(journey:StudentJourney)=>Object.values(journey.visitedModules||{}).filter(Boolean).length;

export default function ProfileAchievements({member}:Props){
  const [journey,setJourney]=useState(()=>readStudentJourney(member.id));
  const [game,setGame]=useState<HiuYQuanProfileProgress|null>(null);
  const [gameBusy,setGameBusy]=useState(true);
  const [gameUnavailable,setGameUnavailable]=useState(false);

  useEffect(()=>{const next=readStudentJourney(member.id);setJourney(next);return subscribeStudentJourney(member.id,setJourney)},[member.id]);
  const syncGame=async()=>{setGameBusy(true);setGameUnavailable(false);try{setGame(await fetchHiuYQuanProfileProgress())}catch{setGame(null);setGameUnavailable(true)}finally{setGameBusy(false)}};
  useEffect(()=>{void syncGame()},[member.id]);

  const visited=useMemo(()=>moduleCount(journey),[journey.visitedModules]);
  const score=typeof journey.lastExamScore==='number'?`${journey.lastExamScore}%`:'—';

  return <article className="profile-achievements-card" aria-label="Thành tích học tập">
    <header className="profile-achievements-head"><div><span><Sparkles/></span><div><h3>Thành tích học tập</h3><p>Tiến độ học trên thiết bị này và danh hiệu HIU Y Quán được xác nhận từ máy chủ.</p></div></div><button type="button" onClick={()=>void syncGame()} disabled={gameBusy}><RefreshCw/>Đồng bộ game</button></header>

    <section className="profile-learning-progress" aria-label="Tiến độ học trên thiết bị này">
      <div className="profile-achievements-label"><BookOpenCheck/><span><b>Tiến độ học</b><small>Lưu trên thiết bị này</small></span></div>
      <div className="profile-achievement-grid">
        <article><Flame/><span><b>{journey.streak}</b><small>ngày học liên tiếp</small></span></article>
        <article><Trophy/><span><b>{journey.xp}</b><small>XP học tập</small></span></article>
        <article><GraduationCap/><span><b>{journey.examAttempts}</b><small>lượt luyện/thi</small></span></article>
        <article><Award/><span><b>{score}</b><small>điểm lần gần nhất</small></span></article>
        <article><Brain/><span><b>{journey.aiUses}</b><small>lượt dùng trợ lý</small></span></article>
        <article><BookOpenCheck/><span><b>{visited}</b><small>module đã mở</small></span></article>
      </div>
    </section>

    <section className="profile-game-progress" aria-label="Tiến độ HIU Y Quán">
      <div className="profile-achievements-label"><Award/><span><b>HIU Y Quán</b><small>Tiến độ do máy chủ game xác nhận</small></span></div>
      {gameBusy&&<div className="profile-game-sync" role="status">Đang đồng bộ danh hiệu HIU Y Quán…</div>}
      {!gameBusy&&game&&<div className="profile-game-title"><div><small>DANH HIỆU HIỆN TẠI</small><strong>{game.title}</strong><span>Cấp {game.level} · {game.xp} XP</span></div><div className="profile-game-metrics"><span><b>{game.streakDays}</b><small>chuỗi ngày game</small></span><span><b>{game.masteryUnlocked}</b><small>mastery đã mở</small></span></div></div>}
      {!gameBusy&&gameUnavailable&&<div className="profile-game-sync profile-game-sync--muted">Chưa đồng bộ được HIU Y Quán. Hồ sơ và tiến độ học vẫn hoạt động bình thường.</div>}
    </section>
  </article>;
}
