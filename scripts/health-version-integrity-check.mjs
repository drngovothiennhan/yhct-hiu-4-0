import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const health=fs.readFileSync(new URL('../api/health.js',import.meta.url),'utf8');
const single=`version:'${pkg.version}'`;
const double=`version:"${pkg.version}"`;

if(!health.includes(single)&&!health.includes(double)){
  throw new Error(`[Health version integrity] api/health.js must report package version ${pkg.version}.`);
}

console.log(`Health version integrity PASS · ${pkg.version}`);
