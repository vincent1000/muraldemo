export const drawCard = (ctx, x, y, w, h, widget, scale, isSelected, isEditing) => {
  // 样式处理
  const bgColor = widget.bgColor || '#f0f0f0';
  const textColor = widget.style?.color || '#333';
  const titleFontSize = (widget.style?.fontSize || 16) * scale;
  const contentFontSize = (widget.style?.fontSize || 12) * scale;
  const editHintFontSize = 12 * scale;

  // 绘制卡片背景和边框
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = isSelected ? '#4285f4' : '#bbbbbb';
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  // 绘制标题
  if (widget.title) {
    ctx.fillStyle = textColor;
    ctx.font = `${titleFontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(widget.title, x + 10 * scale, y + 10 * scale);
  }

  // 绘制内容（支持换行）
  ctx.font = `${contentFontSize}px Arial`;
  ctx.fillStyle = textColor || '#666';
  const contentLines = (widget.content || '').split('\n');
  const contentYStart = widget.title ? 40 * scale : 10 * scale;
  
  contentLines.forEach((line, index) => {
    if (index < 5) {
      ctx.fillText(line, x + 10 * scale, y + contentYStart + (index * 20 * scale));
    } else if (index === 5) {
      ctx.fillText('...', x + 10 * scale, y + contentYStart + (index * 20 * scale));
    }
  });

  // 编辑提示
  if (isSelected && !isEditing && widget.isEditable) {
    ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
    ctx.font = `${editHintFontSize}px Arial`;
    ctx.fillText('Click to edit', x + 10 * scale, y + h - 25 * scale);
  }
};

// 卡片控件操作工具函数
export const cardUtils = {
  createDefaultCard: (id = "widget-card-default") => ({
    id,
    type: 'card',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    title: "Sample Card",
    content: "This is an editable card",
    bgColor: "#f0f0f0",
    style: { color: "#333", fontSize: 14 },
    isEditable: true,
  }),
  
  updateCard: (widget, updates) => ({ ...widget, ...updates })
};

export default { drawCard, cardUtils };