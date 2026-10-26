# Design System & Visual Authority

<!-- impeccable:design-schema 1 -->

## Visual World

**Substrate:** Deep technical command center (`#070a10` carbon base with `#0c121d` elevated surface).
**Tone:** Surgical, authoritative, zero-fluff developer tool. Monospace is reserved strictly for code, tokens, line numbers, hashes, and measurements.

## Palette & Color Strategy

- **Base Canvas:** `#070a10`
- **Surface Elevation:** `#0c121d`
- **Raised Elevation:** `#111a2a`
- **Subtle Borders:** `#182335`
- **Default Borders:** `#22324b`
- **Strong Borders:** `#33496b`
- **Primary Text:** `#f0f4fc` (High contrast, ≥ 4.5:1 on all dark substrates)
- **Secondary Text:** `#94a7c6`
- **Muted Text:** `#5e7394`
- **Accent Primary:** `#2563eb` (Pure blue, used strictly for primary functional actions)

### Diff Grammar

- **Addition Background:** `#062316`
- **Addition Foreground:** `#34d399`
- **Deletion Background:** `#2d0b0f`
- **Deletion Foreground:** `#f87171`

### Severity Grammar

- **Critical:** Vermilion badge (`bg-red-600`), `#21090d` finding backdrop, `#7f1d1d` border.
- **High:** Amber badge (`bg-amber-600`), `#241306` finding backdrop, `#78350f` border.
- **Medium:** Cobalt badge (`bg-blue-600`), `#09152b` finding backdrop, `#1e3a8a` border.
- **Low:** Slate badge (`bg-slate-700`), `#101724` finding backdrop, `#1e293b` border.

## Typography

- **Interface Body & Headings:** System UI sans-serif stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`).
- **Code & Measurements:** Hardware-calibrated monospace stack (`ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas`).
- **Headings:** Direct, heavy weight (`font-extrabold`), tight tracking, zero gradient text or banner labels.

## Components & Layout

- **Split-Screen Diff Viewer:** Synchronized side-by-side (Base vs Head) with 1/2 viewport width and unified single-column stream toggle.
- **Finding Cards:** Inline expandable cards directly underneath the affected line number, featuring rule citations and one-click "Apply Fix to PR Branch" buttons.
- **Rule Studio:** Guideline uploader and vectorization playground with one-click industry standard presets (RFC-104 Zero Secrets, SEC-202 SQL Anti-Injection, ARCH-305 Server Action Isolation).
