/** Merge short pedagogical summary with PDF-derived excerpt for display / seed parity. */
export function composeChapterSummary(summary: string | null | undefined, excerpt: string | null | undefined): string {
  const s = (summary ?? "").trim();
  const e = (excerpt ?? "").trim();
  if (!e) return s;
  if (s && e.length > 40 && s.includes(e.slice(0, Math.min(80, e.length)))) return s;
  const cap = 14_000;
  const body = e.length > cap ? `${e.slice(0, cap)}…` : e;
  if (!s) return `── 課本摘錄（PDF 擷取）──\n\n${body}`;
  return `${s}\n\n── 課本摘錄（PDF 擷取）──\n\n${body}`;
}
