import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/Toast";
// Fonts are bundled with the app (no request to Google at build time or run time).
import "@fontsource-variable/inter/wght.css";
import "@fontsource/fraunces/latin-500.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/noto-sans-sinhala/sinhala-400.css";
import "@fontsource/noto-sans-sinhala/sinhala-500.css";
import "@fontsource/noto-sans-sinhala/sinhala-600.css";
import "@fontsource/noto-sans-tamil/tamil-400.css";
import "@fontsource/noto-sans-tamil/tamil-500.css";
import "@fontsource/noto-sans-tamil/tamil-600.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "AgriSense AI",
  description: "AI-powered agricultural decision support platform for smallholder farmers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col text-[16px] leading-relaxed sm:text-[17px]">
        <LanguageProvider>
          <ToastProvider>
            <Navbar />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}