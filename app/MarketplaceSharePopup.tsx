"use client";

import { useEffect } from "react";

type ShareKind = "facebook" | "linkedin" | "x" | "whatsapp" | "copy";
type Counts = { shareCount: number; favoriteCount: number };

export default function MarketplaceSharePopup() {
  useEffect(() => {
    let activeId = "";
    let activeTitle = "";
    const timers: number[] = [];

    const style = document.createElement("style");
    style.dataset.marketplaceSharePopup = "true";
    style.textContent = `
      /* The root layout owns sharing everywhere. Hide the older duplicate card action row. */
      [data-sahara-service-actions]{display:none!important}
      .sahara-card-share-row{display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:8px;border-top:1px solid rgba(0,0,0,.08);font-size:12px;position:relative;z-index:20}
      .sahara-card-share-count{color:#667085;white-space:nowrap}
      .sahara-card-share-open{margin-left:auto;width:36px;height:36px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;color:#344054;font-size:20px;cursor:pointer;touch-action:manipulation}
      .sahara-share-layer{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.38);backdrop-filter:blur(2px)}
      .sahara-share-layer.open{display:flex}
      .sahara-share-box{width:min(620px,100%);background:#fff;border-radius:16px;padding:26px 32px 28px;box-shadow:0 24px 70px rgba(15,23,42,.28);position:relative;text-align:center;color:#475467}
      .sahara-share-box h2{margin:0;font-size:27px}.sahara-share-box p{margin:10px 0 24px;color:#667085}
      .sahara-share-close{position:absolute;right:16px;top:12px;border:0;background:transparent;font-size:30px;color:#98a2b3;cursor:pointer}
      .sahara-share-options{display:flex;justify-content:center;gap:18px;flex-wrap:wrap}.sahara-share-option{width:82px;border:0;background:transparent;cursor:pointer;color:#475467;display:flex;flex-direction:column;align-items:center;gap:9px;font:inherit;touch-action:manipulation}
      .sahara-share-option b{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:27px;box-shadow:0 4px 12px rgba(15,23,42,.14)}
      .sahara-share-option[data-share=facebook] b{background:#4267a9}.sahara-share-option[data-share=linkedin] b{background:#0a66c2;font-size:22px}.sahara-share-option[data-share=x] b{background:#111}.sahara-share-option[data-share=whatsapp] b{background:#169c36}.sahara-share-option[data-share=copy] b{background:#fff;color:#344054;border:1px solid #d0d5dd}
      .sahara-share-note{margin-top:25px;padding:14px 16px;background:#eef3ff;border-radius:8px;text-align:left;font-size:14px}.sahara-share-note strong{color:#4267a9}
      @media(max-width:520px){.sahara-share-box{padding:24px 16px}.sahara-share-options{gap:10px}.sahara-share-option{width:64px}.sahara-share-option b{width:50px;height:50px}.sahara-share-box h2{font-size:23px}}
    `;
    if (!document.querySelector("style[data-marketplace-share-popup]")) document.head.appendChild(style);

    const layer = document.createElement("div");
    layer.className = "sahara-share-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = `<div class="sahara-share-box" role="dialog" aria-modal="true"><button class="sahara-share-close" type="button" aria-label="Close sharing popup">×</button><div style="font-size:34px;margin-bottom:10px">↗</div><h2>Sharing is caring</h2><p>Inspire people by sharing this service</p><div class="sahara-share-options"><button class="sahara-share-option" data-share="facebook" type="button"><b>f</b><span>Facebook</span></button><button class="sahara-share-option" data-share="linkedin" type="button"><b>in</b><span>LinkedIn</span></button><button class="sahara-share-option" data-share="x" type="button"><b>𝕏</b><span>X</span></button><button class="sahara-share-option" data-share="whatsapp" type="button"><b>◔</b><span>WhatsApp</span></button><button class="sahara-share-option" data-share="copy" type="button"><b>↗</b><span>Copy Link</span></button></div><div class="sahara-share-note"><strong>● Note:</strong> Choose an option to share this service using its direct link. This window stays open until you press ×.</div></div>`;
    document.body.appendChild(layer);

    const stop = (event: Event) => { event.preventDefault(); event.stopPropagation(); if ("stopImmediatePropagation" in event) event.stopImmediatePropagation(); };
    const close = () => { layer.classList.remove("open"); layer.setAttribute("aria-hidden", "true"); activeId = ""; activeTitle = ""; };
    const update = (id: string, next: Partial<Counts>) => document.querySelectorAll<HTMLElement>(`[data-share-count-id="${CSS.escape(id)}"]`).forEach(el => { const previous = el.dataset.counts ? JSON.parse(el.dataset.counts) as Counts : { shareCount: 0, favoriteCount: 0 }; const counts = { ...previous, ...next }; el.dataset.counts = JSON.stringify(counts); el.textContent = `${counts.shareCount} shares · ${counts.favoriteCount} favourites`; });
    const load = async (id: string) => { try { const r = await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(id)}`, { cache: "no-store" }); if (r.ok) { const d = await r.json() as Partial<Counts>; update(id, { shareCount: Number(d.shareCount || 0), favoriteCount: Number(d.favoriteCount || 0) }); } } catch {} };

    const addButtons = () => document.querySelectorAll<HTMLElement>("article[id^='service-']").forEach(article => {
      if (article.querySelector("[data-sahara-share-popup-row]")) return;
      const id = article.id.replace(/^service-/, ""); if (!id) return;
      const row = document.createElement("div"); row.dataset.saharaSharePopupRow = "true"; row.className = "sahara-card-share-row";
      row.innerHTML = `<span class="sahara-card-share-count" data-share-count-id="${id}">0 shares · 0 favourites</span><button type="button" class="sahara-card-share-open" aria-label="Share this service" title="Share">⌯</button>`;
      article.appendChild(row); void load(id);
    });
    addButtons(); [300, 1000, 2500, 5000].forEach(delay => timers.push(window.setTimeout(addButtons, delay)));

    const record = async (id: string) => { try { const r = await fetch("/api/listing-engagement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: id }) }); if (r.ok) { const d = await r.json() as Partial<Counts>; update(id, { shareCount: Number(d.shareCount || 0) }); } } catch {} };
    const perform = async (kind: ShareKind) => {
      if (!activeId) return;
      const url = `${window.location.origin}${window.location.pathname}#service-${encodeURIComponent(activeId)}`;
      let target = "";
      if (kind === "facebook") target = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      if (kind === "linkedin") target = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      if (kind === "x") target = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(activeTitle)}`;
      if (kind === "whatsapp") target = `https://wa.me/?text=${encodeURIComponent(`${activeTitle} ${url}`)}`;
      if (kind === "copy") { try { await navigator.clipboard.writeText(url); } catch { const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } const label = layer.querySelector<HTMLElement>("[data-share=copy] span"); if (label) { label.textContent = "Copied!"; window.setTimeout(() => label.textContent = "Copy Link", 1400); } }
      else if (target) window.open(target, "_blank", "noopener,noreferrer");
      void record(activeId);
      // Deliberately do not close: only the × button, backdrop or Escape closes the popup.
    };

    const click = (event: MouseEvent) => {
      const el = event.target instanceof Element ? event.target : null; if (!el) return;
      const trigger = el.closest<HTMLButtonElement>(".sahara-card-share-open");
      if (trigger) { stop(event); const article = trigger.closest<HTMLElement>("article[id^='service-']"); if (!article) return; activeId = article.id.replace(/^service-/, ""); activeTitle = article.querySelector("h1,h2,h3,h4")?.textContent?.trim() || "Check out this service"; layer.classList.add("open"); layer.setAttribute("aria-hidden", "false"); return; }
      if (el === layer) { close(); return; }
      if (el.closest(".sahara-share-close")) { stop(event); close(); return; }
      const option = el.closest<HTMLButtonElement>(".sahara-share-option[data-share]");
      if (option && layer.contains(option)) { stop(event); const kind = option.dataset.share as ShareKind | undefined; if (kind) void perform(kind); }
    };
    const blockTrigger = (event: Event) => { const el = event.target instanceof Element ? event.target : null; if (el?.closest(".sahara-card-share-open")) stop(event); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", blockTrigger, true); document.addEventListener("mousedown", blockTrigger, true); document.addEventListener("touchstart", blockTrigger, true); document.addEventListener("click", click, true); document.addEventListener("keydown", key);
    return () => { timers.forEach(window.clearTimeout); document.removeEventListener("pointerdown", blockTrigger, true); document.removeEventListener("mousedown", blockTrigger, true); document.removeEventListener("touchstart", blockTrigger, true); document.removeEventListener("click", click, true); document.removeEventListener("keydown", key); layer.remove(); if (style.parentNode === document.head) style.remove(); };
  }, []);
  return null;
}
