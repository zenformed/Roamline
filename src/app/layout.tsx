import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
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
  metadataBase: new URL("https://roamline.vercel.app"),
  title: "Roamline — Share the journey",
  description: "A quiet place to share trips, moments, and the road between them.",
  applicationName: "Roamline",
  openGraph: { title: "Roamline — Share the journey", description: "A quiet place to share trips, moments, and the road between them.", siteName: "Roamline", type: "website" },
  twitter: { card: "summary_large_image", title: "Roamline — Share the journey", description: "A quiet place to share trips, moments, and the road between them." },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Roamline" },
  formatDetection: { telephone: false },
  icons: { icon: "/roamline-icon.svg", apple: "/roamline-icon.svg" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const savedTheme = (await cookies()).get("roamline-theme")?.value;
  const serverTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : undefined;
  const themeScript = `(function(){try{var stored=localStorage.getItem('roamline-theme');var cookie=document.cookie.match(/(?:^|; )roamline-theme=(dark|light)(?:;|$)/);var saved=stored||(cookie&&cookie[1]);var theme=saved||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.cookie='roamline-theme='+theme+'; Path=/; Max-Age=31536000; SameSite=Lax'}catch(e){}})()`;
  return (
    <html
      lang="en"
      data-theme={serverTheme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      style={serverTheme ? { colorScheme: serverTheme } : undefined}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Script id="roamline-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />{children}<PwaInstall /></body>
    </html>
  );
}
