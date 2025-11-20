import React, { useState, forwardRef, useEffect } from 'react';
import Icon from '../utils/icon';

const CardToolbar = forwardRef(({
  card,
  cardType = 'text', // 新增：卡片类型（'text' 或 'image'）
  onUndo,
  onToggleEdit,
  onColorChange,
  onResize,
  onDelete,
  style,
  scale = 1,
}, ref) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const isImageCard = cardType === 'image';

  useEffect(() => {
    // 打印渲染与测量信息（在 card 或 scale 变化时）
    console.log('[CardToolbar] render', { cardId: card && card.id, scale });
    try {
      const el = ref && ref.current ? ref.current : null;
      if (el) {
        const r = el.getBoundingClientRect();
        console.log('[CardToolbar] mounted measure', { width: r.width, height: r.height, scale });
      } else {
        console.log('[CardToolbar] no-ref on render', { scale });
      }
    } catch (err) {
      console.warn('[CardToolbar] measure error', err);
    }
  }, [scale, card && card.id]);

  // 颜色选项
  const colorOptions = [
    '#000000', '#e53e3e', '#3182ce', '#38a169',
    '#805ad5', '#ed8936', '#ffffff', '#718096',
  ];

  // 工具栏基础样式（按 scale 缩放）
  const toolbarStyle = {
    display: 'flex',
    gap: `${8 * scale}px`,
    padding: `${8 * scale}px`,
    backgroundColor: '#ffffff',
    borderRadius: `${8 * scale}px`,
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0',
    alignItems: 'center',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    overflow: 'visible',
    ...style,
  };

  // 按钮样式
  const btnStyle = {
    padding: `${6 * scale}px`,
    border: 'none',
    borderRadius: `${4 * scale}px`,
    backgroundColor: 'transparent',
    color: '#2d3748',
    cursor: 'pointer',
    fontSize: `${14 * scale}px`,
    transition: 'opacity 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // 编辑按钮样式（区分状态）
  const editBtnStyle = {
    ...btnStyle,
    backgroundColor: 'transparent',
    color: '#ffffff',
  };

  // 删除按钮样式
  const deleteBtnStyle = {
    ...btnStyle,
    backgroundColor: 'transparent',
    color: '#ffffff',
  };

  // 颜色选择器样式
  const colorPickerStyle = {
    position: 'relative',
  };

  const colorGridStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: `${8 * scale}px`,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: `${4 * scale}px`,
    padding: `${8 * scale}px`,
    backgroundColor: '#ffffff',
    borderRadius: `${4 * scale}px`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0',
    zIndex: 101,
  };

  const colorSwatchStyle = {
    width: `${24 * scale}px`,
    height: `${24 * scale}px`,
    borderRadius: `${4 * scale}px`,
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.1s ease',
  };

  return (
    <div ref={ref} style={toolbarStyle}>
      {/* 撤销按钮 - 仅在编辑模式显示 */}
      {!isImageCard && card.state === 'edit' && (
        <button
          style={btnStyle}
          onClick={() => onUndo(card.id)}
          disabled={card.history && card.history.length === 0} // 无历史时禁用
          title="撤销 (最多20次)"
        >
          <Icon 
            name="undo" 
            size={18 * scale} 
            disabled={card.history && card.history.length === 0}
          />
        </button>
      )}

      {/* 编辑/保存按钮 - 仅 TextCard 显示 */}
      {!isImageCard && (
        <button
          style={editBtnStyle}
          onClick={() => onToggleEdit(card.id)}
          title={card.state === 'edit' ? '完成编辑' : '编辑'}
        >
          <Icon 
            name={card.state === 'edit' ? 'save' : 'edit'} 
            size={18 * scale}
            color="#ffffff"
            hoverColor="#ffffff"
          />
        </button>
      )}

      {/* 颜色选择器 - 仅 TextCard 且编辑模式显示 */}
      {!isImageCard && (
        <div style={colorPickerStyle}>
          <button 
            style={btnStyle} 
            onClick={() => card.state === 'edit' && setShowColorPicker(!showColorPicker)}
            disabled={card.state !== 'edit'}
            title={card.state === 'edit' ? '选择颜色' : '颜色 (仅编辑时可用)'}
          >
            <Icon 
              name={card.state === 'edit' ? 'colorEnable' : 'colorDisable'} 
              size={18 * scale}
              disabled={card.state !== 'edit'}
            />
          </button>
          {showColorPicker && card.state === 'edit' && (
            <div style={colorGridStyle}>
              {colorOptions.map(color => (
                <div
                  key={color}
                  style={{ ...colorSwatchStyle, backgroundColor: color }}
                  onMouseDown={(e) => {
                    // 阻止默认行为，避免选区丢失
                    e.preventDefault();
                  }}
                  onClick={() => {
                    onColorChange(color);
                    setShowColorPicker(false);
                  }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 模式切换（缩放）按钮 */}
      <button
        style={btnStyle}
        onClick={() => onResize(card.id)}
        title={card.mode === 'normal' ? '展开' : '恢复正常'}
      >
        <Icon 
          name={card.mode === 'normal' ? 'toExpand' : 'toNormal'} 
          size={18 * scale}
        />
      </button>

      {/* 删除按钮 */}
      <button
        style={deleteBtnStyle}
        onClick={() => onDelete(card.id)}
        title="删除"
      >
        <Icon 
          name="delete" 
          size={18 * scale}
          color="#ffffff"
          hoverColor="#ffffff"
        />
      </button>
    </div>
  );
});

CardToolbar.displayName = 'CardToolbar';

export default CardToolbar;