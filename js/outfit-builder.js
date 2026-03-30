// ============================================================
// Outfit Builder Module — layer canvas with drag, z-order, scale
// ============================================================

const OutfitBuilder = (() => {
  let layers = []; // [{id (unique layer id), item_id, image_url, name, x, y, z, scale}]
  let selectedLayerId = null;
  let dragState = null;
  let editingOutfitId = null;
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
      img.addEventListener('touchstart', (e) => startDrag(e, layer.id), {passive: false});
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

  // ── Drag & Pinch logic ───────────────────────────────────────
  function startDrag(e, layerId) {
    selectLayer(layerId);
    const layer = layers.find(l => l.id === layerId);
    
    // Determine coordinate based on Touch vs Mouse
    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;

    let initialPinchDistance = null;
    let initialScale = layer.scale;

    if (isTouch && e.touches.length === 2) {
      initialPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }

    dragState = {
      layerId,
      startMouseX: startX,
      startMouseY: startY,
      startLayerX: layer.x,
      startLayerY: layer.y,
    };

    function onMove(ev) {
      if (!dragState) return;
      // Prevent scrolling while dragging/pinching
      if (ev.cancelable) { ev.preventDefault(); }
      
      const l = layers.find(layer => layer.id === dragState.layerId);
      if (!l) return;

      if (ev.type === 'touchmove' && ev.touches.length === 2) {
        const currentDistance = Math.hypot(
          ev.touches[0].clientX - ev.touches[1].clientX,
          ev.touches[0].clientY - ev.touches[1].clientY
        );
        if (initialPinchDistance === null) {
          initialPinchDistance = currentDistance;
          initialScale = l.scale;
        } else {
          const scaleDelta = currentDistance / initialPinchDistance;
          l.scale = Math.min(Math.max(0.2, initialScale * scaleDelta), 3.0);
          updateScaleSlider();
          const imgEl = canvas.querySelector(`[data-layer-id="${l.id}"]`);
          if (imgEl) imgEl.style.transform = `scale(${l.scale})`;
        }
        return; // skip positional drag while scaling
      } else {
        initialPinchDistance = null;
      }

      const cx = ev.type === 'touchmove' ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.type === 'touchmove' ? ev.touches[0].clientY : ev.clientY;

      const dx = cx - dragState.startMouseX;
      const dy = cy - dragState.startMouseY;
      
      l.x = dragState.startLayerX + dx;
      l.y = dragState.startLayerY + dy;
      const imgEl = canvas.querySelector(`[data-layer-id="${l.id}"]`);
      if (imgEl) {
        imgEl.style.left = l.x + 'px';
        imgEl.style.top = l.y + 'px';
      }
    }

    function onUp() {
      dragState = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
    }

    if (isTouch) {
      document.addEventListener('touchmove', onMove, {passive: false});
      document.addEventListener('touchend', onUp);
      document.addEventListener('touchcancel', onUp);
    } else {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
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
    
    let query = db.from('outfits');
    if (editingOutfitId) {
      query = query.update({ name, layers: payload }).eq('id', editingOutfitId);
    } else {
      query = query.insert([{ name, layers: payload }]);
    }
    
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  // ── Load Outfit ───────────────────────────────────────────────
  function loadOutfit(outfit) {
    editingOutfitId = outfit.id;
    layers = outfit.layers.map(l => ({ ...l, id: crypto.randomUUID() }));
    selectedLayerId = null;
    renderCanvas();
  }

  function clearCanvas() {
    editingOutfitId = null;
    layers = [];
    selectedLayerId = null;
    renderCanvas();
  }

  // ── D-Pad Movement ────────────────────────────────────────────
  function nudgeSelectedLayer(dx, dy) {
    if (!selectedLayerId) return;
    const l = layers.find(layer => layer.id === selectedLayerId);
    if (!l) return;
    l.x += dx;
    l.y += dy;
    const imgEl = canvas.querySelector(`[data-layer-id="${l.id}"]`);
    if (imgEl) {
      imgEl.style.left = l.x + 'px';
      imgEl.style.top = l.y + 'px';
    }
  }

  // Bind D-pad controls
  document.getElementById('btn-move-left')?.addEventListener('click', () => nudgeSelectedLayer(-10, 0));
  document.getElementById('btn-move-right')?.addEventListener('click', () => nudgeSelectedLayer(10, 0));
  document.getElementById('btn-move-up')?.addEventListener('click', () => nudgeSelectedLayer(0, -10));
  document.getElementById('btn-move-down')?.addEventListener('click', () => nudgeSelectedLayer(0, 10));

  return { addItem, moveUp, moveDown, removeLayer, onScaleChange, saveOutfit, loadOutfit, clearCanvas };
})();
window.OutfitBuilder = OutfitBuilder;
