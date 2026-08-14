import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaInstall } from "@/components/pwa-install";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roamline — Share the journey",
  description: "A quiet place to share trips, moments, and the road between them.",
  applicationName: "Roamline",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Roamline" },
  formatDetection: { telephone: false },
  icons: { icon: "/roamline-icon.svg", apple: "/roamline-icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const themeScript = `(function(){try{var saved=localStorage.getItem('roamline-theme');var theme=saved||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch(e){}})()`;
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><script dangerouslySetInnerHTML={{ __html: themeScript }} />{children}<PwaInstall /></body>
    </html>
  );
}
