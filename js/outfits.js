// ============================================================
// Outfits Module — list and manage saved outfits
// ============================================================

const OutfitsModule = (() => {
  async function fetchOutfits() {
    const { data, error } = await db
      .from('outfits')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function deleteOutfit(id) {
    const { error } = await db.from('outfits').delete().eq('id', id);
    if (error) throw error;
  }

  function renderOutfitCards(outfits) {
    const grid = document.getElementById('outfits-grid');
    const emptyMsg = document.getElementById('outfits-empty');
    grid.innerHTML = '';

    if (outfits.length === 0) {
      emptyMsg.style.display = 'flex';
      return;
    }
    emptyMsg.style.display = 'none';

    outfits.forEach(outfit => {
      const card = document.createElement('div');
      card.className = 'outfit-card glass';
      card.innerHTML = `
        <div class="outfit-preview grid-preview">
          ${outfit.layers.slice(0, 4).map(l => `<div class="preview-slot"><img src="${l.image_url}" alt="${l.name}" /></div>`).join('')}
        </div>
        <div class="outfit-info">
          <span class="outfit-name">${outfit.name}</span>
          <span class="outfit-meta">${outfit.layers.length} item${outfit.layers.length !== 1 ? 's' : ''} · ${formatDate(outfit.created_at)}</span>
        </div>
        <div class="outfit-actions">
          <button class="btn btn-sm btn-primary" onclick="AppRouter.openOutfitInBuilder('${outfit.id}')">Edit</button>
          <button class="btn btn-sm btn-ghost danger" onclick="OutfitsModule.handleDelete('${outfit.id}', this)">Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  async function handleDelete(id, btn) {
    if (!confirm('Delete this outfit?')) return;
    btn.disabled = true;
    try {
      await deleteOutfit(id);
      const outfits = await fetchOutfits();
      renderOutfitCards(outfits);
    } catch (err) {
      alert('Error deleting outfit: ' + err.message);
      btn.disabled = false;
    }
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return { fetchOutfits, deleteOutfit, renderOutfitCards, handleDelete };
})();
window.OutfitsModule = OutfitsModule;
