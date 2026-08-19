"use client";

import { useEffect } from "react";

/**
 * Saharasnow is USD-only. This guard is intentionally passive: it normalizes
 * existing/restored page content without observing every DOM mutation, which
 * could otherwise create a mutation loop and freeze interactive pages.
 */
export default function CurrencyNormalizer() {
  useEffect(() => {
    const normalize = () => {
      try { localStorage.setItem("saharasnow_currency", "USD"); } catch {}

      document.querySelectorAll<HTMLSelectElement>('select[aria-label="Currency"]').forEach(select => select.remove());

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);

      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(parent.tagName)) continue;
        const current = node.nodeValue || "";
        const next = current
          .replace(/€/g, "$")
          .replace(/\bEUR\b/g, "USD")
          .replace(/Live currency conversion/gi, "USD pricing")
          .replace(/Indicative automatic conversion/gi, "All prices are in USD");
        if (next !== current) node.nodeValue = next;
      }
    };

    normalize();
    const afterRestore = () => window.setTimeout(normalize, 0);
    window.addEventListener("pageshow", afterRestore);
    window.addEventListener("popstate", afterRestore);

    return () => {
      window.removeEventListener("pageshow", afterRestore);
      window.removeEventListener("popstate", afterRestore);
    };
  }, []);

  return null;
}
