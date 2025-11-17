import React, { useState } from 'react';

const CardToolbar = ({
  card,
  onUndo,
  onToggleEdit,
  onColorChange,
  onResize,
  onDelete,
  style,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  // 颜色选项
  const colorOptions = [
    '#000000', '#e53e3e', '#3182ce', '#38a169',
    '#805ad5', '#ed8936', '#ffffff', '#718096',
  ];

  // 工具栏基础样式
  const toolbarStyle = {
    display: 'flex',
    gap: '8px',
    padding: '8px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0',
    ...style,
  };

  // 按钮样式
  const btnStyle = {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#f7fafc',
    color: '#2d3748',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: '#edf2f7',
    },
  };

  // 编辑按钮样式（区分状态）
  const editBtnStyle = {
    ...btnStyle,
    backgroundColor: card.state === 'edit' ? '#3182ce' : '#48bb78',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: card.state === 'edit' ? '#2b6cb0' : '#38a169',
    },
  };

  // 删除按钮样式
  const deleteBtnStyle = {
    ...btnStyle,
    backgroundColor: '#e53e3e',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: '#c53030',
    },
  };

  // 颜色选择器样式
  const colorPickerStyle = {
    position: 'relative',
  };

  const colorGridStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '8px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
    padding: '8px',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0',
    zIndex: 101,
  };

  const colorSwatchStyle = {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.1s ease',
    '&:hover': {
      transform: 'scale(1.1)',
    },
  };

  return (
    <div style={toolbarStyle}>
      {/* 撤销按钮 */}
      <button
        style={btnStyle}
        onClick={() => onUndo(card.id)}
        disabled={card.history.length === 0} // 无历史时禁用
      >
        撤销
      </button>

      {/* 编辑按钮 */}
      <button
        style={editBtnStyle}
        onClick={() => onToggleEdit(card.id)}
      >
        {card.state === 'edit' ? '完成' : '编辑'}
      </button>

      {/* 颜色选择器 */}
      <div style={colorPickerStyle}>
        <button style={btnStyle} onClick={() => setShowColorPicker(!showColorPicker)}>
          颜色
        </button>
        {showColorPicker && (
          <div style={colorGridStyle}>
            {colorOptions.map(color => (
              <div
                key={color}
                style={{ ...colorSwatchStyle, backgroundColor: color }}
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

      {/* 模式切换（缩放）按钮 */}
      <button
        style={btnStyle}
        onClick={() => onResize(card.id)}
      >
        {card.mode === 'normal' ? '扩展' : '收缩'}
      </button>

      {/* 删除按钮 */}
      <button
        style={deleteBtnStyle}
        onClick={() => onDelete(card.id)}
      >
        删除
      </button>
    </div>
  );
};

export default CardToolbar;