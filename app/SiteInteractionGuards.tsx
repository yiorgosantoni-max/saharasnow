"use client";

import { useEffect } from "react";

/**
 * Global interaction guards must stay passive. In particular, do not walk or
 * rewrite the DOM here: inserting markup into arbitrary homepage containers
 * can change React's layout tree and break sizing across the page.
 */
export default function SiteInteractionGuards() {
  useEffect(() => {
    const blockContext = (event: MouseEvent) => event.preventDefault();
    const blockImageDrag = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault();
    };

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("dragstart", blockImageDrag, true);

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("dragstart", blockImageDrag, true);
    };
  }, []);

  return null;
}
