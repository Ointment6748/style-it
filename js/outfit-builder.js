// ============================================================
// Outfit Builder Module — layer canvas with drag, z-order, scale
// ============================================================

const OutfitBuilder = (() => {
  let layers = []; // [{id (unique layer id), item_id, image_url, name, x, y, z, scale}]
  let selectedLayerId = null;
  let dragState = null;
  const canvas = document.getElementById('builder-canvas');
  const layersList = document.getElementById('layers-list');
  const scaleSlider = document.getElementById('scale-slider');

  // ── Render canvas layers ─────────────────────────────────────
  function renderCanvas() {
    canvas.innerHTML = '';
    const sorted = [...layers].sort((a, b) => a.z - b.z);
    sorted.forEach(layer => {
      const img = document.createElement('img');
      img.src = layer.image_url;
      img.alt = layer.name;
      img.className = 'canvas-item' + (layer.id === selectedLayerId ? ' selected' : '');
      img.dataset.layerId = layer.id;
      img.style.left = layer.x + 'px';
      img.style.top = layer.y + 'px';
      img.style.zIndex = layer.z;
      img.style.transform = `scale(${layer.scale})`;
      img.draggable = false;

      img.addEventListener('mousedown', (e) => startDrag(e, layer.id));
      img.addEventListener('click', () => selectLayer(layer.id));
      canvas.appendChild(img);
    });
    renderLayersList();
    updateScaleSlider();
  }

  // ── Add item from wardrobe ───────────────────────────────────
  function addItem(item) {
    const maxZ = layers.length > 0 ? Math.max(...layers.map(l => l.z)) : 0;
    const canvasRect = canvas.getBoundingClientRect();
    const layer = {
      id: crypto.randomUUID(),
      item_id: item.id,
      image_url: item.image_url,
      name: item.name,
      x: Math.max(0, (canvasRect.width / 2) - 80),
      y: Math.max(0, (canvasRect.height / 2) - 120),
      z: maxZ + 1,
      scale: 1.0,
    };
    layers.push(layer);
    selectLayer(layer.id);
    renderCanvas();
  }

  // ── Select layer ─────────────────────────────────────────────
  function selectLayer(id) {
    selectedLayerId = id;
    renderCanvas();
  }

  // ── Drag logic ───────────────────────────────────────────────
  function startDrag(e, layerId) {
    e.preventDefault();
    selectLayer(layerId);
    const layer = layers.find(l => l.id === layerId);
    const canvasRect = canvas.getBoundingClientRect();
    dragState = {
      layerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startLayerX: layer.x,
      startLayerY: layer.y,
    };

    function onMove(e) {
      if (!dragState) return;
      const dx = e.clientX - dragState.startMouseX;
      const dy = e.clientY - dragState.startMouseY;
      const l = layers.find(l => l.id === dragState.layerId);
      if (l) {
        l.x = dragState.startLayerX + dx;
        l.y = dragState.startLayerY + dy;
        const imgEl = canvas.querySelector(`[data-layer-id="${l.id}"]`);
        if (imgEl) {
          imgEl.style.left = l.x + 'px';
          imgEl.style.top = l.y + 'px';
        }
      }
    }

    function onUp() {
      dragState = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Layer sidebar ────────────────────────────────────────────
  function renderLayersList() {
    layersList.innerHTML = '';
    const sorted = [...layers].sort((a, b) => b.z - a.z); // top first
    sorted.forEach(layer => {
      const li = document.createElement('li');
      li.className = 'layer-item' + (layer.id === selectedLayerId ? ' active' : '');
      li.innerHTML = `
        <img src="${layer.image_url}" alt="${layer.name}" class="layer-thumb" />
        <span class="layer-name">${layer.name}</span>
        <div class="layer-controls">
          <button class="btn-icon" title="Move Up" onclick="OutfitBuilder.moveUp('${layer.id}')">↑</button>
          <button class="btn-icon" title="Move Down" onclick="OutfitBuilder.moveDown('${layer.id}')">↓</button>
          <button class="btn-icon danger" title="Remove" onclick="OutfitBuilder.removeLayer('${layer.id}')">🗑</button>
        </div>
      `;
      li.addEventListener('click', (e) => {
        if (!e.target.closest('button')) selectLayer(layer.id);
      });
      layersList.appendChild(li);
    });

    const emptyMsg = document.getElementById('builder-empty');
    if (emptyMsg) emptyMsg.style.display = layers.length === 0 ? 'flex' : 'none';
  }

  function moveUp(id) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    const above = layers.filter(l => l.z > layer.z);
    if (above.length === 0) return;
    const next = above.reduce((min, l) => l.z < min.z ? l : min);
    [layer.z, next.z] = [next.z, layer.z];
    renderCanvas();
  }

  function moveDown(id) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    const below = layers.filter(l => l.z < layer.z);
    if (below.length === 0) return;
    const prev = below.reduce((max, l) => l.z > max.z ? l : max);
    [layer.z, prev.z] = [prev.z, layer.z];
    renderCanvas();
  }

  function removeLayer(id) {
    layers = layers.filter(l => l.id !== id);
    if (selectedLayerId === id) selectedLayerId = null;
    renderCanvas();
  }

  // ── Scale slider ─────────────────────────────────────────────
  function updateScaleSlider() {
    if (!selectedLayerId) return;
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) scaleSlider.value = layer.scale;
  }

  function onScaleChange(val) {
    if (!selectedLayerId) return;
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) {
      layer.scale = parseFloat(val);
      const imgEl = canvas.querySelector(`[data-layer-id="${layer.id}"]`);
      if (imgEl) imgEl.style.transform = `scale(${layer.scale})`;
    }
  }

  // ── Save Outfit ───────────────────────────────────────────────
  async function saveOutfit(name) {
    if (layers.length === 0) throw new Error('Add items to the canvas first.');
    const payload = layers.map(l => ({
      item_id: l.item_id,
      image_url: l.image_url,
      name: l.name,
      x: l.x,
      y: l.y,
      z: l.z,
      scale: l.scale,
    }));
    const { data, error } = await db
      .from('outfits')
      .insert([{ name, layers: payload }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ── Load Outfit ───────────────────────────────────────────────
  function loadOutfit(outfit) {
    layers = outfit.layers.map(l => ({ ...l, id: crypto.randomUUID() }));
    selectedLayerId = null;
    renderCanvas();
  }

  function clearCanvas() {
    layers = [];
    selectedLayerId = null;
    renderCanvas();
  }

  return { addItem, moveUp, moveDown, removeLayer, onScaleChange, saveOutfit, loadOutfit, clearCanvas };
})();
window.OutfitBuilder = OutfitBuilder;
