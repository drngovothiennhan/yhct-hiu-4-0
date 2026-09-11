import fs from 'node:fs';

const files=['browser-artifacts/chrome-mobile.json','browser-artifacts/chrome-desktop.json'];
const forbidden=[
  /permission denied for function/i,
  /permission denied for schema/i,
  /permission denied for relation/i,
  /jwt expired/i,
  /invalid jwt/i,
];
const failures=[];

for(const file of files){
  if(!fs.existsSync(file)){
    failures.push(`${file}: missing Chrome evidence`);
    continue;
  }
  const raw=fs.readFileSync(file,'utf8');
  for(const pattern of forbidden){
    if(pattern.test(raw))failures.push(`${file}: leaked backend/auth error matched ${pattern}`);
  }
}

const mobile=files[0];
if(fs.existsSync(mobile)){
  const qa=JSON.parse(fs.readFileSync(mobile,'utf8'));
  const before=String(qa?.examAudit?.before?.bodyText||'');
  const after=String(qa?.examAudit?.after?.bodyText||'');
  if(!before||!after)failures.push(`${mobile}: missing /exam before/after content evidence`);
  if(!after.includes('National Exam Prep'))failures.push(`${mobile}: /exam content missing National Exam Prep`);
}

if(failures.length){
  console.error('Production Chrome content contract failed:\n- '+failures.join('\n- '));
  process.exit(1);
}
console.log('Production Chrome content contract passed: no raw backend/auth errors leaked into rendered UI.');
