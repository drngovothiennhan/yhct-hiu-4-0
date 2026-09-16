import fs from 'node:fs';

const css=fs.readFileSync('src/app-assistant-ai.css','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');
const fail=[];
const need=(body,token,label)=>{if(!body.includes(token))fail.push(`${label}: missing ${token}`)};

need(app,'className="mobile-assistant-slot"','assistant mount point must remain available outside the filtered header');
need(css,'@media(max-width:760px)','mobile assistant breakpoint');
need(css,'.mobile-assistant-slot{display:contents!important','mobile mount point must not reserve a fixed drag box');
need(css,'.mobile-assistant-slot .app-assistant{position:fixed!important','mobile assistant root must float at viewport level');
need(css,'touch-action:none!important','mobile launcher must capture touch drag instead of browser panning');
need(css,'will-change:transform!important','mobile launcher must preserve translate3d movement');
need(css,'cursor:grab!important','mobile launcher must advertise draggable interaction');
need(css,'bottom:calc(72px + env(safe-area-inset-bottom,0px))!important','assistant panel must clear bottom navigation');
need(css,'.phase14-shell[data-active-module="ai"] .mobile-assistant-slot{visibility:hidden!important','assistant must not duplicate AI surface');

const mobileBlock=css.slice(css.indexOf('@media(max-width:760px)'));
if(/\.mobile-assistant-slot \.app-assistant \.xz-orb\{[^}]*transform\s*:\s*none!important/.test(mobileBlock))fail.push('mobile launcher must not suppress the inline translate3d drag transform');
if(/\.mobile-assistant-slot \.app-assistant\{[^}]*position\s*:\s*relative!important/.test(mobileBlock))fail.push('mobile assistant root must not be locked to the header slot');
if(/\.mobile-assistant-slot \.app-assistant \.xz-orb\{[^}]*touch-action\s*:\s*manipulation!important/.test(mobileBlock))fail.push('touch-action: manipulation blocks reliable free dragging');

if(fail.length){console.error('MOBILE ASSISTANT TOUCH/DRAG FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Mobile assistant touch/drag PASS: launcher floats above the app shell, touch panning is disabled on the launcher, translate3d remains active, and the dialog clears bottom navigation.');

const slotAt=app.indexOf('className="mobile-assistant-slot"');
const headerAt=app.indexOf('<main><header className="top"');
if(!(slotAt>=0&&slotAt<headerAt))throw new Error('Assistant must be mounted before main/header so backdrop-filter cannot clip fixed controls');
