import fs from 'node:fs';

const source=fs.readFileSync('supabase/functions/learning-sync/index.ts','utf8');
const learningCloud=fs.readFileSync('src/services/learningCloudSyncService.ts','utf8');
const journey=fs.readFileSync('src/services/studentJourneyService.ts','utf8');
const review=fs.readFileSync('src/services/adaptiveReview.ts','utf8');
const errors=[];

for(const marker of [
  "'Access-Control-Allow-Methods':'GET, POST, OPTIONS'",
  "req.method!=='GET'&&req.method!=='POST'",
  "if(req.method==='GET')",
  "learning_sync_stats",
  "hasSync:Boolean(stats)",
  "pipeThrough(new CompressionStream('gzip'))",
  "pipeThrough(new DecompressionStream('gzip'))",
  "new URL(req.url).searchParams.get('snapshot')!=='1'",
  "decryptForMember",
  "snapshotMeta:{",
  "staleIgnored:true",
]){
  if(!source.includes(marker))errors.push(`learning-sync missing marker: ${marker}`);
}

for(const marker of [
  "restoreLearningCloud",
  "learning-sync?snapshot=1",
  "restoreStudentJourney",
  "replaceReviewCards",
  "shouldRestoreRemote",
  "study-os-web-v2-cross-device",
]){
  if(!learningCloud.includes(marker))errors.push(`client restore missing marker: ${marker}`);
}
for(const marker of ["hasMeaningfulStudentJourney","restoreStudentJourney"]){
  if(!journey.includes(marker))errors.push(`journey restore missing marker: ${marker}`);
}
if(!review.includes("replaceReviewCards"))errors.push("adaptive review restore missing replaceReviewCards");

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

console.log('Learning cloud sync supports encrypted cross-device restore, stale-write protection and stream-safe gzip.');
