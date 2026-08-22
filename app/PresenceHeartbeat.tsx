"use client";
import { useEffect } from "react";
import { getClientAuth, observeAuth } from "@/lib/firebase-client";

const HEARTBEAT_MS = 60000;

export default function PresenceHeartbeat() {
  useEffect(() => {
    let timer = 0;
    const ping = async () => {
      const user = getClientAuth().currentUser;
      if (!user || document.visibilityState !== "visible") return;
      try {
        const token = await user.getIdToken();
        await fetch("/api/presence", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      } catch {}
    };
    const onVisible = () => { if (document.visibilityState === "visible") void ping(); };
    const unsubscribe = observeAuth(signedIn => {
      window.clearInterval(timer);
      if (!signedIn) return;
      void ping();
      timer = window.setInterval(ping, HEARTBEAT_MS);
    });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
