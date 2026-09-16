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
need(css,'grid-template-rows:auto auto minmax(0,1fr) auto auto auto','assistant conversation must own the flexible row instead of the composer');
need(css,'.app-assistant-panel .xz-conversation{min-height:0;max-height:none','conversation must shrink and scroll inside the panel');
need(css,'.app-assistant-panel .xz-conversation::after','conversation must keep a bottom scroll anchor');
need(css,'overflow-anchor:auto','conversation must keep the newest turn visible');
need(css,'.app-assistant-panel .xz-empty p{display:none!important}','obsolete empty-state instruction must be removed from the mobile UI');
need(css,'height:min(64dvh,520px)!important','mobile dialog must stay compact');

const mobileBlock=css.slice(css.indexOf('@media(max-width:760px)'));
if(/\.mobile-assistant-slot \.app-assistant \.xz-orb\{[^}]*transform\s*:\s*none!important/.test(mobileBlock))fail.push('mobile launcher must not suppress the inline translate3d drag transform');
if(/\.mobile-assistant-slot \.app-assistant\{[^}]*position\s*:\s*relative!important/.test(mobileBlock))fail.push('mobile assistant root must not be locked to the header slot');
if(/\.mobile-assistant-slot \.app-assistant \.xz-orb\{[^}]*touch-action\s*:\s*manipulation!important/.test(mobileBlock))fail.push('touch-action: manipulation blocks reliable free dragging');

if(fail.length){console.error('MOBILE ASSISTANT TOUCH/CHAT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Mobile assistant touch/chat PASS: launcher drag remains safe, dialog clears bottom navigation, the conversation owns the flexible row, newest turns stay anchored, and compact mobile spacing is enforced.');

const slotAt=app.indexOf('className="mobile-assistant-slot"');
const headerAt=app.indexOf('<main><header className="top"');
if(!(slotAt>=0&&slotAt<headerAt))throw new Error('Assistant must be mounted before main/header so backdrop-filter cannot clip fixed controls');
