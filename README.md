# markdown-renderer

Takes an ordinary markdown file and renders it two ways from one tree: a rich
reading document, and — on a keypress — a presentation.

No slide markers, no special authoring format, and **no LLM anywhere in the
required path**. The whole pipeline runs offline with no API key: parse,
inference, render and export are all deterministic.

```bash
npm install
npm run dev
```

## The idea

Markdown's structure is thin. It gives you headings, lists, paragraphs and
tables, and almost nothing about importance, relationship or grouping. A
renderer that wants to be more than a stylesheet has to get that structure
somewhere.

This one gets it from the *shape* of the content — measurable things like item
count, item length, nesting depth and how many table cells parse as numbers.
It never reads for meaning, because that would need a model, and needing a
model is the one thing it must not do.

The cost of that choice is a narrower rule set. Where a signal is genuinely
ambiguous, the answer is "leave it as prose and let the author say what they
meant", not "guess harder".

## Pipeline

```
.md → remark (mdast) → sections → structural rules → Presentation IR → renderer
                                        ↑
                            directives + <!-- render: --> hints
```

The **Presentation IR** ([`src/core/ir.ts`](src/core/ir.ts)) is the contract
between *what the content is* and *how it gets drawn*. Every renderer — reading
view, deck, static export — consumes only the IR and never sees mdast. That is
what lets one tree render three ways without three parsers, and why switching
between reading and presenting keeps your place.

## What the rules look for

Each rule is a structural test. All of them are refusable, and refusing is the
common case.

| Signal | Becomes |
| --- | --- |
| Blockquote opening `> [!NOTE]` or `> **Note:**` | callout |
| Unordered list, 2+ items, all `**Term** — description` | definition cards |
| Unordered list, 3–6 short flat items | card grid |
| Ordered list, 3+ items of uniform shape | numbered stepper |
| Table with a label column and 1–6 numeric columns sharing a unit | chart (+ table toggle) |
| 2–3 consecutive **sub**-sections whose bodies are each one list | side-by-side columns |
| Unordered list nested 3+ levels deep | collapsible outline |

Deliberate refusals worth knowing about:

- **Comparisons only fire below H2.** Three consecutive H2s each holding a list
  is an ordinary document, not a comparison; hoisting the document's spine into
  columns destroys the structure a reader navigates by.
- **Charts refuse mixed units.** `50%` beside `3.2s` is not one series, and
  putting them on one axis would be a lie. The table stays a table.
- **Task lists are never collapsed or carded.** A checklist's value is seeing
  every unchecked box at once.
- **Ordinary quotations stay quotations.** Only a recognised label makes a
  callout.

The chart is always a *view* of its table, never a replacement: the **Show
table** toggle is permanent, which is also what makes the palette's lighter
hues acceptable.

## When it guesses wrong

Turn on **Inspect**. Every promoted block wears a chip naming the rule that
produced it, and the menu writes your correction back into the markdown as a
single line:

```md
<!-- render: prose -->
- This list is pinned
- and will stay a list
```

Delete the line and the rules take over again. `prose` pins a block to its
plain rendering; any rule name forces that rule with its gates disabled. The
correction lives in the document, so it survives a reload, a re-render, and
being sent to someone else.

Container directives work too, for authoring rather than correcting:

```md
:::cards{columns=2}
- Explicitly requested
- Two columns
:::
```

## Keyboard

| Key | Action |
| --- | --- |
| <kbd>P</kbd> | Toggle reading ⇄ presenting |
| <kbd>→</kbd> <kbd>Space</kbd> | Next reveal step, then next panel |
| <kbd>←</kbd> | Previous |
| <kbd>↑</kbd> <kbd>↓</kbd> | Previous / next panel, skipping reveals |
| <kbd>F</kbd> | Fullscreen |
| <kbd>Esc</kbd> | Back to reading |

## Export

**Export** writes a single self-contained HTML file: markup, styles,
highlighted code, rendered diagrams and web fonts all inlined, with both views
and a small script to switch between them. No server, no network, no build
step — it opens on the conference-room laptop.

The exported file's script only shows and hides what the renderer already
emitted; it has no idea what a panel is. All of that stays in `buildDeck`, so
the export cannot drift from the app.

## Supported markdown

CommonMark and GFM (tables, task lists, strikethrough, autolinks, footnotes),
plus YAML/TOML frontmatter, `$math$` via KaTeX, ```mermaid diagrams, container
directives, reference links and images, code-fence metadata
(``` ```ts title="a.ts" {2-4} ```), and raw HTML through a strict allowlist
sanitizer.

"Supports all markdown elements" is a test-suite claim, not an architecture
claim — [`fixtures/kitchen-sink.md`](fixtures/kitchen-sink.md) is that claim,
and [`test/conformance.test.ts`](test/conformance.test.ts) checks it.

## Layout

```
src/core/      parse → sections → rules → IR      (no React, no DOM, no network)
src/render/    IR → React                          (doc, deck, every block kind)
src/export/    IR → one self-contained .html
src/ui/        toolbar, TOC, theme
fixtures/      kitchen-sink.md, sample.md
test/          conformance, rules, overrides, deck, sanitizer
```

`src/core` has no dependency on React or the DOM, which is why the rules are
testable in isolation and why the whole inference layer runs in Node.

## Scripts

```bash
npm run dev        # dev server
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build
```
