# AutoRevenueOS Brand Guidelines

## Brand intent
AutoRevenueOS helps businesses turn missed calls into booked appointments and revenue. The icon communicates: **phone/contact signal**, **automation/system**, and **conversion/growth**.

---

## Color palette

| Role        | Hex       | Usage                    |
|------------|-----------|--------------------------|
| Primary    | `#1E3A8A` | Logo, icon, key UI       |
| Secondary  | `#3B82F6` | Optional accent          |
| Dark       | `#111827` | Text, dark surfaces      |
| Light      | `#F4F7FB` | Backgrounds              |
| White      | `#FFFFFF` | Backgrounds, reversed logo |

---

## Typography
- **Primary:** Inter
- **Fallback:** system-ui, sans-serif

---

## Logo usage

### Primary logo
- **File:** `logo/logo-primary.svg` (and `.png`)
- **Use:** Blue icon + wordmark on white or light backgrounds.
- **Wordmark:** Must read exactly **AutoRevenueOS** (capital A, R, O).
- **Minimum width:** 160px (digital). 32mm (print).
- **Clear space:** Minimum clear space equal to the height of the letter “A” in the wordmark on all sides.

### Reversed logo (dark backgrounds)
- **File:** `logo/logo-primary-dark.svg` (and `.png`)
- **Use:** White icon + wordmark on blue (#1E3A8A) or dark (#111827) backgrounds only.
- Same clear space and minimum size as primary.

### Light-background variant
- **File:** `logo/logo-primary-light.svg` (and `.png`)
- **Use:** Same as primary; blue on white/light. Use when “primary” and “light” are named separately in file systems.

### Don’t
- Change colors, proportions, or spacing.
- Add effects (gradients, shadows, 3D).
- Place on busy imagery without sufficient contrast.
- Stretch or rotate the logo.

---

## Icon-only usage

### Files
- `icons/icon.svg` — blue (#1E3A8A)
- `icons/icon-dark.svg` — white (for dark backgrounds)
- `icons/icon-light.svg` — blue (for light backgrounds)

### Use
- App icon, social avatars, small UI marks, favicon (when not using the “A”).
- **Minimum size:** 24px (digital). Keep generous padding when placing in app icons or avatars.
- Icon should be centered with even padding in a square canvas.

### Don’t
- Redraw or alter the arc/arrow shapes.
- Use on competing colors; ensure contrast (blue on white, white on dark).

---

## Favicon (letter A)

### Files
- `favicon/favicon-a.svg`
- `favicon/favicon.ico`, `favicon-16.png`, `favicon-32.png`, etc.
- `favicon/apple-touch-icon.png`

### Rules
- **Mark:** Bold geometric capital **“A”** only (not the signal/arrow icon).
- **Color:** #1E3A8A on white.
- Use for browser tabs, bookmarks, and anywhere a single-letter mark is preferred over the full icon.
- Kept consistent with the brand but intentionally a standalone “A” mark.

---

## App icon set

### Files
- `app-icons/app-icon.svg` (master)
- `app-icons/app-icon-1024.png`, `app-icon-512.png`, `app-icon-256.png`, `app-icon-128.png`

### Rules
- **Content:** Icon-only (signal arcs + arrow), no wordmark.
- **Background:** White.
- **Icon color:** #1E3A8A.
- Centered with generous padding; must read at 128px and down (iOS, web app).
- Rounded square (e.g. ~19% corner radius of width).

---

## Social avatars

### Files
- `social/linkedin-profile.png`, `twitter-profile.png`, `facebook-profile.png`, `instagram-profile.png` (400×400)

### Rules
- 400×400px.
- White background, blue icon centered.
- Safe for circular cropping; keep icon well within the center so nothing critical is cut off.
- No wordmark in avatar.

---

## Social banners

### Files / sizes
- LinkedIn: `social/linkedin-banner.png` — 1584×396
- Twitter/X: `social/twitter-banner.png` — 1500×500

### Rules
- White or very light (#F4F7FB) background.
- Small primary logo placed in a clear area (e.g. left or center-left).
- Optional: subtle background pattern derived from signal arcs; keep minimal.
- Tagline option: **“Never Miss Revenue”** (editable in source).
- Premium B2B SaaS look; avoid clutter.

---

## File naming conventions

- **Logo:** `logo-primary`, `logo-primary-dark`, `logo-primary-light` (+ `.svg` / `.png`).
- **Icons:** `icon`, `icon-dark`, `icon-light` (+ `.svg`); `icon-512.png`, `icon-1024.png`.
- **App icons:** `app-icon.svg`, `app-icon-128.png`, `app-icon-256.png`, `app-icon-512.png`, `app-icon-1024.png`.
- **Favicon:** `favicon-a.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`, etc., `apple-touch-icon.png`.
- **Social:** `linkedin-profile.png`, `twitter-profile.png`, `linkedin-banner.png`, `twitter-banner.png`.

---

## Dark vs light background usage

| Background   | Logo asset           | Icon asset    |
|-------------|----------------------|---------------|
| White/light | logo-primary / light | icon / icon-light |
| Blue/dark  | logo-primary-dark    | icon-dark     |

---

## Technical (SVG)

- Use clean `viewBox` values; no unnecessary groups or clipping unless needed.
- No embedded bitmap images in logo/icon SVGs.
- Optimized paths; suitable for Webflow, websites, and app build pipelines.
- All PNGs generated from these SVG masters for consistency.
