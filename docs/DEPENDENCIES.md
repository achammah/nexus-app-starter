# Dependencies

Every npm dependency, why it exists, and how it loads. The server (`server/*.mjs`) is zero-dependency by hard rule: node built-ins only. Adding a client dependency needs a maintainer go and a row here (name, exact resolved version, license, why, weight, lazy-load strategy). Sizes are unpacked `node_modules` kilobytes for the package itself (measured with `du -sk`, transitive deps not included).

## Runtime

| Package | Range → resolved | License | Why it exists | KB | Loading |
|---|---|---|---|---|---|
| react / react-dom | ^18.3.1 → 18.3.1 | MIT | the UI runtime | 368 / 4488 | main chunk |
| @tanstack/react-table | ^8.20.0 → 8.21.3 | MIT | DataTable's column/sort model | 776 | main chunk |
| @tanstack/react-virtual | ^3.10.0 → 3.14.6 | MIT | DataTable windowing past 80 rows | 68 | main chunk |
| @dnd-kit/core | ^6.1.0 → 6.3.1 | MIT | KanbanBoard drag | 1532 | main chunk |
| @dnd-kit/sortable | ^8.0.0 → 8.0.0 | MIT | sortable variants for dnd-kit consumers | 360 | main chunk |
| lucide-react | ^0.427.0 → 0.427.0 | ISC | the icon set (tree-shaken per icon) | 32812 | main chunk (only imported icons bundle) |
| radix-ui | ^1.1.0 → 1.6.2 | MIT | umbrella for the vendored shadcn kit's primitives (the per-primitive @radix-ui packages install through it) | 80 (+primitives) | main chunk |
| class-variance-authority | ^0.7.0 → 0.7.1 | Apache-2.0 | shadcn variant API | 44 | main chunk |
| clsx | ^2.1.1 → 2.1.1 | MIT | class merge (with tailwind-merge behind `cn()`) | 40 | main chunk |
| tailwind-merge | ^2.5.0 → 2.6.1 | MIT | class merge (the shadcn contract) | 760 | main chunk |
| tw-animate-css | ^1.2.0 → 1.4.0 | MIT | shadcn animation utilities | 56 | main chunk |
| cmdk | ^1.0.0 → 1.1.1 | MIT | the ⌘K palette + typeahead lists | 116 | main chunk |
| sonner | ^1.5.0 → 1.7.4 | MIT | vendored toast system (the starter shell ships its own minimal toast; pick ONE per app) | 288 | main chunk |
| next-themes | ^0.3.0 → 0.3.0 | MIT | sonner's theme binding | 36 | main chunk |
| vaul | ^1.0.0 → 1.1.2 | MIT | vendored drawer (bottom sheet) | 196 | main chunk |
| date-fns | ^3.6.0 → 3.6.0 | MIT | date math for the vendored calendar | 36620 | main chunk (tree-shaken) |
| react-day-picker | ^9.0.0 → 9.14.0 | MIT | the vendored calendar / date picking | 32196 | main chunk |
| embla-carousel-react | ^8.1.0 → 8.6.0 | MIT | vendored carousel | 88 | main chunk |
| input-otp | ^1.2.0 → 1.4.2 | MIT | vendored one-time-code input | 124 | main chunk |
| react-hook-form | ^7.52.0 → 7.82.0 | MIT | vendored form wiring | 2124 | main chunk |
| @hookform/resolvers | ^3.9.0 → 3.10.0 | MIT | zod resolver for react-hook-form | 1756 | main chunk |
| zod | ^3.23.0 → 3.25.76 | MIT | form validation schemas (KitDemo, vendored form) | 5136 | main chunk |
| react-resizable-panels | ^4.0.0 → 4.12.2 | MIT | vendored split panes | 556 | main chunk |
| recharts | 3.8.0 (pinned) → 3.8.0 | MIT | the vendored chart.tsx wrapper (token-bound `--chart-1..5`); record-core ChartView itself is dependency-free flex bars | 8636 | main chunk |

## Dev

| Package | Range → resolved | License | Why it exists | KB |
|---|---|---|---|---|
| vite | ^5.4.0 → 5.4.21 | MIT | build + dev server (also provides `import.meta.glob` for the view registry) | 3452 |
| @vitejs/plugin-react | ^4.3.1 → 4.7.0 | MIT | React fast refresh + JSX transform | 80 |
| typescript | ^5.5.4 → 5.9.3 | Apache-2.0 | typecheck (`tsc -b` in `npm run build`) | 23388 |
| tailwindcss + @tailwindcss/vite | ^4.0.0 → 4.3.3 | MIT | the shadcn styling layer over the `--nx-*` tokens | 852 + 28 |
| playwright | ^1.45.0 → 1.61.1 | Apache-2.0 | the journey runner's browser | 4904 |
| @types/react, @types/react-dom | → 18.3.31 / 18.3.7 | MIT | React typings | 464 / 60 |

## Loading strategy + bundle budget

The app builds as ONE main chunk today. Measured eager-bundle checkpoints (`vite build` output, `dist/assets/index-*.js`):

| State | JS min | JS gzip | CSS min |
|---|---|---|---|
| pre view-registry (49292a9) | 1,268.07 kB | 374.81 kB | 158.79 kB |
| with the view registry | 1,274.53 kB | 376.92 kB | 158.79 kB |

Budget rule: the eager bundle must not grow more than 2% over the previous baseline without an explicit maintainer go (the registry landed at +0.51% min / +0.56% gzip). New HEAVY view types register a `React.lazy` component (the registry host wraps rendering in Suspense), which code-splits them out of the eager chunk automatically; a lazy view chunk stays at or under ~250 KB gzip. The natural first split candidates in the existing set are recharts, react-day-picker and date-fns if the eager chunk needs to shrink.

## Adapted-source provenance

Adapted foreign code (MIT / Apache-2.0 / BSD family only) carries a one-line `// adapted from <repo> (<license>)` header comment in the file and a row here. Current adapted files: none.
