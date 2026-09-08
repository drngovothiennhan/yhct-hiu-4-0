const THEMES={
  'duoc-ngoc':'#174C3C','muc-tuyen':'#202824','ngu-y':'#651F24','tcm-cartoon-2d':'#159A84',
  'tcm-isometric-3d':'#176B5A','tcm-spring-2d':'#147D67','tcm-cloud-2d':'#376F9F','tcm-mint-modern':'#0F766E'
};
const FALLBACK_THEME='duoc-ngoc';
const DEFAULT_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
const DEFAULT_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';

async function readSystemTheme(){
  const base=(process.env.VITE_SUPABASE_URL||DEFAULT_URL).replace(/\/$/,'');
  const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||DEFAULT_KEY;
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),2500);
    const response=await fetch(`${base}/rest/v1/rpc/system_theme_get_v1`,{
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:'{}',
      signal:controller.signal,
      cache:'no-store'
    });
    clearTimeout(timer);
    if(!response.ok)return FALLBACK_THEME;
    const data=await response.json();
    return typeof data?.theme==='string'&&Object.prototype.hasOwnProperty.call(THEMES,data.theme)?data.theme:FALLBACK_THEME;
  }catch{return FALLBACK_THEME}
}

export default async function handler(_req,res){
  const theme=await readSystemTheme();
  const body={
    id:'./',
    name:'YHCT HIU 4.0',
    short_name:'YHCT HIU',
    description:'Mạng xã hội Học thuật & Luyện thi Y học Cổ truyền',
    start_url:'./',
    scope:'./',
    display:'standalone',
    background_color:'#f6f1e7',
    theme_color:THEMES[theme]||THEMES[FALLBACK_THEME],
    lang:'vi',
    categories:['education','medical','social'],
    prefer_related_applications:false,
    icons:[
      {src:'yhct-system-mark.svg',sizes:'any',type:'image/svg+xml',purpose:'any'},
      {src:'yhct-system-mark.svg',sizes:'any',type:'image/svg+xml',purpose:'maskable'}
    ],
    shortcuts:[
      {name:'Bảng tin học thuật',short_name:'Bảng tin',url:'./',icons:[{src:'yhct-system-mark.svg',sizes:'any',type:'image/svg+xml'}]},
      {name:'Trung tâm nghiên cứu',short_name:'Nghiên cứu',url:'./research',icons:[{src:'yhct-system-mark.svg',sizes:'any',type:'image/svg+xml'}]},
      {name:'Tường cá nhân',short_name:'Cá nhân',url:'./profile',icons:[{src:'yhct-system-mark.svg',sizes:'any',type:'image/svg+xml'}]}
    ]
  };
  res.setHeader('Content-Type','application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, max-age=0, must-revalidate');
  res.setHeader('X-YHCT-System-Theme',theme);
  res.status(200).send(JSON.stringify(body));
}
