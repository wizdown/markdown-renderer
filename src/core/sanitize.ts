/**
 * Allowlist sanitizer for raw HTML embedded in markdown.
 *
 * Markdown lets authors drop arbitrary HTML into a document, and we render it
 * with dangerouslySetInnerHTML, so this is the only thing standing between a
 * pasted document and script execution. It is deliberately strict and
 * dependency-free: it runs identically in the browser, in Node tests and in
 * the static export, with no DOM required.
 *
 * Anything not explicitly allowed is dropped. Unknown tags lose the tag but
 * keep their text content, which degrades a stray `<span>` into plain prose
 * rather than swallowing the sentence inside it.
 */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col',
  'colgroup', 'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption',
  'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd',
  'li', 'mark', 'ol', 'p', 'picture', 'pre', 'q', 's', 'samp', 'section',
  'small', 'source', 'span', 'strong', 'sub', 'summary', 'sup', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'var', 'wbr',
])

/** Void elements never get a closing tag re-emitted. */
const VOID_TAGS = new Set(['br', 'col', 'hr', 'img', 'source', 'wbr'])

const GLOBAL_ATTRS = new Set(['class', 'id', 'title', 'lang', 'dir', 'role'])

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  source: new Set(['src', 'srcset', 'type', 'media']),
  td: new Set(['colspan', 'rowspan', 'align']),
  th: new Set(['colspan', 'rowspan', 'align', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  ol: new Set(['start', 'type', 'reversed']),
  details: new Set(['open']),
  del: new Set(['datetime']),
  ins: new Set(['datetime']),
}

/** Attributes whose value is a URL and therefore needs a scheme check. */
const URL_ATTRS = new Set(['href', 'src', 'srcset'])

const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i
/** Inline images are common and harmless; other data: payloads are not. */
const SAFE_DATA_URL = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i
/** Control characters and spaces, stripped before scheme matching so that
 *  `java\nscript:` and `java script:` cannot smuggle a scheme past the test. */
const URL_NOISE = /[\u0000-\u0020\u007F]/g

export function isSafeUrl(raw: string): boolean {
  const url = raw.replace(URL_NOISE, '')
  if (url === '') return false
  if (SAFE_DATA_URL.test(raw.trim())) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return SAFE_URL.test(url)
  // Scheme-less: a relative path, fragment or bare filename.
  return true
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function sanitizeAttrs(tag: string, raw: string): string {
  const allowed = TAG_ATTRS[tag]
  const out: string[] = []
  let match: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((match = ATTR_RE.exec(raw)) !== null) {
    const name = (match[1] ?? '').toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    // `on*` handlers, `style`, and anything unlisted go on the floor.
    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue
    if (URL_ATTRS.has(name) && !isSafeUrl(value)) continue
    out.push(value === '' ? name : `${name}="${escapeAttr(value)}"`)
  }
  return out.length > 0 ? ' ' + out.join(' ') : ''
}

const TOKEN_RE =
  /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>|<\?[\s\S]*?(?:\?>|$)|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>?/g

/**
 * Elements whose *contents* are dropped along with the tag — leaving the text
 * of a <script> or <style> behind would dump code into the page as prose.
 */
const DROP_CONTENT =
  /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?(?:<\/\1\s*>|$)/gi

export function sanitizeHtml(input: string): string {
  const withoutDangerous = input.replace(DROP_CONTENT, '')
  let out = ''
  let cursor = 0
  let match: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0

  while ((match = TOKEN_RE.exec(withoutDangerous)) !== null) {
    out += escapeText(withoutDangerous.slice(cursor, match.index))
    cursor = match.index + match[0].length

    const tagName = match[1]?.toLowerCase()
    // Comments, doctypes, CDATA and processing instructions: dropped entirely.
    if (tagName === undefined) continue
    if (!ALLOWED_TAGS.has(tagName)) continue

    if (match[0].startsWith('</')) {
      if (!VOID_TAGS.has(tagName)) out += `</${tagName}>`
      continue
    }

    let attrs = sanitizeAttrs(tagName, match[2] ?? '')
    // Links that open a new tab must not hand the opener over with them.
    if (tagName === 'a' && /\btarget=/.test(attrs) && !/\brel=/.test(attrs)) {
      attrs += ' rel="noopener noreferrer"'
    }
    out += VOID_TAGS.has(tagName) ? `<${tagName}${attrs} />` : `<${tagName}${attrs}>`
  }
  out += escapeText(withoutDangerous.slice(cursor))
  return out
}
