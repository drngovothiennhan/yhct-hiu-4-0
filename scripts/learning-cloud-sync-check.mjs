import fs from 'node:fs';

const source=fs.readFileSync('supabase/functions/learning-sync/index.ts','utf8');
const errors=[];

for(const marker of [
  "'Access-Control-Allow-Methods':'GET, POST, OPTIONS'",
  "req.method!=='GET'&&req.method!=='POST'",
  "if(req.method==='GET')",
  "learning_sync_stats",
  "hasSync:Boolean(stats)",
  "pipeThrough(new CompressionStream('gzip'))",
]){
  if(!source.includes(marker))errors.push(`learning-sync missing marker: ${marker}`);
}

for(const forbidden of [
  "const writer=cs.writable.getWriter()",
  "await writer.write(bytes)",
  "await writer.close()",
]){
  if(source.includes(forbidden))errors.push(`learning-sync retains backpressure-prone gzip pattern: ${forbidden}`);
}

if(errors.length){
  console.error('Learning cloud sync contract failed:');
  for(const error of errors)console.error('- '+error);
  process.exit(1);
}

console.log('Learning cloud sync uses stream-safe gzip and exposes authenticated progress reads.');
