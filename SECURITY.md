# Security policy

## Supported versions

This project is in beta. Only the latest release on `master` receives fixes;
there are no maintained older lines.

## Reporting a vulnerability

Please report privately, not in a public issue.

Use GitHub's private vulnerability reporting: go to the
[Security tab](https://github.com/wizdown/markdown-renderer/security/advisories/new)
and open a draft advisory. It is visible only to you and the maintainer.

Include what you can — the markdown or HTML input that triggers it, the
rendered or exported output you got, and what an attacker would gain. A
reproducing snippet is worth more than a description.

You can expect an acknowledgement within a week, and a fix or an explanation of
why it is not one before any public disclosure.

## What is in scope

The interesting surface is untrusted markdown:

- **The HTML sanitizer** ([`src/core/sanitize.ts`](src/core/sanitize.ts)) —
  raw HTML in a source document passes through a strict allowlist. Anything
  that gets script execution, event handlers, `javascript:` URLs or unexpected
  tags past it is a vulnerability.
- **Exported documents** — an exported `.html` file inlines content from the
  source markdown. Injection that survives into the exported artifact is in
  scope, since those files are made to be sent to other people.
- **The CLI** — path handling and anything that lets a source document reach
  outside the rendering process.

## What is not

- The dev server (`npm run dev`), which is a local development tool and not
  meant to be exposed.
- Rendering a document you already trust in ways you did not expect. A rule
  firing wrongly is a bug — please report it as an issue, not as a
  vulnerability.
- Denial of service from a pathological document. Worth an issue, not an
  advisory.
