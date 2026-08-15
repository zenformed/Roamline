"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("roamline-theme", next);
    document.cookie = `roamline-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label="Toggle color theme" title="Toggle color theme"><span className="theme-moon"><Moon size={17} /></span><span className="theme-sun"><Sun size={17} /></span></button>;
}
