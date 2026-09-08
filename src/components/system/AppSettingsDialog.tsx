import {useEffect,useState} from 'react';
import {CheckCircle2,Download,MonitorSmartphone,Settings,X} from 'lucide-react';
import ViewportModeToggle,{type ViewportMode} from './ViewportModeToggle';
import {getPwaInstallStatus,requestPwaInstall,subscribePwaInstall,type PwaInstallStatus} from '../../services/pwaInstallService';

export default function AppSettingsDialog({open,onClose,viewportMode,onViewportChange}:{open:boolean;onClose:()=>void;viewportMode:ViewportMode;onViewportChange:(mode:ViewportMode)=>void}){
  const [status,setStatus]=useState<PwaInstallStatus>(()=>getPwaInstallStatus()),[message,setMessage]=useState('');
  useEffect(()=>subscribePwaInstall(()=>setStatus(getPwaInstallStatus())),[]);
  useEffect(()=>{if(open){setStatus(getPwaInstallStatus());setMessage('')}},[open]);
  if(!open)return null;
  const install=async()=>{setMessage('');const result=await requestPwaInstall();setStatus(getPwaInstallStatus());if(result.status==='accepted')setMessage('Chrome đã chấp nhận yêu cầu cài đặt ứng dụng.');else if(result.status==='dismissed')setMessage('Bạn đã đóng hộp thoại cài đặt. Có thể thử lại sau.');else if(result.status==='installed')setMessage('Ứng dụng đã được cài trên thiết bị.');else setMessage('Chrome chưa phát tín hiệu cài đặt. Hãy mở bản production bằng Chrome và dùng mục “Cài đặt ứng dụng” của trình duyệt nếu nút này chưa sẵn sàng.')};
  return <div className="app-settings-backdrop" onMouseDown={onClose}><section className="app-settings-dialog" role="dialog" aria-modal="true" aria-label="Cài đặt ứng dụng" onMouseDown={e=>e.stopPropagation()}>
    <header><div><Settings/><span><b>Cài đặt</b><small>Ứng dụng YHCT HIU 4.0</small></span></div><button className="icon-btn" onClick={onClose} aria-label="Đóng cài đặt"><X/></button></header>
    <article className="app-install-card"><div className="row"><MonitorSmartphone/><div><h3>Cài ứng dụng mạng xã hội</h3><p>Cài dưới dạng PWA độc lập của Chrome, chạy ở chế độ <b>standalone</b>; đây không phải lối tắt web thông thường.</p></div></div>{status==='installed'?<div className="install-ready"><CheckCircle2/> Đã cài đặt trên thiết bị</div>:status==='available'?<button className="install-primary" onClick={()=>void install()}><Download/>Cài ứng dụng</button>:<><button className="install-primary" onClick={()=>void install()}><Download/>Kiểm tra khả năng cài đặt</button><small>Chrome chỉ phát lời mời cài khi ứng dụng đáp ứng HTTPS + manifest + service worker và chưa được cài trước đó.</small></>}{message&&<div className="ai-note" role="status">{message}</div>}</article>
    <article className="app-display-card"><div><h3>Chế độ hiển thị</h3><p>Chọn bố cục phù hợp thiết bị; theme màu sắc vẫn đồng bộ toàn hệ thống.</p></div><ViewportModeToggle mode={viewportMode} onChange={onViewportChange} className="viewport-toggle--settings"/></article>
  </section></div>;
}
