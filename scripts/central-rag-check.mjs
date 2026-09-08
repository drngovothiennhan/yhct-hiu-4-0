import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error(`CENTRAL-RAG FAIL: ${message}`);process.exitCode=1};
const ok=message=>console.log(`OK: ${message}`);
const requireText=(text,needle,label)=>text.includes(needle)?ok(label):fail(`${label} (missing ${needle})`);

const migration=read('supabase/migrations/202609081925_ai_knowledge_evidence_pubmed_scholar_v1.sql');
const service=read('src/services/centralKnowledgeService.ts');
const tools=read('api/_lib/ai-tools.js');
const access=read('api/_lib/member-access.js');
const health=read('api/ai/health.js');
const mini=read('src/components/ai/UnifiedAiMini.tsx');

requireText(migration,'create table if not exists public.ai_knowledge_evidence','central evidence table is versioned');
requireText(migration,'ai_knowledge_search_v2','central RAG v2 search RPC is versioned');
requireText(migration,'ai_knowledge_stats_v2','central RAG stats RPC is versioned');
requireText(migration,'https://pubmed.ncbi.nlm.nih.gov/','evidence seeds use canonical PubMed URLs');
requireText(migration,'https://scholar.google.com/scholar?','evidence seeds expose Google Scholar DOI lookups');
requireText(migration,'verified boolean not null default true','evidence schema requires explicit verification state');
requireText(migration,'revoke all on table public.ai_knowledge_evidence from anon,authenticated','raw evidence table is not directly exposed');

const pmids=[...migration.matchAll(/'([0-9]{6,9})','10\./g)].map(match=>match[1]);
const uniquePmids=new Set(pmids);
if(uniquePmids.size>=10)ok(`migration contains ${uniquePmids.size} unique PMID-backed evidence seeds`);else fail(`expected at least 10 unique PMID seeds, found ${uniquePmids.size}`);
if(/WITHDRAWN/i.test(migration))fail('withdrawn publications must not be seeded');else ok('migration excludes withdrawn publication records');

requireText(service,"supabase.rpc('ai_knowledge_search_v2'",'client searches centralized Supabase RAG first');
requireText(service,'searchLocalKnowledge','client retains IndexedDB knowledge fallback');
requireText(service,"source:'central'",'client labels centralized results');
requireText(service,"source:'local'",'client labels offline fallback results');
requireText(service,'evidenceLabel','client formats verified PMID/DOI provenance');
for(const forbidden of ['feedback_submit_v1','research_apply_v1','system_theme_set_v1','drl_admin_']){
  if(service.includes(forbidden))fail(`central knowledge service must be read-only; forbidden RPC found: ${forbidden}`);else ok(`central knowledge service excludes mutation RPC ${forbidden}`);
}

requireText(tools,'search_yhct_knowledge','AI tool registry includes centralized YHCT knowledge search');
requireText(tools,"rpc:'ai_knowledge_search_v2'",'AI knowledge tool uses evidence-enriched v2 RPC');
requireText(tools,"minRole:'member'",'AI knowledge tool is role-bound to approved members');
for(const forbidden of ['feedback_submit_v1','research_apply_v1','system_theme_set_v1','drl_admin_']){
  if(tools.includes(forbidden))fail(`AI tool registry must remain read-only; forbidden mutation RPC found: ${forbidden}`);else ok(`AI registry excludes mutation RPC ${forbidden}`);
}

const toolModule=await import('../api/_lib/ai-tools.js');
const guestTools=toolModule.aiToolsForRole('guest').map(tool=>tool.name);
const memberTools=toolModule.aiToolsForRole('member').map(tool=>tool.name);
if(memberTools.includes('search_yhct_knowledge'))ok('approved member receives central YHCT search tool');else fail('member is missing central YHCT search tool');
if(!guestTools.includes('search_yhct_knowledge'))ok('guest cannot receive authenticated AI knowledge tool');else fail('guest must not receive central AI tool through cloud gateway');

requireText(mini,"from '../../services/centralKnowledgeService'",'A.I Mini uses centralized knowledge service');
requireText(mini,"searchKnowledge(text,'all',5)",'A.I Mini executes central-first knowledge search before cloud escalation');
requireText(mini,'Nguồn đối chiếu đã xác minh','A.I Mini visibly labels verified evidence provenance');
requireText(mini,'Central RAG · offline fallback','A.I Mini communicates central-first/offline architecture');

requireText(access,'export async function publicRpc','server provides bounded public RPC transport for readiness checks');
requireText(access,'safeRpcName','public/member RPC transports validate RPC names');
requireText(health,"publicRpc('ai_knowledge_stats_v2'",'AI health checks the live central knowledge RPC');
requireText(health,'centralRag:true','AI health advertises Central RAG architecture');
requireText(health,'centralRagReady','AI health reports live Central RAG readiness');
requireText(health,'evidenceBacked:true','AI health advertises evidence-backed knowledge');
requireText(health,"evidenceSources:['pubmed','google_scholar']",'AI health reports non-secret evidence providers');
requireText(health,'offlineFallback:true','AI health advertises offline fallback');
requireText(health,'total>=26&&evidence>=10&&pubmed>=10&&scholar>=10','AI health requires minimum live corpus/evidence counts');

if(!process.exitCode)ok('Central RAG acceptance passed');
