/**
 * Clean textbook / import artifacts: PUA blocks, invisible chars, and
 * extract "book placement" tags like [M4L5] → module 4, lesson 5.
 */

export type BookPlacement = { module: number; lesson: number };

function stripInvisibleAndPUA(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      continue;
    }
    if (cp >= 0xf0000 && cp <= 0xffffd) {
      continue;
    }
    if (cp === 0xfffc || cp === 0xfffd) {
      continue;
    }
    if (cp >= 0x200b && cp <= 0x200f) {
      continue;
    }
    if (cp === 0xfeff) {
      continue;
    }
    out += ch;
  }
  return out;
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s{2,}/g, " ").trim();
}

/**
 * Remove book-tag patterns and problematic codepoints; return first tag found.
 */
export function cleanMeaningField(
  raw: string | null | undefined
): { text: string; placement: BookPlacement | null } {
  if (!raw) {
    return { text: "", placement: null };
  }
  const bookTagRe = /[\[【［]\s*M\s*(\d+)\s*L\s*(\d+)\s*[\]】］]/gi;
  let placement: BookPlacement | null = null;
  const replaced = raw.replace(bookTagRe, (_m, mod, les) => {
    if (!placement) {
      placement = {
        module: Math.min(99, parseInt(mod, 10) || 0),
        lesson: Math.min(99, parseInt(les, 10) || 0),
      };
    }
    return "";
  });
  const text = normalizeSpaces(stripInvisibleAndPUA(replaced));
  return { text, placement };
}

export function formatBookPlacement(p: BookPlacement): string {
  return `Modul ${p.module} · Pelajaran ${p.lesson}`;
}

export function mergePlacements(
  a: BookPlacement | null,
  b: BookPlacement | null
): BookPlacement | null {
  return a ?? b ?? null;
}
