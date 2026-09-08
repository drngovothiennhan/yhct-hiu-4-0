import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const profile=read('src/components/profile/ProfileCenter.tsx');
const css=read('src/components/profile/ProfileCenter.module.css');
const tokens=read('src/design-system/tokens.css');
const main=read('src/main.tsx');

const errors=[];
const requiredProfile=[
  "import styles from './ProfileCenter.module.css'",
  'className={styles.root}',
  'data-wall-theme={wallTheme}',
  'styles.overviewCard',
  'styles.wallCard',
  'styles.drlCard',
  'styles.passwordCard'
];
for(const token of requiredProfile)if(!profile.includes(token))errors.push(`ProfileCenter missing ${token}`);

const forbiddenStructural=[
  'className="panel"',
  'className="row"',
  'className="between"',
  'className="schedule-actions"',
  'className="profile-shell"',
  'className="personal-wall"'
];
for(const token of forbiddenStructural)if(profile.includes(token))errors.push(`ProfileCenter reintroduced global structural class ${token}`);

const requiredCss=[
  'container:account/inline-size',
  'grid-template-columns:repeat(4,minmax(0,1fr))',
  '@container account (min-width:46rem)',
  'grid-template-columns:repeat(12,minmax(0,1fr))',
  'overflow:clip',
  "[data-wall-theme='bamboo']",
  '@media(max-width:680px)'
];
for(const token of requiredCss)if(!css.includes(token))errors.push(`Profile CSS missing ${token}`);

const requiredTokens=['--ds-space-1:4px','--ds-space-2:8px','--ds-color-surface:var(--surface','--ds-color-primary:var(--primary','--ds-radius-lg:18px'];
for(const token of requiredTokens)if(!tokens.includes(token))errors.push(`design tokens missing ${token}`);
if(!main.includes("import './design-system/tokens.css';"))errors.push('design tokens are not loaded by main.tsx');

if(errors.length){
  console.error('ACCOUNT LAYOUT CHECK FAILED');
  for(const error of errors)console.error(`- ${error}`);
  process.exit(1);
}

console.log('account-layout-ok: ProfileCenter uses scoped CSS Modules, semantic tokens, 4-column mobile and 12-column container-query desktop layout');
