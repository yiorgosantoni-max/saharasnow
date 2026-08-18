"use client";

import { useEffect } from "react";

type Currency = "USD" | "EUR" | "GBP" | "ZAR" | "AUD";
const supported = new Set<Currency>(["USD", "EUR", "GBP", "ZAR", "AUD"]);

/**
 * Currency rendering is handled by the application's currency state/components.
 * This component must never walk or rewrite document.body: mutating arbitrary
 * React text nodes can trigger expensive hydration/layout work and can leave the
 * homepage unresponsive. Its only responsibility is persisting the user's choice.
 */
export default function CurrencyNormalizer() {
  useEffect(() => {
    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (target.getAttribute("aria-label") !== "Currency") return;
      const currency = target.value.toUpperCase() as Currency;
      if (!supported.has(currency)) return;
      try {
        localStorage.setItem("saharasnow_currency", currency);
      } catch {}
    };

    document.addEventListener("change", onChange, true);
    return () => document.removeEventListener("change", onChange, true);
  }, []);

  return null;
}
