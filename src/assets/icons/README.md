# App icons

Drop UI icons for the app here (SVG preferred; PNG @2x acceptable).

## Conventions

- **Naming**: kebab-case, descriptive — `heat-pump-outdoor.svg`, `filter-refrigerant.svg`.
  Add `-dark` / `-light` suffixes only when a theme variant is truly needed.
- **Format**: SVG with `fill="currentColor"` (or explicit brand colors from
  `brand-assets/README.md`) so icons inherit text color where possible.
- **Brand marks** (logo, flags) stay in `brand-assets/` + `src/components/BrandLogo.tsx` —
  this folder is for functional UI icons only.

## Usage (Vite)

```tsx
// As an <img> URL (bundled & hashed at build time):
import filterIcon from '../assets/icons/filter-refrigerant.svg';
<img src={filterIcon} alt="" width={16} height={16} />

// Raw SVG string (for inlining):
import raw from '../assets/icons/filter-refrigerant.svg?raw';
```

Tiny one-off stroke icons already live inline in `src/hpiq/ui.tsx`
(SearchIcon, ChevronDown, …) — keep using that pattern for simple glyphs;
use this folder for anything with real artwork.
