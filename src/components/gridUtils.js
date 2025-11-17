// src/components/mural/gridUtils.js
export const drawGrid = ({ canvasRef, gridCanvasRef, gridSize, scale }) => {
  const canvasEl = canvasRef.current;
  if (!canvasEl) return;

  // 创建/获取网格画布
  let gridCanvas = gridCanvasRef.current;
  if (!gridCanvas) {
    gridCanvas = document.createElement('canvas');
    gridCanvasRef.current = gridCanvas;
    gridCanvas.style.position = 'absolute';
    gridCanvas.style.top = '0';
    gridCanvas.style.left = '0';
    gridCanvas.style.zIndex = '-1';
    gridCanvas.style.pointerEvents = 'none';
    canvasEl.appendChild(gridCanvas);
  }

  // 适配画布尺寸和缩放
  const { width, height } = canvasEl.getBoundingClientRect();
  gridCanvas.width = width;
  gridCanvas.height = height;

  const ctx = gridCanvas.getContext('2d');
  if (!ctx) return;

  // 清除画布
  ctx.clearRect(0, 0, width, height);

  // 绘制网格线（线宽随缩放反向调整，确保视觉一致）
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1 / scale;

  // 水平网格线
  for (let y = 0; y < height; y += gridSize * scale) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 垂直网格线
  for (let x = 0; x < width; x += gridSize * scale) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
};