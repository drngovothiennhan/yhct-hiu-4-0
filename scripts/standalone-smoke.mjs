// Mở bản HTML tự chứa bằng Chromium headless (khung điện thoại), ghi lỗi JS và chụp màn hình.
import path from 'node:path';
import { chromium } from 'playwright';

const file = path.resolve('dist-standalone/study-os-standalone.html');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => failedRequests.push(r.url().slice(0, 120)));
await page.goto('file://' + file, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);
const state = await page.evaluate(() => ({
  rootChildren: document.querySelector('#root')?.children.length ?? -1,
  booting: document.documentElement.dataset.appBooting ?? null,
  textLen: (document.body?.innerText || '').trim().length,
  title: document.title,
}));
await page.screenshot({ path: path.resolve('dist-standalone/standalone-phone.png'), fullPage: false });
// Đi qua các nút điều hướng (thanh dưới và menu) và ghi lỗi theo từng màn.
const navLabels = await page.$$eval('nav button, nav a, [role="tab"]', (els) =>
  [...new Set(els.map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter((t) => t && t.length < 40))]
).catch(() => []);
const screens = [];
for (const label of navLabels.slice(0, 12)) {
  const before = pageErrors.length + consoleErrors.length;
  try {
    await page.locator('nav button, nav a, [role="tab"]').filter({ hasText: label }).first().click({ timeout: 4000 });
    await page.waitForTimeout(1200);
    const len = await page.evaluate(() => (document.body?.innerText || '').trim().length);
    screens.push(`${label}:ok(${len})${pageErrors.length + consoleErrors.length > before ? ':ERR' : ''}`);
  } catch (e) {
    screens.push(`${label}:not-clickable`);
  }
}
console.log(`::notice title=screens::${screens.join(' | ')}`);
console.log(`::notice title=errors-after-screens::${pageErrors.length} page / ${consoleErrors.length} console`);
await browser.close();

console.log(`::notice title=state::${JSON.stringify(state)}`);
console.log(`::notice title=pageerrors::${pageErrors.length} ${pageErrors.slice(0, 5).join(' | ')}`);
console.log(`::notice title=consoleerrors::${consoleErrors.length} ${consoleErrors.slice(0, 6).join(' | ')}`);
console.log(`::notice title=failedrequests::${failedRequests.length} ${failedRequests.slice(0, 6).join(' | ')}`);
if (state.rootChildren <= 0) {
  console.log('::error title=blank::#root trống, app không dựng được');
  process.exitCode = 1;
}
