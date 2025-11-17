// 图片缓存管理
const imageCache = new Map();

// 绘制错误占位符
const drawErrorPlaceholder = (ctx, x, y, w, h, scale) => {
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#ff4444';
  ctx.font = `${12 * scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Image load failed', x + w / 2, y + h / 2);
};

// 绘制图片到画布
const drawImageToCanvas = (ctx, img, x, y, w, h, isSelected, scale, widget) => {
  try {
    if (widget.rotation && widget.rotation !== 0) {
      ctx.save();
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((widget.rotation * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
  } catch (err) {
    drawErrorPlaceholder(ctx, x, y, w, h, scale);
    return;
  }

  // 绘制边框
  ctx.strokeStyle = isSelected ? '#4285f4' : 'rgba(187, 187, 187, 0.5)';
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeRect(x, y, w, h);

  // 状态提示
  if (widget.isLocked) {
    ctx.fillStyle = 'rgba(255, 159, 64, 0.8)';
    ctx.font = `${12 * scale}px Arial`;
    ctx.fillText('Locked', x + 10 * scale, y + 10 * scale);
  } else if (isSelected) {
    ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
    ctx.font = `${12 * scale}px Arial`;
    ctx.fillText('Image Control', x + 10 * scale, y + 10 * scale);
  }
};

// 优化的图片绘制（带缓存）
export const drawImageOptimized = (ctx, x, y, w, h, widget, scale, isSelected, onRedraw) => {
  const src = widget.src;
  if (!src) {
    drawErrorPlaceholder(ctx, x, y, w, h, scale);
    return;
  }

  const cacheEntry = imageCache.get(src);
  if (cacheEntry) {
    if (cacheEntry.status === 'loaded' && cacheEntry.img) {
      drawImageToCanvas(ctx, cacheEntry.img, x, y, w, h, isSelected, scale, widget);
    } else if (cacheEntry.status === 'error') {
      drawErrorPlaceholder(ctx, x, y, w, h, scale);
    }
    return;
  }

  // 加载图片并缓存
  const img = new Image();
  img.crossOrigin = 'anonymous';
  imageCache.set(src, { status: 'loading', img: null });

  img.onload = () => {
    imageCache.set(src, { status: 'loaded', img });
    onRedraw();
  };

  img.onerror = () => {
    imageCache.set(src, { status: 'error', img: null });
    onRedraw();
  };

  img.src = src;
};

// 图片控件工具函数
export const imageUtils = {
  createDefaultImage: (id = "widget-image-default") => ({
    id,
    type: 'image',
    x: 300,
    y: 200,
    width: 300,
    height: 200,
    src: "https://picsum.photos/seed/img1/300/200",
    rotation: 0,
    isLocked: false,
  }),
  
  updateImage: (widget, updates) => ({ ...widget, ...updates })
};

export default { drawImageOptimized, imageUtils, imageCache };