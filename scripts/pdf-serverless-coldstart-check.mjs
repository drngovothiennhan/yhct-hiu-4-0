import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[PDF serverless cold-start] ${message}`)};
const pdf=read('api/_lib/pdf-quiz-source.js');
const pipeline=read('api/_lib/quiz-pipeline-v2.js');
const route=read('api/ai/drive-rag.js');
const pkg=JSON.parse(read('package.json'));

if(/^import\s+\{?\s*PDFParse[^\n]+from\s+['"]pdf-parse['"]/m.test(pdf))fail('pdf-parse must not be statically imported into the Drive/RAG cold-start graph');
if(!/await import\(['"]@napi-rs\/canvas['"]\)/.test(pdf))fail('native canvas runtime must be lazy-loaded only for actual PDF parsing');
if(!/await import\(['"]pdf-parse['"]\)/.test(pdf))fail('pdf-parse must be dynamically loaded after canvas globals are initialized');
for(const key of ['DOMMatrix','ImageData','Path2D'])if(!pdf.includes(`globalThis.${key}`))fail(`${key} serverless polyfill contract missing`);
if(pkg.dependencies?.['@napi-rs/canvas']!=='0.1.80')fail('@napi-rs/canvas must be an explicit production dependency for Vercel tracing');
if(pkg.dependencies?.['pdf-parse']!=='2.4.5')fail('validated pdf-parse version changed unexpectedly');
if(!pipeline.includes("from './pdf-quiz-source.js'"))fail('quiz pipeline PDF source integration disappeared');
if(!route.includes("from '../_lib/quiz-pipeline-v2.js'"))fail('Drive/RAG route no longer exercises the protected pipeline import graph');

// Importing the production route must be safe before any request/auth/PDF work happens.
await import('../api/ai/drive-rag.js');
console.log('PDF serverless cold-start contract: PASS');
