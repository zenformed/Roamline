"use client";

import { useEffect } from "react";

import {
  decodeTimeZoneCookie,
  VIEWER_TIME_ZONE_COOKIE,
} from "@/lib/time-zone";

export function TimeZoneSync({ storedTimeZone }: { storedTimeZone: string }) {
  useEffect(() => {
    function syncTimeZone() {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!browserTimeZone) return;

      const cookiePrefix = `${VIEWER_TIME_ZONE_COOKIE}=`;
      const cookieTimeZone = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(cookiePrefix))
        ?.slice(cookiePrefix.length);
      const currentTimeZone = cookieTimeZone
        ? decodeTimeZoneCookie(cookieTimeZone)
        : storedTimeZone;
      if (browserTimeZone === currentTimeZone) return;

      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${VIEWER_TIME_ZONE_COOKIE}=${encodeURIComponent(browserTimeZone)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
      window.location.reload();
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") syncTimeZone();
    }

    syncTimeZone();
    window.addEventListener("pageshow", syncTimeZone);
    window.addEventListener("focus", syncTimeZone);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.removeEventListener("pageshow", syncTimeZone);
      window.removeEventListener("focus", syncTimeZone);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [storedTimeZone]);

  return null;
}
