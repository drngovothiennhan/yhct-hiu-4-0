import { ecosystemApps } from "@/data/apps";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return ecosystemApps.map((app) => ({ slug: app.slug }));
}

export default async function AppDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = ecosystemApps.find((item) => item.slug === slug);
  if (!app) notFound();

  return (
    <main className="detailPage">
      <a className="backLink" href="/">← Về bản đồ</a>
      <div className="detailPanel">
        <span className="detailStatus">{app.status}</span>
        <p className="sectionKicker">HIU YHCT ECOSYSTEM</p>
        <h1>{app.name}</h1>
        <h2>{app.tagline}</h2>
        <p>{app.description}</p>
        <div className="detailActions">
          <a className="primaryBtn" href={app.currentUpstreamUrl}>Mở ứng dụng ↗</a>
          <a className="secondaryBtn" href="/">Khám phá ứng dụng khác</a>
        </div>
      </div>
    </main>
  );
}
