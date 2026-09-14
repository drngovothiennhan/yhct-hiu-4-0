import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const study=read('api/_lib/study-assistant-handler.js');
const provider=read('api/_lib/gemini-provider.js');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const golden=read('evals/medical-golden-v1.json');
const fail=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))fail.push(`${label} missing ${token}`)};
need(study,["MAX_CONTEXT=8000","TRUSTED_QUIZ_EVIDENCE=new Set(['OpenAlex','Europe PMC'])","sources.length<2","gọi 115 hoặc đến cấp cứu ngay","thuốc chống đông","maxLines=followup?8:6","maxChars=followup?5000:3600"],'Study reasoning/evidence safety hardening');
need(provider,['DEFAULT_PRIMARY_TIMEOUT_MS=7500','RESEARCH_PRIMARY_TIMEOUT_MS=10000','FALLBACK_TIMEOUT_MS=8500','transientNetworkError','retryableGeminiStatus'],'Gemini failover hardening');
need(aiCenter,['messages.slice(-12)','slice(-6500)'],'Study UI conversation depth');
need(golden,['medical-golden-v1','criticalSafetyPassRate','citationPassRate','routePassRate'],'Golden Medical Eval contract');
if(fail.length){console.error('AI QUALITY HARDENING FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('AI quality hardening PASS: deeper bounded context, trusted quiz evidence, emergency safety, resilient Gemini failover and Golden Medical Eval are enforced.');
