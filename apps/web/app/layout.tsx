import type { Metadata } from "next";
import "@/styles/globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AgriSense AI",
  description: "AI-powered agricultural decision support platform for smallholder farmers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-[16px] leading-relaxed sm:text-[17px]">
        <Navbar />
        {children}
      </body>
    </html>
  );
}