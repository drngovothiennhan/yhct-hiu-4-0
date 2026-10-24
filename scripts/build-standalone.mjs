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

// Tài nguyên public được gọi bằng đường dẫn tuyệt đối (ví dụ /club-yhct-logo.svg) sẽ không tải được khi mở file cục bộ.
// Nhúng các file đó thành data URI (chỉ file có thật trong public/).
let inlinedAssets = 0;
const publicDir = path.resolve('public');
html = html.replace(/(?<![A-Za-z0-9_.\/:-])\/((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:svg|png|webp|jpg|jpeg|gif|ico))(\?[A-Za-z0-9._=&-]*)?/g, (m, rel) => {
  const file = path.join(publicDir, rel);
  if (!fs.existsSync(file)) return m;
  const ext = path.extname(rel).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  inlinedAssets += 1;
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
});

const outFile = path.join(outDir, 'study-os-standalone.html');
fs.writeFileSync(outFile, html);
const leftovers = (html.match(/src="\.\/assets\/[^"]+"|href="\.\/assets\/[^"]+"/g) || []).length;
console.log(`standalone: ${outFile} ${Math.round(html.length / 1024)} KB, inlined public assets: ${inlinedAssets}, external asset refs left: ${leftovers}`);
if (leftovers > 0) process.exitCode = 1;
