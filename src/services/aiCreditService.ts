import {supabase} from './authService';

export type AiCredits={enforced:boolean;unlimited:boolean;balance:number;expiringWithin30Days:number};

// Launch gift. The server ignores it until the owner enables the campaign, so asking is always safe.
const LAUNCH_CAMPAIGN='launch-2026-10-01';
const claimKey=(memberId:string)=>`hiu-ai-credit-claim-${LAUNCH_CAMPAIGN}-${memberId}`;

function asCredits(value:unknown):AiCredits|null{
  const raw=value as Partial<AiCredits>|null;
  if(!raw||typeof raw!=='object'||typeof raw.balance!=='number')return null;
  return{enforced:raw.enforced===true,unlimited:raw.unlimited===true,balance:Math.max(0,Math.trunc(raw.balance)),expiringWithin30Days:Math.max(0,Math.trunc(Number(raw.expiringWithin30Days)||0))};
}

// Returns null when credits are not switched on (or not reachable): callers then show nothing.
export async function loadAiCredits(memberId:string,signal?:AbortSignal):Promise<AiCredits|null>{
  try{
    const {data}=await supabase.auth.getSession(),token=data.session?.access_token;
    if(!token)return null;
    const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
    let claimed=false;
    try{claimed=localStorage.getItem(claimKey(memberId))==='1'}catch{claimed=false}
    if(!claimed){
      const response=await fetch('/api/ai/assistant',{method:'POST',signal,headers,body:JSON.stringify({mode:'credits',op:'claim',campaign:LAUNCH_CAMPAIGN})});
      const payload=await response.json().catch(()=>null) as {claim?:{claimed?:boolean;reason?:string};credits?:unknown}|null;
      if(response.ok&&(payload?.claim?.claimed===true||payload?.claim?.reason==='already_claimed')){try{localStorage.setItem(claimKey(memberId),'1')}catch{/* storage unavailable */}}
      return response.ok?asCredits(payload?.credits):null;
    }
    const response=await fetch('/api/ai/assistant?action=credits',{signal,headers:{Authorization:`Bearer ${token}`}});
    const payload=await response.json().catch(()=>null) as {credits?:unknown}|null;
    return response.ok?asCredits(payload?.credits):null;
  }catch{return null}
}
