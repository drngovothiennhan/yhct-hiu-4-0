import {Check,Sparkles} from 'lucide-react';
import {THEME_OPTIONS,type ThemeName} from '../../theme';

export default function AdminThemeControl({theme,onChange}:{theme:ThemeName;onChange:(theme:ThemeName)=>void}){
  const current=THEME_OPTIONS.find(option=>option.id===theme)||THEME_OPTIONS[0];
  return <section className="panel acc-theme-control acc-theme-control--compact" aria-label="Giao diện hệ thống dành cho Admin">
    <div className="between"><div className="row"><Sparkles/><div><h3>Giao diện hệ thống</h3><p className="muted">Chỉ ACC/Admin thay đổi. Số lượng theme được giữ nguyên; module khác chỉ nhận theme đồng bộ và không sở hữu cấu hình giao diện.</p></div></div><span className="badge">{THEME_OPTIONS.length} theme</span></div>
    <div className="acc-theme-current"><div><small>Đang dùng</small><b>{current.name}</b></div><div className="theme-swatches">{current.swatches.map(color=><i key={color} style={{backgroundColor:color}}/>)}</div></div>
    <div className="acc-theme-compact-grid">{THEME_OPTIONS.map(option=><button type="button" key={option.id} className={theme===option.id?'active':''} onClick={()=>onChange(option.id)} aria-pressed={theme===option.id}><span><b>{option.name}</b><small>{option.description}</small></span>{theme===option.id&&<Check/>}</button>)}</div>
  </section>;
}
