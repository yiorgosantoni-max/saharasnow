"use client";

import { useEffect } from "react";

/**
 * Global interaction guards stay passive: no DOM walking or markup insertion.
 * The small style patch below only normalizes the existing mobile app buttons
 * and hides any legacy Apple icon that may have been injected by an older
 * cached deployment.
 */
export default function SiteInteractionGuards() {
  useEffect(() => {
    const blockContext = (event: MouseEvent) => event.preventDefault();
    const blockImageDrag = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault();
    };

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("dragstart", blockImageDrag, true);

    const style = document.createElement("style");
    style.textContent = `
      /* Remove legacy/injected duplicate Apple logos from older builds. */
      .sahara-apple-logo-holder,
      .sahara-apple-logo { display: none !important; }

      /* Keep exactly one Apple logo, inside the Apple App Store button. */
      .mobileSoon .appPlaceholders > div:first-child > i {
        font-size: 0 !important;
        display: inline-block !important;
        width: 22px !important;
        height: 26px !important;
        min-width: 22px !important;
        flex: 0 0 22px !important;
        background: #fff !important;
        -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M17.05 12.54c.02-2.22 1.81-3.29 1.89-3.34-1.03-1.51-2.64-1.72-3.2-1.74-1.35-.14-2.66.81-3.35.81-.71 0-1.78-.8-2.92-.78-1.5.02-2.9.89-3.67 2.25-1.6 2.76-.41 6.82 1.12 9.05.77 1.09 1.66 2.31 2.83 2.27 1.15-.05 1.58-.73 2.97-.73 1.35 0 1.74.73 2.98.7 1.23-.02 2.01-1.1 2.75-2.2.89-1.25 1.25-2.49 1.26-2.55-.03-.01-2.4-.92-2.42-3.74zM14.87 6.03c.62-.78 1.05-1.84.93-2.92-.9.04-2.03.62-2.68 1.38-.58.68-1.1 1.79-.97 2.83 1.01.08 2.05-.51 2.72-1.29z'/%3E%3C/svg%3E") center / contain no-repeat !important;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M17.05 12.54c.02-2.22 1.81-3.29 1.89-3.34-1.03-1.51-2.64-1.72-3.2-1.74-1.35-.14-2.66.81-3.35.81-.71 0-1.78-.8-2.92-.78-1.5.02-2.9.89-3.67 2.25-1.6 2.76-.41 6.82 1.12 9.05.77 1.09 1.66 2.31 2.83 2.27 1.15-.05 1.58-.73 2.97-.73 1.35 0 1.74.73 2.98.7 1.23-.02 2.01-1.1 2.75-2.2.89-1.25 1.25-2.49 1.26-2.55-.03-.01-2.4-.92-2.42-3.74zM14.87 6.03c.62-.78 1.05-1.84.93-2.92-.9.04-2.03.62-2.68 1.38-.58.68-1.1 1.79-.97 2.83 1.01.08 2.05-.51 2.72-1.29z'/%3E%3C/svg%3E") center / contain no-repeat !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("dragstart", blockImageDrag, true);
    };
  }, []);

  return null;
}
