/**
 * GitHub-flavoured heading slugs, with per-document de-duplication.
 * Anchors, the TOC and deck routing all key off these, so two headings with
 * the same text must still get distinct, stable ids.
 */
export class Slugger {
  private seen = new Map<string, number>()

  slug(text: string): string {
    const base =
      text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section'

    const count = this.seen.get(base) ?? 0
    this.seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }

  reset(): void {
    this.seen.clear()
  }
}
