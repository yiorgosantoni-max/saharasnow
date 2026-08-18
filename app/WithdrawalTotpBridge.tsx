"use client";

import { useEffect } from "react";
import { getClientAuth } from "@/lib/firebase-client";

declare global {
  interface Window {
    qrcode?: (typeNumber: number, errorCorrectionLevel: string) => {
      addData: (value: string) => void;
      make: () => void;
      createDataURL: (cellSize?: number, margin?: number) => string;
    };
  }
}

let qrLoader: Promise<void> | null = null;

function loadQrLibrary() {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser required"));
  if (window.qrcode) return Promise.resolve();
  if (qrLoader) return qrLoader;
  qrLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("QR renderer could not be loaded"));
    document.head.appendChild(script);
  });
  return qrLoader;
}

async function setupForModal(root: HTMLElement) {
  const user = getClientAuth().currentUser;
  if (!user) return;
  const token = await user.getIdToken(true);
  const response = await fetch("/api/withdrawals/setup", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to prepare Google Authenticator");

  const qr = root.querySelector<HTMLElement>(".qrDemo");
  const codeInput = root.querySelector<HTMLInputElement>("#setup-code");
  const confirm = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.includes("Confirm and enable"));
  const list = root.querySelector<HTMLOListElement>(".setupList");

  if (data.enabled) {
    if (qr) qr.innerHTML = "<span>✓ Authenticator already enabled</span>";
    if (list) list.style.display = "none";
    if (codeInput) codeInput.parentElement?.setAttribute("style", "display:none");
    if (confirm) confirm.textContent = "Continue to withdrawal";
    return;
  }

  if (qr && data.otpauthUri) {
    await loadQrLibrary();
    if (window.qrcode) {
      const generator = window.qrcode(0, "M");
      generator.addData(String(data.otpauthUri));
      generator.make();
      const dataUrl = generator.createDataURL(5, 4);
      qr.innerHTML = `<img src="${dataUrl}" alt="Unique SaharaSnow Google Authenticator QR code" style="width:100%;height:100%;object-fit:contain"/>`;
    }
  }

  if (data.secretKey && qr) {
    const manual = document.createElement("div");
    manual.className = "totpManualKey";
    manual.innerHTML = `<small>Manual setup key</small><b>${String(data.secretKey).replace(/[&<>\"']/g, "")}</b>`;
    qr.parentElement?.insertBefore(manual, qr.nextSibling);
  }

  if (confirm) {
    let verified = false;
    confirm.addEventListener("click", async event => {
      if (verified) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const code = String(codeInput?.value || "").replace(/\D/g, "");
      if (code.length !== 6) return;
      confirm.disabled = true;
      try {
        const freshUser = getClientAuth().currentUser;
        if (!freshUser) throw new Error("Please sign in again.");
        const freshToken = await freshUser.getIdToken(true);
        const verifyResponse = await fetch("/api/withdrawals/setup", {
          method: "PUT",
          headers: { "content-type": "application/json", authorization: `Bearer ${freshToken}` },
          body: JSON.stringify({ code }),
        });
        const verifyData = await verifyResponse.json();
        if (!verifyResponse.ok) throw new Error(verifyData.error || "Authenticator code is invalid");
        verified = true;
        confirm.disabled = false;
        confirm.click();
      } catch (error) {
        confirm.disabled = false;
        const message = error instanceof Error ? error.message : "Authenticator verification failed";
        const existing = root.querySelector<HTMLElement>(".totpError");
        if (existing) existing.textContent = message;
        else {
          const errorNode = document.createElement("p");
          errorNode.className = "secureNote totpError";
          errorNode.textContent = message;
          confirm.parentElement?.appendChild(errorNode);
        }
      }
    }, { capture: true });
  }
}

export default function WithdrawalTotpBridge() {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const modal = Array.from(document.querySelectorAll<HTMLElement>(".backdrop .authModal")).find(node => node.querySelector("#setup-code"));
      if (!modal || modal.dataset.totpBridge === "1") return;
      modal.dataset.totpBridge = "1";
      void setupForModal(modal).catch(() => {
        modal.dataset.totpBridge = "error";
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
