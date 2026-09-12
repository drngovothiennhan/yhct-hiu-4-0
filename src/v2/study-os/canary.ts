const CANARY_PARAM='studyos';
const CANARY_VALUE='v2';

/**
 * Phase 13A is intentionally default-off. The new shell is available only
 * when an explicit `?studyos=v2` query flag is present. This keeps the
 * production Home contract untouched while the V2 surface is verified.
 */
export function studyOsV2CanaryEnabled(search?:string):boolean{
  const raw=search??(typeof window==='undefined'?'':window.location.search);
  if(!raw)return false;
  try{return new URLSearchParams(raw).get(CANARY_PARAM)===CANARY_VALUE}catch{return false}
}
