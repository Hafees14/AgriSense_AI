import type { Metadata } from "next";
import { Fraunces, Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/lib/i18n";
import "@/styles/globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const sinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  weight: ["400", "500", "600"],
  variable: "--font-sinhala",
  display: "swap",
});

const tamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: ["400", "500", "600"],
  variable: "--font-tamil",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgriSense AI",
  description: "AI-powered agricultural decision support platform for smallholder farmers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${sinhala.variable} ${tamil.variable}`}
    >
      <body className="min-h-screen text-[16px] leading-relaxed sm:text-[17px]">
        <LanguageProvider>
          <Navbar />
          <main id="main">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}