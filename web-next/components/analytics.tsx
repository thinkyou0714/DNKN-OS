"use client";

import { useEffect } from "react";
import { parseUtm } from "@/lib/analytics";

/**
 * 着地時に UTM を取得し first-party `/api/track` へ page_view を送る（同一オリジン・CSP clean）。
 * 取得した attribution は sessionStorage に保持し、後続の会員登録時に紐付ける想定（T10/T16）。
 * 計測失敗はアプリ動作に影響させない（best-effort）。
 */
export function Analytics() {
  useEffect(() => {
    try {
      const utm = parseUtm(window.location.search);
      const hasUtm = Object.keys(utm).length > 0;
      if (hasUtm && !sessionStorage.getItem("denken:utm")) {
        sessionStorage.setItem("denken:utm", JSON.stringify(utm));
      }
      void fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "page_view",
          path: window.location.pathname,
          ...(hasUtm ? { utm } : {}),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // no-op: 計測は best-effort。
    }
  }, []);

  return null;
}
