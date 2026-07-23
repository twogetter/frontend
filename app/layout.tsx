import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./lib/auth";
import Nav from "./components/Nav";

export const metadata: Metadata = {
  title: "twogetter · 최애와 더 가까이",
  description: "구독하고 아티스트와 실시간으로 대화하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <Nav />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
