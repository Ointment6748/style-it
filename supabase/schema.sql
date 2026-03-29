-- ============================================================
-- Style-It: Wardrobe App — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Wardrobe Items
create table if not exists wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('top', 'bottom', 'outerwear', 'shoes', 'accessory', 'other')),
  image_url text not null,
  created_at timestamptz default now()
);

-- Saved Outfits
-- layers: [{item_id, image_url, x, y, z, scale, name}]
create table if not exists outfits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  layers jsonb not null default '[]',
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (public — single user, no auth)
-- ============================================================
alter table wardrobe_items enable row level security;
alter table outfits enable row level security;

drop policy if exists "public_all_wardrobe" on wardrobe_items;
drop policy if exists "public_all_outfits" on outfits;

create policy "public_all_wardrobe" on wardrobe_items
  for all using (true) with check (true);

create policy "public_all_outfits" on outfits
  for all using (true) with check (true);

-- ============================================================
-- Storage Bucket (run separately or via dashboard)
-- ============================================================
-- 1. Go to Supabase Dashboard → Storage → New Bucket
-- 2. Name: wardrobe-images
-- 3. Check "Public bucket"
-- 4. Save

-- Or via SQL (Supabase storage schema):
insert into storage.buckets (id, name, public)
values ('wardrobe-images', 'wardrobe-images', true)
on conflict (id) do nothing;

create policy "public_upload" on storage.objects
  for insert with check (bucket_id = 'wardrobe-images');

create policy "public_read" on storage.objects
  for select using (bucket_id = 'wardrobe-images');

create policy "public_delete" on storage.objects
  for delete using (bucket_id = 'wardrobe-images');
