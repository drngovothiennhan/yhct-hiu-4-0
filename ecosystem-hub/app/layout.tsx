import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIU YHCT Ecosystem",
  description: "Cổng khám phá hệ sinh thái số của Câu lạc bộ Y học cổ truyền HIU.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
