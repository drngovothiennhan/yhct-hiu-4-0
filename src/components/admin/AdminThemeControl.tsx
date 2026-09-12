import {Check,Sparkles} from 'lucide-react';
import {THEME_OPTIONS,type ThemeName} from '../../theme';

// Module isolation contract: module khác chỉ nhận theme đồng bộ.
export default function AdminThemeControl({theme,onChange}:{theme:ThemeName;onChange:(theme:ThemeName)=>void}){
  const current=THEME_OPTIONS.find(option=>option.id===theme)||THEME_OPTIONS[0];
  return <section className="panel acc-theme-control acc-theme-control--compact" aria-label="Giao diện hệ thống dành cho Admin">
    <div className="between acc-theme-title"><div className="row"><Sparkles/><h3>Giao diện hệ thống</h3></div><span className="badge">{current.name} · {THEME_OPTIONS.length}</span></div>
    <div className="acc-theme-compact-grid">{THEME_OPTIONS.map(option=><button type="button" key={option.id} className={theme===option.id?'active':''} onClick={()=>onChange(option.id)} aria-pressed={theme===option.id}><span><b>{option.name}</b></span><span className="theme-swatches">{option.swatches.slice(0,3).map(color=><i key={color} style={{backgroundColor:color}}/>)}</span>{theme===option.id&&<Check/>}</button>)}</div>
  </section>;
}