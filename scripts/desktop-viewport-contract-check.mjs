import fs from 'node:fs';

const file='src/components/system/ViewportModeToggle.tsx';
const source=fs.readFileSync(file,'utf8');
const checks=[
  ['wide desktop detector',/const isWideDesktop=.*min-width: 980px/],
  ['desktop boot guard',/if\(isWideDesktop\(\)\)return'desktop'/],
  ['desktop preview does not persist mobile',/if\(isWideDesktop\(\)\)[\s\S]*localStorage\.setItem\(VIEWPORT_MODE_KEY,'desktop'\)/],
  ['viewport contract bumped',/VIEWPORT_CONTRACT_KEY='yhct-viewport-contract-v4'/],
  ['desktop label is preview',/Xem thử bản Mobile/]
];
let failed=false;
for(const [label,pattern] of checks){
  const ok=pattern.test(source);
  console.log(`${ok?'PASS':'FAIL'} ${label}`);
  if(!ok)failed=true;
}
if(failed)process.exit(1);
console.log('PASS desktop viewport persistence contract');
