import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error(`CENTRAL-RAG FAIL: ${message}`);process.exitCode=1};
const ok=message=>console.log(`OK: ${message}`);
const requireText=(text,needle,label)=>text.includes(needle)?ok(label):fail(`${label} (missing ${needle})`);

const baseMigration=read('supabase/migrations/20260908121556_ai_knowledge_central_rag_v1.sql');
const evidenceMigration=read('supabase/migrations/202609081925_ai_knowledge_evidence_pubmed_scholar_v1.sql');
const authorityMigration=read('supabase/migrations/202609082020_ai_knowledge_authority_sources_v3.sql');
const service=read('src/services/centralKnowledgeService.ts');
const tools=read('api/_lib/ai-tools.js');
const access=read('api/_lib/member-access.js');
const health=read('api/ai/health.js');
const mini=read('src/components/ai/UnifiedAiMini.tsx');

requireText(baseMigration,'create table if not exists public.ai_knowledge_items','base central knowledge table is versioned in repo');
const baseSeeds=[...baseMigration.matchAll(/\('(?:formula|herb|acupoint)-/g)].length;
if(baseSeeds>=26)ok(`base migration versions at least 26 YHCT corpus rows (${baseSeeds})`);else fail(`expected at least 26 versioned corpus seeds, found ${baseSeeds}`);
requireText(baseMigration,'ai_knowledge_search_v1','base central search RPC is versioned');
requireText(baseMigration,'ai_knowledge_stats_v1','base central stats RPC is versioned');

requireText(evidenceMigration,'create table if not exists public.ai_knowledge_evidence','central publication evidence table is versioned');
requireText(evidenceMigration,'ai_knowledge_search_v2','central RAG v2 evidence RPC is versioned');
requireText(evidenceMigration,'ai_knowledge_stats_v2','central RAG v2 stats RPC is versioned');
requireText(evidenceMigration,'https://pubmed.ncbi.nlm.nih.gov/','evidence seeds use canonical PubMed URLs');
requireText(evidenceMigration,'https://scholar.google.com/scholar?','Google Scholar remains DOI discovery/verification link, not sole evidence source');
requireText(evidenceMigration,'verified boolean not null default true','publication evidence schema requires explicit verification state');
requireText(evidenceMigration,'revoke all on table public.ai_knowledge_evidence from anon,authenticated','raw publication evidence table is not directly exposed');
const pmids=[...evidenceMigration.matchAll(/'([0-9]{6,9})','10\./g)].map(match=>match[1]);
const uniquePmids=new Set(pmids);
if(uniquePmids.size>=10)ok(`migration contains ${uniquePmids.size} unique PMID-backed evidence seeds`);else fail(`expected at least 10 unique PMID seeds, found ${uniquePmids.size}`);
if(/WITHDRAWN/i.test(evidenceMigration))fail('withdrawn publications must not be seeded');else ok('publication migration excludes withdrawn records');

requireText(authorityMigration,'create table if not exists public.ai_knowledge_authority_sources','institutional authority source table is versioned');
requireText(authorityMigration,"provider in ('who','nccih','cochrane')",'authority provider whitelist is explicit');
requireText(authorityMigration,'ai_knowledge_search_v3','authority-enriched v3 search RPC is versioned');
requireText(authorityMigration,'ai_knowledge_stats_v3','authority-enriched v3 stats RPC is versioned');
requireText(authorityMigration,'https://www.who.int/publications/i/item/9789240113176','WHO 2025-2034 strategy uses official URL');
requireText(authorityMigration,'https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know','NCCIH TCM evidence summary uses official NIH URL');
requireText(authorityMigration,'https://doi.org/10.1002/14651858.CD003281.pub5','Cochrane PC6 review uses canonical DOI');
requireText(authorityMigration,'revoke all on table public.ai_knowledge_authority_sources from anon,authenticated','raw authority source table is not directly exposed');
for(const provider of ["'who'","'nccih'","'cochrane'"]){if(authorityMigration.includes(provider))ok(`authority migration includes ${provider}`);else fail(`authority provider missing: ${provider}`)}

requireText(service,"supabase.rpc('ai_knowledge_search_v3'",'client searches authority-enriched Supabase RAG first');
requireText(service,'searchLocalKnowledge','client retains IndexedDB knowledge fallback');
requireText(service,"source:'central'",'client labels centralized results');
requireText(service,"source:'local'",'client labels offline fallback results');
requireText(service,'referenceLabel','client formats publication and authority provenance');
requireText(service,"'who'|'nccih'|'cochrane'",'client authority types are provider-whitelisted');
for(const forbidden of ['feedback_submit_v1','research_apply_v1','system_theme_set_v1','drl_admin_']){
  if(service.includes(forbidden))fail(`central knowledge service must be read-only; forbidden RPC found: ${forbidden}`);else ok(`central knowledge service excludes mutation RPC ${forbidden}`);
}

requireText(tools,'search_yhct_knowledge','AI tool registry includes centralized YHCT knowledge search');
requireText(tools,"rpc:'ai_knowledge_search_v3'",'AI knowledge tool uses authority-enriched v3 RPC');
requireText(tools,"minRole:'member'",'AI knowledge tool is role-bound to approved members');
requireText(tools,'WHO, NCCIH/NIH hoặc Cochrane','AI tool description communicates authority providers');
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
requireText(mini,'Nguồn đối chiếu đã xác minh','A.I Mini visibly labels verified references');
requireText(mini,'PubMed/DOI + WHO/NCCIH/Cochrane','A.I Mini communicates diversified high-standard evidence sources');
requireText(mini,'offline fallback','A.I Mini communicates offline fallback');

requireText(access,'export async function publicRpc','server provides bounded public RPC transport for readiness checks');
requireText(access,'safeRpcName','public/member RPC transports validate RPC names');
requireText(health,"publicRpc('ai_knowledge_stats_v3'",'AI health checks live authority-enriched RAG stats');
requireText(health,'centralRag:true','AI health advertises Central RAG architecture');
requireText(health,'centralRagReady','AI health reports live Central RAG readiness');
requireText(health,'evidenceBacked:true','AI health advertises evidence-backed knowledge');
requireText(health,"evidenceSources:['pubmed','doi','google_scholar','who','nccih','cochrane']",'AI health reports diversified evidence providers');
requireText(health,'offlineFallback:true','AI health advertises offline fallback');
requireText(health,'authority>=8&&who>=3&&nccih>=4&&cochrane>=1','AI health requires live authority-source minimums');

if(!process.exitCode)ok('Central RAG acceptance passed');
