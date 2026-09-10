# markdown-renderer

Takes an ordinary markdown file and renders it two ways from one tree: a rich
reading document, and — on a keypress — a presentation.

No slide markers, no special authoring format, and **no LLM anywhere in the
required path**. The whole pipeline runs offline with no API key: parse,
inference, render and export are all deterministic.

```bash
npm install
npm run dev        # the app: open, edit, inspect, present

npm run build:cli
node dist-cli/mdr.mjs talk.md      # -> talk.html, one self-contained file
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

## Sharing what you render

The artifact you hand to other people is **one HTML file**. Markup, styles,
highlighted code, maths fonts and both views are inlined, along with a small
script to switch between them. No server, no network, no install — it opens
from a filesystem, on any machine, offline.

Two ways to produce one:

**In the app** — the **Export** button. This one runs in a real browser, so
diagrams are pre-rendered to SVG and the file stays small (~500 KB).

**On the command line** — `mdr`, which needs no browser at all:

```bash
mdr talk.md                  # -> talk.html, ~430 KB
mdr talk.md -o build/x.html  # choose the output path
mdr talk.md --stdout         # pipe it somewhere
mdr talk.md --diagrams       # inline the diagram runtime (see below)
```

### The one thing the CLI cannot do

Mermaid needs a browser layout engine to measure text, so there is no way to
draw a diagram in Node. The CLI therefore has two honest options and no third:

| | Result | Size |
| --- | --- | --- |
| default | diagrams shown as their source | ~430 KB |
| `--diagrams` | diagrams draw themselves when opened | ~3.9 MB |
| app **Export** | diagrams pre-rendered to SVG | ~500 KB |

`--diagrams` inlines mermaid's self-contained build, which is about 3.4 MB.
There is no smaller version: the ESM entry lazy-loads its diagram types by
relative path, which cannot work from an inline script, and bundling from
source saves nothing because mermaid registers every diagram type eagerly.
A ninefold jump in file size for one flowchart should be your decision, so it
is opt-in.

If a document has diagrams and you want a small file, use the app's Export.

### Why there is no binary

Every way of packaging JavaScript as an executable embeds a whole runtime:
Bun's `--compile` lands around 55–60 MB, Deno's around 80 MB, Node's SEA
around 110 MB. None of them are small, and a native rewrite that *would* be
small (~8 MB) would mean giving up Shiki, KaTeX and Mermaid.

`npx` gets you the same thing at 0 MB for anyone who has Node, and the file
you actually share needs nothing installed at all. If you do need a Node-free
binary later, `bun build --compile` over `src/cli-entry.ts` is a packaging
step rather than a change to any of this.

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
src/export/    IR → one self-contained .html       (browser and Node paths)
src/cli.ts     the `mdr` command
src/ui/        toolbar, TOC, theme
fixtures/      kitchen-sink.md, sample.md
test/          conformance, rules, overrides, deck, sanitizer
```

`src/core` has no dependency on React or the DOM, which is why the rules are
testable in isolation and why the whole inference layer runs in Node.

The export has two front ends over one set of components. The browser path
lets Shiki, KaTeX and Mermaid settle in a live document and serializes the
result; the Node path resolves the same work up front and renders in a single
`react-dom/server` pass. Neither has its own copy of the renderer, so the two
cannot drift — and because the Node path exists, the exported file is covered
by the test suite rather than only by opening a browser.

## Scripts

```bash
npm run dev        # dev server
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # typecheck, then app and CLI
npm run build:cli  # just the CLI
```

## Licence

MIT. This repository is published read-only and does not take pull requests —
see [CONTRIBUTING.md](CONTRIBUTING.md). Fork away.
