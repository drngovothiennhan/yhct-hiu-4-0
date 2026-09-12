const STUDY_OS_PARAM='studyos';
const LEGACY_VALUE='legacy';

/**
 * Phase 14 production cutover: Study OS V2 is now the default Home surface.
 * `?studyos=legacy` remains as an emergency visual rollback only; it does not
 * change auth, data, quiz, Research or module contracts.
 */
export function studyOsV2CanaryEnabled(search?:string):boolean{
  const raw=search??(typeof window==='undefined'?'':window.location.search);
  if(!raw)return true;
  try{return new URLSearchParams(raw).get(STUDY_OS_PARAM)!==LEGACY_VALUE}catch{return true}
}
