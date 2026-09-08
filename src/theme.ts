import {supabase} from './services/authService';

export type ThemeName='duoc-ngoc'|'muc-tuyen'|'ngu-y'|'tcm-cartoon-2d'|'tcm-isometric-3d'|'tcm-spring-2d'|'tcm-cloud-2d'|'tcm-mint-modern';
export const THEME_OPTIONS:{id:ThemeName;name:string;description:string;swatches:string[]}[]=[
  {id:'duoc-ngoc',name:'Dược Ngọc – Son Đỏ',description:'Ngọc dược, đỏ son và giấy ngà; cân bằng truyền thống với giao diện học thuật hiện đại.',swatches:['#174C3C','#8B1E2D','#F7F1E5','#C99A45']},
  {id:'muc-tuyen',name:'Mực Tuyên – Giấy Ngà',description:'Mực tàu, giấy tuyên, xanh trà; tối giản, tập trung đọc dài và luyện thi.',swatches:['#202824','#5A6F61','#F5F1E8','#A77A3A']},
  {id:'ngu-y',name:'Ngự Y – Đồng Son',description:'Đỏ nâu, đồng cổ, kem ấm; trang trọng hơn cho điều hành và nội dung chuyên môn.',swatches:['#651F24','#8B5A2B','#F4E8D3','#B88942']},
  {id:'tcm-cartoon-2d',name:'2D Flat YHCT',description:'Ngọc bích tươi, vàng hoàng cúc, chu sa dịu và cam quế; vector phương Đông trẻ trung.',swatches:['#159A84','#F5C453','#C8554F','#D9824A']},
  {id:'tcm-isometric-3d',name:'3D Isometric YHCT',description:'Khối nổi isometric, bóng đổ nhiều tầng và chất liệu giấy dược liệu, chỉ dành cho phiên Admin.',swatches:['#176B5A','#D9AA45','#A8463E','#F4EEDF']},
  {id:'tcm-spring-2d',name:'Xuân Dược 2D',description:'Hoạt hình 2D sáng, xanh dược liệu và sắc hoa nhẹ; tối ưu cho CLB và thiết bị phổ thông.',swatches:['#147D67','#E65F68','#F3FBF7','#F3BD4B']},
  {id:'tcm-cloud-2d',name:'Vân Lam 2D',description:'Xanh trời sáng, hồng dược hoa và nền trắng sạch; hiện đại, nhẹ mắt, phù hợp nội dung học thuật.',swatches:['#376F9F','#D76A7F','#F4F9FD','#E4B85D']},
  {id:'tcm-mint-modern',name:'Mint YHCT Modern',description:'Xanh mint hiện đại, tương phản rõ, khối giao diện sạch và nhẹ; ưu tiên hiệu năng và khả năng đọc.',swatches:['#0F766E','#F06F57','#F5FAF8','#E6B84E']}
];

const DEFAULT_THEME:ThemeName='duoc-ngoc';
const LEGACY_THEME_KEY='yhct-hiu-ui-theme-v1';
const SYSTEM_THEME_HINT_KEY='yhct-system-theme-hint-v3';
const SYSTEM_META_ATTR='data-yhct-system-theme';

type Palette={primary:string;primary2:string;accent:string;accent2:string;gold:string;bg:string;surface:string;surface2:string;text:string;muted:string;line:string;nav:string;nav2:string;success:string;danger:string;shadow:string;radius?:string;radiusSm?:string;cartoonJade?:string;cartoonApricot?:string;cartoonCinnabar?:string;cartoonCinnamon?:string};
type ThemeTokens={
  '--primary':string;'--primary-2':string;'--accent':string;'--accent-2':string;'--gold':string;'--bg':string;'--surface':string;'--surface-2':string;'--text':string;'--muted':string;'--line':string;'--border':string;'--nav':string;'--nav-2':string;'--success':string;'--danger':string;'--shadow':string;'--radius':string;'--radius-sm':string;'--cartoon-jade':string;'--cartoon-apricot':string;'--cartoon-cinnabar':string;'--cartoon-cinnamon':string;
};
const makeTokens=(p:Palette):ThemeTokens=>({
  '--primary':p.primary,'--primary-2':p.primary2,'--accent':p.accent,'--accent-2':p.accent2,'--gold':p.gold,
  '--bg':p.bg,'--surface':p.surface,'--surface-2':p.surface2,'--text':p.text,'--muted':p.muted,'--line':p.line,'--border':p.line,
  '--nav':p.nav,'--nav-2':p.nav2,'--success':p.success,'--danger':p.danger,'--shadow':p.shadow,'--radius':p.radius||'18px','--radius-sm':p.radiusSm||'12px',
  '--cartoon-jade':p.cartoonJade||p.primary,'--cartoon-apricot':p.cartoonApricot||p.gold,'--cartoon-cinnabar':p.cartoonCinnabar||p.accent,'--cartoon-cinnamon':p.cartoonCinnamon||p.accent2
});

const THEME_TOKENS:Record<ThemeName,ThemeTokens>={
  'duoc-ngoc':makeTokens({primary:'#174c3c',primary2:'#23634f',accent:'#8b1e2d',accent2:'#a72d3d',gold:'#c99a45',bg:'#f6f1e7',surface:'#fffaf1',surface2:'#f0e7d8',text:'#24362f',muted:'#6f786f',line:'#ddd0bc',nav:'#5d1522',nav2:'#7c1d2b',success:'#2f6f4f',danger:'#962e2e',shadow:'0 14px 36px rgba(77,55,31,.10)'}),
  'muc-tuyen':makeTokens({primary:'#344d40',primary2:'#5a6f61',accent:'#4e4338',accent2:'#6c5946',gold:'#a77a3a',bg:'#f5f1e8',surface:'#fffdf8',surface2:'#ebe6dc',text:'#202824',muted:'#69716c',line:'#d7d0c5',nav:'#222b27',nav2:'#35453d',success:'#4e6b5a',danger:'#8f4b43',shadow:'0 14px 34px rgba(32,40,36,.10)'}),
  'ngu-y':makeTokens({primary:'#651f24',primary2:'#833039',accent:'#8b5a2b',accent2:'#a56c35',gold:'#b88942',bg:'#f4e8d3',surface:'#fff7ea',surface2:'#ead9bd',text:'#3d2c24',muted:'#78685e',line:'#d8c1a0',nav:'#4d171b',nav2:'#6b2529',success:'#456a4f',danger:'#8c2b2b',shadow:'0 16px 38px rgba(82,42,27,.12)'}),
  'tcm-cartoon-2d':makeTokens({primary:'#159a84',primary2:'#20b69a',accent:'#c8554f',accent2:'#d96559',gold:'#f5c453',bg:'#fff7e6',surface:'#fffdf7',surface2:'#f6edd7',text:'#25443c',muted:'#6a746d',line:'#e2c992',nav:'#177d6e',nav2:'#1ea58d',success:'#278c68',danger:'#bd4c47',shadow:'0 10px 0 rgba(217,130,74,.10),0 16px 38px rgba(93,66,30,.10)',radius:'22px',radiusSm:'14px',cartoonJade:'#159a84',cartoonApricot:'#f5c453',cartoonCinnabar:'#c8554f',cartoonCinnamon:'#d9824a'}),
  'tcm-isometric-3d':makeTokens({primary:'#176b5a',primary2:'#24816d',accent:'#a8463e',accent2:'#c05d50',gold:'#d9aa45',bg:'#f4eedf',surface:'#fff9ed',surface2:'#e8deca',text:'#2a3c35',muted:'#6f746d',line:'#d5c3a3',nav:'#14584b',nav2:'#1c6e5d',success:'#2e7c5b',danger:'#a8463e',shadow:'0 8px 0 rgba(217,170,69,.10),0 20px 44px rgba(53,74,63,.15)',radius:'20px',radiusSm:'13px'}),
  'tcm-spring-2d':makeTokens({primary:'#147d67',primary2:'#20a184',accent:'#e65f68',accent2:'#f08a72',gold:'#f3bd4b',bg:'#f3fbf7',surface:'#ffffff',surface2:'#e8f6ef',text:'#18372e',muted:'#668077',line:'#cfe7dc',nav:'#176b5a',nav2:'#20866e',success:'#2f8a5d',danger:'#c84e56',shadow:'0 12px 30px rgba(31,104,82,.12)'}),
  'tcm-cloud-2d':makeTokens({primary:'#376f9f',primary2:'#4d8fc6',accent:'#d76a7f',accent2:'#e79083',gold:'#e4b85d',bg:'#f4f9fd',surface:'#ffffff',surface2:'#eaf3f9',text:'#233746',muted:'#687c8b',line:'#cfdeea',nav:'#315e83',nav2:'#3e769f',success:'#4a8467',danger:'#b84e60',shadow:'0 12px 30px rgba(49,94,131,.11)'}),
  'tcm-mint-modern':makeTokens({primary:'#0f766e',primary2:'#14a394',accent:'#f06f57',accent2:'#ff9478',gold:'#e6b84e',bg:'#f5faf8',surface:'#ffffff',surface2:'#e8f4f1',text:'#1d3431',muted:'#647b77',line:'#cfe3de',nav:'#114f4a',nav2:'#0f766e',success:'#278466',danger:'#c6524d',shadow:'0 14px 36px rgba(15,118,110,.11)',radius:'18px',radiusSm:'12px'})
};
const THEME_TOKEN_KEYS=Object.keys(THEME_TOKENS[DEFAULT_THEME]) as (keyof ThemeTokens)[];
const THEME_MODES:Record<ThemeName,string>={'duoc-ngoc':'heritage','muc-tuyen':'ink','ngu-y':'imperial','tcm-cartoon-2d':'flat','tcm-isometric-3d':'isometric','tcm-spring-2d':'spring','tcm-cloud-2d':'cloud','tcm-mint-modern':'modern'};
const isThemeName=(value:unknown):value is ThemeName=>typeof value==='string'&&THEME_OPTIONS.some(x=>x.id===value);
let applyRevision=0;
let pendingSaveTheme:ThemeName|null=null;
let desiredSystemTheme:ThemeName|null=null;
let saveRunner:Promise<ThemeName>|null=null;

function readThemeHint():ThemeName|null{
  if(typeof window==='undefined')return null;
  try{const value=window.localStorage.getItem(SYSTEM_THEME_HINT_KEY);return isThemeName(value)?value:null}catch{return null}
}
function rememberThemeHint(theme:ThemeName){if(typeof window==='undefined')return;try{window.localStorage.setItem(SYSTEM_THEME_HINT_KEY,theme)}catch{}}
function purgeLegacyThemeState(){if(typeof window==='undefined')return;try{window.localStorage.removeItem(LEGACY_THEME_KEY);window.sessionStorage.removeItem(LEGACY_THEME_KEY)}catch{}}

export function readTheme():ThemeName{
  if(typeof document!=='undefined'){
    const value=document.documentElement.dataset.theme;
    if(isThemeName(value))return value;
  }
  return readThemeHint()||DEFAULT_THEME;
}

function normalizeManifestLink(){
  if(typeof document==='undefined')return;
  const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if(!link)return;
  link.setAttribute('href','/api/manifest');
  link.removeAttribute('data-theme-hint');
}

function syncBrowserChrome(theme:ThemeName){
  if(typeof document==='undefined')return;
  const primary=THEME_TOKENS[theme]['--primary'];
  const root=document.documentElement;
  root.style.setProperty('--system-chrome-color',primary);
  root.style.setProperty('--system-status-color',primary);
  const metas=Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  let meta=metas.find(node=>node.getAttribute(SYSTEM_META_ATTR)==='1')||metas[0]||null;
  for(const node of metas)if(node!==meta)node.remove();
  if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}
  meta.setAttribute(SYSTEM_META_ATTR,'1');
  meta.content=primary;
  normalizeManifestLink();
}

function unlockThemeAfterPaint(revision:number){
  if(typeof window==='undefined')return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const root=document.documentElement;
    if(revision===applyRevision)delete root.dataset.themeSwitching;
  }));
}

export function clearLegacyThemeState(){purgeLegacyThemeState()}

export function bootstrapThemeState():ThemeName{
  purgeLegacyThemeState();
  const root=typeof document==='undefined'?null:document.documentElement;
  const domTheme=root&&isThemeName(root.dataset.theme)?root.dataset.theme:null;
  const initial=domTheme||readThemeHint()||DEFAULT_THEME;
  applyTheme(initial);
  return initial;
}

export function applyTheme(theme:ThemeName){
  if(typeof document==='undefined')return;
  const root=document.documentElement;
  if(root.dataset.theme===theme&&root.dataset.themeApplied==='1'){
    rememberThemeHint(theme);
    syncBrowserChrome(theme);
    return;
  }
  const revision=++applyRevision;
  root.dataset.themeSwitching='1';
  root.dataset.themeGeneration=String(revision);
  delete root.dataset.theme;
  delete root.dataset.themeMode;
  for(const option of THEME_OPTIONS)root.classList.remove(`system-theme-${option.id}`);
  for(const key of THEME_TOKEN_KEYS)root.style.removeProperty(key);
  const tokens=THEME_TOKENS[theme];
  for(const key of THEME_TOKEN_KEYS)root.style.setProperty(key,tokens[key]);
  root.dataset.theme=theme;
  root.dataset.themeMode=THEME_MODES[theme];
  root.dataset.themeApplied='1';
  root.classList.add(`system-theme-${theme}`);
  rememberThemeHint(theme);
  syncBrowserChrome(theme);
  unlockThemeAfterPaint(revision);
}

async function readSystemThemeFromServer():Promise<ThemeName>{
  const {data,error}=await supabase.rpc('system_theme_get_v1');
  if(error)throw error;
  return isThemeName((data as {theme?:unknown}|null)?.theme)?(data as {theme:ThemeName}).theme:DEFAULT_THEME;
}

export async function fetchSystemTheme():Promise<ThemeName>{
  const next=await readSystemThemeFromServer();
  if(desiredSystemTheme&&next!==desiredSystemTheme)return desiredSystemTheme;
  applyTheme(next);
  return next;
}

async function flushThemeSaveQueue():Promise<ThemeName>{
  let confirmed=readTheme();
  while(pendingSaveTheme){
    const target=pendingSaveTheme;
    pendingSaveTheme=null;
    const {data,error}=await supabase.rpc('system_theme_set_v1',{p_theme:target});
    if(error){
      if(pendingSaveTheme)continue;
      desiredSystemTheme=null;
      try{confirmed=await readSystemThemeFromServer();applyTheme(confirmed)}catch{}
      throw error;
    }
    confirmed=isThemeName((data as {theme?:unknown}|null)?.theme)?(data as {theme:ThemeName}).theme:target;
    if(!pendingSaveTheme){desiredSystemTheme=null;applyTheme(confirmed)}
    else desiredSystemTheme=pendingSaveTheme;
  }
  return confirmed;
}

export function saveSystemTheme(theme:ThemeName):Promise<ThemeName>{
  pendingSaveTheme=theme;
  desiredSystemTheme=theme;
  applyTheme(theme);
  if(!saveRunner){
    let runner:Promise<ThemeName>;
    runner=flushThemeSaveQueue().finally(()=>{if(saveRunner===runner)saveRunner=null});
    saveRunner=runner;
  }
  return saveRunner;
}

export function watchSystemTheme(onTheme:(theme:ThemeName)=>void){
  const channel=supabase
    .channel('system-theme-global-v3')
    .on('broadcast',{event:'theme.changed'},message=>{
      const next=(message as {payload?:{theme?:unknown}})?.payload?.theme;
      if(!isThemeName(next))return;
      if(desiredSystemTheme&&next!==desiredSystemTheme)return;
      applyTheme(next);
      onTheme(next);
    })
    .subscribe();
  return ()=>{void supabase.removeChannel(channel)};
}
