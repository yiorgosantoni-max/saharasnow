const ESCAPE_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] || c);

/**
 * Renders lightweight **bold**, *italic* and __underline__ markup as safe HTML.
 * Raw text is HTML-escaped first, so the only tags ever introduced are the
 * fixed strong/em/u wrappers below - user input can never inject markup.
 */
export function renderRichText(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<u>$1</u>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return html;
}

