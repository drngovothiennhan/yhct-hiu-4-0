import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=f=>fs.readFileSync(path.join(root,f),'utf8');let failed=false;
const ok=m=>console.log(`V15 PASS ${m}`),fail=m=>{failed=true;console.error(`V15 FAIL ${m}`)},has=(t,n,m)=>t.includes(n)?ok(m):fail(`${m} (missing ${n})`),no=(t,n,m)=>!t.includes(n)?ok(m):fail(`${m} (forbidden ${n})`);
const sql=read('supabase/migrations/202609101500_hiu_y_quan_engagement_v15.sql');
const ui=read('src/components/game/HiuYQuanEngagementV15.tsx');
const host=read('src/components/game/HerbGardenGame.tsx');
const css=read('src/yquan-v15-engagement.css');
const main=read('src/main.tsx');
const core=read('src/components/game/HiuYQuanGame.tsx');

for(const table of ['hiu_y_quan_engagement_profiles','hiu_y_quan_mastery','hiu_y_quan_herb_challenge_sessions','hiu_y_quan_daily_rewards','hiu_y_quan_consult_votes']){
  has(sql,`public.${table}` ,`${table} exists`);
  has(sql,`alter table public.${table} enable row level security`,`${table} has RLS`);
  has(sql,`revoke all on table public.${table} from anon, authenticated`,`${table} denies direct member table access`);
}
has(sql,"expires_at<=started_at+interval '60 seconds'",'official herb challenge is capped at sixty server seconds');
has(sql,"jsonb_array_length(questions)=8",'herb challenge contains exactly eight questions');
has(sql,"(p_questions->p_index)-'correct_index'-'herb_key'",'challenge answer metadata is stripped before public response');
has(sql,"update public.hiu_y_quan_engagement_profiles set xp=least(xp+2",'correct herb answers award isolated XP');
has(sql,"'diagnose','label','Chẩn đúng 2 ca'",'daily diagnosis mission exists');
has(sql,"'discharge','label','Hoàn tất 1 ca Dưỡng Trị'",'daily discharge mission exists');
has(sql,"'herb','label','Thử thách Tủ thuốc đạt 3 câu đúng'",'daily herb mission exists');
has(sql,"xp=least(xp+25",'daily completion awards 25 XP');
has(sql,"on conflict do nothing; get diagnostics inserted=row_count",'daily/busy reward paths are idempotent');
has(sql,"check (ordinal between 1 and 3)",'case ordinal expands compatibly to optional third patient');
has(sql,"ordinal=3",'busy shift targets only the third hourly slot');
has(sql,"on conflict do nothing",'busy shift cannot duplicate a third case');
has(sql,"private.hiu_y_quan_consult_payload_v15",'shared deterministic consultation payload exists');
has(sql,"payload-'correct_code'-'correct_label'-'explanation'",'consult answer stays hidden before vote');
has(sql,"primary key(consult_date,member_id)",'consult allows one vote per member per day');
has(sql,"'distribution',distribution",'community vote distribution is revealed after voting');
has(sql,"private.hiu_y_quan_sync_syndrome_mastery_v15",'syndrome mastery reuses correct V14 attempts');
has(sql,"public.hiu_y_quan_herbs_v14()",'herb mastery reuses verified V14 herb catalog');
no(sql,'herb_garden_wallets','V15 never writes Gia Vien wallet');
no(sql,'award_points(','V15 does not route rewards through legacy score currency');
for(const fn of ['hiu_y_quan_engagement_v15()','hiu_y_quan_herb_challenge_start_v15()','hiu_y_quan_daily_claim_v15()','hiu_y_quan_busy_shift_v15()','hiu_y_quan_consult_today_v15()','hiu_y_quan_collection_v15()']){
  has(sql,`revoke all on function public.${fn} from public,anon`,`${fn} is not anonymous`);
  has(sql,`grant execute on function public.${fn} to authenticated`,`${fn} is authenticated-only`);
}
has(sql,'revoke all on function public.hiu_y_quan_herb_challenge_answer_v15(uuid,integer) from public,anon','challenge answer is not anonymous');
has(sql,'grant execute on function public.hiu_y_quan_herb_challenge_answer_v15(uuid,integer) to authenticated','challenge answer is authenticated-only');
has(sql,'revoke all on function public.hiu_y_quan_consult_vote_v15(text) from public,anon','consult vote is not anonymous');
has(sql,'grant execute on function public.hiu_y_quan_consult_vote_v15(text) to authenticated','consult vote is authenticated-only');

has(ui,"type EngagementTab='daily'|'herb'|'busy'|'consult'|'collection'",'all five engagement surfaces are isolated in one component');
has(ui,"hiu_y_quan_herb_challenge_start_v15",'60-second challenge is wired');
has(ui,"hiu_y_quan_daily_claim_v15",'daily mission claim is wired');
has(ui,"hiu_y_quan_busy_shift_v15",'busy shift is wired');
has(ui,"hiu_y_quan_consult_vote_v15",'community consultation vote is wired');
has(ui,"hiu_y_quan_collection_v15",'mastery collection is wired');
has(ui,'class V15Boundary extends Component','V15 has a local failure boundary');
has(ui,'HIU Y Quán cốt lõi vẫn hoạt động bình thường','V15 failure explicitly preserves core game UX');
has(ui,'không phải phân loại cấp cứu','busy mode is explicitly non-triage');
has(ui,'không ghi vào kho Gia Viên','collection remains isolated from Gia Vien inventory');
no(ui,'correct_index','frontend never receives or depends on answer index');

has(host,"import HiuYQuanEngagementV15 from './HiuYQuanEngagementV15'",'V15 is integrated at the stable game wrapper');
has(host,'<HiuYQuanGame key={clinicRefreshKey} member={member}/>','core V14 remount is scoped to clinic refresh');
has(host,'onClinicRefresh={()=>setClinicRefreshKey(value=>value+1)}','busy shift refreshes core without modifying its logic');
no(core,'hiu_y_quan_busy_shift_v15','V14 core game remains decoupled from V15 busy shift');
no(core,'hiu_y_quan_daily_claim_v15','V14 core game remains decoupled from V15 rewards');
has(main,"import './yquan-v15-engagement.css'",'V15 CSS is loaded');
const v14Index=main.indexOf("import './yquan-v14-clinic-flow.css'"),v15Index=main.indexOf("import './yquan-v15-engagement.css'");
if(v14Index>=0&&v15Index>v14Index)ok('V15 CSS loads after V14');else fail('V15 CSS must load after V14');
no(css,'100vh','V15 CSS avoids viewport-height stretching');no(css,'100dvh','V15 CSS avoids dynamic viewport-height stretching');has(css,'html[data-desktop-on-phone="true"]','V15 has desktop-on-phone guard');has(css,'@media(max-width:680px)','V15 has compact mobile layout');

const routeCount=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>e.isDirectory()?n+(e.name.startsWith('_')?0:routeCount(path.join(dir,e.name))):n+(/\.(?:js|ts)$/.test(e.name)?1:0),0);
const apiRoutes=routeCount(path.join(root,'api'));if(apiRoutes<=12)ok(`Vercel Hobby function budget preserved (${apiRoutes}/12)`);else fail(`Vercel Hobby function budget exceeded (${apiRoutes}/12)`);
if(failed)process.exit(1);console.log('V15 HIU Y Quan engagement contract passed.');
