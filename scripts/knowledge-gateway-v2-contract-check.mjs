import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Knowledge Gateway V2 contract] ${message}`)};
const requireText=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbidText=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const migration=read('supabase/migrations/202609121430_learning_resource_gateway_v1.sql');
const hardening=read('supabase/migrations/202609121435_learning_resource_quiz_publish_guard_v1.sql');
const gateway=read('api/_lib/knowledge-gateway.js');
const route=read('api/knowledge/resources.js');
const drive=read('api/ai/drive-rag.js');

requireText(migration,/private\.learning_resources_v1/,'resource registry must stay in private schema');
requireText(migration,/private\.learning_resource_sources_v1/,'raw source registry must stay in private schema');
requireText(migration,/resource_key[^\n]+hiu_res_/,'stable opaque application resource key is required');
requireText(migration,/source_locator text not null/,'source locator must be stored separately from public resource identity');
requireText(migration,/unique index[^;]+one_current_idx/is,'each resource must have one current source revision');
requireText(migration,/private\.is_learning_content_manager\(\)/,'writes and publication must preserve scoped learning-content capability');
requireText(migration,/private\.is_approved\(\)/,'member reads must require approved membership');
requireText(migration,/revoke all on table private\.learning_resources_v1 from public,anon,authenticated/,'private registry must not be directly readable by browser roles');
requireText(migration,/revoke all on table private\.learning_resource_sources_v1 from public,anon,authenticated/,'raw source registry must not be directly readable by browser roles');
requireText(migration,/learning_resource_get_v1/,'safe resource get RPC is required');
requireText(migration,/learning_resource_list_v1/,'safe resource list RPC is required');
requireText(migration,/learning_resource_publish_v1/,'explicit publish RPC is required');

const safeRpcBodies=[
  migration.match(/create or replace function public\.learning_resource_get_v1[\s\S]*?end\n\$\$;/i)?.[0]||'',
  migration.match(/create or replace function public\.learning_resource_list_v1[\s\S]*?end\n\$\$;/i)?.[0]||''
].join('\n');
forbidText(safeRpcBodies,/source_locator|source_version|source_metadata|drive_file_id|webViewLink|drive\.google\.com/i,'student/member read RPC must never return raw Drive/source locators');

requireText(hardening,/resource_type='quiz_source'/,'quiz-source publication must have a dedicated integrity gate');
requireText(hardening,/review_status in\('source_verified','expert_approved'\)/,'quiz-source publication must require reviewed eligible questions');
requireText(hardening,/practice_questions/,'publish guard must reuse the canonical quiz bank instead of creating a parallel approval state');
requireText(hardening,/learning_resource_sources_v1_created_by_idx/,'private source foreign key must be indexed');

requireText(gateway,/learningContentAccess\(req\)/,'server writes must enforce Learning Content Manager capability');
requireText(gateway,/memberAccess\(req,['"]member['"]\)/,'safe reads must enforce approved member access');
requireText(gateway,/^const resourceKey=.*\^hiu_res_/m,'server must validate opaque resource keys');
forbidText(route,/SUPABASE_SERVICE_ROLE|GOOGLE_SERVICE_ACCOUNT|GOOGLE_DRIVE_API_KEY|drive\.google\.com/i,'public gateway route must not contain infrastructure secrets or raw Drive URLs');
requireText(route,/Cache-Control['"],['"]no-store/,'resource API must disable caching of authenticated metadata');
requireText(route,/Vary['"],['"]Authorization/,'resource API must vary on member authorization');

requireText(drive,/registerDriveLearningResource/,'Drive quiz sync must register sources through Knowledge Gateway');
requireText(drive,/resourceKey:''/,'admin sync result should expose stable app resource key when available');
requireText(drive,/practice_drive_ingest_admin_v1/,'existing quiz ingest/review pipeline must remain in place');
forbidText(gateway,/expert_approved|correct_index|practice_questions/,'Knowledge Gateway API helper must not implement a parallel quiz approval state');

console.log('Knowledge Gateway V2 contracts: PASS');
