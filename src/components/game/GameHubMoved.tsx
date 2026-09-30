import {useState} from 'react';
import {Gamepad2,ArrowRight} from 'lucide-react';
import {openGameHubWithSession} from '../../services/authService';

/** Shown in place of the in-app games once VITE_GAME_HUB_URL is configured. */
export default function GameHubMoved({hubUrl}:{hubUrl:string}){
  const [opening,setOpening]=useState(false);
  const open=async()=>{if(opening)return;setOpening(true);try{await openGameHubWithSession(hubUrl)}finally{setOpening(false)}};
  return <section className="panel game-hub-moved" aria-labelledby="game-hub-moved-title" style={{display:'grid',gap:12,padding:24,maxWidth:640,margin:'24px auto',textAlign:'center'}}>
    <Gamepad2 aria-hidden style={{width:40,height:40,margin:'0 auto'}}/>
    <h2 id="game-hub-moved-title">Gia Viên Dược Thảo và HIU Y Quán đã chuyển sang Game Hub</h2>
    <p>Tiến độ, hạt giống, tín dụng và dược liệu của bạn được giữ nguyên. Mở Game Hub để tiếp tục chơi và nhận thưởng theo mốc.</p>
    <button type="button" onClick={()=>void open()} disabled={opening} style={{justifySelf:'center'}}>{opening?'Đang mở…':'Mở Game Hub'} <ArrowRight aria-hidden/></button>
  </section>;
}
