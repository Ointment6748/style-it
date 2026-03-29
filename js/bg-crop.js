// ============================================================
// BgCrop — polygon lasso manual cut tool
// Opens a canvas modal, user clicks to place polygon points,
// double-clicks or clicks near start to close, then masks outside.
// ============================================================

const BgCrop = (() => {
  let modal, canvas, ctx, srcImg, points, mousePos, resolvePromise;
  let scale = 1;

  function init() {
    modal    = document.getElementById('manual-cut-modal');
    canvas   = document.getElementById('crop-canvas');
    ctx      = canvas.getContext('2d');

    canvas.addEventListener('click',     onCanvasClick);
    canvas.addEventListener('dblclick',  onDoubleClick);
    canvas.addEventListener('mousemove', onMouseMove);

    document.getElementById('btn-crop-cancel') .addEventListener('click', cancel);
    document.getElementById('btn-crop-confirm').addEventListener('click', finish);
    document.getElementById('btn-crop-clear')  .addEventListener('click', clearPoints);
    document.getElementById('btn-crop-undo')   .addEventListener('click', undo);
  }

  // ── Public: open for a File / Blob, returns Promise<Blob|null> ──
  function openForFile(file) {
    return new Promise((resolve) => {
      resolvePromise = resolve;
      points  = [];
      mousePos = null;

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
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function onCanvasClick(e) {
    if (e.detail >= 2) return; // let dblclick handle
    const pos = getPos(e);
    // Close if near first point
    if (points.length >= 3) {
      const dx = pos.x - points[0].x, dy = pos.y - points[0].y;
      if (Math.sqrt(dx*dx + dy*dy) < 16) { finish(); return; }
    }
    points.push(pos);
    render();
  }

  function onDoubleClick() { finish(); }

  function onMouseMove(e) {
    mousePos = getPos(e);
    render();
  }

  // ── Render ───────────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(srcImg, 0, 0, canvas.width, canvas.height);
    if (points.length === 0) return;

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
    if (mousePos) ctx.lineTo(mousePos.x, mousePos.y);
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
  }

  // ── Finish — apply mask ──────────────────────────────────────
  function finish() {
    if (points.length < 3) { alert('Draw at least 3 points to define the outline.'); return; }

    const out    = document.createElement('canvas');
    out.width    = srcImg.naturalWidth;
    out.height   = srcImg.naturalHeight;
    const outCtx = out.getContext('2d');

    outCtx.drawImage(srcImg, 0, 0);
    outCtx.globalCompositeOperation = 'destination-in';
    outCtx.beginPath();
    // Scale points back to natural image size
    const inv = 1 / scale;
    outCtx.moveTo(points[0].x * inv, points[0].y * inv);
    points.slice(1).forEach(p => outCtx.lineTo(p.x * inv, p.y * inv));
    outCtx.closePath();
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

  function clearPoints() { points = []; mousePos = null; render(); }
  function undo()         { points.pop(); render(); }

  return { init, openForFile };
})();
window.BgCrop = BgCrop;
