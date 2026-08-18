"use client";

import { useEffect } from "react";

/** Saharasnow is USD-only. Keep stale preferences and legacy UI pinned to USD. */
export default function CurrencyNormalizer() {
  useEffect(() => {
    try { localStorage.setItem("saharasnow_currency", "USD"); } catch {}

    const normalizeRoot = (root: Element) => {
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
      document.querySelectorAll<HTMLSelectElement>('select[aria-label="Currency"]').forEach(select => select.remove());
      const roots = document.querySelectorAll("main, .listingModal, .accountModal, .modal, .growthSuite, footer");
      roots.forEach(normalizeRoot);
    };

    applyUsdOnly();
    const onClick = () => window.setTimeout(applyUsdOnly, 0);
    window.addEventListener("pageshow", applyUsdOnly);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pageshow", applyUsdOnly);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
