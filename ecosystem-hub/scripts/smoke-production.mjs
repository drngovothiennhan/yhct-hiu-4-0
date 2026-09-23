const base = process.env.BASE_URL || "https://hiutmc.com";
const routes = [
  ["/", "HIU TMC Ecosystem"],
  ["/ecosystem/study-os/", "Study OS"],
  ["/ecosystem/ai-thiet-chan/", "A.I Thiệt Chẩn"],
  ["/ecosystem/trung-y-van/", "Trung Y Văn HIU"],
  ["/ecosystem/atlas/", "3D Huyệt vị"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getWithRetry(url, attempts = 12) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "HIU-TMC-release-smoke/1.0" },
      });
      clearTimeout(timer);
      const text = await response.text();
      if (response.ok) return { response, text, attempt: i };
      last = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      last = error;
    }
    if (i < attempts) await sleep(10000);
  }
  throw last || new Error(`Unable to fetch ${url}`);
}

for (const [route, marker] of routes) {
  const url = new URL(route, base).toString();
  const { response, text, attempt } = await getWithRetry(url);
  if (!text.includes(marker)) {
    throw new Error(`${url} is reachable but missing expected marker: ${marker}`);
  }
  console.log(`PASS ${response.status} ${url} (attempt ${attempt})`);
}

const home = await fetch(new URL("/", base), { redirect: "follow" });
const requiredHeaders = [
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
];
for (const [name, expected] of requiredHeaders) {
  const value = home.headers.get(name);
  if (!value || !value.toLowerCase().includes(expected)) {
    throw new Error(`Missing/invalid production header ${name}: ${value ?? "<absent>"}`);
  }
  console.log(`PASS header ${name}: ${value}`);
}

console.log("HIU TMC production smoke passed.");
