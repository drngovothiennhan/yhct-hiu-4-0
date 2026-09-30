// Summarise Gemini token usage from Vercel logs so credit prices can be set from real cost.
// Usage: vercel logs <deployment> --since 1d | node scripts/ai-usage-summary.mjs --input-per-m 0.10 --output-per-m 0.40
// Prices (USD per 1M tokens) come from the owner's current Google AI pricing page; none are hardcoded here.
import {pathToFileURL} from 'node:url';

export function summarize(text,{inputPerM=0,outputPerM=0}={}){
  const rows=new Map();
  for(const match of String(text).matchAll(/\{"event":"ai_usage"[^{}]*\}/g)){
    let entry;try{entry=JSON.parse(match[0])}catch{continue}
    const key=`${entry.model}|${entry.mode}`;
    const row=rows.get(key)||{model:String(entry.model||'?'),mode:String(entry.mode||'?'),calls:0,promptTokens:0,outputTokens:0,thoughtsTokens:0};
    row.calls++;row.promptTokens+=Number(entry.promptTokens)||0;row.outputTokens+=Number(entry.outputTokens)||0;row.thoughtsTokens+=Number(entry.thoughtsTokens)||0;
    rows.set(key,row);
  }
  return[...rows.values()].map(row=>{
    const billedOutput=row.outputTokens+row.thoughtsTokens,cost=(row.promptTokens*inputPerM+billedOutput*outputPerM)/1e6;
    return{...row,avgPromptTokens:Math.round(row.promptTokens/row.calls),avgOutputTokens:Math.round(billedOutput/row.calls),estCostUsd:cost,estCostUsdPer1000Calls:cost/row.calls*1000};
  }).sort((a,b)=>b.calls-a.calls);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=name=>{const i=process.argv.indexOf(name);return i>=0?Number(process.argv[i+1]):0};
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const rows=summarize(input,{inputPerM:arg('--input-per-m'),outputPerM:arg('--output-per-m')});
  if(!rows.length){console.log('Không thấy dòng ai_usage nào trong log.');process.exit(0)}
  console.table(rows.map(r=>({model:r.model,mode:r.mode,calls:r.calls,avgPromptTok:r.avgPromptTokens,avgOutputTok:r.avgOutputTokens,'USD/1000 calls':Number(r.estCostUsdPer1000Calls.toFixed(4)),'USD total':Number(r.estCostUsd.toFixed(4))})));
}
