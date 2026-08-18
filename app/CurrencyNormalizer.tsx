"use client";

import { useEffect } from "react";

/**
 * Saharasnow is USD-only. Keep any stale browser preference pinned to USD and
 * remove the legacy currency selector without using mutation observers or
 * document-wide text rewriting that could interfere with React rendering.
 */
export default function CurrencyNormalizer() {
  useEffect(() => {
    try {
      localStorage.setItem("saharasnow_currency", "USD");
    } catch {}

    const removeLegacyCurrencyControl = () => {
      document.querySelectorAll<HTMLSelectElement>('select[aria-label="Currency"]').forEach((select) => {
        select.remove();
      });
    };

    removeLegacyCurrencyControl();
    window.addEventListener("pageshow", removeLegacyCurrencyControl);
    return () => window.removeEventListener("pageshow", removeLegacyCurrencyControl);
  }, []);

  return null;
}
