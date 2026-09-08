import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const theme=read('src/theme.ts');
const main=read('src/main.tsx');
const index=read('index.html');
const runtime=read('src/theme-runtime.css');
const worker=read('public/service-worker.js');
const ids=['duoc-ngoc','muc-tuyen','ngu-y','tcm-cartoon-2d','tcm-isometric-3d','tcm-spring-2d','tcm-cloud-2d','tcm-mint-modern'];
const requiredTokens=['--primary','--primary-2','--accent','--accent-2','--gold','--bg','--surface','--surface-2','--text','--muted','--line','--border','--nav','--nav-2','--success','--danger','--shadow','--radius','--radius-sm'];
const fail=message=>{throw new Error(`Theme atomic audit failed: ${message}`)};

for(const id of ids){
  if(!theme.includes(`'${id}':makeTokens(`))fail(`missing complete token definition for ${id}`);
  if(!index.includes(`'${id}':{primary:`))fail(`missing prepaint palette for ${id}`);
}
for(const token of requiredTokens)if(!theme.includes(`'${token}'`))fail(`theme token ${token} is not centrally managed`);

if(!theme.includes("SYSTEM_THEME_HINT_KEY='yhct-system-theme-hint-v3'"))fail('system theme hint key is missing');
if(!theme.includes("root.dataset.themeSwitching='1'"))fail('runtime switch transaction guard is missing');
if(!theme.includes('for(const key of THEME_TOKEN_KEYS)root.style.removeProperty(key)'))fail('old token removal phase is missing');
if(!theme.includes('for(const key of THEME_TOKEN_KEYS)root.style.setProperty(key,tokens[key])'))fail('new token commit phase is missing');
if(!theme.includes('pendingSaveTheme')||!theme.includes('desiredSystemTheme')||!theme.includes('flushThemeSaveQueue'))fail('theme save race protection is missing');
if(!theme.includes('if(desiredSystemTheme&&next!==desiredSystemTheme)return desiredSystemTheme'))fail('stale server read suppression is missing');
if(!theme.includes('if(desiredSystemTheme&&next!==desiredSystemTheme)return;'))fail('stale broadcast suppression is missing');
if(!main.includes("import {bootstrapThemeState} from './theme'"))fail('main bootstrap does not use persisted theme state');
if(!main.includes("import './theme-runtime.css'"))fail('theme runtime CSS is not loaded');
if(main.indexOf("import './theme-runtime.css'")<main.indexOf("import './exam-v2.css'"))fail('theme runtime CSS must be the final CSS authority');
if(main.includes('clearLegacyThemeState();'))fail('main still resets the app to the legacy default theme');
if(index.includes('data-theme="duoc-ngoc"'))fail('index hardcodes the red heritage theme before runtime');
if(!index.includes('yhct-system-theme-hint-v3')||!index.includes('--prepaint-bg'))fail('first paint does not restore the persisted theme hint');
if(!runtime.includes("html[data-theme-switching='1'] *")||!runtime.includes('transition:none!important'))fail('cross-fade suppression is missing');
if(!worker.includes('v5-atomic-theme-pwa'))fail('service-worker cache was not invalidated for the new theme runtime');

console.log(`Theme atomic audit PASS: ${ids.length} themes replace complete token sets with stale-state and transition guards.`);
