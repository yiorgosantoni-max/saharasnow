"use client";

import { useEffect } from "react";

type ShareKind = "facebook" | "linkedin" | "x" | "whatsapp" | "copy";
type Counts = { shareCount: number; favoriteCount: number };

const icon = {
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.6 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V4a22 22 0 0 0-2.4-.1c-2.4 0-4 1.5-4 4.1V10H8v3h2.5v8h3.1Z"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.94 8.5H3.56V20.4h3.38V8.5ZM5.25 3.6a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92ZM20.4 20.4h-3.37v-6.24c0-1.49-.03-3.4-2.07-3.4-2.08 0-2.4 1.62-2.4 3.3v6.34H9.2V8.5h3.24v1.63h.05c.45-.85 1.56-1.75 3.21-1.75 3.44 0 4.07 2.26 4.07 5.2v6.82Z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.4l-5-6.6L6 22H2.9l7.3-8.4L2.3 2h6.5l4.5 6 5.6-6Zm-1.1 17.7h1.7L7.7 4.2H5.9l11.9 15.5Z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 3.5A11.2 11.2 0 0 0 12.6.2C6.5.2 1.5 5.2 1.5 11.3c0 2 .5 3.9 1.5 5.6L1.4 23l6.3-1.6a11 11 0 0 0 4.9 1.2h.1c6.1 0 11.1-5 11.1-11.1 0-3-1.2-5.8-3.3-8Zm-7.9 17.1h-.1c-1.5 0-3-.4-4.3-1.1l-.3-.2-3.7 1 1-3.6-.2-.3a9.2 9.2 0 0 1-1.4-4.9c0-5.1 4.1-9.2 9.2-9.2 2.5 0 4.8 1 6.5 2.7a9.1 9.1 0 0 1 2.7 6.5c0 5-4.1 9.1-9.1 9.1Zm5-6.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.7-.8-2.8-1.5-3.9-3.3-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5s-.7-1.7-.9-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.8 4.3 1.8.8 2.5.9 3.4.8.5-.1 1.6-.6 1.8-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.7-.4Z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M9 9h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V9Zm3-3V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1"/><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M9 9H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/></svg>`,
};

export default function CardSharePopup() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.saharaSharePopup = "true";
    style.textContent = `
      .sahara-share-layer{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.38);backdrop-filter:blur(2px)}
      .sahara-share-layer.open{display:flex}
      .sahara-share-box{width:min(620px,calc(100vw - 20px));background:#fff;border-radius:5px;padding:70px 32px 36px;box-shadow:0 24px 70px rgba(15,23,42,.28);position:relative;text-align:center;color:#475467}
      .sahara-share-box h2{margin:0 0 8px;font-size:26px;color:#475467;font-weight:700}
      .sahara-share-box>p{margin:0 0 30px;color:#8b6f72;font-size:16px}
      .sahara-share-close{position:absolute;right:20px;top:25px;border:0;background:transparent;font-size:30px;line-height:1;color:#b1b5bb;cursor:pointer;padding:0}
      .sahara-share-options{display:flex;justify-content:center;gap:28px;flex-wrap:wrap}
      .sahara-share-option{width:76px;border:0;background:transparent;cursor:pointer;color:#475467;display:flex;flex-direction:column;align-items:center;gap:9px;font:inherit;padding:0}
      .sahara-share-option b{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:#fff;box-shadow:0 2px 5px rgba(15,23,42,.08)}
      .sahara-share-option b svg{width:27px;height:27px;display:block}
      .sahara-share-option[data-share=facebook] b{background:#4267a9}
      .sahara-share-option[data-share=linkedin] b{background:#0a66c2}
      .sahara-share-option[data-share=x] b{background:#111}
      .sahara-share-option[data-share=whatsapp] b{background:#0aa52a}
      .sahara-share-option[data-share=copy] b{background:#fff;color:#7b7f85;border:1px solid #cfd3d8}
      .sahara-share-note{margin-top:30px;padding:13px 16px;background:#eef2ff;border-radius:5px;text-align:left;color:#48628f;font-size:14px;line-height:1.35}
      .sahara-share-note strong{color:#4267a9}
      [data-sahara-share-count-id]{font-variant-numeric:tabular-nums}
      @media(max-width:520px){.sahara-share-box{padding:55px 14px 28px}.sahara-share-options{gap:12px}.sahara-share-option{width:64px}.sahara-share-option b{width:52px;height:52px}.sahara-share-box h2{font-size:23px}}
    `;
    document.head.appendChild(style);

    const layer = document.createElement("div");
    layer.className = "sahara-share-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = `<div class="sahara-share-box" role="dialog" aria-modal="true" aria-labelledby="sahara-share-title"><button class="sahara-share-close" type="button" aria-label="Close sharing popup">×</button><h2 id="sahara-share-title">Sharing is caring</h2><p>Inspire people by sharing this service</p><div class="sahara-share-options"><button class="sahara-share-option" data-share="facebook" type="button"><b>${icon.facebook}</b><span>Facebook</span></button><button class="sahara-share-option" data-share="linkedin" type="button"><b>${icon.linkedin}</b><span>LinkedIn</span></button><button class="sahara-share-option" data-share="x" type="button"><b>${icon.x}</b><span>X</span></button><button class="sahara-share-option" data-share="whatsapp" type="button"><b>${icon.whatsapp}</b><span>WhatsApp</span></button><button class="sahara-share-option" data-share="copy" type="button"><b>${icon.copy}</b><span>Copy Link</span></button></div><div class="sahara-share-note"><strong>● Note:</strong> Opening this window does not count as a share. A count is recorded only after a share action is initiated or the link is copied successfully.</div></div>`;
    document.body.appendChild(layer);

    let activeId = "";
    let activeTitle = "";
    let activeUrl = "";

    const updateCounts = (id: string, next: Partial<Counts>) => {
      document.querySelectorAll<HTMLElement>(`[data-sahara-share-count-id="${CSS.escape(id)}"]`).forEach((element) => {
        const previous = element.dataset.counts ? (JSON.parse(element.dataset.counts) as Counts) : { shareCount: 0, favoriteCount: 0 };
        const value = { ...previous, ...next };
        element.dataset.counts = JSON.stringify(value);
        element.textContent = `${value.shareCount} shares · ${value.favoriteCount} favourites`;
      });
    };

    const loadCounts = async (id: string) => {
      try {
        const response = await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Partial<Counts>;
        updateCounts(id, { shareCount: Math.max(0, Number(data.shareCount) || 0), favoriteCount: Math.max(0, Number(data.favoriteCount) || 0) });
      } catch {}
    };

    const hydrateCounts = () => {
      document.querySelectorAll<HTMLElement>("[data-sahara-share-count-id]").forEach((element) => {
        if (element.dataset.saharaHydrated) return;
        const id = element.getAttribute("data-sahara-share-count-id") || "";
        if (!id) return;
        element.dataset.saharaHydrated = "true";
        void loadCounts(id);
      });
    };

    const openFor = (trigger: Element) => {
      const article = trigger.closest<HTMLElement>("article[id^='service-'],[data-listing-id]");
      activeId = trigger.getAttribute("data-listing-id") || article?.getAttribute("data-listing-id") || article?.id.replace(/^service-/i, "") || "";
      activeTitle = trigger.getAttribute("data-share-title") || article?.querySelector("h1,h2,h3,h4")?.textContent?.trim() || document.querySelector("main h1")?.textContent?.trim() || "Check out this service";
      const suppliedUrl = trigger.getAttribute("data-share-url");
      const resolvedSuppliedUrl = suppliedUrl ? new URL(suppliedUrl, window.location.origin).href : "";
      const serviceLink = article?.querySelector<HTMLAnchorElement>('a[href*="/service/"]');
      activeUrl = resolvedSuppliedUrl || serviceLink?.href || window.location.href;
      if (!activeId) return;
      void loadCounts(activeId);
      layer.classList.add("open");
      layer.setAttribute("aria-hidden", "false");
    };

    const recordShare = async () => {
      if (!activeId) return;
      try {
        const response = await fetch("/api/listing-engagement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: activeId }) });
        if (!response.ok) return;
        const data = (await response.json()) as Partial<Counts>;
        const shareCount = Math.max(0, Number(data.shareCount) || 0);
        updateCounts(activeId, { shareCount });
        document.dispatchEvent(new CustomEvent("sahara-share-recorded", { detail: { listingId: activeId, shareCount } }));
      } catch {}
    };

    const perform = async (kind: ShareKind) => {
      if (!activeId) return;
      const url = activeUrl || window.location.href;
      const text = activeTitle || "Check out this service";
      let target = "";
      if (kind === "facebook") target = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      if (kind === "linkedin") target = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      if (kind === "x") target = `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      if (kind === "whatsapp") target = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
      if (kind === "copy") {
        try {
          await navigator.clipboard.writeText(url);
          const label = layer.querySelector<HTMLElement>("[data-share=copy] span");
          if (label) {
            label.textContent = "Copied!";
            setTimeout(() => (label.textContent = "Copy Link"), 1400);
          }
          await recordShare();
        } catch {}
        return;
      }
      if (target) {
        window.open(target, "_blank", "noopener,noreferrer");
        await recordShare();
      }
    };

    const close = () => {
      layer.classList.remove("open");
      layer.setAttribute("aria-hidden", "true");
      activeId = "";
      activeTitle = "";
      activeUrl = "";
    };

    const click = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      if (element === layer) {
        close();
        return;
      }
      if (element.closest(".sahara-share-close")) {
        event.preventDefault();
        close();
        return;
      }
      const trigger = element.closest<HTMLElement>("[data-sahara-share],.saharaCardShareButton,.sahara-card-share-open");
      if (trigger && !layer.contains(trigger)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openFor(trigger);
        return;
      }
      const option = element.closest<HTMLButtonElement>(".sahara-share-option[data-share]");
      if (option && layer.contains(option)) {
        event.preventDefault();
        const kind = option.dataset.share as ShareKind | undefined;
        if (kind) void perform(kind);
      }
    };

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    hydrateCounts();
    const observer = new MutationObserver(hydrateCounts);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keydown);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keydown);
      layer.remove();
      style.remove();
    };
  }, []);

  return null;
}
