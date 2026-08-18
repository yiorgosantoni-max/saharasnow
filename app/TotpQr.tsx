"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    qrcode?: (typeNumber: number, errorCorrectionLevel: string) => {
      addData: (value: string) => void;
      make: () => void;
      createDataURL: (cellSize?: number, margin?: number) => string;
    };
  }
}

let loader: Promise<void> | null = null;

function loadQrLibrary() {
  if (typeof window === "undefined") return Promise.reject(new Error("QR code can only be generated in the browser."));
  if (window.qrcode) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-saharasnow-qrcode="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load QR code renderer.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.min.js";
    script.async = true;
    script.dataset.saharasnowQrcode = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load QR code renderer."));
    document.head.appendChild(script);
  });
  return loader;
}

export default function TotpQr({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setDataUrl("");
      return;
    }
    setError("");
    void loadQrLibrary().then(() => {
      if (cancelled || !window.qrcode) return;
      const qr = window.qrcode(0, "M");
      qr.addData(value);
      qr.make();
      const next = qr.createDataURL(5, 4);
      if (!cancelled) setDataUrl(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to render QR code.");
    });
    return () => { cancelled = true; };
  }, [value]);

  if (error) return <div className="qrDemo" aria-label="Authenticator QR code"><span>{error}</span></div>;
  if (!dataUrl) return <div className="qrDemo" aria-label="Authenticator QR code"><span>Generating QR…</span></div>;
  return <div className="qrDemo" aria-label="Authenticator QR code"><img src={dataUrl} alt="Unique SaharaSnow Google Authenticator QR code" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>;
}
