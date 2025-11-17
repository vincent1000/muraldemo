// src/components/mural/Toolbar.jsx
import React, { useState } from 'react';

// 色卡组件
const ColorPicker = ({ onColorChange, isOpen, toggleOpen }) => {
  const colors = [
    '#000000', '#DC2626', '#2563EB', '#059669', '#7C3AED',
    '#D97706', '#DB2777', '#4B5563', '#4F46E5', '#EA580C',
  ];

  return (
    <div style={{ position: 'relative' }}>
      {/* 颜色按钮 */}
      <button
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
        }}
        onClick={toggleOpen}
        onMouseDown={(e) => e.stopPropagation()} // 阻止触发卡片拖动
      >
        <i className="fa fa-font" style={{ fontSize: '16px' }}></i>
      </button>

      {/* 色卡面板 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '0',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
            zIndex: 30,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {colors.map((color) => (
            <button
              key={color}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '2px solid transparent',
                backgroundColor: color,
                cursor: 'pointer',
              }}
              onClick={() => {
                onColorChange(color);
                toggleOpen();
              }}
              onMouseEnter={(e) => (e.target.style.borderColor = '#6366f1')}
              onMouseLeave={(e) => (e.target.style.borderColor = 'transparent')}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 工具栏主组件
const Toolbar = ({ style, isEditing, onSave, onEdit, onUndo, onColorChange, onResize, onDelete }) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // 切换色卡显示/隐藏
  const toggleColorPicker = (e) => {
    e.stopPropagation();
    setIsColorPickerOpen(!isColorPickerOpen);
  };

  return (
    <div style={style} onMouseDown={(e) => e.stopPropagation()}>
      {/* 撤销按钮（仅编辑状态显示） */}
      {isEditing && (
        <button
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
          }}
          onClick={onUndo}
          title="撤销（最多20次）"
        >
          <i className="fa fa-undo" style={{ fontSize: '16px' }}></i>
        </button>
      )}

      {/* 编辑/保存按钮 */}
      <button
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isEditing ? '#059669' : '#6b7280',
        }}
        onClick={isEditing ? onSave : onEdit}
        title={isEditing ? '保存' : '编辑'}
      >
        <i className={isEditing ? 'fa fa-save' : 'fa fa-pencil'} style={{ fontSize: '16px' }}></i>
      </button>

      {/* 颜色选择器 */}
      <ColorPicker
        isOpen={isColorPickerOpen}
        toggleOpen={toggleColorPicker}
        onColorChange={onColorChange}
      />

      {/* 模式切换按钮 */}
      <button
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
        }}
        onClick={onResize}
        title="切换模式（正常/展开）"
      >
        <i className="fa fa-expand" style={{ fontSize: '16px' }}></i>
      </button>

      {/* 删除按钮 */}
      <button
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#dc2626',
        }}
        onClick={onDelete}
        title="删除"
      >
        <i className="fa fa-trash" style={{ fontSize: '16px' }}></i>
      </button>
    </div>
  );
};

export default Toolbar;