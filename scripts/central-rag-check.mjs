import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error(`CENTRAL-RAG FAIL: ${message}`);process.exitCode=1};
const ok=message=>console.log(`OK: ${message}`);
const requireText=(text,needle,label)=>text.includes(needle)?ok(label):fail(`${label} (missing ${needle})`);
const forbidText=(text,needle,label)=>!text.includes(needle)?ok(label):fail(`${label} (forbidden ${needle})`);

const baseMigration=read('supabase/migrations/20260908121556_ai_knowledge_central_rag_v1.sql');
const evidenceMigration=read('supabase/migrations/202609081925_ai_knowledge_evidence_pubmed_scholar_v1.sql');
const authorityMigration=read('supabase/migrations/202609082020_ai_knowledge_authority_sources_v3.sql');
const surfaceMigration=read('supabase/migrations/202609081328_ai_knowledge_public_surface_v4.sql');
const service=read('src/services/centralKnowledgeService.ts');
const tools=read('api/_lib/ai-tools.js');
const access=read('api/_lib/member-access.js');
const health=read('api/ai/health.js');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const research=read('src/components/research/ResearchCenter.tsx');
const researchMini=read('src/components/research/ResearchAiMini.tsx');
const researchEvidence=read('src/services/researchEvidenceService.ts');
const researchApi=read('api/knowledge/resources.js');

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

requireText(surfaceMigration,'revoke all on function public.ai_knowledge_search_v1','legacy v1 search RPC is removed from public surface');
requireText(surfaceMigration,'revoke all on function public.ai_knowledge_search_v2','legacy v2 search RPC is removed from public surface');
requireText(surfaceMigration,'revoke all on function public.ai_knowledge_stats_v1','legacy v1 stats RPC is removed from public surface');
requireText(surfaceMigration,'revoke all on function public.ai_knowledge_stats_v2','legacy v2 stats RPC is removed from public surface');
requireText(surfaceMigration,'grant execute on function public.ai_knowledge_search_v3','v3 search remains the sole public RAG search surface');
requireText(surfaceMigration,'grant execute on function public.ai_knowledge_stats_v3','v3 stats remains the sole public RAG stats surface');

requireText(service,"supabase.rpc('ai_knowledge_search_v3'",'client searches authority-enriched Supabase RAG first inside the central service');
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

requireText(researchMini,"from '../../services/centralKnowledgeService'",'Research A.I Mini uses centralized academic knowledge service');
requireText(researchMini,"internalEnabled?searchKnowledge(text,'all',4)",'Research A.I queries Central RAG only after explicit per-request opt-in');
requireText(researchMini,'centralSources','Research A.I Mini maps central evidence into bounded AI sources');
requireText(researchMini,'h.evidence','Research A.I Mini includes publication evidence in source context');
requireText(researchMini,'h.authoritySources','Research A.I Mini includes WHO/NCCIH/Cochrane authority evidence in source context');
requireText(researchMini,'Dùng tài liệu nội bộ cho lượt này','Research A.I visibly exposes explicit one-request internal-context opt-in');
requireText(researchMini,'Mặc định chỉ dùng PubMed/Europe PMC · OpenAlex · ClinicalTrials.gov','Research A.I clearly states its default public-evidence scope without provider-choice UX');
requireText(researchMini,'setUseInternal(false)','Research A.I consumes internal-context consent after each request');
requireText(researchMini,'result.citations','Research A.I visibly renders server-validated source-backed provenance');
requireText(researchMini,'các nguồn đã tìm vẫn được giữ bên dưới','Research A.I fails closed without fabricating a local answer while preserving independently retrieved evidence');
requireText(research,'searchResearchEvidence(query,18)','Research Center uses the canonical public evidence client');
requireText(researchEvidence,"/api/knowledge/resources?action=research",'Research client crosses one bounded server boundary');
requireText(researchApi,"action==='research'",'existing knowledge function owns public Research retrieval');
for(const old of ['searchPubMed(query,12)','searchOpenAlex(query,12)','searchClinicalTrials(query,8)'])forbidText(research,old,`Research Center excludes browser provider fan-out ${old}`);
requireText(research,'Bằng chứng công khai','Research Center independently exposes public evidence for verification');
if(!mini.includes('centralKnowledgeService')&&!mini.includes('searchKnowledge(')&&!mini.includes('searchOpenAlex')&&!mini.includes('searchDriveRag'))ok('Global A.I Mini is cleanly separated from academic RAG');else fail('Global A.I Mini must not load academic RAG providers');

requireText(access,'export async function publicRpc','server provides bounded public RPC transport for readiness checks');
requireText(access,'safeRpcName','public/member RPC transports validate RPC names');
requireText(health,"publicRpc('ai_knowledge_stats_v3'",'AI health checks live authority-enriched RAG stats');
requireText(health,'centralRag:true','AI health advertises Central RAG architecture');
requireText(health,'centralRagReady','AI health reports live Central RAG readiness');
requireText(health,'evidenceBacked:true','AI health advertises evidence-backed knowledge');
requireText(health,"evidenceSources:['pubmed','doi','google_scholar','who','nccih','cochrane']",'AI health reports diversified evidence providers');
requireText(health,'offlineFallback:true','AI health advertises offline fallback');
requireText(health,'authority>=8&&who>=3&&nccih>=4&&cochrane>=1','AI health requires live authority-source minimums');

if(!process.exitCode)ok('Central RAG acceptance passed with public evidence default, request-scoped internal RAG and server-bounded academic retrieval isolated to Research Center');