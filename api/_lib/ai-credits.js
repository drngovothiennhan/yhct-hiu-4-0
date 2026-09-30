import {randomUUID} from 'node:crypto';
import {memberAccess,memberRpc} from './member-access.js';

// AI credit gate v1. Everything here is inert unless ENABLE_AI_CREDITS=true AND the database switch
// private.ai_credit_settings_v1.enforce is on. See docs/AI_CREDITS_V1.md.
const KNOWN_MODES=new Set(['fast','research','exam']);
const safe=value=>String(value??'').toLowerCase().replace(/[^a-z0-9_:.-]/g,'_').slice(0,48)||'chat';
const clean=(value,max=64)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

export const aiCreditsEnabled=()=>process.env.ENABLE_AI_CREDITS==='true';
const failClosed=()=>process.env.AI_CREDITS_FAIL_CLOSED==='true';

// Server jobs are never charged to a learner.
export function creditCapability(body){
  const b=body&&typeof body==='object'?body:{};
  if(b.task==='daily_review_cron'||b.mode==='academic-daily-post')return'';
  if(b.mode==='study')return`study_${safe(b.task||'chat')}`;
  if(b.mode==='xiaozhi-mini')return'xiaozhi_mini';
  return`assistant_${KNOWN_MODES.has(b.mode)?b.mode:'fast'}`;
}

export function isCreditsRequest(req){
  if(req.method==='GET')return String(req.query?.action||'')==='credits';
  return req.method==='POST'&&req.body?.mode==='credits';
}

// Spend before calling a provider. The ref is generated here and never sent to the browser,
// so only this server can refund the spend.
export async function reserveAiCredit(req,capability){
  if(!aiCreditsEnabled()||!capability||req.method!=='POST')return{enforced:false,allowed:true,ref:null};
  const ref=randomUUID();
  try{
    const result=await memberRpc(req,'ai_credit_spend_v1',{p_capability:capability,p_ref:ref});
    if(result?.allowed===false)return{enforced:true,allowed:false,ref:null,detail:result};
    return{enforced:Boolean(result?.enforced),allowed:true,ref:result?.charged>0||result?.free===true?ref:null,detail:result};
  }catch(error){
    const message=String(error?.message||error);
    // Not signed in: let the normal handler answer 401.
    if(message.includes('Authentication required'))return{enforced:false,allowed:true,ref:null};
    console.warn(JSON.stringify({event:'ai_credit',ok:false,capability,failClosed:failClosed(),reason:clean(message,160)}));
    if(failClosed())return{enforced:true,allowed:false,unavailable:true,ref:null};
    return{enforced:false,allowed:true,ref:null};
  }
}

export async function refundAiCredit(req,ref){
  if(!ref)return;
  try{await memberRpc(req,'ai_credit_refund_v1',{p_ref:ref})}
  catch(error){console.warn(JSON.stringify({event:'ai_credit',ok:false,action:'refund',reason:clean(error?.message||error,160)}))}
}

// A learner is not charged for an answer that fell back to a degraded/local reply or failed server-side.
export const creditShouldRefund=res=>res?.getHeader?.('X-AI-Degraded')==='1'||Number(res?.statusCode)>=500;

export function creditRefusal(res,gate){
  res.setHeader('Cache-Control','no-store');
  if(gate?.unavailable)return res.status(503).json({error:'Dịch vụ tín dụng tạm thời chưa sẵn sàng. Vui lòng thử lại.',code:'credits_unavailable'});
  const detail=gate?.detail||{};
  return res.status(402).json({error:'Bạn đã dùng hết lượt miễn phí hôm nay và không đủ tín dụng cho tính năng này.',code:'insufficient_credits',credits:{balance:Number(detail.balance)||0,cost:Number(detail.cost)||0}});
}

// Balance / claim. Lives in the existing assistant function to stay within the Vercel function limit.
export async function handleCredits(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Authorization');
  const access=await memberAccess(req,'member');if(!access.ok)return res.status(access.status).json({error:access.error});
  try{
    if(req.method==='POST'&&req.body?.op==='claim'){
      const campaign=clean(req.body?.campaign,64);
      if(!/^[a-z0-9_-]{3,64}$/.test(campaign))return res.status(400).json({error:'Chiến dịch không hợp lệ.'});
      const claim=await memberRpc(req,'ai_credit_claim_v1',{p_campaign:campaign});
      return res.status(200).json({claim,credits:await memberRpc(req,'ai_credit_balance_v1',{})});
    }
    return res.status(200).json({credits:await memberRpc(req,'ai_credit_balance_v1',{})});
  }catch(error){
    console.warn(JSON.stringify({event:'ai_credit',ok:false,action:'credits',reason:clean(error?.message||error,160)}));
    return res.status(503).json({error:'Chưa đọc được tín dụng.',code:'credits_unavailable'});
  }
}
