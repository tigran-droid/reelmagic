## Photoshop page tweaks

1. **Header**: bring back the top header with "Photoshop" title on the left and the round filter button on the right (like before the redesign).
2. **Card size**: enlarge the section cards so that on a 390px viewport ~2.5 cards are visible (≈ width 160px, aspect 4/5). Featured top row stays as-is.
3. **Border radius**: reduce card corners from `rounded-2xl` to `rounded-lg` (closer to the reference screenshot).
4. **Everything else** (white background, no status bar, overlay caption "PHOTOSHOOT / name", "All ›" pill) stays the same.

### Files
- `src/routes/photoshop.tsx` — header block, card width, rounded class.