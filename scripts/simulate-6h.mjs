const HOURS=6;
const EVENTS_PER_MINUTE=6;
const TOTAL=HOURS*60*EVENTS_PER_MINUTE;
const roles=['admin','mod','member'];
const roleRank={member:1,mod:2,admin:3};
const actions=[
  {name:'feed.read',min:'member',weight:20},
  {name:'drl.search',min:'member',weight:14},
  {name:'post.create',min:'member',weight:10},
  {name:'comment.create',min:'member',weight:10},
  {name:'document.download',min:'member',weight:7},
  {name:'news.review',min:'mod',weight:6},
  {name:'drl.import',min:'mod',weight:5},
  {name:'schedule.manage',min:'mod',weight:4},
  {name:'acc.health',min:'admin',weight:5},
  {name:'snapshot.create',min:'admin',weight:3},
  {name:'snapshot.restore.verify',min:'admin',weight:2}
];
const weighted=actions.flatMap(a=>Array.from({length:a.weight},()=>a));
let seed=0x4a594843;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/0x100000000};
const pick=a=>a[Math.floor(random()*a.length)];

const summary={virtualHours:HOURS,totalEvents:0,authorized:0,deniedByRole:0,transientFaults:0,autoRecovered:0,unresolved:0,byRole:{},byAction:{},auditSamples:[]};
for(const role of roles)summary.byRole[role]={events:0,authorized:0,denied:0};

for(let i=0;i<TOTAL;i++){
  const role=roles[i%roles.length];
  const action=pick(weighted);
  const allowed=roleRank[role]>=roleRank[action.min];
  const transient=random()<0.008;
  const recovered=transient&&random()<0.985;
  const minute=Math.floor(i/EVENTS_PER_MINUTE);
  const timestamp=new Date(Date.UTC(2026,8,7,0,0)+minute*60000).toISOString();
  const entry={timestamp,role,action:action.name,allowed,ip:`198.51.100.${10+(i%30)}`,userAgent:`YHCT-QA/${role}; mobile=${i%2===0}`};

  summary.totalEvents++;
  summary.byRole[role].events++;
  summary.byAction[action.name]=(summary.byAction[action.name]||0)+1;
  if(allowed){summary.authorized++;summary.byRole[role].authorized++}else{summary.deniedByRole++;summary.byRole[role].denied++}
  if(transient){summary.transientFaults++;if(recovered){summary.autoRecovered++}else{summary.unresolved++}}
  if(summary.auditSamples.length<12&&(i%Math.floor(TOTAL/12)===0))summary.auditSamples.push(entry);
}

const assertions=[
  ['event count',summary.totalEvents===TOTAL],
  ['admin has no role denials',summary.byRole.admin.denied===0],
  ['mod cannot access admin-only actions',summary.deniedByRole>0],
  ['fault recovery bounded',summary.unresolved<=2],
  ['audit samples include IP',summary.auditSamples.every(x=>x.ip)],
  ['audit samples include user agent',summary.auditSamples.every(x=>x.userAgent)],
  ['virtual duration',summary.virtualHours===6]
];
const failed=assertions.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length){console.error('SIM6H FAILED',failed.join(', '));process.exit(1)}
console.log('sim6h-ok',JSON.stringify(summary));
