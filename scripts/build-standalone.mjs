// Xuất Study OS thành MỘT file HTML tự chứa (JS và CSS nhúng sẵn) để mở trực tiếp hoặc tải về.
// Chỉ là bản sao cục bộ: không thay đổi build production, không đụng trang chủ.
// Tính năng cần máy chủ (đăng nhập, AI, đồng bộ, PDF worker) sẽ không hoạt động trong bản này.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const outDir = path.resolve('dist-standalone');
const release = String(process.env.GITHUB_SHA || 'standalone').slice(0, 12);

await build({
  configFile: false,
  root: process.cwd(),
  base: './',
  logLevel: 'warn',
  plugins: [react()],
  define: { __YHCT_RELEASE_ID__: JSON.stringify(release) },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      input: { main: 'index.html' },
      output: { inlineDynamicImports: true },
    },
  },
});

const indexPath = path.join(outDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_m, src) => {
  const js = fs.readFileSync(path.join(outDir, src), 'utf8');
  return `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`;
});
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) => {
  const css = fs.readFileSync(path.join(outDir, href), 'utf8');
  return `<style>${css}</style>`;
});
// Manifest và icon nằm trên máy chủ; bản cục bộ không dùng tới.
html = html.replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '');

const outFile = path.join(outDir, 'study-os-standalone.html');
fs.writeFileSync(outFile, html);
const leftovers = (html.match(/src="\.\/assets\/[^"]+"|href="\.\/assets\/[^"]+"/g) || []).length;
console.log(`standalone: ${outFile} ${Math.round(html.length / 1024)} KB, external asset refs left: ${leftovers}`);
if (leftovers > 0) process.exitCode = 1;
