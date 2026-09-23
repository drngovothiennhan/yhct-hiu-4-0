export type EcosystemApp = {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  status: "Production" | "Preview" | "Development";
  currentUpstreamUrl: string;
  plannedCanonicalDomain: string;
  x: number;
  y: number;
  accent: string;
};

export const ecosystemApps: EcosystemApp[] = [
  {
    slug: "study-os",
    name: "Study OS",
    shortName: "Study OS",
    tagline: "Học • Hiểu • Ứng dụng",
    description: "Không gian học tập số dành cho sinh viên Y học cổ truyền HIU, tập trung vào học liệu, luyện tập và trải nghiệm học tập thống nhất.",
    currentUpstreamUrl: "https://yhct-hiu-final4-stage.vercel.app/",
    plannedCanonicalDomain: "https://study.hiutmc.com/",
    status: "Production",
    x: 30,
    y: 30,
    accent: "#e9b84a"
  },
  {
    slug: "ai-thiet-chan",
    name: "A.I Thiệt Chẩn",
    shortName: "A.I Thiệt Chẩn",
    tagline: "AI hỗ trợ học thiệt chẩn",
    description: "Khu trải nghiệm AI hỗ trợ quan sát, học và đối chiếu đặc điểm lưỡi trong bối cảnh giáo dục Y học cổ truyền.",
    currentUpstreamUrl: "https://ai-thiet-chan-hiu-yhct.vercel.app/",
    plannedCanonicalDomain: "https://thietchan.hiutmc.com/",
    status: "Production",
    x: 70,
    y: 30,
    accent: "#56c9ff"
  },
  {
    slug: "trung-y-van",
    name: "Trung Y Văn HIU",
    shortName: "Trung Y Văn",
    tagline: "Kho tri thức Y học cổ truyền",
    description: "Không gian đọc, tra cứu và kết nối học liệu Trung y văn cho sinh viên và hoạt động học thuật của câu lạc bộ.",
    currentUpstreamUrl: "https://github.com/drngovothiennhan/trung-y-van-hiu",
    plannedCanonicalDomain: "https://trungyvan.hiutmc.com/",
    status: "Development",
    x: 28,
    y: 66,
    accent: "#c79a5c"
  },
  {
    slug: "atlas",
    name: "3D Huyệt vị – Kinh lạc",
    shortName: "3D Atlas",
    tagline: "Khám phá cơ thể qua kinh lạc và huyệt vị",
    description: "Mô hình tương tác phục vụ học huyệt vị, đường kinh và liên hệ giải phẫu theo định hướng dành cho sinh viên Y học cổ truyền.",
    currentUpstreamUrl: "https://human-atlas-seven.vercel.app/",
    plannedCanonicalDomain: "https://atlas.hiutmc.com/",
    status: "Preview",
    x: 71,
    y: 66,
    accent: "#5ee1d2"
  }
];
