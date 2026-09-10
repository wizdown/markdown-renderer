import { describe, expect, it } from 'vitest'
import { isSafeUrl, sanitizeHtml } from '../src/core/sanitize'

describe('sanitizeHtml', () => {
  it('keeps allowlisted tags and attributes', () => {
    expect(sanitizeHtml('<div class="x"><strong>hi</strong></div>')).toBe(
      '<div class="x"><strong>hi</strong></div>',
    )
  })

  it('drops unknown tags but keeps their text', () => {
    expect(sanitizeHtml('<marquee>keep this</marquee>')).toBe('keep this')
  })

  it('drops script and style contents entirely', () => {
    expect(sanitizeHtml('<script>alert(1)</script>after')).toBe('after')
    expect(sanitizeHtml('<style>body{color:red}</style>after')).toBe('after')
  })

  it('drops event handlers and inline styles', () => {
    expect(sanitizeHtml('<div onclick="steal()" style="color:red">x</div>')).toBe('<div>x</div>')
  })

  it('adds rel=noopener to target=_blank links', () => {
    expect(sanitizeHtml('<a href="https://example.com" target="_blank">go</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">go</a>',
    )
  })

  it('drops unsafe hrefs but keeps the link text', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>')
  })

  it('escapes stray angle brackets', () => {
    expect(sanitizeHtml('5 < 6 & 7 > 2')).toBe('5 &lt; 6 &amp; 7 &gt; 2')
  })

  it('drops comments', () => {
    expect(sanitizeHtml('<!-- secret -->visible')).toBe('visible')
  })
})

describe('isSafeUrl', () => {
  const unsafe = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\nscript:alert(1)',
    'java script:alert(1)',
    ' javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
  ]
  for (const url of unsafe) {
    it(`rejects ${JSON.stringify(url)}`, () => expect(isSafeUrl(url)).toBe(false))
  }

  const safe = [
    'https://example.com',
    'http://example.com',
    'mailto:a@b.com',
    '#anchor',
    '/absolute/path',
    './relative.png',
    'bare-file.png',
    'data:image/png;base64,iVBORw0KGgo=',
  ]
  for (const url of safe) {
    it(`accepts ${JSON.stringify(url)}`, () => expect(isSafeUrl(url)).toBe(true))
  }
})
