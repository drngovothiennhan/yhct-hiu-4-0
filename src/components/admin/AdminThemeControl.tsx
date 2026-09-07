import { Layers3,Sparkles } from 'lucide-react';
import type { ThemeName } from '../../theme';

export default function AdminThemeControl({theme,onChange}:{theme:ThemeName;onChange:(theme:ThemeName)=>void}){
  return <section className="panel acc-theme-control" aria-label="Giao diện quản trị ACC">
    <div className="row"><Sparkles/><div><h3>Giao diện quản trị ACC</h3><p className="muted">Chỉ Admin thấy và thay đổi. Cấu hình lưu cục bộ cho phiên quản trị, không thay đổi phiên của thành viên khác.</p></div></div>
    <div className="acc-theme-toggle" role="group" aria-label="Chọn giao diện 2D hoặc 3D">
      <button type="button" className={theme==='tcm-cartoon-2d'?'active':''} onClick={()=>onChange('tcm-cartoon-2d')} aria-pressed={theme==='tcm-cartoon-2d'}><Sparkles/><b>2D Flat</b><small>Vector YHCT phẳng, sáng và nhẹ.</small></button>
      <button type="button" className={theme==='tcm-isometric-3d'?'active':''} onClick={()=>onChange('tcm-isometric-3d')} aria-pressed={theme==='tcm-isometric-3d'}><Layers3/><b>3D Isometric</b><small>Khối nổi, bóng tầng và chiều sâu quản trị.</small></button>
    </div>
  </section>;
}
