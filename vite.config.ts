import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const githubPages=process.env.GITHUB_PAGES==='true';

export default defineConfig({
  base:githubPages?'/yhct-hiu-4-0/':'/',
  plugins:[react()],
  build:{target:'es2022',sourcemap:false},
  server:{port:4173}
});
