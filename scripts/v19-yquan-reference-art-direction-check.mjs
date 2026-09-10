import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const css=read('src/yquan-v19-reference-art-direction.css');
const main=read('src/main.tsx');
const game=read('src/components/game/HiuYQuanGame.tsx');

const groups=[];
const group=(name,points,checks)=>{
  const failed=checks.filter(([label,test])=>!test).map(([label])=>label);
  const earned=failed.length?0:points;
  groups.push({name,points,earned,failed});
};
const has=(text,needle)=>text.includes(needle);

const v18Index=main.indexOf("import './yquan-v18-final-character-scene.css';");
const v19Index=main.indexOf("import './yquan-v19-reference-art-direction.css';");

group('Architecture / cascade',20,[
  ['V19 stylesheet exists',css.length>1000],
  ['V19 imported',v19Index>=0],
  ['V19 loads after V18 final',v18Index>=0&&v19Index>v18Index],
  ['Scoped to HIU Y Quan',has(css,'.hyq-page--v17')],
  ['No backend client usage in visual layer',!/(supabase|\.rpc\s*\()/i.test(css)]
]);

group('Character system',20,[
  ['Doctor scale token',has(css,'--hyq-v19-doctor-scale')],
  ['Patient scale token',has(css,'--hyq-v19-patient-scale')],
  ['Semi-chibi face rules',has(css,'.hyq-doctor--chibi .hyq-face')],
  ['Large-eye treatment',has(css,'.hyq-doctor--chibi .hyq-face i')],
  ['Academy outfit treatment',has(css,'.hyq-outfit--academy .hyq-robe')],
  ['Master outfit treatment',has(css,'.hyq-outfit--master .hyq-robe')],
  ['Senior patient treatment',has(css,'.hyq-patient--senior .head:before')]
]);

group('Three-scene visual grammar',20,[
  ['Consult scene',has(css,'.hyq-room--consult')],
  ['Ward scene',has(css,'.hyq-room--ward')],
  ['Lab scene',has(css,'.hyq-room--lab')],
  ['Drawer-wall/cabinet system',has(css,'.hyq-world-cabinet')&&has(css,'.hyq-cabinet-drawer')],
  ['Three-bed bank preserved',has(css,'.hyq-bed-bank-v17')&&has(game,'const bedSlots=[1,2,3] as const')],
  ['Dispensing props preserved',has(css,'.hyq-mortar')&&has(css,'.hyq-scale')&&has(css,'.hyq-herb-tray')],
  ['Mobile focus room',has(css,'.hyq-room.is-focus')&&has(css,'position:absolute!important')]
]);

group('Responsive geometry',15,[
  ['Desktop max width bounded',has(css,'max-width:1040px!important')],
  ['Mobile breakpoint <=760',has(css,'@media(max-width:760px)')],
  ['Android breakpoint <=420',has(css,'@media(max-width:420px)')],
  ['Narrow fallback <=350',has(css,'@media(max-width:350px)')],
  ['Mobile world full width',has(css,'max-width:none!important')],
  ['Focused room removes three-column miniaturization',has(css,'display:block!important')&&has(css,'visibility:hidden!important')&&has(css,'visibility:visible!important')]
]);

group('Clinical UI readability',10,[
  ['Tứ chẩn desktop grid retained',has(css,'grid-template-columns:repeat(4,minmax(0,1fr))!important')],
  ['Tứ chẩn mobile two-column layout',has(css,'grid-template-columns:repeat(2,minmax(0,1fr))!important')],
  ['Scene toolbar has three touch targets',has(css,'grid-template-columns:repeat(3,minmax(0,1fr))!important')],
  ['Patient strip bounded',has(css,'.hyq-case-patient-strip')]
]);

const requiredRpcs=[
  'hiu_y_quan_state_v1','hiu_y_quan_hourly_cases_v4','hiu_y_quan_herbs_v14',
  'hiu_y_quan_records_v14','hiu_y_quan_customize_v1','hiu_y_quan_activate_v1',
  'hiu_y_quan_submit_v1','hiu_y_quan_disposition_v17','hiu_y_quan_recheck_v14',
  'hiu_y_quan_appointment_decide_v2'
];
group('Gameplay/data regression guard',10,[
  ['Core game RPC contract still present',requiredRpcs.every((name)=>has(game,name))],
  ['Three scene order still present',has(game,"const sceneOrder:ClinicScene[]=['consult','lab','ward']")],
  ['No API route or database code added by V19 CSS',!/(fetch\(|axios|supabase|postgres|service_role)/i.test(css)]
]);

group('Motion/accessibility',5,[
  ['Reduced motion supported',has(css,'@media(prefers-reduced-motion:reduce)')&&has(css,'transition:none!important')],
  ['World retains semantic label',has(game,'aria-label="Phòng khám HIU Y Quán ba bối cảnh"')],
  ['Scene navigation retains accessible label',has(game,'aria-label="Chọn bối cảnh"')]
]);

const score=groups.reduce((sum,item)=>sum+item.earned,0);
for(const item of groups){
  const mark=item.earned===item.points?'PASS':'FAIL';
  console.log(`${mark} ${item.name}: ${item.earned}/${item.points}`);
  for(const failure of item.failed)console.log(`  - ${failure}`);
}
console.log(`HIU Y Quan V19 technical acceptance score: ${score}/100`);
if(score<95){
  console.error('V19 REJECTED: technical score must be >=95/100.');
  process.exit(1);
}
console.log('V19 TECHNICAL GATE ACCEPTED (>=95/100). Pixel-level visual similarity still requires visual screenshot QA.');
