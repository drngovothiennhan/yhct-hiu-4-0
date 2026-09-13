import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const githubPages=process.env.GITHUB_PAGES==='true';
const releaseId=String(process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||process.env.npm_package_version||'local').slice(0,64);

// Keep manual chunking limited to true third-party vendor families.
// Application modules already use React.lazy(); forcing src/components/* into
// named manual chunks can pull shared code back into the entry graph and make
// lazy routes preload on first paint.
function productionChunk(id:string){
  const normalized=id.replace(/\\/g,'/');
  if(normalized.includes('/node_modules/react/')||normalized.includes('/node_modules/react-dom/')||normalized.includes('/node_modules/scheduler/'))return 'vendor-react';
  if(normalized.includes('/node_modules/@supabase/'))return 'vendor-supabase';
  if(normalized.includes('/node_modules/lucide-react/'))return 'vendor-icons';
  if(normalized.includes('/node_modules/xlsx/')||normalized.includes('/node_modules/mammoth/'))return 'vendor-documents';
  return undefined;
}

export default defineConfig({
  base:githubPages?'/yhct-hiu-4-0/':'/',
  plugins:[react()],
  define:{__YHCT_RELEASE_ID__:JSON.stringify(releaseId)},
  build:{
    target:'es2022',
    sourcemap:false,
    rollupOptions:{output:{manualChunks:productionChunk}}
  },
  server:{port:4173}
});
