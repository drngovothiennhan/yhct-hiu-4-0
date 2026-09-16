import {useEffect,useState} from 'react';
import {CheckCircle2,Mail,RefreshCw,UserPlus,X} from 'lucide-react';
import {readCachedMember,supabase} from '../../services/authService';
import {registerMemberSelf,resendMemberActivation} from '../../services/authRuntimeService';

const initialForm={studentCode:'',fullName:'',className:'',faculty:'',email:'',password:'',confirmPassword:''};

export default function SelfRegistrationPortal(){
  const [hidden,setHidden]=useState(()=>Boolean(readCachedMember()));
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState(initialForm);
  const [busy,setBusy]=useState(false);
  const [resendBusy,setResendBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState(false);
  const [activationNotice,setActivationNotice]=useState(()=>new URLSearchParams(window.location.search).get('member_activation')==='done');

  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&session)setHidden(true);
      if(event==='SIGNED_OUT')setHidden(false);
    });
    return()=>subscription.unsubscribe();
  },[]);

  const setField=(key:keyof typeof initialForm,value:string)=>setForm(current=>({...current,[key]:value}));
  const close=()=>{if(busy)return;setOpen(false);setError('')};
  const submit=async()=>{
    if(busy)return;
    setError('');
    const studentCode=form.studentCode.replace(/\s/g,'');
    if(!/^\d{8,14}$/.test(studentCode)){setError('MSSV phải gồm 8–14 chữ số.');return}
    if(form.fullName.trim().length<2){setError('Vui lòng nhập họ tên đầy đủ.');return}
    if(!form.className.trim()){setError('Vui lòng nhập lớp.');return}
    if(!form.faculty.trim()){setError('Vui lòng nhập khoa.');return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())){setError('Email kích hoạt không hợp lệ.');return}
    if(form.password.length<8){setError('Mật khẩu phải có ít nhất 8 ký tự.');return}
    if(form.password!==form.confirmPassword){setError('Mật khẩu nhập lại chưa khớp.');return}
    setBusy(true);
    try{
      await registerMemberSelf({studentCode,fullName:form.fullName,className:form.className,faculty:form.faculty,email:form.email,password:form.password});
      setForm(current=>({...current,studentCode,password:'',confirmPassword:''}));
      setSuccess(true);
    }catch(e){setError((e as Error).message||'Không thể đăng ký thành viên.')}finally{setBusy(false)}
  };
  const resend=async()=>{if(resendBusy||!form.email.trim())return;setResendBusy(true);setError('');try{await resendMemberActivation(form.email);setError('Email kích hoạt đã được gửi lại.')}catch(e){setError((e as Error).message)}finally{setResendBusy(false)}};

  if(hidden)return null;
  return <>
    {activationNotice&&<div className="member-activation-toast" role="status"><CheckCircle2/><span><b>Email đã được xác minh.</b><small>Bạn có thể đăng nhập bằng MSSV và mật khẩu đã tạo.</small></span><button onClick={()=>{setActivationNotice(false);const url=new URL(window.location.href);url.searchParams.delete('member_activation');window.history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`)}} aria-label="Đóng thông báo"><X/></button></div>}
    <button className="member-register-launch" onClick={()=>{setOpen(true);setSuccess(false);setError('')}}><UserPlus/><span>Đăng ký thành viên</span></button>
    {open&&<div className="member-register-backdrop" onMouseDown={close}><section className="member-register-dialog" role="dialog" aria-modal="true" aria-labelledby="member-register-title" onMouseDown={event=>event.stopPropagation()}>
      <button className="member-register-close" type="button" onClick={close} disabled={busy} aria-label="Đóng"><X/></button>
      {!success?<>
        <header><UserPlus/><div><h2 id="member-register-title">Đăng ký thành viên HIU YHCT</h2><p>MSSV là tên đăng nhập. Email dùng để kích hoạt tài khoản.</p></div></header>
        <form onSubmit={event=>{event.preventDefault();void submit()}}>
          <label>MSSV<input value={form.studentCode} onChange={e=>setField('studentCode',e.target.value)} inputMode="numeric" autoComplete="username" maxLength={14} placeholder="Mã số sinh viên" disabled={busy}/></label>
          <label>Họ và tên<input value={form.fullName} onChange={e=>setField('fullName',e.target.value)} autoComplete="name" maxLength={180} placeholder="Họ tên đầy đủ" disabled={busy}/></label>
          <div className="member-register-grid"><label>Lớp<input value={form.className} onChange={e=>setField('className',e.target.value)} maxLength={80} placeholder="Lớp" disabled={busy}/></label><label>Khoa<input value={form.faculty} onChange={e=>setField('faculty',e.target.value)} maxLength={120} placeholder="Khoa" disabled={busy}/></label></div>
          <label>Email kích hoạt<input value={form.email} onChange={e=>setField('email',e.target.value)} type="email" autoComplete="email" maxLength={254} placeholder="email@example.com" disabled={busy}/></label>
          <div className="member-register-grid"><label>Mật khẩu<input value={form.password} onChange={e=>setField('password',e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Tối thiểu 8 ký tự" disabled={busy}/></label><label>Nhập lại mật khẩu<input value={form.confirmPassword} onChange={e=>setField('confirmPassword',e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Nhập lại mật khẩu" disabled={busy}/></label></div>
          {error&&<div className="member-register-message" role="alert">{error}</div>}
          <button className="member-register-submit" type="submit" disabled={busy}>{busy?'Đang tạo đăng ký…':'Đăng ký & gửi mail kích hoạt'}</button>
          <small className="member-register-note">Tài khoản chỉ được mở sau khi xác minh email. Hệ thống tự kiểm tra trùng MSSV với danh sách do admin đã nạp.</small>
        </form>
      </>:<div className="member-register-success"><CheckCircle2/><h2>Đã ghi nhận đăng ký</h2><p>Email kích hoạt đã được gửi tới <b>{form.email}</b>. Hãy mở email và xác minh, sau đó đăng nhập bằng MSSV và mật khẩu bạn vừa tạo.</p>{error&&<div className="member-register-message" role="status">{error}</div>}<button type="button" className="secondary" onClick={()=>void resend()} disabled={resendBusy}><RefreshCw/>{resendBusy?'Đang gửi…':'Gửi lại email kích hoạt'}</button><button type="button" onClick={()=>{setOpen(false);setSuccess(false)}}><Mail/>Đóng</button></div>}
    </section></div>}
  </>;
}
