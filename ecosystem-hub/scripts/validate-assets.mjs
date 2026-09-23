import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const componentPath = path.join(root, "components", "EcosystemMap.tsx");
const mapPath = path.join(root, "public", "ecosystem-map-art.svg");

const errors = [];
if (!fs.existsSync(mapPath)) {
  errors.push("Missing public/ecosystem-map-art.svg");
} else {
  const svg = fs.readFileSync(mapPath, "utf8");
  if (!svg.startsWith("<svg")) errors.push("Map artwork is not a valid SVG document.");
  if (!svg.includes('viewBox="0 0 1600 900"')) errors.push("Map artwork must keep the 1600x900 viewBox.");
  if (Buffer.byteLength(svg) < 10000) errors.push("Map artwork is unexpectedly small; possible placeholder/corruption.");
  if (!svg.includes("AI tongue clinic") || !svg.includes("3D atlas pavilion")) errors.push("Map artwork is missing required themed districts.");
}

const component = fs.readFileSync(componentPath, "utf8");
if (!component.includes('/ecosystem-map-art.svg')) {
  errors.push("EcosystemMap component is not wired to the validated SVG artwork.");
}
if (component.includes('/ecosystem-map-hiutmc.webp')) {
  errors.push("EcosystemMap still references the retired corrupt WebP artwork.");
}

if (errors.length) {
  console.error("Asset validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Asset validation passed: vector map artwork is present and wired.");
