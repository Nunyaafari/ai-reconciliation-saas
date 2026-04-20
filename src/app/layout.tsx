import "@/styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EZIRECON",
  description: "Intelligent bank reconciliation made simple",
  icons: {
    icon: [
      { url: "/brand/ezfavicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/brand/ezfavicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();
  return (
    <html lang="en">
      <body className="font-sans text-slate-900">
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-slate-200 bg-white/70">
            <div className="mx-auto w-full max-w-6xl px-6 py-4 text-center text-xs text-slate-500">
              © {year} Amagold Technologies Ltd. All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
