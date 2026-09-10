# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html) — with the caveat
that this is beta software, so pre-1.0 minor releases may break the rule set,
the Presentation IR or the override syntax.

## [Unreleased]

## [0.1.0]

First public release.

### Added

- Dual rendering of one markdown tree: a reading document and a presentation,
  switched with <kbd>P</kbd>, sharing position between the two.
- Structural inference over content shape — callouts, definition cards, card
  grids, numbered steppers, charts, side-by-side comparisons and collapsible
  outlines — with no model and no network.
- `<!-- render: -->` hints and container directives for overriding an inferred
  block, written back into the source document.
- **Inspect** mode, naming the rule behind every promoted block.
- Export to a single self-contained HTML file, from the app or from the `mdr`
  CLI, carrying both views offline.
- Markdown support covering CommonMark and GFM, frontmatter, KaTeX maths,
  mermaid diagrams, code-fence metadata and raw HTML through an allowlist
  sanitizer.

[Unreleased]: https://github.com/wizdown/markdown-renderer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wizdown/markdown-renderer/releases/tag/v0.1.0
