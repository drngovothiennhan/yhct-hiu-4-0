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
  {id:'gemini-server',label:'Gemini Server Runtime',kind:'cloud-llm',state:'optional',zeroInstallCost:true,networkRequired:true,capabilities:['structured-output','research','exam','multimodal-ready','provider-failover'],note:'Optional server-side provider. No mandatory software-license/setup fee; API quota or usage charges depend on the Google tier selected by the deployment owner.'},
  {id:'browser-local',label:'Browser Local A.I',kind:'browser-local',state:'active',zeroInstallCost:true,networkRequired:false,capabilities:['fallback','topic-suggestion','local-translation'],note:'Runs on-device when browser capability is available.'},
  {id:'gemini-byok',label:'Gemini BYOK',kind:'byok-llm',state:'optional',zeroInstallCost:true,networkRequired:true,capabilities:['admin-testing','fallback'],note:'Legacy admin/testing adapter; the production direction is the server-side Gemini provider so secrets are not distributed to browsers.'},
  {id:'central-rag',label:'Central YHCT RAG',kind:'knowledge',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['evidence-search','citations','offline-fallback'],note:'Supabase-backed YHCT knowledge with verified evidence links.'},
  {id:'drive-rag',label:'Drive RAG',kind:'knowledge',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['private-library-search'],note:'Server-side retrieval from the configured YHCT research folder.'},
  {id:'openalex',label:'OpenAlex',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['literature-search','citation-metadata'],note:'Primary open scholarly discovery source.'},
  {id:'semantic-scholar',label:'Semantic Scholar',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['literature-search','recommendations','citation-graph','openalex-fallback'],note:'Bounded zero-cost fallback for OpenAlex; public API throttling is handled as a degraded source, never as fabricated evidence.'},
  {id:'opencitations',label:'OpenCitations',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['citation-count','citation-graph','doi-enrichment'],note:'Best-effort DOI citation-count enrichment on a bounded subset of search results.'},
  {id:'pubmed',label:'PubMed',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['biomedical-search'],note:'Biomedical literature source used by Research Center.'},
  {id:'europe-pmc',label:'Europe PMC',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['biomedical-search','full-text-links','pubmed-fallback'],note:'Active zero-cost fallback for PubMed search; public endpoints are rate-limited.'},
  {id:'clinicaltrials',label:'ClinicalTrials.gov',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['trial-search'],note:'Clinical trial registry source used by Research Center.'},
  {id:'crossref',label:'Crossref REST',kind:'academic-search',state:'active',zeroInstallCost:true,networkRequired:true,capabilities:['doi-metadata','reference-resolution','literature-fallback'],note:'Active bounded fallback when the trial registry is unavailable or returns no result.'},
  {id:'unpaywall',label:'Unpaywall',kind:'academic-search',state:'optional',zeroInstallCost:true,networkRequired:true,capabilities:['open-access-resolution'],note:'Optional until a deployment contact email is configured, because the public API requires an email parameter.'}
];

export const activeAiProviders=()=>aiProviderRegistry.filter(x=>x.state==='active');
export const candidateZeroCostProviders=()=>aiProviderRegistry.filter(x=>x.state==='candidate'&&x.zeroInstallCost);
