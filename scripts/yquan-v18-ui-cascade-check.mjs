import fs from 'node:fs';

const main=fs.readFileSync('src/main.tsx','utf8');
const extensionPath='src/yquan-v18-ui-extensions.css';
const extension=fs.readFileSync(extensionPath,'utf8');

const required=[
  "import './yquan-v17-three-beds-flow.css';",
  "import './yquan-v18-visual-coherence.css';",
  "import './yquan-v18-ui-extensions.css';"
];
const forbidden=[
  "import './yquan-scale-harmony.css';",
  "import './yquan-display-fix.css';",
  "import './yquan-v18-final-character-scene.css';"
];

for(const item of required){
  if(!main.includes(item))throw new Error(`Missing canonical Y Quan import: ${item}`);
}
for(const item of forbidden){
  if(main.includes(item))throw new Error(`Obsolete Y Quan patch is still imported: ${item}`);
}

const positions=required.map(item=>main.indexOf(item));
if(!(positions[0]<positions[1]&&positions[1]<positions[2])){
  throw new Error('Y Quan CSS cascade order must be V17 -> V18 core -> V18 extensions.');
}

const importedYQuan=[...main.matchAll(/import '\.\/([^']*yquan[^']*\.css)';/gi)].map(match=>match[1]);
const duplicates=importedYQuan.filter((name,index)=>importedYQuan.indexOf(name)!==index);
if(duplicates.length)throw new Error(`Duplicate Y Quan CSS imports: ${[...new Set(duplicates)].join(', ')}`);

const contracts=[
  ['3-column cabinet','grid-template-columns:repeat(3,minmax(0,1fr))'],
  ['4-row cabinet','grid-template-rows:repeat(4,minmax(0,1fr))'],
  ['cabinet button reset','min-height:0!important'],
  ['phone two-column exams','grid-template-columns:repeat(2,minmax(0,1fr))'],
  ['narrow phone fallback','@media(max-width:350px)'],
  ['reduced motion','prefers-reduced-motion:reduce']
];
for(const [name,needle] of contracts){
  if(!extension.includes(needle))throw new Error(`Missing V18 UI contract: ${name}`);
}

const retired=[
  'src/yquan-scale-harmony.css',
  'src/yquan-display-fix.css',
  'src/yquan-v18-final-character-scene.css'
];
for(const path of retired){
  if(fs.existsSync(path))throw new Error(`Retired patch file still exists: ${path}`);
}

console.log(`Y Quan V18 CSS cascade OK: ${importedYQuan.join(' -> ')}`);
