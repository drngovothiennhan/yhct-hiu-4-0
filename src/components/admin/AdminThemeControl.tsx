import {Check,Sparkles} from 'lucide-react';
import {THEME_OPTIONS,type ThemeName} from '../../theme';

const USE_CASE:Record<ThemeName,string>={
  'duoc-ngoc':'Mặc định · học thuật & điều hành',
  'muc-tuyen':'Đọc dài · nghiên cứu · luyện thi',
  'ngu-y':'Hội nghị · quản trị trang trọng',
  'tcm-cartoon-2d':'Trẻ trung · CLB · thiết bị nhẹ',
  'tcm-isometric-3d':'Desktop mạnh · trình diễn ACC'
};
export default function AdminThemeControl({theme,onChange}:{theme:ThemeName;onChange:(theme:ThemeName)=>void}){
  return <section className="panel acc-theme-control" aria-label="Bảng giao diện YHCT dành cho Admin">
    <div className="row"><Sparkles/><div><h3>Bảng giao diện YHCT</h3><p className="muted">Admin chọn giao diện cho phiên quản trị hiện tại. Thiết bị yếu vẫn được bộ tối ưu phần cứng tự giảm hiệu ứng nặng.</p></div></div>
    <div className="theme-legacy-shortcuts" aria-label="Preset nhanh"><button type="button" className={theme==='tcm-cartoon-2d'?'active':''} onClick={()=>onChange('tcm-cartoon-2d')}>2D Flat YHCT</button><button type="button" className={theme==='tcm-isometric-3d'?'active':''} onClick={()=>onChange('tcm-isometric-3d')}>3D Isometric YHCT</button></div>
    <div className="theme-choice-grid">{THEME_OPTIONS.map(opt=><button type="button" key={opt.id} className={theme===opt.id?'active':''} onClick={()=>onChange(opt.id)} aria-pressed={theme===opt.id}><div className="theme-choice-title"><b>{opt.name}</b>{theme===opt.id&&<Check/>}</div><div className="theme-swatches">{opt.swatches.map(c=><i key={c} style={{backgroundColor:c}}/>)}</div><small>{opt.description}</small><span>{USE_CASE[opt.id]}</span></button>)}</div>
    <div className="theme-matrix" role="table" aria-label="Bảng khuyến nghị giao diện"><div role="row" className="theme-matrix-head"><b>Giao diện</b><b>Khuyến nghị</b></div>{THEME_OPTIONS.map(opt=><div role="row" key={opt.id}><span>{opt.name}</span><span>{USE_CASE[opt.id]}</span></div>)}</div>
  </section>;
}
