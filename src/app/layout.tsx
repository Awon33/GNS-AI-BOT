import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GNS 212 AI Teaching Assistant",
  description: "Your personalized zero-cost AI Teaching Assistant for GNS 212",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} min-h-full bg-slate-950 text-slate-50 antialiased selection:bg-indigo-500/30 flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
