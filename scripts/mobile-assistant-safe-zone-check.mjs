import fs from 'node:fs';

const css=fs.readFileSync('src/app-assistant-ai.css','utf8');
const fail=[];
const need=(token,label)=>{if(!css.includes(token))fail.push(`${label}: missing ${token}`)};
need('@media(max-width:760px)','mobile assistant breakpoint');
need('position:fixed!important','mobile assistant fixed dock');
need('top:31px!important','mobile assistant top safe zone');
need('right:94px!important','mobile assistant right safe zone');
need('transform:none!important','mobile assistant must ignore roaming transform');
need('bottom:calc(72px + env(safe-area-inset-bottom,0px))!important','assistant panel must clear bottom navigation');
need('.phase14-shell[data-active-module="ai"] .app-assistant{display:none!important}','assistant must not duplicate AI surface');
if(/@media\(max-width:760px\)[\s\S]*?\.app-assistant \.xz-orb\{[^}]*bottom:\s*(?:76|80)px/.test(css))fail.push('mobile launcher must not return to content-area bottom floating position');
if(fail.length){console.error('MOBILE ASSISTANT SAFE-ZONE FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Mobile assistant safe-zone PASS: mascot is docked in top app bar, cannot roam over study content, and panel clears bottom navigation.');
