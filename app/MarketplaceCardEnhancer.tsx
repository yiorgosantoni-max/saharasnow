"use client";

import { useEffect } from "react";

// ...existing component code...

    const scan = () => document.querySelectorAll<HTMLElement>("#service-results article[id^='service-']").forEach(enhanceCard);
    scan();
    const root = document.getElementById("service-results");
    const observer = root ? new MutationObserver(scan) : null;
    if (observer && root) observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      document.removeEventListener("click", favoriteClick, true);
      document.removeEventListener("sahara-share-recorded", refreshEngagement as EventListener);
      style.remove();
    };
  }, []);
  return null;
}