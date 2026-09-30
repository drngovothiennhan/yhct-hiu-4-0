import fs from 'node:fs';
import path from 'node:path';

const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))fail.push(`${label} missing ${token}`)};
const forbid=(body,tokens,label)=>{for(const token of tokens)if(body.includes(token))fail.push(`${label} must not contain ${token}`)};
const ok=(cond,label)=>{if(!cond)fail.push(label)};

// ---- Static contract -------------------------------------------------------------------------
const migration=read('supabase/migrations/202609301700_ai_credit_ledger_v1.sql');
const gate=read('api/_lib/ai-credits.js');
const assistant=read('api/ai/assistant.js');
const doc=read('docs/AI_CREDITS_V1.md');
const examGap=read('api/ai/exam-gap.js');
const docxSummary=read('api/ai/docx-summary.js');
const creditClient=read('src/services/aiCreditService.ts');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const geminiProvider=read('api/_lib/gemini-provider.js');
const runbook=read('docs/ops/AI_CREDITS_LAUNCH_RUNBOOK.md');
const {summarize}=await import('./ai-usage-summary.mjs');

need(migration,[
  'ai_credit_settings_v1','enforce boolean not null default false',
  'ai_credit_policy_v1','ai_credit_lot_v1','ai_credit_ledger_v1','ai_credit_campaign_v1',
  'enabled boolean not null default false',
  'revoke all on table private.ai_credit_settings_v1',
  'pg_advisory_xact_lock','order by expires_at nulls last, id','unique (user_id, kind, ref)',
  "raise exception using errcode='42501', message='Approved member required'",
  "raise exception using errcode='42501', message='Admin required'",
  'grant execute on function public.ai_credit_spend_v1(text,text) to authenticated',
  'revoke all on function private.ai_credit_member_v1() from public, anon, authenticated'
],'credit migration');
forbid(migration,['drop table','drop function','truncate','delete from','alter table auth.'],'credit migration must stay additive');
ok(!/grant\s+(select|insert|update|delete|all)[^;]*private\./i.test(migration),'credit migration must not grant table access on private schema');

need(gate,['ENABLE_AI_CREDITS','AI_CREDITS_FAIL_CLOSED','ai_credit_spend_v1','ai_credit_refund_v1','randomUUID','X-AI-Degraded',"daily_review_cron","academic-daily-post",'402','insufficient_credits'],'credit gate');
forbid(gate,['res.setHeader(\'X-AI-Credit-Ref','ref:ref,','JSON.stringify({ref'],'credit ref must never be sent to the browser');
need(assistant,['async function routeAssistant(req,res)','reserveAiCredit(req,creditCapability(req.body))','creditRefusal(res,gate)','isCreditsRequest(req)','refundAiCredit(req,gate.ref)'],'assistant gateway credit hook');
if((assistant.match(/export default async function handler/g)||[]).length!==1)fail.push('assistant must keep exactly one exported handler');
need(examGap,["reserveAiCredit(req,'exam_gap')",'creditRefusal(res,gate)','refundAiCredit(req,gate.ref)'],'exam-gap goes through the credit gate');
need(docxSummary,["reserveAiCredit(req,'docx_summary')",'creditRefusal(res,gate)','refundAiCredit(req,gate.ref)'],'docx-summary goes through the credit gate');
need(creditClient,["mode:'credits'",'launch-2026-10-01','/api/ai/assistant?action=credits','return null'],'client credit service is silent when credits are off');
need(aiCenter,['loadAiCredits','credits?.enforced&&!credits.unlimited','ai-center__credits'],'AI center shows balance only when enforced');
forbid(creditClient,['console.log','p_ref','ai_credit_spend_v1'],'client must never see spend refs or call spend');
need(geminiProvider,["event:'ai_usage'",'usageMetadata','promptTokenCount','candidatesTokenCount'],'gemini usage telemetry');
forbid(geminiProvider.slice(geminiProvider.indexOf('function extractUsage'),geminiProvider.indexOf('async function requestGemini')),['text','prompt:','systemInstruction'],'usage telemetry must log token counts only');
{
  const sample=[
    'noise {"event":"ai_usage","provider":"gemini","model":"m1","mode":"default","promptTokens":1000,"outputTokens":200,"thoughtsTokens":0,"totalTokens":1200}',
    '{"event":"ai_usage","provider":"gemini","model":"m1","mode":"default","promptTokens":3000,"outputTokens":400,"thoughtsTokens":100,"totalTokens":3500}',
    '{"event":"ai_gateway","ok":true}',
    '{"event":"ai_usage","provider":"gemini","model":"m2","mode":"research","promptTokens":10,"outputTokens":10,"thoughtsTokens":0,"totalTokens":20}'
  ].join('\n');
  const rows=summarize(sample,{inputPerM:1,outputPerM:2});
  const m1=rows.find(r=>r.model==='m1');
  ok(rows.length===2&&m1?.calls===2&&m1.promptTokens===4000&&m1.avgOutputTokens===350,'usage summary aggregates calls and tokens per model/mode');
  ok(Math.abs(m1.estCostUsd-(4000*1+700*2)/1e6)<1e-12,'usage summary cost uses owner-supplied prices');
  ok(summarize('nothing here').length===0,'usage summary tolerates logs without usage lines');
}
need(runbook,['Lùi nhanh','enforce = false','ENABLE_AI_CREDITS','launch-2026-10-01','private.ai_credit_lot_v1','SQL editor'],'launch runbook');
forbid(runbook,['drop table','delete from','truncate'],'runbook must not contain destructive SQL');
need(doc,['ENABLE_AI_CREDITS','ai_credit_settings_v1','launch-2026-10-01','Không rút thành tiền'],'credit doc');

// Vercel Hobby allows 12 functions: credits must live inside an existing function.
const listFns=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='_lib'?[]:e.isDirectory()?listFns(path.join(dir,e.name)):e.name.endsWith('.js')?[path.join(dir,e.name)]:[]);
ok(listFns('api').length<=12,`api must stay within 12 serverless functions, found ${listFns('api').length}`);

// ---- Runtime behaviour with a mocked Supabase --------------------------------------------------
const realFetch=globalThis.fetch;
let calls=[];
let script=[];
globalThis.fetch=async(url,init)=>{
  const rpc=String(url).split('/rpc/')[1]||'';
  calls.push({rpc,body:JSON.parse(init?.body||'{}')});
  const next=script.shift();
  if(next instanceof Error)throw next;
  return{ok:true,status:200,json:async()=>next,text:async()=>JSON.stringify(next)};
};
const req=(body,method='POST')=>({method,body,headers:{authorization:'Bearer '+'x'.repeat(40)},query:{}});
const mkRes=()=>{const h={};return{statusCode:200,setHeader:(k,v)=>{h[k]=v},getHeader:k=>h[k],status(c){this.statusCode=c;return this},json(b){this.body=b;return this}}};
const gateMod=await import('../api/_lib/ai-credits.js');

delete process.env.ENABLE_AI_CREDITS;
calls=[];script=[];
let g=await gateMod.reserveAiCredit(req({query:'hi'}),gateMod.creditCapability({query:'hi'}));
ok(g.allowed&&!g.enforced&&calls.length===0,'flag off: no database call and always allowed');

ok(gateMod.creditCapability({mode:'research'})==='assistant_research','capability: research');
ok(gateMod.creditCapability({mode:'weird'})==='assistant_fast','capability: unknown mode is fast');
ok(gateMod.creditCapability({mode:'study',task:'quiz'})==='study_quiz','capability: study quiz');
ok(gateMod.creditCapability({mode:'xiaozhi-mini'})==='xiaozhi_mini','capability: xiaozhi');
ok(gateMod.creditCapability({task:'daily_review_cron'})==='','capability: cron is never charged');
ok(gateMod.creditCapability({mode:'academic-daily-post'})==='','capability: academic daily post is never charged');
ok(gateMod.creditCapability(null)==='assistant_fast','capability: empty body');

process.env.ENABLE_AI_CREDITS='true';
calls=[];script=[{allowed:true,enforced:true,charged:2,free:false,balance:8}];
g=await gateMod.reserveAiCredit(req({mode:'study',task:'quiz'}),'study_quiz');
ok(g.allowed&&g.enforced&&typeof g.ref==='string'&&g.ref.length>=32&&calls[0]?.rpc==='ai_credit_spend_v1'&&calls[0].body.p_ref===g.ref,'flag on: spends with a server-generated ref');

calls=[];script=[{allowed:true,enforced:true,charged:0,free:true}];
g=await gateMod.reserveAiCredit(req({}),'assistant_fast');
ok(g.allowed&&typeof g.ref==='string','free use keeps a ref so it can be refunded');

calls=[];script=[{allowed:true,enforced:false,charged:0,free:false}];
g=await gateMod.reserveAiCredit(req({}),'assistant_fast');
ok(g.allowed&&g.ref===null,'database switch off: nothing to refund');

calls=[];script=[{allowed:false,enforced:true,reason:'insufficient_credits',cost:5,balance:1}];
g=await gateMod.reserveAiCredit(req({}),'assistant_research');
ok(g.allowed===false,'insufficient credits blocks');
let res=mkRes();gateMod.creditRefusal(res,g);
ok(res.statusCode===402&&res.body?.code==='insufficient_credits'&&res.body?.credits?.cost===5&&!('ref' in (res.body.credits||{})),'402 body carries balance and cost only');

calls=[];script=[new Error('Member RPC ai_credit_spend_v1 failed 500: boom')];
g=await gateMod.reserveAiCredit(req({}),'assistant_fast');
ok(g.allowed&&g.ref===null,'database failure fails open by default');

process.env.AI_CREDITS_FAIL_CLOSED='true';
script=[new Error('Member RPC ai_credit_spend_v1 failed 500: boom')];
g=await gateMod.reserveAiCredit(req({}),'assistant_fast');
res=mkRes();if(g.allowed===false)gateMod.creditRefusal(res,g);
ok(g.allowed===false&&res.statusCode===503,'fail-closed option blocks with 503');
script=[new Error('Authentication required')];
g=await gateMod.reserveAiCredit(req({}),'assistant_fast');
ok(g.allowed===true,'signed-out request is left to the normal 401 path');
delete process.env.AI_CREDITS_FAIL_CLOSED;

ok(gateMod.reserveAiCredit(req({},'GET'),'assistant_fast')instanceof Promise,'GET returns a promise');
calls=[];g=await gateMod.reserveAiCredit(req({},'GET'),'assistant_fast');
ok(g.allowed&&calls.length===0,'GET requests are never charged');

let r1=mkRes();r1.setHeader('X-AI-Degraded','1');ok(gateMod.creditShouldRefund(r1),'degraded answer is refunded');
let r2=mkRes();r2.statusCode=502;ok(gateMod.creditShouldRefund(r2),'server error is refunded');
ok(!gateMod.creditShouldRefund(mkRes()),'good answer is not refunded');

calls=[];script=[{refunded:true}];
await gateMod.refundAiCredit(req({}),'a'.repeat(36));
ok(calls[0]?.rpc==='ai_credit_refund_v1','refund calls the refund RPC');
calls=[];await gateMod.refundAiCredit(req({}),null);
ok(calls.length===0,'no ref -> no refund call');

// Credits endpoint: claim + balance through the existing function
script=[{approved:true,role:'member',memberId:'m1'},{claimed:true,amount:50},{balance:50,enforced:false}];
calls=[];res=mkRes();
await gateMod.handleCredits(req({mode:'credits',op:'claim',campaign:'launch-2026-10-01'}),res);
ok(res.statusCode===200&&res.body?.claim?.claimed===true&&res.body?.credits?.balance===50,'claim returns claim result and balance');
script=[{approved:true,role:'member',memberId:'m1'}];res=mkRes();
await gateMod.handleCredits(req({mode:'credits',op:'claim',campaign:'BAD CAMPAIGN'}),res);
ok(res.statusCode===400,'claim rejects a malformed campaign id');
ok(gateMod.isCreditsRequest({method:'GET',query:{action:'credits'}})&&gateMod.isCreditsRequest({method:'POST',body:{mode:'credits'}})&&!gateMod.isCreditsRequest({method:'POST',body:{mode:'study'}}),'credits request detection');

// With the server switch off the credits endpoint must not touch the database at all.
delete process.env.ENABLE_AI_CREDITS;
calls=[];script=[];res=mkRes();
await gateMod.handleCredits(req({mode:'credits',op:'claim',campaign:'launch-2026-10-01'}),res);
ok(res.statusCode===200&&res.body?.disabled===true&&res.body?.credits===null&&calls.length===0,'credits endpoint is inert while ENABLE_AI_CREDITS is off');

globalThis.fetch=realFetch;
delete process.env.ENABLE_AI_CREDITS;

if(fail.length){console.error(fail.map(x=>`FAIL: ${x}`).join('\n'));process.exit(1)}
console.log('AI credit ledger contract PASS: additive migration, default-off gate, server-only refs, refund on degraded/failed answers, existing-function hosting and 402/503 handling are enforced.');
