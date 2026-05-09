import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "AIVENTRA — AI-Powered Forensic Triage & Postmortem Intelligence",
  description:
    "Next-generation AI forensic intelligence platform for international investigative agencies. Real-time evidence correlation, pattern detection, and automated case building.",
  keywords: [
    "AI forensics",
    "forensic intelligence",
    "digital forensics",
    "crime investigation",
    "evidence analysis",
    "pattern detection",
  ],
  authors: [{ name: "AIVENTRA Intelligence Systems" }],
  openGraph: {
    title: "AIVENTRA — AI-Powered Forensic Intelligence",
    description:
      "Military-grade forensic AI platform for international investigative agencies.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-base text-pure font-inter antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
