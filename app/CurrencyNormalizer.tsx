"use client";

import { useEffect } from "react";

/** Saharasnow is USD-only. Keep stale browser history, dynamic cards and legacy UI pinned to USD. */
export default function CurrencyNormalizer() {
  useEffect(() => {
    try { localStorage.setItem("saharasnow_currency", "USD"); } catch {}

    const normalizeRoot = (root: Element | Document = document) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(parent.tagName)) continue;
        const next = node.nodeValue
          ?.replace(/€/g, "$")
          .replace(/\bEUR\b/g, "USD")
          .replace(/Live currency conversion/gi, "USD pricing")
          .replace(/Indicative automatic conversion/gi, "All prices are in USD");
        if (next !== node.nodeValue) node.nodeValue = next ?? "";
      }
    };

    const applyUsdOnly = () => {
      try { localStorage.setItem("saharasnow_currency", "USD"); } catch {}
      document.querySelectorAll<HTMLSelectElement>('select[aria-label="Currency"]').forEach(select => select.remove());
      normalizeRoot();
      document.querySelectorAll<HTMLElement>(".saharaPrice").forEach(price => {
        price.textContent = (price.textContent || "").replace(/€/g, "$").replace(/\bEUR\b/g, "USD");
      });
    };

    applyUsdOnly();
    const observer = new MutationObserver(() => applyUsdOnly());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const onRestore = () => window.setTimeout(applyUsdOnly, 0);
    const onPageShow = () => window.setTimeout(applyUsdOnly, 0);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onRestore);
    document.addEventListener("visibilitychange", onRestore);

    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onRestore);
      document.removeEventListener("visibilitychange", onRestore);
    };
  }, []);

  return null;
}
