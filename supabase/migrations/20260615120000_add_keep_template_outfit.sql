-- Per-template outfit mode, controlled only from the admin panel.
-- false = change face AND body/clothes (use the user's own outfit) — default
-- true  = change face only, keep the template's outfit
alter table public.photoshop_items
  add column if not exists keep_template_outfit boolean not null default false;
