"use client";
import { type CSSProperties } from "react";

const btnStyle: CSSProperties = { border: "1px solid #dcdfea", background: "#fff", borderRadius: 7, padding: "6px 11px", cursor: "pointer", fontSize: 13, lineHeight: 1, color: "#17154a" };

export default function RichTextToolbar({ textareaId, value, onChange }: { textareaId: string; value: string; onChange: (next: string) => void }) {
  const wrap = (marker: string) => {
    const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + marker.length, start + marker.length + selected.length);
    });
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <button type="button" onClick={() => wrap("**")} title="Bold" aria-label="Bold" style={{ ...btnStyle, fontWeight: 900 }}>B</button>
      <button type="button" onClick={() => wrap("*")} title="Italic" aria-label="Italic" style={{ ...btnStyle, fontStyle: "italic" }}>I</button>
      <button type="button" onClick={() => wrap("__")} title="Underline" aria-label="Underline" style={{ ...btnStyle, textDecoration: "underline" }}>U</button>
      <small style={{ color: "#8a8fa3", fontWeight: 400, fontSize: 11 }}>Select text and click, or type **bold**, *italic*, __underline__</small>
    </div>
  );
}

