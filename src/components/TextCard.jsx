import React from 'react';
import BaseCard from './BaseCard';

// React.memo 优化重渲染（无需 defaultProps）
const TextCard = React.memo(({
  id,
  x,
  y,
  width,
  height,
  mode = 'normal', // 原生默认参数：默认正常模式
  state = 'normal', // 原生默认参数：默认正常状态
  title = '无标题', // 原生默认参数
  summary = '', // 原生默认参数
  content = '', // 原生默认参数
  onClick = () => {}, // 原生默认参数：空函数避免报错
  onDoubleClick = () => {}, // 原生默认参数
  onMouseDown = () => {}, // 原生默认参数
  onEditTitle = () => {}, // 原生默认参数
  onEditSummary = () => {}, // 原生默认参数
  onEditContent = () => {}, // 原生默认参数
  cardRef = null, // 原生默认参数
}) => {
  const isEditing = state === 'edit';

  // 公共样式提取（减少冗余）
  const commonTextStyle = {
    wordBreak: 'break-word',
    outline: 'none',
    padding: isEditing ? '8px 12px' : '0 12px',
    backgroundColor: isEditing ? '#f7fafc' : 'transparent',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease',
  };

  // 标题样式
  const titleStyle = {
    ...commonTextStyle,
    fontSize: '16px',
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: '8px',
  };

  // 摘要样式（正常模式）
  const summaryStyle = {
    ...commonTextStyle,
    fontSize: '14px',
    color: '#4a5568',
    lineHeight: 1.5,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  };

  // 内容样式（扩展模式）
  const contentStyle = {
    ...commonTextStyle,
    fontSize: '14px',
    color: '#4a5568',
    lineHeight: 1.6,
    flex: 1,
    overflowY: 'auto',
    maxHeight: 'calc(100% - 40px)',
  };

  // 内容容器样式
  const cardContentWrapper = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    paddingTop: '12px',
  };

  // 标题编辑回调
  const handleTitleBlur = (e) => {
    const newTitle = e.target.innerText.trim() || '无标题';
    onEditTitle(id, newTitle);
  };

  // 摘要编辑回调
  const handleSummaryBlur = (e) => {
    onEditSummary(id, e.target.innerHTML);
  };

  // 内容编辑回调
  const handleContentBlur = (e) => {
    onEditContent(id, e.target.innerHTML);
  };

  // 渲染标题
  const renderTitle = () => (
    <div style={titleStyle}>
      {isEditing ? (
        <div
          contentEditable
          onBlur={handleTitleBlur}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: title }}
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: title }} />
      )}
    </div>
  );

  // 渲染正常模式内容（标题+摘要）
  const renderNormalContent = () => (
    <div style={summaryStyle}>
      {isEditing ? (
        <div
          contentEditable
          onBlur={handleSummaryBlur}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: summary }}
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: summary }} />
      )}
    </div>
  );

  // 渲染扩展模式内容（标题+完整内容）
  const renderExpandedContent = () => (
    <div style={contentStyle}>
      {isEditing ? (
        <div
          contentEditable
          onBlur={handleContentBlur}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      )}
    </div>
  );

  return (
    <BaseCard
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      state={state}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      cardRef={cardRef}
      style={{
        backgroundColor: '#ffffff',
        border: state === 'preview' ? '2px solid #3182ce' : '1px solid #e2e8f0',
        boxShadow: state === 'preview'
          ? '0 4px 12px rgba(49, 130, 206, 0.15)'
          : '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={cardContentWrapper}>
        {renderTitle()}
        {mode === 'normal' ? renderNormalContent() : renderExpandedContent()}
      </div>
    </BaseCard>
  );
});

// 移除 defaultProps 定义（关键修复）
export default TextCard;