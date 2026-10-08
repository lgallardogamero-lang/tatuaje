"use client";

import { OPEN_COOKIES_EVENT } from "@/lib/consent";

export function CookieSettingsButton() {
  return (
    <button type="button" className="w-fit text-left hover:text-stencil" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIES_EVENT))}>
      Gestionar cookies
    </button>
  );
}
