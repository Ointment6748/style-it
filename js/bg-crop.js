// ============================================================
// BgCrop — polygon lasso manual cut tool
// Opens a canvas modal, user clicks to place polygon points,
// double-clicks or clicks near start to close, then masks outside.
// ============================================================

const BgCrop = (() => {
  let modal, canvas, ctx, srcImg, points, mousePos, resolvePromise;
  let scale = 1;
  let mode = 'lasso'; // 'lasso' or 'square'
  let dragging = false;

  function init() {
    modal    = document.getElementById('manual-cut-modal');
    canvas   = document.getElementById('crop-canvas');
    ctx      = canvas.getContext('2d');

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onMouseDown(e.touches[0]); }, {passive:false});
    canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); onMouseMove(e.touches[0]); }, {passive:false});
    window.addEventListener('touchend',   (e) => { onMouseUp(e.changedTouches[0]); });

    canvas.addEventListener('dblclick',  onDoubleClick);

    document.getElementById('btn-crop-cancel') .addEventListener('click', cancel);
    document.getElementById('btn-crop-confirm').addEventListener('click', finish);
    document.getElementById('btn-crop-clear')  .addEventListener('click', clearPoints);
    document.getElementById('btn-crop-undo')   .addEventListener('click', undo);

    // Mode switching
    const btnLasso  = document.getElementById('btn-mode-lasso');
    const btnSquare = document.getElementById('btn-mode-square');
    
    if (btnLasso && btnSquare) {
      btnLasso.addEventListener('click', () => setMode('lasso'));
      btnSquare.addEventListener('click', () => setMode('square'));
    }
  }

  function setMode(m) {
    mode = m;
    document.getElementById('btn-mode-lasso').classList.toggle('active', m === 'lasso');
    document.getElementById('btn-mode-square').classList.toggle('active', m === 'square');
    clearPoints();
  }

  // ── Public: open for a File / Blob, returns Promise<Blob|null> ──
  function openForFile(file) {
    return new Promise((resolve) => {
      resolvePromise = resolve;
      points  = [];
      mousePos = null;
      dragging = false;

      const url = URL.createObjectURL(file);
      srcImg = new Image();
      srcImg.onload = () => {
        const maxW = Math.min(window.innerWidth  * 0.88, 820);
        const maxH = Math.min(window.innerHeight * 0.64, 560);
        scale = Math.min(maxW / srcImg.naturalWidth, maxH / srcImg.naturalHeight, 1);
        canvas.width  = Math.round(srcImg.naturalWidth  * scale);
        canvas.height = Math.round(srcImg.naturalHeight * scale);
        render();
        modal.classList.remove('hidden');
        URL.revokeObjectURL(url);
      };
      srcImg.src = url;
    });
  }

  // ── Canvas events ────────────────────────────────────────────
  function getPos(e) {
    if (!e) return { x: 0, y: 0 };
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function onMouseDown(e) {
    const pos = getPos(e);
    if (mode === 'lasso') {
      // Close if near first point
      if (points.length >= 3) {
        const dx = pos.x - points[0].x, dy = pos.y - points[0].y;
        if (Math.sqrt(dx*dx + dy*dy) < 16) { finish(); return; }
      }
      points.push(pos);
    } else {
      // Square mode: start drag
      points = [pos, { ...pos }];
      dragging = true;
    }
    render();
  }

  function onMouseUp() {
    if (mode === 'square' && dragging) {
      dragging = false;
      // We keep the two points: points[0] is start, points[1] is end (constrained to square)
    }
  }

  function onDoubleClick() { if (mode === 'lasso') finish(); }

  function onMouseMove(e) {
    mousePos = getPos(e);
    if (mode === 'square' && dragging) {
      const start = points[0];
      const end = mousePos;
      
      // Constraint to square
      let w = end.x - start.x;
      let h = end.y - start.y;
      const size = Math.max(Math.abs(w), Math.abs(h));
      
      points[1] = {
        x: start.x + (w >= 0 ? size : -size),
        y: start.y + (h >= 0 ? size : -size)
      };
    }
    render();
  }

  // ── Render ───────────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(srcImg, 0, 0, canvas.width, canvas.height);
    if (points.length === 0) return;

    if (mode === 'lasso') {
      // Dim outside (only once there are 3+ points)
      if (points.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.fill('evenodd');
        ctx.restore();
      }

      // Path line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      if (mousePos && !dragging) ctx.lineTo(mousePos.x, mousePos.y);
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Closing guide to first point
      if (points.length >= 3 && mousePos) {
        const dx = mousePos.x - points[0].x, dy = mousePos.y - points[0].y;
        const near = Math.sqrt(dx*dx + dy*dy) < 16;
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, near ? 10 : 6, 0, Math.PI * 2);
        ctx.fillStyle = near ? '#8b5cf6' : '#a78bfa';
        ctx.fill();
      }

      // All points dots
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#8b5cf6' : '#c4b5fd';
        ctx.fill();
      });
    } else {
      // Square Mode Render
      if (points.length >= 2) {
        const start = points[0];
        const end = points[1];
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.fill('evenodd');
        
        ctx.beginPath();
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ── Finish — apply mask ──────────────────────────────────────
  function finish() {
    if (mode === 'lasso' && points.length < 3) { alert('Draw at least 3 points to define the outline.'); return; }
    if (mode === 'square' && points.length < 2) { alert('Click and drag to select a square area.'); return; }

    const out    = document.createElement('canvas');
    out.width    = srcImg.naturalWidth;
    out.height   = srcImg.naturalHeight;
    const outCtx = out.getContext('2d');

    outCtx.drawImage(srcImg, 0, 0);
    outCtx.globalCompositeOperation = 'destination-in';
    outCtx.beginPath();
    
    const inv = 1 / scale;
    if (mode === 'lasso') {
      outCtx.moveTo(points[0].x * inv, points[0].y * inv);
      points.slice(1).forEach(p => outCtx.lineTo(p.x * inv, p.y * inv));
      outCtx.closePath();
    } else {
      const start = points[0];
      const end = points[1];
      outCtx.rect(start.x * inv, start.y * inv, (end.x - start.x) * inv, (end.y - start.y) * inv);
    }
    outCtx.fill();

    out.toBlob(blob => {
      modal.classList.add('hidden');
      if (resolvePromise) { resolvePromise(blob); resolvePromise = null; }
    }, 'image/png');
  }

  function cancel() {
    modal.classList.add('hidden');
    if (resolvePromise) { resolvePromise(null); resolvePromise = null; }
  }

  function clearPoints() { points = []; mousePos = null; dragging = false; render(); }
  function undo()         { points.pop(); render(); }

  return { init, openForFile };
})();
window.BgCrop = BgCrop;
