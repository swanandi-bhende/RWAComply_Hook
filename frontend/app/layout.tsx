import type { Metadata } from "next";
import { Geist_Mono, Mozilla_Headline, Mozilla_Text } from "next/font/google";
import "./globals.css";
import { ClientShell } from "./client-shell";

const headline = Mozilla_Headline({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: "700",
});

const text = Mozilla_Text({
  variable: "--font-text",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RWAComply",
  description: "One human. Multiple wallets. One shared purchase budget.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headline.variable} ${text.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
