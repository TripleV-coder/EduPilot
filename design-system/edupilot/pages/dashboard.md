# Dashboard Page Overrides

> **PROJECT:** EduPilot
> **Generated:** 2026-04-11 11:01:50
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Hero with video background, 2. Key features overlay, 3. Benefits section, 4. CTA

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Dark overlay 60% on video. Brand accent for CTA. White text on dark.

### Component Overrides

- Avoid: Ignore accessibility motion settings
- Avoid: Keyboard traps or illogical tab order
- Avoid: No skip link on nav-heavy pages

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Clear focus rings (3-4px), ARIA labels, skip links, responsive design, reduced motion, 44x44px touch targets
- Animation: Check prefers-reduced-motion media query
- Accessibility: Tab order matches visual order
- Accessibility: Provide skip to main content link
- CTA Placement: Overlay on video (center/bottom) + Bottom section
