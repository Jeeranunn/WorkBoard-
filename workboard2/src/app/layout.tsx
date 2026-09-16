import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// IBM Plex Sans Thai over Noto Sans Thai: a genuinely Thai-designed text
// face (not just Thai glyphs bolted onto a Latin design) with a proper
// static weight family, SIL OFL licensed, and served self-hosted at build
// time via next/font (no runtime request to Google's CDN, no CLS from a
// late-swapping web font). LINE Seed Sans TH was considered too, but it
// isn't on Google Fonts — using it would mean sourcing and self-hosting
// its font files directly (next/font/local), which needs a separate
// licensing/asset review this hotfix round didn't have room for.
const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

// Supabase production is in Singapore; keep server rendering close to the database\n// so authenticated navigations avoid unnecessary cross-region latency.\nexport const preferredRegion = "sin1";\n\nexport const metadata: Metadata = {
  title: "WorkBoard",
  description: "พื้นที่ทำงานกลางขององค์กร",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${ibmPlexSansThai.variable} h-full`}>
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
