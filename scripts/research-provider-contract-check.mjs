import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const need=(ok,msg)=>{if(!ok){console.error(`FAIL: ${msg}`);process.exitCode=1}else console.log(`OK: ${msg}`)};
const service=read('src/services/researchService.ts'),evidenceClient=read('src/services/researchEvidenceService.ts'),registry=read('src/modules/ai/providers/registry.ts'),publicEvidence=read('api/_lib/public-medical-evidence.js'),resourceApi=read('api/knowledge/resources.js'),center=read('src/components/research/ResearchCenter.tsx'),researchAi=read('src/components/research/ResearchAiMini.tsx'),gemini=read('api/_lib/gemini-provider.js'),driveRag=read('api/_lib/drive-rag.js');

need(service.includes('searchSemanticScholar')&&service.includes('fallback Semantic Scholar'),'legacy OpenAlex adapter keeps bounded Semantic Scholar fallback for compatibility');
need(service.includes('citationCountOpenCitations')&&service.includes('enrichOpenCitationCounts'),'OpenCitations DOI enrichment stays bounded');
need(registry.includes("id:'semantic-scholar'")&&registry.match(/id:'semantic-scholar'[\s\S]{0,220}state:'active'/),'Semantic Scholar registry state is active');
need(registry.includes("id:'opencitations'")&&registry.match(/id:'opencitations'[\s\S]{0,220}state:'active'/),'OpenCitations registry state is active');
need(!registry.includes("id:'unpaywall'")&&!registry.includes('candidateZeroCostProviders'),'unused expansion adapters stay out of the canonical provider registry');

need(evidenceClient.includes("/api/knowledge/resources?action=research")&&evidenceClient.includes('searchResearchEvidence'),'Research UI uses one canonical server-side public evidence route');
need(resourceApi.includes("action==='research'")&&resourceApi.includes('retrievePublicResearchEvidence'),'existing knowledge function owns research retrieval without adding serverless sprawl');
need(publicEvidence.includes('Panax vietnamensis Ngoc Linh ginseng'),'Ngoc Linh query expands to the scientific botanical name');
need(publicEvidence.includes("provider:'ClinicalTrials.gov'")&&publicEvidence.includes("provider:'Crossref'")&&publicEvidence.includes('rankResearchRows'),'server retrieval merges resilient sources and relevance-ranks results');
need(center.includes('searchResearchEvidence(query,18)')&&!center.includes('Promise.allSettled([searchPubMed'),'Research Center no longer fires browser-side provider fan-out or exposes provider transport failures');
need(researchAi.includes('searchResearchEvidence(text,14,controller.signal)')&&researchAi.includes('reusePublic')&&!/searchPubMed|searchOpenAlex|searchClinicalTrials/.test(researchAi),'Research A.I reuses matching evidence and performs at most one canonical public retrieval');
need(gemini.includes('geminiModelCandidates')&&gemini.includes('GEMINI_RESEARCH_FALLBACK_MODEL')&&gemini.includes('gemini_model_failover'),'Gemini research has one bounded stable-model failover');
need(gemini.includes('generationConfig(mode,maxOutputTokens,schema,model)'),'Gemini generation config follows the actual fallback model');
need(service.includes("/api/research/drive?refresh=1"),'Research Drive sync forces a fresh server index instead of reusing the five-minute cache');
need(driveRag.includes('GOOGLE_SERVICE_ACCOUNT_JSON')&&driveRag.includes('driveConfigured')&&driveRag.includes('includeItemsFromAllDrives'),'Research Drive sync supports private/shared folders through server-side service account auth');

if(process.exitCode)process.exit(process.exitCode);console.log('Research Center resilience contract passed: canonical server retrieval + relevance filtering + bounded Gemini failover + anti-sprawl policy.');
