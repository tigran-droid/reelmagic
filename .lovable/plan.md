# Photoshop admin + dynamic sections + dedicated feed

## 1. Database

Two new tables (plus a storage bucket for photoshop song files, reusing existing `reel-images` / new `photoshop-audio`).

```
photoshop_sections
  id uuid pk
  title text             -- "Business headshot", "Studio", etc. (editable)
  position int           -- ordering
  created_at timestamptz

photoshop_items
  id uuid pk
  section_id uuid fk -> photoshop_sections on delete cascade
  title text             -- photo title
  hashtags text[]
  song text              -- label
  image_url text         -- cover
  image_urls text[]      -- swipeable photos in the feed
  audio_url text
  audio_start_sec numeric default 0
  audio_end_sec numeric
  position int
  created_at timestamptz
```

Public RLS (same pattern as `reels`: anyone can select/insert/update/delete — admin is unauthenticated like the existing admin page). New storage bucket `photoshop-audio` (public).

## 2. Admin panel redesign (`/admin`)

Turn the current single form into a tabbed/sectioned dashboard, responsive (mobile + desktop wide layout).

Tabs at the top:
- **Reels** (existing UI moved here, unchanged)
- **Photoshop** (new)

Photoshop tab:
- List of section blocks (Business headshot, Popular photoshoots, Studio, Travel, Everyday, …) — each rendered as a card showing the section title (inline-editable) + delete button + list of photos.
- Each photo row inside a section: thumbnail, title, hashtags, song name; edit/delete buttons.
- "Add photo" form per section: pick 1+ images (first = cover, rest swipeable in feed), title, hashtags, song name, optional audio file with trimmer.
- "+ Add new section" button at the bottom of the Photoshop tab.
- On desktop (md+) sections render in a 2-column grid; on mobile a single column. Forms use wider inputs on desktop.

## 3. Photoshop page (`/photoshop`)

Replace hardcoded `sections` array with a Supabase query joining `photoshop_sections` + `photoshop_items` ordered by `position`. Layout stays the same (horizontal scrolling rows per section). Each photo tile is clickable → navigates to the new Photoshop feed at the corresponding item.

Featured row: keep current visual but pull first item from first 2 sections (or first 2 items overall). Acceptable to keep simple.

## 4. Dedicated Photoshop feed (`/photoshop/feed`)

New route, same vertical-scroll reel layout as `/feed` but the data source is ONLY `photoshop_items` (not `reels`). Tabs at top removed (no global/regional) — this feed shows only photoshop content. Supports query param `?item=<id>` to scroll to a specific item when opened from the Photoshop page tile.

Behavior carried over from `/feed`:
- vertical snap-scroll
- swipeable inner photo carousel
- audio playback with trim window
- "Create yours" → opens device file picker → `/create` flow (same as today)
- like/comment/share UI stays decorative

## 5. Separation of feeds

Current `/feed` (reels) and `/trends` (Local) remain unchanged. The new `/photoshop/feed` is reached ONLY from the Photoshop tab (no entry on Local or Videos). Main bottom tab bar is unchanged (Videos / Photoshop / Local).

## Technical notes

- All admin writes use the existing browser supabase client (same pattern as current admin), uploading to storage then inserting.
- Position updates on add: `max(position)+1` per section.
- Order sections by `position` ASC then `created_at`.
- Use `useQuery` + `invalidateQueries` for cache sync between admin and public pages.
- Migration runs first (separate tool call), then the code changes land in one batch after approval.

## File changes

- new migration: tables + RLS + bucket
- `src/routes/admin.tsx` — refactor into tabbed dashboard
- `src/routes/photoshop.tsx` — fetch from DB, link tiles to feed
- new `src/routes/photoshop.feed.tsx` — vertical reel feed for photoshop items
- (no changes to `MobileFrame`, `/feed`, `/trends`, `/create`)
