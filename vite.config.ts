import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const githubPages=process.env.GITHUB_PAGES==='true';

function productionChunk(id:string){
  const normalized=id.replace(/\\/g,'/');
  if(normalized.includes('/node_modules/react/')||normalized.includes('/node_modules/react-dom/')||normalized.includes('/node_modules/scheduler/'))return 'vendor-react';
  if(normalized.includes('/node_modules/@supabase/'))return 'vendor-supabase';
  if(normalized.includes('/node_modules/lucide-react/'))return 'vendor-icons';
  if(normalized.includes('/node_modules/xlsx/')||normalized.includes('/node_modules/mammoth/'))return 'vendor-documents';
  if(normalized.includes('/src/components/admin/'))return 'feature-admin';
  if(normalized.includes('/src/components/drl/'))return 'feature-drl';
  if(normalized.includes('/src/components/research/'))return 'feature-research';
  if(normalized.includes('/src/components/exam/'))return 'feature-exam';
  if(normalized.includes('/src/components/schedule/'))return 'feature-schedule';
  if(normalized.includes('/src/components/profile/'))return 'feature-profile';
  if(normalized.includes('/src/components/notifications/'))return 'feature-notifications';
  return undefined;
}

export default defineConfig({
  base:githubPages?'/yhct-hiu-4-0/':'/',
  plugins:[react()],
  build:{
    target:'es2022',
    sourcemap:false,
    rollupOptions:{output:{manualChunks:productionChunk}}
  },
  server:{port:4173}
});
