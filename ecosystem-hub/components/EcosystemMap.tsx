"use client";

import { useState } from "react";
import Link from "next/link";
import { ecosystemApps } from "@/data/apps";

export default function EcosystemMap() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="mapShell" aria-label="Bản đồ hệ sinh thái HIU YHCT">
      <div className="mapStage">
        <img className="mapArtwork" src="/ecosystem-map.webp" alt="Bản đồ anime 2D hệ sinh thái HIU YHCT" />
        <div className="mapShade" />
        {ecosystemApps.map((app) => (
          <div
            className={`hotspot ${active === app.slug ? "isActive" : ""}`}
            style={{ left: `${app.x}%`, top: `${app.y}%`, ["--accent" as string]: app.accent }}
            key={app.slug}
            onMouseEnter={() => setActive(app.slug)}
            onMouseLeave={() => setActive(null)}
          >
            <button className="hotspotPulse" onClick={() => setActive(active === app.slug ? null : app.slug)} aria-label={`Xem ${app.name}`} />
            <div className="hotspotCard">
              <span className="status">{app.status}</span>
              <strong>{app.name}</strong>
              <small>{app.tagline}</small>
              <Link href={`/ecosystem/${app.slug}/`}>Khám phá →</Link>
            </div>
          </div>
        ))}
        <div className="heroCopy">
          <p className="eyebrow">CÂU LẠC BỘ Y HỌC CỔ TRUYỀN HIU</p>
          <h1>Một bản đồ. Nhiều hành trình học tập.</h1>
          <p>Khám phá các ứng dụng học tập, AI và mô hình tương tác trong cùng một hệ sinh thái.</p>
        </div>
      </div>

      <nav className="quickDock" aria-label="Khám phá nhanh">
        {ecosystemApps.map((app) => (
          <Link href={`/ecosystem/${app.slug}/`} key={app.slug}>{app.shortName}</Link>
        ))}
      </nav>
    </section>
  );
}
