import React from 'react';

// React.memo 包裹（无需 defaultProps）
const BaseCard = React.memo(({
  id,
  x = 0, // 原生默认参数：默认x坐标0
  y = 0, // 原生默认参数：默认y坐标0
  width = 200, // 原生默认参数：默认宽度200px
  height = 140, // 原生默认参数：默认高度140px
  state = 'normal', // 原生默认参数：默认正常状态
  onClick = () => {}, // 原生默认参数：空函数避免报错
  onDoubleClick = () => {}, // 原生默认参数
  onMouseDown = () => {}, // 原生默认参数
  cardRef = null, // 原生默认参数
  children = null, // 原生默认参数：默认无内容
  style = {}, // 原生默认参数：默认空样式
}) => {
  // 基础样式（简洁高效，无冗余过渡）
  const baseStyle = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    boxSizing: 'border-box',
    // 编辑状态光标为文本，其他为移动
    cursor: state === 'edit' ? 'text' : 'move',
    // 编辑状态允许选中文本，其他禁止（避免拖拽冲突）
    userSelect: state === 'edit' ? 'text' : 'none',
    overflow: 'hidden',
    borderRadius: '8px',
    // 合并外部样式（优先级更高）
    ...style,
  };
  const handleMouseDown = (e) => {
    // 编辑模式下：允许事件冒泡和默认行为（让文本选择工作）
    if (state !== 'edit') {
      e.stopPropagation(); // 阻止事件冒泡到画布，避免同时触发平移
      e.preventDefault();
    }
    onMouseDown(e); // 调用外部传入的onMouseDown
  };
  const handleClick = (e) => {
    // 编辑模式下，点击卡片内任何位置都不应触发外部 click（避免退出编辑）
    if (state === 'edit') return;
    onClick(e);
  };
  const handleDoubleClick = (e) => {
    // 编辑模式下，双击卡片内任何位置不应触发外部 doubleClick
    if (state === 'edit') return;
    onDoubleClick(e);
  };
  return (
    <div
      ref={cardRef}
      id={`card-${id}`}
      style={baseStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      draggable={false} // 禁止浏览器默认拖拽
    >
      {children}
    </div>
  );
});

// 移除 defaultProps 定义（关键修复）
export default BaseCard;