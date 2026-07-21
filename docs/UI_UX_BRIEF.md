# MRH Academy UI/UX repair brief

## Objective
Make the existing Next.js application behave consistently when switching Arabic/English and light/dark themes across every route, while preserving the established Mr.H Academy dark teal and gold visual identity. Fix the shared layout/provider architecture first, then improve the most visible landing-page and navigation states without redesigning the product from scratch.

## Audience
Arabic- and English-speaking students, tutors, and academy administrators using desktop and mobile browsers.

## Current visual direction to preserve
- Dark teal primary surfaces, warm cream/gold accent, rounded cards, clean premium education aesthetic.
- Existing Cairo/Plus Jakarta typography and current logo/nav structure.
- RTL Arabic and LTR English must both be first-class layouts.

## Required behavior
- Language toggle must update all visible page copy, navigation labels, buttons, metadata direction, and layout direction—not only the navbar.
- Theme toggle must update every page and persist across refreshes. Ensure text, cards, borders, inputs, and sections remain readable in both themes.
- Avoid hard-coded one-off language/theme state in individual pages; use shared providers and route-safe hydration.
- Keep forms and authenticated dashboards functional.

## Focus areas
- `apps/web/src/contexts/language-context.tsx`
- `apps/web/src/contexts/theme-context.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/layout/Navbar.tsx`
- `apps/web/src/app/page.tsx`, `apps/web/src/app/en/page.tsx`
- shared CSS under `apps/web/src/styles` and `apps/web/src/app/globals.css`

## Verification
Exercise `/`, `/en`, `/login`, `/register`, `/courses`, `/faq`, `/student`, `/tutor`, and `/admin` where auth permits. Check language and theme toggles, responsive layout, no console errors caused by the changes, and run web lint/typecheck/build.
