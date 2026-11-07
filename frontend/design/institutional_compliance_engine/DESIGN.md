---
name: Institutional Compliance Engine
colors:
  surface: '#FCFAFB'
  surface-dim: '#EEE4E9'
  surface-bright: '#FCFAFB'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#FFF7FA'
  surface-container: '#FCEAF2'
  surface-container-high: '#FCEAF2'
  surface-container-highest: '#FCEAF2'
  on-surface: '#211A1F'
  on-surface-variant: '#766B72'
  inverse-surface: '#211A1F'
  inverse-on-surface: '#FCFAFB'
  outline: '#766B72'
  outline-variant: '#EEE4E9'
  surface-tint: '#D9468D'
  primary: '#D9468D'
  on-primary: '#ffffff'
  primary-container: '#BE3477'
  on-primary-container: '#FFFFFF'
  inverse-primary: '#FCEAF2'
  secondary: '#16845B'
  on-secondary: '#ffffff'
  secondary-container: '#E7F6EF'
  on-secondary-container: '#16845B'
  tertiary: '#9D285F'
  on-tertiary: '#ffffff'
  tertiary-container: '#BE3477'
  on-tertiary-container: '#FFF7FA'
  error: '#B83270'
  on-error: '#ffffff'
  error-container: '#FCEAF2'
  on-error-container: '#9D285F'
  primary-fixed: '#FCEAF2'
  primary-fixed-dim: '#FCEAF2'
  on-primary-fixed: '#211A1F'
  on-primary-fixed-variant: '#9D285F'
  secondary-fixed: '#E7F6EF'
  secondary-fixed-dim: '#16845B'
  on-secondary-fixed: '#211A1F'
  on-secondary-fixed-variant: '#16845B'
  tertiary-fixed: '#FCEAF2'
  tertiary-fixed-dim: '#FCEAF2'
  on-tertiary-fixed: '#211A1F'
  on-tertiary-fixed-variant: '#9D285F'
  background: '#FCFAFB'
  on-background: '#211A1F'
  surface-variant: '#FCEAF2'
typography:
  display:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: '600'
    lineHeight: 3.5rem
    letterSpacing: -0.025em
  display-mobile:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.025em
  numeric-metric:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an institutional-grade, audit-ready visual environment tailored for real-world asset (RWA) compliance, identity verification, and multi-wallet limit aggregation. The interface departs decisively from retail crypto conventions—rejecting neon glows, gamified gradients, dark-mode terminal aesthetics, and speculative hype.

The visual direction draws from Swiss modernist typography, clean corporate architectural structuring, and regulatory utility. Every interface element reinforces transparency, technical determinism, and fiduciary accountability. The aesthetic communicates the gravitas of a tier-one clearing house combined with the frictionless speed of modern institutional infrastructure: deliberate, grounded, understated, and mathematically precise.

## Colors

The palette relies on structural clarity and high-contrast accessibility.

- **Primary Accent (`#BE3477`)**: An authoritative, desaturated deep burgundy. Reserved for primary operational actions, brand indicators, and key institutional verification touchpoints.
- **Secondary (`#059669`)**: A sober emerald used for verified identity states, authorized wallet ties, and compliant allocation headroom. Its surface counterpart (`#ECFDF5`) acts as a calm confirmation backdrop.
- **Tertiary (`#DC2626`)**: A precise, urgent warning red for hard limit breaches, denied sybil interactions, and identity verification flags. Paired with muted backing (`#FEF2F2`).
- **Neutrals**:
  - Base canvas: `#F8F9FA` creates a low-strain, soft backdrop.
  - Layered surfaces: `#FFFFFF` provides pure, elevated clarity for transactional cards and audit ledgers.
  - Borders: Crisp, hairline neutral lines (`#E5E7EB`).
  - Text Primary: `#111827` delivers uncompromising legibility.
  - Text Secondary/Muted: `#6B7280` provides calm contextual hierarchy for subheaders, table captions, and metadata.

## Typography

Typography prioritizes tabular consistency and rigorous data alignment. All numeric data across ledgers, aggregated balance sheets, limit meters, and wallet strings must enforce CSS font feature settings: `font-feature-settings: "tnum" on, "cv05" on, "cv11" on`. This guarantees uniform vertical scanning across disparate wallet listings.

Headline weights are limited to Medium (500) and SemiBold (600) to avoid sensationalist visual weight. Body text prioritizes high legibility at dense information scales. Micro-labels and compliance badge text use SemiBold (600) with slight positive tracking to maintain absolute clarity against subtle pastel container backgrounds.

## Layout & Spacing

The layout is constructed on an 8pt base grid within a 12-column responsive layout. On desktop viewports (1280px+), the maximum content container width is capped at 1360px to maintain scannable line lengths and controlled eye movement across financial data grids.

- **Breakpoints**: Mobile (under 768px, 4 columns, 1rem margin), Tablet (768px–1024px, 8 columns, 1.5rem margin), Desktop (1024px+, 12 columns, 2rem margin).
- **Rhythm**: Element padding and margins adhere strictly to multiples of 4px and 8px. Metric cards, data ledgers, and compliance forms rely on internal vertical stacking (`space-sm` for labels, `space-md` between form rows, `space-lg` to `space-xl` for section separation). Dense dashboard data grids use compact padding scales to maximize above-the-fold institutional visibility.

## Elevation & Depth

Visual separation relies on architectural surface boundaries and muted depth rather than high-contrast drops.

1. **Base Surface**: The global foundation sits at `#F8F9FA`.
2. **Container Level (Cards & Data Tables)**: Clean `#FFFFFF` elevated from the base using a crisp `1px solid #E5E7EB` border complemented by a diffused, low-opacity ambient shadow: `0 1px 3px 0 rgba(17, 24, 39, 0.05), 0 1px 2px -1px rgba(17, 24, 39, 0.03)`.
3. **Floating Overlays & Dropdowns**: Modals and institutional verification flyouts introduce an elevation boundary defined by `0 10px 15px -3px rgba(17, 24, 39, 0.06), 0 4px 6px -4px rgba(17, 24, 39, 0.04)` combined with a `1px solid #E5E7EB` perimeter.
4. **State Layering**: Hover states on interactive surface rows do not lift along the Z-axis; instead, they shift their background fill to `#F9FAFB` to preserve architectural stability.

## Shapes

The geometric framework balances human usability with structural precision. Base surfaces, container panels, and data modules utilize an 8px radius (`0.5rem`). Larger layout cards, modal dialogs, and verification summary containers leverage 12px (`0.75rem`). 

Inner items—such as wallet badges, table chips, input fields, and action buttons—strictly mirror the 6px to 8px range. Circular geometry is restricted entirely to circular user identity indicators, progress spinners, and status ping dots. Pills and extreme radiuses are excluded to preserve institutional rigor.

## Components

### Buttons
- **Primary**: Solid background `#BE3477`, text `#FFFFFF`, 8px radius. Hover state: `#821524`. Focus: 2px offset ring in `#BE3477`.
- **Secondary / Outline**: Background `#FFFFFF`, border `1px solid #E5E7EB`, text `#111827`. Hover state: `#F9FAFB` with border `#D1D5DB`.
- **Destructive**: Background `#DC2626`, text `#FFFFFF`. Hover: `#B91C1C`.
- **Dimensions**: Fixed vertical heights (36px for compact/table-actions, 44px for primary verification CTAs).

### Chips & Status Badges
- **Verified Status**: Background `#ECFDF5`, text `#059669`, border `1px solid #A7F3D0`, font size `0.75rem`, weight SemiBold.
- **Limit Breach / Warning**: Background `#FEF2F2`, text `#DC2626`, border `1px solid #FECACA`.
- **Identity Link Chip**: Background `#F3F4F6`, text `#374151`, border `1px solid #E5E7EB`, with truncated monospace wallet address formatting (`0x1a...4b2`).

### Input Fields
- Background `#FFFFFF`, 8px radius, border `1px solid #D1D5DB`, text `#111827`.
- Focus state: Border transitions to `#BE3477` with a subtle, non-blurry ring (`rgba(158, 28, 46, 0.1)`).
- Error state: Border `#DC2626`, accompanied by `body-sm` helper copy in `#DC2626`.

### Cards & Ledger Tables
- **Cards**: Background `#FFFFFF`, border `1px solid #E5E7EB`, 8px or 12px radius, internal padding `1.5rem`.
- **Ledger Tables**: Fixed-header layout, borders between rows `1px solid #F3F4F6`, cell padding `0.75rem 1rem`. Numeric columns must right-align with active tabular digits.

### Specialized Limit Meters & Allocation Trackers
- Structural horizontal meter: Track height 8px, track background `#E5E7EB`, radius 4px.
- Fill color: Smooth progression in `#059669` while within permissible ceiling; transitions directly to `#DC2626` when approaching or exceeding the unified shared purchase limit.
- Headroom indicators must explicitly display remaining aggregated capacity in bold tabular figures directly above the track.