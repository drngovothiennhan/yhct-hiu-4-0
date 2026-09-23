import type { MetadataRoute } from "next";
import { ecosystemApps } from "@/data/apps";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://hiutmc.com";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...ecosystemApps.map((app) => ({
      url: `${base}/ecosystem/${app.slug}/`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
