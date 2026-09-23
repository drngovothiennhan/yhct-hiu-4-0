import { ecosystemApps } from "../data/apps.ts";

const required = new Map([
  ["study-os", "study.hiutmc.com"],
  ["ai-thiet-chan", "thietchan.hiutmc.com"],
  ["trung-y-van", "trungyvan.hiutmc.com"],
  ["atlas", "atlas.hiutmc.com"],
]);

const errors = [];

if (ecosystemApps.length !== required.size) {
  errors.push(`Expected ${required.size} registered apps, found ${ecosystemApps.length}.`);
}

const seenSlugs = new Set();
const seenUpstreams = new Set();

for (const app of ecosystemApps) {
  if (!required.has(app.slug)) errors.push(`Unexpected app slug: ${app.slug}`);
  if (seenSlugs.has(app.slug)) errors.push(`Duplicate slug: ${app.slug}`);
  seenSlugs.add(app.slug);

  let upstream;
  let canonical;
  try { upstream = new URL(app.currentUpstreamUrl); } catch { errors.push(`Invalid upstream URL for ${app.slug}`); }
  try { canonical = new URL(app.plannedCanonicalDomain); } catch { errors.push(`Invalid canonical URL for ${app.slug}`); }

  if (upstream) {
    if (upstream.protocol !== "https:") errors.push(`${app.slug} upstream must use HTTPS.`);
    if (upstream.hostname === "github.com") errors.push(`${app.slug} points to a GitHub repository instead of a runnable app.`);
    if (seenUpstreams.has(upstream.href)) errors.push(`Duplicate upstream: ${upstream.href}`);
    seenUpstreams.add(upstream.href);
  }

  if (canonical) {
    const expectedHost = required.get(app.slug);
    if (canonical.protocol !== "https:" || canonical.hostname !== expectedHost) {
      errors.push(`${app.slug} canonical domain must be https://${expectedHost}/`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(app.verifiedAt)) {
    errors.push(`${app.slug} verifiedAt must use YYYY-MM-DD.`);
  }

  if (app.x < 5 || app.x > 95 || app.y < 5 || app.y > 95) {
    errors.push(`${app.slug} hotspot coordinate is outside the safe map area.`);
  }
}

for (const slug of required.keys()) {
  if (!seenSlugs.has(slug)) errors.push(`Missing required app: ${slug}`);
}

if (errors.length) {
  console.error("Registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Registry validation passed for ${ecosystemApps.length} ecosystem apps.`);
