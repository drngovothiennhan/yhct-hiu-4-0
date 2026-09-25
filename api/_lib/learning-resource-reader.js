import {createSign} from 'node:crypto';
import {memberAccess} from './member-access.js';

const SUPABASE_URL=String(process.env.VITE_SUPABASE_URL||'https://gzmpnsrwqjpsbklyflqr.supabase.co').trim();
const MAX_PDF_BYTES=48*1024*1024;
const MAX_RANGE_BYTES=8*1024*1024;
const allowedOrigins=new Set(['https://hiutmc.com','https://www.hiutmc.com']);
let cachedDriveToken='';
let cachedDriveTokenExpiresAt=0;

const clean=(value,max=300)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const b64url=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');

function driveServiceAccount(){
  try{
    const value=JSON.parse(String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||''));
    const email=clean(value?.client_email,320);
    const key=String(value?.private_key||'').replace(/\\n/g,'\n');
    return email&&key?{email,key}:null;
  }catch{return null}
}

async function driveAccessToken(){
  const now=Date.now();
  if(cachedDriveToken&&cachedDriveTokenExpiresAt>now+30000)return cachedDriveToken;
  const account=driveServiceAccount();
  if(!account)throw new Error('Drive reader is not configured');
  const issuedAt=Math.floor(now/1000);
  const header=b64url({alg:'RS256',typ:'JWT'});
  const claims=b64url({iss:account.email,scope:'https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:issuedAt,exp:issuedAt+300});
  const unsigned=header+'.'+claims;
  const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signer.sign(account.key,'base64url')}),
    signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw new Error('Drive authorization failed');
  const body=await response.json();
  const token=String(body?.access_token||'');
  if(!token)throw new Error('Drive authorization returned no token');
  cachedDriveToken=token;
  cachedDriveTokenExpiresAt=now+Math.min(240000,Math.max(60000,(Number(body?.expires_in)||300)*1000));
  return token;
}

async function driveRequest(fileId,token,headers={},media=false){
  const url=new URL('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId));
  url.searchParams.set('supportsAllDrives','true');
  if(media)url.searchParams.set('alt','media');
  return fetch(url,{headers:{authorization:'Bearer '+token,...headers},signal:AbortSignal.timeout(15000)});
}

function parseRange(raw,size){
  if(!raw)return null;
  const match=/^bytes=(\d*)-(\d*)$/.exec(String(raw).trim());
  if(!match||(!match[1]&&!match[2]))return false;
  let start,end;
  if(!match[1]){
    const suffix=Number(match[2]);
    if(!Number.isSafeInteger(suffix)||suffix<1)return false;
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    start=Number(match[1]);end=match[2]?Number(match[2]):size-1;
  }
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=size)return false;
  end=Math.min(end,size-1);
  if(end-start+1>MAX_RANGE_BYTES)return false;
  return{start,end};
}

async function serviceRpc(resourceKey){
  const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  if(!serviceKey||!SUPABASE_URL)throw new Error('Reader database credentials are not configured');
  const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/learning_resource_reader_source_v1',{
    method:'POST',
    headers:{apikey:serviceKey,authorization:'Bearer '+serviceKey,'content-type':'application/json'},
    body:JSON.stringify({p_resource_key:resourceKey}),
    signal:AbortSignal.timeout(6000)
  });
  if(!response.ok)throw new Error('Reader resource lookup failed');
  return response.json();
}

export async function serveProtectedLearningResource(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Disposition','inline');
  res.setHeader('Accept-Ranges','bytes');
  res.setHeader('Vary','Authorization, Origin, Range');

  const origin=String(req.headers?.origin||'');
  if(allowedOrigins.has(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Range');
    res.setHeader('Access-Control-Expose-Headers','Accept-Ranges, Content-Length, Content-Range, Content-Type');
    res.setHeader('Access-Control-Max-Age','600');
  }
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});

  const access=await memberAccess(req,'member');
  if(!access.ok)return res.status(access.status).json({ok:false,error:access.error});
  const resourceKey=String(req.query?.key||'').trim();
  if(!/^hiu_res_[0-9a-f]{20}$/.test(resourceKey))return res.status(404).json({ok:false,error:'Resource not found'});

  try{
    const source=await serviceRpc(resourceKey);
    if(!source||source.provider!=='drive'||source.mimeType!=='application/pdf'||!/^[-_a-zA-Z0-9]{10,200}$/.test(String(source.sourceLocator||''))){
      return res.status(404).json({ok:false,error:'PDF resource not found'});
    }
    const token=await driveAccessToken();
    const metadataResponse=await driveRequest(source.sourceLocator,token);
    if(!metadataResponse.ok)return res.status(404).json({ok:false,error:'PDF resource not found'});
    const metadata=await metadataResponse.json();
    const size=Number(metadata?.size||0);
    if(metadata?.mimeType!=='application/pdf'||!Number.isSafeInteger(size)||size<1||size>MAX_PDF_BYTES){
      return res.status(415).json({ok:false,error:'PDF is unavailable or exceeds the reader limit'});
    }
    const range=parseRange(req.headers?.range,size);
    if(range===false){
      res.setHeader('Content-Range','bytes */'+size);
      return res.status(416).end();
    }
    const headers=range?{range:'bytes='+range.start+'-'+range.end}:{};
    const contentResponse=await driveRequest(source.sourceLocator,token,headers,true);
    if(contentResponse.status!==200&&contentResponse.status!==206)return res.status(502).json({ok:false,error:'PDF content is temporarily unavailable'});
    const bytes=Buffer.from(await contentResponse.arrayBuffer());
    const expected=range?range.end-range.start+1:size;
    if(bytes.length!==expected)return res.status(502).json({ok:false,error:'PDF content response was incomplete'});
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Length',String(bytes.length));
    if(range){
      res.status(206);
      res.setHeader('Content-Range','bytes '+range.start+'-'+range.end+'/'+size);
    }else res.status(200);
    return res.end(bytes);
  }catch{
    return res.status(503).json({ok:false,error:'Protected reader is temporarily unavailable'});
  }
}
