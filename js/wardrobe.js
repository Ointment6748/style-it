// ============================================================
// Wardrobe Module — upload, fetch, delete wardrobe items
// bg removal is handled upstream (app.js); this module just
// uploads a final processed blob + saves metadata to Supabase.
// ============================================================

const WardrobeModule = (() => {
  let items = [];

  // ── Upload a ready blob (post bg-removal or manual cut) ──────
  async function uploadProcessedBlob(blob, name, category, color, style) {
    // Convert to WebP for ~70% smaller file size before uploading
    const webpBlob = await toWebP(blob);
    const ext = webpBlob.type === 'image/webp' ? 'webp' : 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data: storageData, error: storageErr } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(filename, webpBlob, { contentType: webpBlob.type, upsert: false });

    if (storageErr) throw storageErr;

    const { data: urlData } = db.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storageData.path);

    const { data, error } = await db
      .from('wardrobe_items')
      .insert([{ name, category, color, style, image_url: urlData.publicUrl }])
      .select()
      .single();

    if (error) throw error;
    items.unshift(data);
    return data;
  }

  // ── Fetch ────────────────────────────────────────────────────
  async function fetchItems(category = null, colorSearch = null) {
    let query = db
      .from('wardrobe_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (category && category !== 'all') query = query.eq('category', category);
    if (colorSearch) query = query.ilike('color', `%${colorSearch}%`);
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

  async function toWebP(blob, quality = 0.88) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (webpBlob) => resolve(webpBlob || blob), // fallback to original if unsupported
          'image/webp',
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
      img.src = url;
    });
  }

  return { uploadProcessedBlob, fetchItems, deleteItem };
})();
window.WardrobeModule = WardrobeModule;
