"use client";

import { useEffect, useState } from "react";

type Media = { kind: "image" | "video" | "youtube"; src: string; title: string };

function youtubeEmbed(src: string) {
  try {
    const url = new URL(src);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : src;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) return `${src}${url.search ? "&" : "?"}autoplay=1`;
      const id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop() || "";
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : src;
    }
  } catch {}
  return src;
}

function isServicePage() {
  return location.pathname === "/service" || location.pathname.startsWith("/service/") || location.pathname === "/services" || location.pathname.startsWith("/services/");
}

function isIgnoredImage(node: Element) {
  return Boolean(node.closest("header,nav,footer,button,a[href*='/profile'],.avatar,.sellerAvatar,.userAvatar,.profileAvatar,.logo,.icon"));
}

export default function ServiceMediaLightbox() {
  const [media, setMedia] = useState<Media | null>(null);

  useEffect(() => {
    const close = () => setMedia(null);
    const onClick = (event: MouseEvent) => {
      if (!isServicePage()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const node = target.closest("img,video,iframe") || target.querySelector("img,video,iframe");
      if (!node || isIgnoredImage(node)) return;
      if (node instanceof HTMLImageElement && node.currentSrc) {
        event.preventDefault(); event.stopPropagation();
        setMedia({ kind: "image", src: node.currentSrc, title: node.alt || node.title || "Service image" });
      } else if (node instanceof HTMLVideoElement) {
        const src = node.currentSrc || node.src;
        if (src) { event.preventDefault(); event.stopPropagation(); setMedia({ kind: "video", src, title: node.title || "Service video" }); }
      } else if (node instanceof HTMLIFrameElement && node.src) {
        event.preventDefault(); event.stopPropagation(); setMedia({ kind: "youtube", src: youtubeEmbed(node.src), title: node.title || "Service media" });
      }
    };
    const prepare = () => {
      if (!isServicePage()) return;
      document.querySelectorAll<HTMLImageElement>("main img").forEach((img) => {
        if (!isIgnoredImage(img)) { img.style.cursor = "zoom-in"; img.setAttribute("title", "Click to enlarge"); }
      });
      document.querySelectorAll<HTMLIFrameElement>("main iframe").forEach((frame) => { frame.style.pointerEvents = "none"; frame.setAttribute("tabindex", "-1"); });
    };
    prepare();
    const observer = new MutationObserver(prepare);
    observer.observe(document.body, { childList: true, subtree: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => { observer.disconnect(); document.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey); };
  }, []);

  if (!media) return null;
  return <div className="saharaMediaLightbox" role="dialog" aria-modal="true" aria-label="Enlarged service media" onMouseDown={(e)=>{if(e.target===e.currentTarget)setMedia(null)}}>
    <button type="button" className="saharaMediaLightboxClose" aria-label="Close and return to service" title="Close" onClick={()=>setMedia(null)}>×</button>
    <div className="saharaMediaLightboxContent">
      {media.kind === "image" ? <img src={media.src} alt={media.title} /> : media.kind === "video" ? <video src={media.src} controls autoPlay playsInline /> : <iframe src={media.src} title={media.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
    </div>
  </div>;
}
