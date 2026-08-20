"use client";
import { useEffect } from "react";

export default function CustomOrderNotificationTabs() {
  useEffect(() => {
    let dead = false;
    let queued = false;

    const clearPlaceholders = () => {
      document.querySelectorAll<HTMLElement>(".saharaCustomOrderTabs,.saharaReqHead,.saharaReqTable").forEach((x) => x.remove());
      Array.from(document.querySelectorAll<HTMLElement>("section,div")).forEach((x) => {
        const text = (x.innerText || "").trim();
        if (
          text === "Custom ordersManage custom order requests and offers." ||
          text === "Custom ordersManage custom order requests separately from your other dashboard sections."
        ) x.remove();
      });
    };

    const install = () => {
      queued = false;
      if (dead) return;
      clearPlaceholders();
      if (/admin|service|listing/.test(location.pathname.toLowerCase())) return;

      const text = (document.body.innerText || "").toLowerCase();
      if (!["profile", "earnings", "kyc verification", "notifications", "inbox", "orders & invoices"].every((x) => text.includes(x))) return;
      if (document.querySelector(".saharaTabNav")) return;

      const tabs = Array.from(document.querySelectorAll<HTMLElement>("button,a,[role='tab'],[role='link']"));
      const orders = tabs.find((x) => (x.innerText || "").trim().toLowerCase() === "orders & invoices");
      const strip = orders?.parentElement as HTMLElement | null;
      const parent = strip?.parentElement as HTMLElement | null;
      if (!orders || !strip || !parent) return;

      const left = document.createElement("button");
      const right = document.createElement("button");
      left.type = right.type = "button";
      left.className = right.className = "saharaTabArrow";
      left.textContent = "‹";
      right.textContent = "›";

      const wrapper = document.createElement("div");
      wrapper.className = "saharaTabNav";
      parent.insertBefore(wrapper, strip);
      wrapper.append(left, strip, right);
      strip.classList.add("saharaTabStrip");

      const custom = document.createElement(orders.tagName.toLowerCase() === "a" ? "a" : "button") as HTMLAnchorElement | HTMLButtonElement;
      custom.className = `${String(orders.className || "")} saharaRequestsTab`;
      if (custom instanceof HTMLAnchorElement) custom.href = "#custom-orders";
      else custom.type = "button";
      custom.textContent = "Custom orders";
      strip.appendChild(custom);

      let index = 0;
      const browse = (direction: number) => {
        const items = Array.from(strip.children).filter((x) => (x as HTMLElement).offsetParent !== null) as HTMLElement[];
        index = Math.max(0, Math.min(items.length - 1, index + direction));
        items[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      };
      left.onclick = () => browse(-1);
      right.onclick = () => browse(1);

      custom.onclick = (event: MouseEvent) => {
        event.preventDefault();
        clearPlaceholders();
        document.dispatchEvent(new CustomEvent("saharasnow:open-custom-orders"));
        const real = Array.from(document.querySelectorAll<HTMLElement>("button,a")).find(
          (x) => /custom order request|send custom order/i.test((x.innerText || "").trim()) && !x.classList.contains("saharaRequestsTab")
        );
        if (real) real.click();
        else location.hash = "custom-orders";
      };

      Array.from(strip.children)
        .filter((x) => x !== custom)
        .forEach((x) => x.addEventListener("click", () => {
          clearPlaceholders();
          location.hash = "";
        }));
    };

    const schedule = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(install);
      }
    };

    install();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", schedule);
    window.addEventListener("pageshow", schedule);

    return () => {
      dead = true;
      observer.disconnect();
      window.removeEventListener("popstate", schedule);
      window.removeEventListener("pageshow", schedule);
    };
  }, []);

  return <style>{`.saharaTabNav{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;width:100%!important;min-width:0!important}.saharaTabStrip{display:flex!important;align-items:center!important;gap:inherit!important;min-width:0!important;overflow-x:auto!important;scroll-behavior:smooth!important;scrollbar-width:none!important;white-space:nowrap!important}.saharaTabStrip::-webkit-scrollbar{display:none}.saharaRequestsTab{font:inherit!important;font-size:inherit!important;font-weight:inherit!important;line-height:inherit!important;letter-spacing:inherit!important;text-transform:none!important;color:inherit!important;white-space:nowrap!important;box-sizing:border-box!important;flex:0 0 auto!important;cursor:pointer!important}.saharaTabArrow{border:0!important;background:transparent!important;color:inherit!important;font:inherit!important;padding:0 8px!important;margin:0!important;cursor:pointer!important;white-space:nowrap!important}`}</style>;
}
