import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hiutmc.com"),
  title: {
    default: "HIU TMC Ecosystem",
    template: "%s | HIU TMC Ecosystem",
  },
  description: "Cổng khám phá hệ sinh thái số của Câu lạc bộ Y học cổ truyền HIU: Study OS, A.I Thiệt Chẩn, Trung Y Văn HIU và 3D Huyệt vị – Kinh lạc.",
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "https://hiutmc.com",
    siteName: "HIU TMC Ecosystem",
    title: "HIU TMC Ecosystem",
    description: "Một bản đồ. Nhiều hành trình học tập Y học cổ truyền.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
