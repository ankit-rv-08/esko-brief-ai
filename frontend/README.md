# Pack Brief Pro

Build a premium editorial-style web app UI for a "Packaging Design Brief" tool. 

STYLE:

- Warm off-white canvas (#f7f5f2)

- Terracotta accent (#d97757)

- Serif display font (Georgia) for main title

- Sans-serif (Inter) for everything else

- Editorial/legal-document feel like a high-end consultancies brief

LAYOUT (3 columns, fixed height, no page scroll):

LEFT SIDEBAR (300px, light gray #fbfaf8, right border):

- Section "Sources" with count badge — list of file cards (icon + filename + meta)

- Section "Gaps" with amber count badge — amber-tinted cards with title + description

- Section "Conflicts" with count badge — white card with two-column "Recycled Kraft VS Bleached White" comparison

CENTER (scrollable, white background):

- Large serif title: "Draft Brief: ECO-01 Soap Packaging Redesign"

- Numbered sections as white cards: "1. Project Overview", "2. Material Specs"

- Each section has a confidence pill on the right: green "94% Confidence" or amber "82% Confidence" with a colored dot

- Below each section body: row of citation chips with file icons (green spreadsheet icon for xlsx, red document icon for pdf), each says "production_specs.xlsx, p.2"

- At the bottom: two side-by-side callouts — "Uncertainty" (amber bg, bullet list) and "Open Questions for Agency" (white bg, numbered list)

- Bottom row: two ghost buttons "Export PDF" and "Export DOCX"

RIGHT PANEL (340px, light gray, left border):

- Header "Evidence"

- Empty state: small icon + "Select a citation in the brief to inspect the exact supporting source."

- When populated: light gray snippet card with the highlighted source text, a mono-font line "Source file: production_specs.xlsx · Row 3", and a terracotta link "Open full source ↗"

HEADER (52px):

- Left: small dark square with sparkles icon + "Brief AI" bold

- Right: ghost button "Add files" + primary terracotta button "Generate brief"

Add subtle fade-up animation on section load. Rounded corners 6-12px. Soft shadows only on hover.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f661c7bb-03eb-4d0f-bfad-1947c471a5dc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
