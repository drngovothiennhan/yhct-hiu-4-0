import {useEffect,useRef,useState} from 'react';
import {CloudCog,ExternalLink,KeyRound,ShieldCheck,X} from 'lucide-react';
import './drive-credential-guide.css';

type Props={visible:boolean};

const DRIVE_API_URL='https://console.cloud.google.com/apis/library/drive.googleapis.com';
const SERVICE_ACCOUNT_URL='https://console.cloud.google.com/iam-admin/serviceaccounts';

export default function DriveCredentialGuide({visible}:Props){
 const [open,setOpen]=useState(false);
 const prompted=useRef(false);
 useEffect(()=>{if(visible&&!prompted.current){prompted.current=true;setOpen(true)}},[visible]);
 useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open]);
 if(!visible)return null;
 return <>
  <button type="button" className="drive-guide-trigger" onClick={()=>setOpen(true)}><KeyRound/>Hướng dẫn lấy credential Google Drive</button>
  {open&&<div className="drive-guide-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
   <section className="drive-guide-modal" role="dialog" aria-modal="true" aria-labelledby="drive-guide-title">
    <header><div><span className="drive-guide-kicker"><CloudCog/>Kết nối Google Drive cho ACC</span><h3 id="drive-guide-title">Lấy credential Google Drive an toàn</h3></div><button type="button" className="drive-guide-close" aria-label="Đóng hướng dẫn" onClick={()=>setOpen(false)}><X/></button></header>
    <div className="drive-guide-recommended"><ShieldCheck/><div><b>Nên dùng Service Account JSON</b><span>Kho “Ngân hàng trắc nghiệm” và “Kho kiến thức YHCT” là dữ liệu riêng. API key thông thường không đủ quyền đọc thư mục riêng.</span></div></div>
    <ol>
     <li><div><b>Bật Google Drive API</b><p>Mở Google Cloud Console, chọn hoặc tạo project của HIU YHCT 4.0 rồi bật Google Drive API.</p><a href={DRIVE_API_URL} target="_blank" rel="noreferrer">Mở Google Drive API <ExternalLink/></a></div></li>
     <li><div><b>Tạo Service Account</b><p>Vào IAM &amp; Admin → Service Accounts → Create service account. Có thể đặt tên như <code>hiu-yhct-drive-reader</code>. Không cần cấp quyền rộng cho project.</p><a href={SERVICE_ACCOUNT_URL} target="_blank" rel="noreferrer">Mở Service Accounts <ExternalLink/></a></div></li>
     <li><div><b>Tạo khóa JSON</b><p>Mở service account vừa tạo → Keys → Add key → Create new key → JSON. Google sẽ tải một file <code>.json</code> xuống thiết bị.</p></div></li>
     <li><div><b>Chia sẻ đúng 2 thư mục Drive</b><p>Mở file JSON, lấy giá trị <code>client_email</code>. Trên Google Drive, chia sẻ “Ngân hàng trắc nghiệm” và “Kho kiến thức YHCT” cho email này với quyền <b>Viewer</b>. Không đưa file JSON lên Drive, GitHub hoặc giao diện web.</p></div></li>
     <li><div><b>Đưa secret vào Vercel</b><p>Trong Vercel của project, tạo biến môi trường <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> và dán <b>toàn bộ nội dung JSON</b> làm giá trị cho Production, sau đó redeploy. Secret chỉ nằm phía server.</p></div></li>
    </ol>
    <aside><b>Lưu ý:</b> <code>GOOGLE_DRIVE_API_KEY</code> chỉ phù hợp nội dung công khai; với Drive riêng, hãy dùng <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>.</aside>
    <footer><button type="button" className="secondary" onClick={()=>setOpen(false)}>Đóng</button><a className="drive-guide-primary" href={DRIVE_API_URL} target="_blank" rel="noreferrer">Bắt đầu tại Google Cloud <ExternalLink/></a></footer>
   </section>
  </div>}
 </>;
}
