/**
 * Tự động nạp tài liệu mới trong thư mục Drive "Thêm thủ công" vào ngân hàng câu hỏi.
 * Chạy nền cho tài khoản quản lý học tập (chính nhóm đã được máy chủ cho phép gọi `trusted-quiz-sync`),
 * dùng đúng đường nạp có sẵn nên vẫn chỉ nhận câu đủ A–D + đúng một đáp án tô đỏ.
 * Mặc định BẬT. Tắt khẩn cấp: đặt biến môi trường Vercel VITE_QUIZ_AUTO_SYNC=0 rồi deploy lại.
 */
export const QUIZ_AUTO_SYNC_INTERVAL_MS=15*60*1000;
const STORAGE_KEY='hiu-quiz-auto-sync-last';

export const quizAutoSyncEnabled=():boolean=>{
  try{return String(import.meta.env?.VITE_QUIZ_AUTO_SYNC??'1').trim()!=='0'}catch{return true}
};

/** Hàm thuần: có nên chạy lần tiếp theo chưa. */
export const shouldRunQuizAutoSync=(now:number,last:number,interval=QUIZ_AUTO_SYNC_INTERVAL_MS):boolean=>
  !Number.isFinite(last)||last<=0||now-last>=interval||now<last;

const readLast=():number=>{try{return Number(localStorage.getItem(STORAGE_KEY))||0}catch{return 0}};
const writeLast=(value:number)=>{try{localStorage.setItem(STORAGE_KEY,String(value))}catch{/* storage unavailable */}};

let inflight:Promise<void>|null=null;

/** Chạy một lượt nếu đã đủ giãn cách; không bao giờ ném lỗi, không chạy chồng. */
export function runQuizAutoSync(now=Date.now()):Promise<void>{
  if(!quizAutoSyncEnabled())return Promise.resolve();
  if(inflight)return inflight;
  if(!shouldRunQuizAutoSync(now,readLast()))return Promise.resolve();
  writeLast(now);
  inflight=(async()=>{
    try{
      const {syncQuizBank}=await import('./quizWorkspaceService');
      const result=await syncQuizBank(10);
      // Có lỗi vận chuyển/Drive: cho phép thử lại sớm hơn thay vì chờ đủ chu kỳ.
      if(result.ok===false||Number(result.errors||0)>0)writeLast(0);
    }catch{writeLast(0)}
    finally{inflight=null}
  })();
  return inflight;
}

/** Bắt đầu vòng tự động; trả về hàm dừng. */
export function startQuizAutoSync(){
  if(!quizAutoSyncEnabled())return()=>{};
  let live=true;
  const tick=()=>{if(live&&document.visibilityState!=='hidden')void runQuizAutoSync()};
  const first=window.setTimeout(tick,20000);
  const interval=window.setInterval(tick,QUIZ_AUTO_SYNC_INTERVAL_MS);
  const onVisible=()=>{if(document.visibilityState==='visible')tick()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{live=false;window.clearTimeout(first);window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible)};
}
