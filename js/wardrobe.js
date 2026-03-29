// ============================================================
// Wardrobe Module — upload, fetch, delete wardrobe items
// bg removal is handled upstream (app.js); this module just
// uploads a final processed blob + saves metadata to Supabase.
// ============================================================

const WardrobeModule = (() => {
  let items = [];

  // ── Upload a ready blob (post bg-removal or manual cut) ──────
  async function uploadProcessedBlob(blob, name, category) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { data: storageData, error: storageErr } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filename, blob, { contentType: 'image/png', upsert: false });

    if (storageErr) throw storageErr;

    const { data: urlData } = db.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storageData.path);

    const { data, error } = await db
      .from('wardrobe_items')
      .insert([{ name, category, image_url: urlData.publicUrl }])
      .select()
      .single();

    if (error) throw error;
    items.unshift(data);
    return data;
  }

  // ── Fetch ────────────────────────────────────────────────────
  async function fetchItems(category = null) {
    let query = db
      .from('wardrobe_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (category && category !== 'all') query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;
    items = data;
    return data;
  }

  // ── Delete ───────────────────────────────────────────────────
  async function deleteItem(id) {
    const item = items.find(i => i.id === id);
    if (item) {
      const path = item.image_url.split(`/${STORAGE_BUCKET}/`)[1];
      if (path) await db.storage.from(STORAGE_BUCKET).remove([path]);
    }
    const { error } = await db.from('wardrobe_items').delete().eq('id', id);
    if (error) throw error;
    items = items.filter(i => i.id !== id);
  }

  return { uploadProcessedBlob, fetchItems, deleteItem };
})();
window.WardrobeModule = WardrobeModule;
