import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import ErrorBoundary from "@/components/ErrorBoundary";
import FeedbackButton from "@/components/FeedbackButton";
import GlobalErrorInit from "@/components/GlobalErrorInit";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "디옵트 AI 기획 어시스턴트",
  description: "디옵트(DIOPT) 상세페이지 기획을 위한 AI 어시스턴트",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-gray-50 antialiased font-[family-name:var(--font-geist-sans)]">
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <FeedbackButton />
          <GlobalErrorInit />
        </Providers>
      </body>
    </html>
  );
}
