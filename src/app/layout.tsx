import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { PwaInstall } from "@/components/pwa-install";
import { TimeZoneSync } from "@/components/time-zone-sync";
import {
  decodeTimeZoneCookie,
  VIEWER_TIME_ZONE_COOKIE,
} from "@/lib/time-zone";

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
  icons: {
    icon: [
      { url: "/roamline-icon.svg", type: "image/svg+xml" },
      { url: "/roamline-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("roamline-theme")?.value;
  const serverTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : undefined;
  const storedTimeZone = decodeTimeZoneCookie(
    cookieStore.get(VIEWER_TIME_ZONE_COOKIE)?.value
  );
  const themeScript = `(function(){try{var stored=localStorage.getItem('roamline-theme');var cookie=document.cookie.match(/(?:^|; )roamline-theme=(dark|light)(?:;|$)/);var saved=stored||(cookie&&cookie[1]);var theme=saved||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.cookie='roamline-theme='+theme+'; Path=/; Max-Age=31536000; SameSite=Lax'}catch(e){}})()`;
  const timeZoneScript = `(function(){try{var name='${VIEWER_TIME_ZONE_COOKIE}=';var zone=Intl.DateTimeFormat().resolvedOptions().timeZone;var entry=document.cookie.split('; ').find(function(value){return value.indexOf(name)===0});var saved=entry?decodeURIComponent(entry.slice(name.length)):'';if(zone&&zone!==saved){var secure=location.protocol==='https:'?'; Secure':'';document.cookie=name+encodeURIComponent(zone)+'; Path=/; Max-Age=31536000; SameSite=Lax'+secure;location.reload()}}catch(e){}})()`;
  return (
    <html
      lang="en"
      data-theme={serverTheme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      style={serverTheme ? { colorScheme: serverTheme } : undefined}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Script id="roamline-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} /><Script id="roamline-time-zone" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: timeZoneScript }} /><TimeZoneSync storedTimeZone={storedTimeZone} />{children}<PwaInstall /></body>
    </html>
  );
}
