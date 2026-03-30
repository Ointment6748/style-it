// ============================================================
// App Router — view switching, upload flow, carousel builder
// ============================================================

const AppRouter = (() => {
  let currentView = 'wardrobe';
  let allWardrobeItems = [];
  let currentCategory = 'all';
  let currentColor = null;

  // ── Carousel state ───────────────────────────────────────────
  const CAROUSEL_CATS = ['outerwear', 'top', 'bottom', 'shoes', 'accessory', 'other'];
  const carouselSel = {}; // category → { index: -1 means none, items: [], scale: 1 }
  CAROUSEL_CATS.forEach(c => (carouselSel[c] = { index: -1, items: [], scale: 1 }));

  const views = {
    wardrobe: document.getElementById('view-wardrobe'),
    builder : document.getElementById('view-builder'),
    outfits : document.getElementById('view-outfits'),
  };
  const navLinks = document.querySelectorAll('.nav-link');

  // ── Navigation ───────────────────────────────────────────────
  function navigate(view) {
    currentView = view;
    Object.keys(views).forEach(k => views[k].classList.toggle('hidden', k !== view));
    navLinks.forEach(a => a.classList.toggle('active', a.dataset.view === view));
    window.location.hash = view;
    onViewEnter(view);
  }

  async function onViewEnter(view) {
    if (view === 'wardrobe') loadWardrobe();
    if (view === 'outfits')  loadOutfits();
    if (view === 'builder')  { loadBuilderPanel(); populateCarousel(); }
  }

  // ── Builder Tabs (Canvas / Carousel) ─────────────────────────
  function initBuilderTabs() {
    document.querySelectorAll('.builder-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.builder-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.dataset.tab;
        document.getElementById('builder-canvas-mode').classList.toggle('hidden', mode !== 'canvas');
        document.getElementById('builder-carousel-mode').classList.toggle('hidden', mode !== 'carousel');
      });
    });
  }

  // ── Wardrobe View ────────────────────────────────────────────
  async function loadWardrobe(category = currentCategory) {
    if (category !== currentCategory) currentColor = null; // reset color when changing cat
    currentCategory = category;
    showSpinner('wardrobe-spinner');
    try {
      allWardrobeItems = await WardrobeModule.fetchItems(category === 'all' ? null : category);
      
      renderColorPanel(allWardrobeItems);
      
      const filtered = currentColor ? allWardrobeItems.filter(i => i.color && i.color.toLowerCase() === currentColor.toLowerCase()) : allWardrobeItems;
      renderWardrobeGrid(filtered);
    } catch (e) {
      showError('wardrobe-error', e.message);
    } finally {
      hideSpinner('wardrobe-spinner');
    }
  }

  function renderColorPanel(items) {
    const panel = document.getElementById('wardrobe-color-panel');
    if (!panel) return;
    const colors = new Set();
    items.forEach(i => {
       if (i.color) colors.add(i.color.trim().toLowerCase());
    });
    
    panel.innerHTML = '';
    if (colors.size === 0) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'flex';

    colors.forEach(col => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn'; // use the same style as category buttons
      if (currentColor === col) btn.classList.add('active');
      btn.textContent = col.charAt(0).toUpperCase() + col.slice(1);
      btn.onclick = () => {
        currentColor = currentColor === col ? null : col;
        const filtered = currentColor ? allWardrobeItems.filter(i => i.color && i.color.toLowerCase() === currentColor.toLowerCase()) : allWardrobeItems;
        renderWardrobeGrid(filtered);
        renderColorPanel(allWardrobeItems); // update active state
      };
      panel.appendChild(btn);
    });
  }

  function renderWardrobeGrid(items) {
    const grid     = document.getElementById('wardrobe-grid');
    const emptyMsg = document.getElementById('wardrobe-empty');
    grid.innerHTML = '';
    if (items.length === 0) { emptyMsg.style.display = 'flex'; return; }
    emptyMsg.style.display = 'none';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'wardrobe-card glass';
      card.innerHTML = `
        <div class="item-img-wrap">
          <img src="${item.image_url}" alt="${item.name}" loading="lazy" />
          <div class="item-overlay">
            <button class="btn btn-sm btn-primary" onclick="AppRouter.addToBuilder('${item.id}')">+ Layer</button>
            <button class="btn btn-sm btn-ghost danger" onclick="AppRouter.deleteItem('${item.id}',this)">Delete</button>
          </div>
        </div>
        <div class="item-info">
          <span class="item-name">${item.name}</span>
          <span class="item-cat badge">${item.category}</span>
          ${item.color ? `<span class="item-cat badge" style="background:var(--bg-2);color:var(--text-1)">${item.color}</span>` : ''}
          ${item.style ? `<span class="item-cat badge" style="background:var(--bg-2);color:var(--text-1)">${item.style}</span>` : ''}
        </div>`;
      grid.appendChild(card);
    });
  }

  async function deleteItem(id, btn) {
    if (!confirm('Remove this item?')) return;
    btn.disabled = true;
    try {
      await WardrobeModule.deleteItem(id);
      loadWardrobe();
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled = false;
    }
  }

  // ── Upload flow ───────────────────────────────────────────────
  function initUploadFlow() {
    const modal        = document.getElementById('upload-modal');
    const openBtn      = document.getElementById('btn-open-upload');
    const closeBtn     = document.getElementById('btn-close-upload');
    const form         = document.getElementById('upload-form');
    const fileInput    = document.getElementById('file-input');
    const cameraInput  = document.getElementById('camera-input');
    const previewWrap  = document.getElementById('file-preview-wrap');
    const preview      = document.getElementById('file-preview');
    const previewBtn   = document.getElementById('file-preview-button');
    const changeBtn    = document.getElementById('btn-change-photo');
    const progressEl   = document.getElementById('upload-progress');
    const progressBar  = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const cameraBtn    = document.getElementById('btn-camera');
    const galleryBtn   = document.getElementById('btn-gallery');
    let selectedFile   = null;

    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn.addEventListener('click', resetUploadModal);

    fileInput.addEventListener('change', async () => { if (fileInput.files[0]) await prepareSelectedFile(fileInput.files[0]); });
    cameraInput.addEventListener('change', async () => { if (cameraInput.files[0]) await prepareSelectedFile(cameraInput.files[0]); });

    if (cameraBtn) cameraBtn.addEventListener('click', () => cameraInput.click());
    if (galleryBtn) galleryBtn.addEventListener('click', () => fileInput.click());

    previewBtn.addEventListener('click', () => fileInput.click());
    changeBtn.addEventListener('click', () => fileInput.click());

    // Manual cut shortcut button
    document.getElementById('btn-manual-cut-shortcut').addEventListener('click', async () => {
      const file = selectedFile;
      if (!file) { alert('Select a photo first.'); return; }
      const blob = await BgCrop.openForFile(file);
      if (blob) {
        const url = URL.createObjectURL(blob);
        preview.src = url;
        previewWrap.classList.remove('hidden');
        previewWrap.dataset.processedBlob = 'manual';
        // store blob reference via hidden data attribute trick
        previewWrap._processedBlob = blob;
      }
    });

    async function prepareSelectedFile(file) {
      try {
        selectedFile = await normalizeImageFile(file);
        showPreview(selectedFile);
      } catch (err) {
        selectedFile = null;
        fileInput.value = '';
        cameraInput.value = '';
        alert(err.message);
      }
    }

    function showPreview(file) {
      preview.src = URL.createObjectURL(file);
      previewWrap.classList.remove('hidden');
      delete previewWrap._processedBlob;
    }

    async function normalizeImageFile(file) {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please choose an image file.');
      }
      if (/image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
        throw new Error('This photo format is not supported here yet. Please use the camera option or convert it to JPG/PNG first.');
      }

      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const normalizedBlob = await new Promise((resolve, reject) => {
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to prepare this image for upload.')), 'image/png');
        });

        const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
        return new File([normalizedBlob], `${baseName}.png`, { type: 'image/png' });
      } catch (error) {
        throw new Error('Upload failed: this photo could not be decoded. Try taking a new photo, choosing a different image, or switching background removal to None.');
      }
    }

    function resetUploadModal() {
      modal.classList.add('hidden');
      form.reset();
      preview.src = '';
      previewWrap.classList.add('hidden');
      selectedFile = null;
      fileInput.value = '';
      cameraInput.value = '';
      delete previewWrap._processedBlob;
      progressEl.classList.add('hidden');
      progressBar.style.width = '0%';
      if (cameraBtn) cameraBtn.disabled = false;
      if (galleryBtn) galleryBtn.disabled = false;
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const file     = selectedFile;
      const name     = document.getElementById('item-name').value.trim();
      const category = document.getElementById('item-category').value;
      const color    = document.getElementById('item-color').value.trim() || null;
      const style    = document.getElementById('item-style').value || null;
      const bgMode   = document.querySelector('input[name="bg-mode"]:checked').value;
      if (!file || !name) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      if (cameraBtn) cameraBtn.disabled = true;
      if (galleryBtn) galleryBtn.disabled = true;
      progressEl.classList.remove('hidden');

      let finalBlob = null;

      try {
        if (bgMode === 'auto') {
          progressText.textContent = 'Removing background…';
          progressBar.style.width  = '15%';

          const removeFn = window.__bgRemove;
          if (!removeFn) throw new Error('BG removal not ready — try Manual Cut or None.');

          finalBlob = await removeFn(file, {
            model: "isnet_quint8",
            devicePixelRatio: 1, // Speeds up process on mobile displays
            progress: (key, current, total) => {
              if (total > 0) {
                const pct = 15 + Math.floor((current / total) * 70);
                progressBar.style.width = Math.min(pct, 85) + '%';
              }
            },
          });

        } else if (bgMode === 'manual') {
          progressEl.classList.add('hidden');
          submitBtn.disabled = false;
          const blob = await BgCrop.openForFile(file);
          if (!blob) return; // user cancelled
          finalBlob = blob;
          submitBtn.disabled = true;
          progressEl.classList.remove('hidden');

        } else {
          // none — convert original file to blob
          finalBlob = file;
        }

        // If a manually-cut preview blob already set via shortcut, use that
        if (previewWrap._processedBlob) finalBlob = previewWrap._processedBlob;

        progressText.textContent = 'Uploading…';
        progressBar.style.width  = '88%';

        await WardrobeModule.uploadProcessedBlob(finalBlob, name, category, color, style);

        progressBar.style.width  = '100%';
        progressText.textContent = 'Done!';
        setTimeout(() => { resetUploadModal(); loadWardrobe(); }, 600);

      } catch (err) {
        const msg = /could not be decoded|source image could not be decoded/i.test(err.message)
          ? 'This photo format could not be processed. Try Take new photo, Choose from gallery again, or set Background Removal to None.'
          : err.message;
        alert('Upload failed: ' + msg);
        progressEl.classList.add('hidden');
      } finally {
        submitBtn.disabled = false;
        if (cameraBtn) cameraBtn.disabled = false;
        if (galleryBtn) galleryBtn.disabled = false;
        submitBtn.textContent = 'Add to Wardrobe';
      }
    });
  }

  // ── Category filter ───────────────────────────────────────────
  function initCategoryFilter() {
    document.querySelectorAll('.category-filter .cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-filter .cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadWardrobe(btn.dataset.cat);
      });
    });
  }

  // ── Canvas Builder — left panel ───────────────────────────────
  async function loadBuilderPanel() {
    const panel = document.getElementById('builder-wardrobe-panel');
    panel.innerHTML = '<p class="panel-loading">Loading…</p>';
    try {
      const items = await WardrobeModule.fetchItems();
      allWardrobeItems = items;
      panel.innerHTML = '';
      if (items.length === 0) { panel.innerHTML = '<p class="panel-empty">Upload items first.</p>'; return; }
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'panel-item';
        card.title = `${item.name} (${item.category})`;
        card.innerHTML = `<img src="${item.image_url}" alt="${item.name}" /><span>${item.name}</span>`;
        card.addEventListener('click', () => addToBuilder(item.id, true));
        panel.appendChild(card);
      });
    } catch (e) {
      panel.innerHTML = `<p class="panel-empty error">Error: ${e.message}</p>`;
    }
  }

  function addToBuilder(itemId, switchToCanvas = false) {
    const item = allWardrobeItems.find(i => i.id === itemId);
    if (!item) return;
    OutfitBuilder.addItem(item);
    if (currentView !== 'builder') navigate('builder');
    if (switchToCanvas || true) {
      // ensure canvas tab is active
      document.querySelectorAll('.builder-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'canvas'));
      document.getElementById('builder-canvas-mode').classList.remove('hidden');
      document.getElementById('builder-carousel-mode').classList.add('hidden');
    }
  }

  // ── Save outfit modal ─────────────────────────────────────────
  function initSaveOutfitModal() {
    const modal      = document.getElementById('save-outfit-modal');
    const saveBtn    = document.getElementById('btn-save-outfit');
    const closeBtn   = document.getElementById('btn-close-save-modal');
    const confirmBtn = document.getElementById('btn-confirm-save');
    const nameInput  = document.getElementById('outfit-name-input');

    saveBtn   .addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn  .addEventListener('click', () => modal.classList.add('hidden'));
    confirmBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      confirmBtn.disabled    = true;
      confirmBtn.textContent = 'Saving…';
      try {
        // Check which builder mode is active
        const isCarousel = !document.getElementById('builder-carousel-mode').classList.contains('hidden');
        if (isCarousel) {
          await saveCarouselOutfit(name);
        } else {
          await OutfitBuilder.saveOutfit(name);
        }
        modal.classList.add('hidden');
        nameInput.value = '';
        showToast('Outfit saved! ✨');
      } catch (err) {
        alert('Error saving: ' + err.message);
      } finally {
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Save';
      }
    });
  }

  function initScaleSlider() {
    document.getElementById('scale-slider').addEventListener('input', e => OutfitBuilder.onScaleChange(e.target.value));
  }

  function initClearCanvas() {
    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
      if (confirm('Clear all layers?')) {
        OutfitBuilder.clearCanvas();
        document.getElementById('outfit-name-input').value = '';
      }
    });
  }

  // ── Carousel Builder ──────────────────────────────────────────
  async function populateCarousel() {
    const items = allWardrobeItems.length ? allWardrobeItems : await WardrobeModule.fetchItems();
    allWardrobeItems = items;

    CAROUSEL_CATS.forEach(cat => {
      carouselSel[cat].items = items.filter(i => i.category === cat);
      if (carouselSel[cat].index >= carouselSel[cat].items.length) carouselSel[cat].index = -1;
    });

    renderCarousel();
  }

  function renderCarousel() {
    CAROUSEL_CATS.forEach(cat => {
      const state = carouselSel[cat];
      const item  = state.index >= 0 ? state.items[state.index] : null;

      const imgEl    = document.querySelector(`.carousel-slot[data-cat="${cat}"] .slot-img`);
      const emptyEl  = document.querySelector(`.carousel-slot[data-cat="${cat}"] .slot-none`);
      const nameEl   = document.querySelector(`.carousel-slot[data-cat="${cat}"] .slot-item-name`);
      const countEl  = document.querySelector(`.carousel-slot[data-cat="${cat}"] .slot-count`);
      const scaleEl  = document.querySelector(`.carousel-slot[data-cat="${cat}"] .slot-scale`);

      if (imgEl) {
        if (item) {
          imgEl.src = item.image_url;
          imgEl.classList.remove('hidden');
          if (emptyEl)  emptyEl .classList.add('hidden');
          if (nameEl)   nameEl  .textContent = item.name;
          if (scaleEl) { scaleEl.classList.remove('hidden'); scaleEl.value = state.scale; }
        } else {
          imgEl.classList.add('hidden');
          if (emptyEl)  emptyEl .classList.remove('hidden');
          if (nameEl)   nameEl  .textContent = 'None';
          if (scaleEl) scaleEl.classList.add('hidden');
        }
        if (countEl) countEl.textContent = state.items.length ? `${Math.max(0, state.index) + 1}/${state.items.length + 1}` : '0';
      }
    });
    renderCarouselPreview();
  }

  function carouselNav(cat, dir) {
    const state = carouselSel[cat];
    // -1 = none, 0..n-1 = items
    const max = state.items.length - 1;
    state.index = Math.min(max, Math.max(-1, state.index + dir));
    state.scale = 1;
    renderCarousel();
  }

  function renderCarouselPreview() {
    const preview = document.getElementById('carousel-preview-stack');
    preview.innerHTML = '';
    let hasItems = false;
    // Render vertically: hats → tops → bottoms → shoes
    const layerOrder = ['accessory', 'outerwear', 'top', 'bottom', 'shoes', 'other'];
    layerOrder.forEach((cat, i) => {
      const state = carouselSel[cat];
      if (state.index >= 0 && state.items[state.index]) {
        hasItems = true;
        const item = state.items[state.index];
        const win = document.createElement('div');
        win.className = 'layer-window glass';
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.name;
        img.style.transform = `scale(${state.scale})`;
        win.appendChild(img);
        preview.appendChild(win);
      }
    });
    document.getElementById('carousel-preview-empty').style.display = hasItems ? 'none' : 'flex';
  }

  async function saveCarouselOutfit(name) {
    const layerOrder = ['bottom', 'top', 'outerwear', 'accessory', 'shoes', 'other'];
    const layers = [];
    layerOrder.forEach((cat, i) => {
      const state = carouselSel[cat];
      if (state.index >= 0 && state.items[state.index]) {
        const item = state.items[state.index];
        layers.push({ item_id: item.id, image_url: item.image_url, name: item.name, x: 50, y: 50, z: i + 1, scale: state.scale });
      }
    });
    if (layers.length === 0) throw new Error('Select at least one item.');
    const { data, error } = await db.from('outfits').insert([{ name, layers }]).select().single();
    if (error) throw error;
    return data;
  }

  function initCarouselControls() {
    CAROUSEL_CATS.forEach(cat => {
      const slot = document.querySelector(`.carousel-slot[data-cat="${cat}"]`);
      if (!slot) return;
      slot.querySelector('.slot-prev').addEventListener('click', () => carouselNav(cat, -1));
      slot.querySelector('.slot-next').addEventListener('click', () => carouselNav(cat,  1));
      const scaleEl = slot.querySelector('.slot-scale');
      if (scaleEl) {
        scaleEl.addEventListener('input', (e) => {
          carouselSel[cat].scale = parseFloat(e.target.value);
          renderCarouselPreview();
        });
      }
    });
  }

  // ── Outfits View ──────────────────────────────────────────────
  async function loadOutfits() {
    showSpinner('outfits-spinner');
    try {
      const outfits = await OutfitsModule.fetchOutfits();
      OutfitsModule.renderOutfitCards(outfits);
    } catch (e) {
      showError('outfits-error', e.message);
    } finally {
      hideSpinner('outfits-spinner');
    }
  }

  async function openOutfitInBuilder(outfitId) {
    const outfits = await OutfitsModule.fetchOutfits();
    const outfit  = outfits.find(o => o.id === outfitId);
    if (outfit) { 
      OutfitBuilder.loadOutfit(outfit); 
      document.getElementById('outfit-name-input').value = outfit.name;
      navigate('builder'); 
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function showSpinner(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
  function hideSpinner(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  function showError(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = 'Error: ' + msg; el.style.display = 'block'; } }
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  // ── Init ──────────────────────────────────────────────────────
  function initThemes() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    const brandLogo = document.getElementById('brand-logo');
    let clickCount = 0;
    let clickTimer = null;

    toggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
      toggleBtn.textContent = isDark ? '🌙' : '🌓';
    });

    brandLogo.addEventListener('click', () => {
      clickCount++;
      clearTimeout(clickTimer);
      if (clickCount >= 5) {
        document.documentElement.dataset.theme = 'kisses';
        toggleBtn.textContent = '💋';
        showToast('Secret Theme Unlocked! 💋');
        clickCount = 0;
      } else {
        clickTimer = setTimeout(() => { clickCount = 0; }, 800);
      }
    });
  }

  function init() {
    initThemes();
    navLinks.forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.view); }));
    initBuilderTabs();
    initUploadFlow();
    initCategoryFilter();
    initSaveOutfitModal();
    initScaleSlider();
    initClearCanvas();
    initCarouselControls();
    BgCrop.init();

    document.addEventListener('aiModelReady', () => showToast('AI Background Removal Ready ✨'));

    const hash = window.location.hash.replace('#', '') || 'wardrobe';
    navigate(Object.keys(views).includes(hash) ? hash : 'wardrobe');
  }

  return { init, navigate, deleteItem, addToBuilder, openOutfitInBuilder };
})();
window.AppRouter = AppRouter;

AppRouter.init();
