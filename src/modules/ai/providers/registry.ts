export type AiProviderKind='cloud-llm'|'browser-local'|'byok-llm'|'knowledge'|'academic-search'|'translation';
export type AiProviderState='active'|'optional'|'candidate';

export type AiProviderDescriptor={
  id:string;
  label:string;
  kind:AiProviderKind;
  state:AiProviderState;
  zeroInstallCost:boolean;
  networkRequired:boolean;
  capabilities:string[];
  note:string;
};

export const aiProviderRegistry:AiProviderDescriptor[]=[
  {id:'openai',label:'OpenAI Cloud Runtime',kind:'cloud-llm',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['structured-output','function-calling','general','research','exam'],note:'Server-side gateway; usage cost is controlled by the deployment owner.'},
  {id:'browser-local',label:'Browser Local A.I',kind:'browser-local',state:'active',zeroInstallCost:true,networkRequired:false,capabilities:['fallback','topic-suggestion','local-translation'],note:'Runs on-device when browser capability is available.'},
  {id:'gemini-byok',label:'Gemini BYOK',kind:'byok-llm',state:'optional',zeroInstallCost:true,networkRequired:true,capabilities:['fallback'],note:'Optional user-supplied key stored only for the browser session.'},
  {id:'central-rag',label:'Central YHCT RAG',kind:'knowledge',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['evidence-search','citations','offline-fallback'],note:'Supabase-backed YHCT knowledge with verified evidence links.'},
  {id:'drive-rag',label:'Drive RAG',kind:'knowledge',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['private-library-search'],note:'Server-side retrieval from the configured YHCT research folder.'},
  {id:'openalex',label:'OpenAlex',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['literature-search','citation-metadata'],note:'Open scholarly discovery source.'},
  {id:'pubmed',label:'PubMed',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['biomedical-search'],note:'Biomedical literature source used by Research Center.'},
  {id:'clinicaltrials',label:'ClinicalTrials.gov',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['trial-search'],note:'Clinical trial registry source used by Research Center.'},
  {id:'semantic-scholar',label:'Semantic Scholar',kind:'academic-search',state:'candidate',zeroInstallCost:true,networkRequired:true,capabilities:['ai-literature-search','recommendations','citation-graph'],note:'Recommended zero-cost search adapter; public endpoints are available without authentication but are rate-limited.'},
  {id:'europe-pmc',label:'Europe PMC',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['biomedical-search','full-text-links','pubmed-fallback'],note:'Active zero-cost fallback for PubMed search; public endpoints are rate-limited.'},
  {id:'crossref',label:'Crossref REST',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['doi-metadata','reference-resolution','literature-fallback'],note:'Active bounded fallback when the trial registry is unavailable or returns no result; public REST rate limits apply.'},
  {id:'opencitations',label:'OpenCitations',kind:'academic-search',state:'candidate',zeroInstallCost:true,networkRequired:true,capabilities:['citation-graph','reference-count'],note:'Recommended open citation graph adapter with public rate limits.'},
  {id:'unpaywall',label:'Unpaywall',kind:'academic-search',state:'candidate',zeroInstallCost:true,networkRequired:true,capabilities:['open-access-resolution'],note:'Recommended adapter to locate legal open-access copies from DOI metadata.'}
];

export const activeAiProviders=()=>aiProviderRegistry.filter(x=>x.state==='active');
export const candidateZeroCostProviders=()=>aiProviderRegistry.filter(x=>x.state==='candidate'&&x.zeroInstallCost);
