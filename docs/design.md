# Design notes

Why this renderer works the way it does. For what it does and how to run it,
see the [README](../README.md).

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

The **Presentation IR** ([`src/core/ir.ts`](../src/core/ir.ts)) is the contract
between *what the content is* and *how it gets drawn*. Every renderer — reading
view, deck, static export — consumes only the IR and never sees mdast. That is
what lets one tree render three ways without three parsers, and why switching
between reading and presenting keeps your place.

`src/core` has no dependency on React or the DOM, which is why the rules are
testable in isolation and why the whole inference layer runs in Node.

## Deliberate refusals

Each rule is a structural test, and all of them are refusable. Refusing is the
common case. The ones worth knowing about:

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

## Exporting

The export has two front ends over one set of components. The browser path lets
Shiki, KaTeX and Mermaid settle in a live document and serializes the result;
the Node path resolves the same work up front and renders in a single
`react-dom/server` pass. Neither has its own copy of the renderer, so the two
cannot drift — and because the Node path exists, the exported file is covered
by the test suite rather than only by opening a browser.

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

Running from a clone costs 0 MB for anyone who has Node, and the file you
actually share needs nothing installed at all. If a Node-free binary is ever
needed, `bun build --compile` over `src/cli-entry.ts` is a packaging step
rather than a change to any of this.
