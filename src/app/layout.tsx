import "@/styles/globals.css";
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

export const metadata: Metadata = {
  title: "AI Reconciliation SaaS",
  description: "Intelligent bank reconciliation made simple",
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className="font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
