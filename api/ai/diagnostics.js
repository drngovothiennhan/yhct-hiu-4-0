import {memberAccess} from '../_lib/member-access.js';
import {buildDiagnosticPrompt,normalizeDiagnosticPayload,runDiagnosticProvider} from '../_lib/diagnostic-policy.js';

const safe=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,4000);
function local(body){const logs=Array.isArray(body.logs)?body.logs:[];const severe=logs.filter(x=>['error','critical'].includes(String(x?.severity))),warnings=logs.filter(x=>String(x?.severity)==='warning');const lines=[`Diagnostic local: ${severe.length} lỗi nghiêm trọng, ${warnings.length} cảnh báo trong mẫu ${logs.length} log.`];if(severe.length)lines.push('Ưu tiên cô lập route/module lỗi lặp, đối chiếu timestamp với deployment SHA và chạy smoke test trên staging.');else lines.push('Không thấy lỗi nghiêm trọng trong mẫu log; tiếp tục theo dõi auth, Supabase RPC và runtime Vercel.');lines.push('Auto-hotfix an toàn: chỉ vá trên nhánh RC/staging sau CI; không tự đổi production alias trước gate.');return lines.join('\n')}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=await memberAccess(req,'admin');if(!access.ok)return res.status(access.status).json({error:access.error});
  const payload=normalizeDiagnosticPayload(req.body||{}),fallback=local(payload),input=buildDiagnosticPrompt(payload);
  try{
    const result=await runDiagnosticProvider(input,{timeoutMs:12000});
    if(!result)return res.status(200).json({analysis:fallback,provider:'local',degraded:true});
    return res.status(200).json({analysis:safe(result.text),provider:result.provider,model:result.model,degraded:false});
  }catch(error){
    console.warn(JSON.stringify({event:'ai_diagnostic',ok:false,failureClass:'provider_error'}));
    return res.status(200).json({analysis:fallback,provider:'local',degraded:true});
  }
}
