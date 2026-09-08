import fs from 'node:fs';

const files={
  main:'src/main.tsx',
  component:'src/components/herbs/SmartHerbCenter.tsx',
  css:'src/components/herbs/smart-herb.css',
  migration:'supabase/migrations/20260908_smart_herbs_v1.sql',
  vercel:'vercel.json'
};

const read=(path)=>fs.readFileSync(path,'utf8');
const checks=[];
const add=(name,ok,detail)=>checks.push({name,ok:Boolean(ok),detail});

for(const [name,path] of Object.entries(files))add(`file:${name}`,fs.existsSync(path),path);

const main=read(files.main);
const component=read(files.component);
const css=read(files.css);
const migration=read(files.migration);
const vercel=JSON.parse(read(files.vercel));

add('route:component-import',main.includes("import SmartHerbCenter from './components/herbs/SmartHerbCenter';"),'SmartHerbCenter import');
add('route:path-gate',main.includes("window.location.pathname==='/smart-herb'"),'public /smart-herb path');
add('route:render-gate',main.includes('isSmartHerb?<SmartHerbCenter/>:<App/>'),'isolated render path');

for(const pmid of ['41976194','39199328','42543293'])add(`evidence:pmid:${pmid}`,component.includes(pmid),`PMID ${pmid}`);
add('safety:disclaimer',component.includes('không thay thế chẩn đoán hoặc điều trị chuyên môn'),'medical education disclaimer');
add('fallback:three-herbs',['duong-quy','sinh-khuong','cam-thao'].every(slug=>component.includes(`slug:'${slug}'`)),'3 offline-safe demo herbs');
add('ui:mobile-breakpoint',css.includes('@media(max-width:460px)'),'phone breakpoint');

add('db:table',migration.includes('create table if not exists public.smart_herbs'),'isolated catalog table');
add('db:rls',migration.includes('alter table public.smart_herbs enable row level security'),'RLS enabled');
add('db:read-policy',migration.includes('for select')&&migration.includes('to anon, authenticated'),'public read policy');
add('db:no-public-mutation',migration.includes('revoke insert, update, delete on table public.smart_herbs from anon, authenticated'),'anon/auth mutation revoked');

const rewrites=Array.isArray(vercel.rewrites)?vercel.rewrites:[];
add('vercel:manifest-preserved',rewrites.some(r=>r?.source==='/manifest.webmanifest'&&r?.destination==='/api/manifest'),'existing manifest route preserved');
add('vercel:smart-herb-rewrite',rewrites.some(r=>r?.source==='/smart-herb'&&r?.destination==='/'),'SPA deep-link rewrite');
add('vercel:auto-deploy-remains-off',vercel?.git?.deploymentEnabled===false,'no production auto-deploy side effect');

const placeholderPatterns=[/\bTODO\b/i,/implement later/i,/code here/i];
add('quality:no-placeholders',!placeholderPatterns.some(rx=>rx.test(component)),'no placeholder implementation markers');

const failed=checks.filter(c=>!c.ok);
for(const check of checks)console.log(`${check.ok?'PASS':'FAIL'} ${check.name} — ${check.detail}`);
console.log(`\nSmart Herb release gate: ${checks.length-failed.length}/${checks.length} checks passed.`);
if(failed.length){
  console.error(`Failed checks: ${failed.map(c=>c.name).join(', ')}`);
  process.exit(1);
}
