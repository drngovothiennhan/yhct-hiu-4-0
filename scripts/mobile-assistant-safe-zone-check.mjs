import fs from 'node:fs';

const css=fs.readFileSync('src/app-assistant-ai.css','utf8');
const responsive=fs.readFileSync('src/responsive-phase7.css','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');
const fail=[];
const need=(body,token,label)=>{if(!body.includes(token))fail.push(`${label}: missing ${token}`)};

need(app,'className="mobile-assistant-slot"','assistant must have a structural header slot');
need(app,'<div className="top-actions"><span className="badge">','assistant slot must live in header actions');
need(css,'@media(max-width:760px)','mobile assistant breakpoint');
need(css,'.mobile-assistant-slot{display:grid','mobile assistant slot must participate in layout');
need(css,'.mobile-assistant-slot .app-assistant{position:relative!important','mobile assistant root must be structural, not viewport-fixed');
need(css,'.mobile-assistant-slot .app-assistant .xz-orb{position:relative!important','mobile launcher must remain inside its slot');
need(css,'transform:none!important','mobile launcher must ignore roaming transform');
need(css,'.mobile-assistant-slot .app-assistant .xz-orb>b{position:static!important','assistant label must use normal slot flow');
need(css,'bottom:calc(72px + env(safe-area-inset-bottom,0px))!important','assistant panel must clear bottom navigation');
need(css,'.phase14-shell[data-active-module="ai"] .mobile-assistant-slot{visibility:hidden!important','assistant must not duplicate AI surface');
need(responsive,'.top-actions{','header actions must reserve layout space');
need(responsive,'.mobile-assistant-slot{','responsive shell must reserve assistant width');
if(/@media\(max-width:760px\)[\s\S]*?\.mobile-assistant-slot \.app-assistant \.xz-orb\{[^}]*(?:top|right|bottom|left):\s*\d+px!important/.test(css))fail.push('mobile launcher must not use viewport coordinate docking inside its structural slot');
if(fail.length){console.error('MOBILE ASSISTANT SAFE-ZONE FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Mobile assistant safe-zone PASS: mascot is structurally mounted in the header action row, roaming transform is disabled on mobile, and only the dialog remains fixed above bottom navigation.');
