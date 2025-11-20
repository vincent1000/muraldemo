import React, { useState, useRef, useEffect } from 'react';
import BaseCard from './BaseCard';
import RichTextToolbar from './RichTextToolbar';

// React.memo 优化重渲染（无需 defaultProps）
const TextCard = React.memo(({
  id,
  x,
  y,
  width,
  height,
  mode = 'normal', // 原生默认参数：默认正常模式
  state = 'normal', // 原生默认参数：默认正常状态
  scale = 1, // 缩放比例（用于缩放字体）
  title = '无标题', // 原生默认参数
  summary = '', // 原生默认参数
  content = '', // 原生默认参数
  tag = '',
  updatedAt = null,
  onClick = () => {}, // 原生默认参数：空函数避免报错
  onDoubleClick = () => {}, // 原生默认参数
  onMouseDown = () => {}, // 原生默认参数
  onEditTitle = () => {}, // 原生默认参数
  onEditSummary = () => {}, // 原生默认参数
  onEditContent = () => {}, // 原生默认参数
  onFieldFocus = () => {}, // 原生默认参数
  cardRef = null, // 原生默认参数
}) => {
  const isEditing = state === 'edit';
  const summaryEditRef = useRef(null);
  const [showRichToolbar, setShowRichToolbar] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const richToolbarRef = useRef(null);
  const isClickingToolbarRef = useRef(false);

  // 处理字段焦点，显示富文本工具栏
  const handleFieldFocusInternal = (field) => {
    console.log('[TextCard] field focus:', field, 'isEditing:', isEditing);
    setActiveField(field);
    setShowRichToolbar(true);
    onFieldFocus(field);
  };

  // 处理字段失焦
  const handleFieldBlur = (e) => {
    // 如果正在点击工具栏，不处理失焦
    if (isClickingToolbarRef.current) {
      console.log('[TextCard] blur ignored - clicking toolbar');
      return;
    }
    
    // 延迟检查，以便工具栏按钮能够响应点击
    setTimeout(() => {
      const activeEl = document.activeElement;
      const isInCard = activeEl && activeEl.closest(`#card-${id}`);
      const isInToolbar = activeEl && (
        activeEl.closest('.rich-text-toolbar') || 
        activeEl.classList.contains('rich-text-toolbar')
      );
      
      console.log('[TextCard] blur check:', { 
        isInCard, 
        isInToolbar, 
        isClickingToolbar: isClickingToolbarRef.current,
        activeElement: activeEl?.tagName 
      });
      
      // 只有当焦点既不在卡片内，也不在工具栏内，且没有点击工具栏时才隐藏工具栏
      if (!isInCard && !isInToolbar && !isClickingToolbarRef.current) {
        setShowRichToolbar(false);
        setActiveField(null);
      }
    }, 200);
  };

  // 处理富文本命令
  const handleRichCommand = (command) => {
    // execCommand 已在 RichTextToolbar 中执行
    // 这里可以添加自定义逻辑
  };

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isEditing) return;
      
      // Ctrl/Cmd + B: 加粗
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
      }
      // Ctrl/Cmd + I: 斜体
      else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
      }
      // Ctrl/Cmd + U: 下划线
      else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        document.execCommand('underline', false, null);
      }
    };

    if (isEditing) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isEditing]);

  // 进入编辑模式时重置 summary 滚动位置
  useEffect(() => {
    if (isEditing && summaryEditRef.current) {
      try {
        const editableDiv = summaryEditRef.current.querySelector('[contenteditable]');
        if (editableDiv && typeof editableDiv.scrollTop !== 'undefined') {
          editableDiv.scrollTop = 0;
        }
      } catch (err) {
        // noop
      }
    }
  }, [isEditing]);

  // 简易 Markdown 渲染器（支持标题、加粗、斜体、链接、行内代码与换行）
  const markdownToHtml = (md) => {
    if (!md) return '';
    let s = String(md)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    s = s.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    s = s.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    s = s.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    s = s.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    s = s.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    s = s.replace(/`(.*?)`/gim, '<code>$1</code>');
    s = s.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
    s = s.replace(/\n/g, '<br/>');
    return s;
  };

  // 时间格式化（紧凑英文缩写）：
  // <60s -> 'now'
  // <1h -> 'Xm ago'
  // <24h -> 'Xh ago'
  // <7d -> weekday short (Mon)
  // same year -> 'M/D'
  // else -> 'YYYY'
  const formatUpdatedAt = (iso) => {
    if (!iso) return '';
    const then = new Date(iso);
    if (isNaN(then.getTime())) return '';
    const now = new Date();
    const diff = Math.floor((now - then) / 1000); // seconds
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 7 * 86400) {
      return then.toLocaleDateString('en-US', { weekday: 'short' });
    }
    const sameYear = now.getFullYear() === then.getFullYear();
    if (sameYear) {
      return `${then.getMonth() + 1}/${then.getDate()}`;
    }
    return `${then.getFullYear()}`;
  };

  // 公共样式提取（减少冗余，支持缩放）
  // 注意：保持统一 padding 避免进入编辑模式时元素位移
  // 公共样式提取（减少冗余，支持缩放）
  // 注意：把外层间距和编辑内层间距分开处理，确保编辑框相对于卡片有间隔
  const commonTextStyle = {
    wordBreak: 'break-word',
    outline: 'none',
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: `${4 * scale}px`,
    transition: 'background-color 0.2s ease',
    boxSizing: 'border-box',
  };

  const innerWrapperPadding = { padding: `${6 * scale}px ${12 * scale}px`, boxSizing: 'border-box' };

  // 标题样式（支持缩放）
  // 预览模式：单行省略，编辑模式：单行横向滚动
  const titleStyle = {
    ...commonTextStyle,
    fontSize: `${16 * scale}px`,
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: `${8 * scale}px`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minHeight: `${20 * scale}px`,
    lineHeight: 1.2,
  };

  const titleEditInnerStyle = {
    outline: 'none',
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflowX: 'hidden',
    textOverflow: 'clip',
    overflowY: 'hidden',
    width: '100%',
    display: 'block',
    padding: 0,
    boxSizing: 'border-box',
    fontSize: `${16 * scale}px`,
    fontWeight: 600,
    color: '#2d3748',
    lineHeight: 1.2,
  };

  // 摘要样式
  // 预览模式：两行省略，编辑模式：竖向滚动
  const summaryStyle = {
    ...commonTextStyle,
    fontSize: `${14 * scale}px`,
    color: '#4a5568',
    lineHeight: 1.5,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  };

  const summaryEditStyle = {
    width: '100%',
    boxSizing: 'border-box',
  };

  const summaryEditInnerStyle = {
    outline: 'none',
    width: '100%',
    minHeight: `${56 * scale}px`,
    boxSizing: 'border-box',
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: `${4 * scale}px`,
    overflowY: 'auto',
    fontSize: `${14 * scale}px`,
    color: '#4a5568',
    lineHeight: 1.5,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0,0,0,0.2) transparent',
  };

  // 内容样式（扩展模式，支持缩放）
  const contentStyle = {
    ...commonTextStyle,
    fontSize: `${14 * scale}px`,
    color: '#4a5568',
    lineHeight: 1.5,
    flex: 1,
    overflowY: 'auto',
    maxHeight: `calc(100% - ${40 * scale}px)`,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0,0,0,0.2) transparent',
  };

  const contentEditInnerStyle = {
    outline: 'none',
    width: '100%',
    minHeight: `${42 * scale}px`,
    boxSizing: 'border-box',
    padding: 0,
    backgroundColor: 'transparent',
    borderRadius: `${4 * scale}px`,
    overflowY: 'auto',
    fontSize: `${14 * scale}px`,
    color: '#4a5568',
    lineHeight: 1.5,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0,0,0,0.2) transparent',
  };

  // 内容容器样式（支持缩放，footer固定底部，内容区自适应）
  const cardContentWrapper = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    boxSizing: 'border-box',
    paddingTop: `${12 * scale}px`,
    paddingBottom: 0,
  };

  // 内容区样式（flex:1, 保证footer可见）
  const mainContentStyle = {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  // 底部信息（tag + updatedAt）
  const footerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    padding: `0 ${12 * scale}px ${8 * scale}px`,
    gap: `${8 * scale}px`,
  };

  const tagStyle = {
    color: '#2d3748',
    padding: `0 ${8 * scale}px`,
    fontSize: `${13 * scale}px`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '60%'
  };

  const timeStyle = {
    color: '#2d3748',
    fontSize: `${13 * scale}px`,
    whiteSpace: 'nowrap',
  };

  // 标题编辑回调
  const handleTitleBlur = (e) => {
    const newTitle = e.target.innerHTML.trim() || '无标题';
    onEditTitle(id, newTitle);
    // 离开编辑后重置水平滚动，保证预览从头开始显示
    try {
      if (e && e.target && typeof e.target.scrollLeft !== 'undefined') {
        e.target.scrollLeft = 0;
      }
    } catch (err) {
      // noop
    }
  };

  // 摘要编辑回调
  const handleSummaryBlur = (e) => {
    onEditSummary(id, e.target.innerHTML);
    // 离开编辑后重置垂直滚动，保证预览从头开始显示
    try {
      if (e && e.target && typeof e.target.scrollTop !== 'undefined') {
        e.target.scrollTop = 0;
      }
    } catch (err) {
      // noop
    }
  };

  // 内容编辑回调
  const handleContentBlur = (e) => {
    onEditContent(id, e.target.innerHTML);
  };

  // 渲染标题
  const renderTitle = () => (
    isEditing ? (
      <div style={{ padding: `0 ${12 * scale}px`, marginBottom: `${8 * scale}px` }}>
        <div style={{ ...innerWrapperPadding, backgroundColor: '#fff', borderRadius: `${4 * scale}px` }} data-field="title">
          <div
            contentEditable
            onFocus={() => handleFieldFocusInternal('title')}
            onBlur={(e) => { handleTitleBlur(e); handleFieldBlur(); }}
            suppressContentEditableWarning
            style={titleEditInnerStyle}
            spellCheck={false}
            dangerouslySetInnerHTML={{ __html: title }}
          />
        </div>
      </div>
    ) : (
      <div style={{ ...titleStyle, ...innerWrapperPadding }}>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span dangerouslySetInnerHTML={{ __html: title }} />
        </div>
      </div>
    )
  );

  // 渲染摘要
  const renderSummary = () => (
    isEditing ? (
      <div style={{ padding: `0 ${12 * scale}px`, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...innerWrapperPadding, backgroundColor: '#fff', borderRadius: `${4 * scale}px`, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} data-field="summary">
          <div
            ref={summaryEditRef}
            contentEditable
            onFocus={() => handleFieldFocusInternal('summary')}
            onBlur={(e) => { handleSummaryBlur(e); handleFieldBlur(); }}
            suppressContentEditableWarning
            style={summaryEditInnerStyle}
            spellCheck={false}
            dangerouslySetInnerHTML={{ __html: summary }}
          />
        </div>
      </div>
    ) : (
      <div style={innerWrapperPadding}>
        <div
          style={summaryStyle}
          title={String(summary || '').trim() ? String(summary).replace(/<[^>]+>/g, '') : ''}
        >
          <span dangerouslySetInnerHTML={{ __html: summary }} />
        </div>
      </div>
    )
  );

  // 渲染扩展模式内容（标题+完整内容）
  const renderExpandedContent = () => (
    isEditing ? (
      <div style={{ padding: `0 ${12 * scale}px`, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...innerWrapperPadding, backgroundColor: '#fff', borderRadius: `${4 * scale}px`, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} data-field="content">
          <div
            contentEditable
            onFocus={() => handleFieldFocusInternal('content')}
            onBlur={(e) => { handleContentBlur(e); handleFieldBlur(); }}
            suppressContentEditableWarning
            style={contentEditInnerStyle}
            spellCheck={false}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </div>
    ) : (
      <div style={{ ...innerWrapperPadding, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.2) transparent' }}>
        <div style={{ flex: '0 0 auto', fontSize: `${14 * scale}px`, color: '#4a5568', lineHeight: 1.5 }}>
          <span dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    )
  );

  // 卡片选中/编辑/预览高亮样式
  let borderColor = '#e2e8f0', boxShadow = '0 1px 3px rgba(0,0,0,0.05)', bg = '#D3DEF2';
  if (state === 'selected' || state === 'edit') {
    borderColor = '#3DADFF';
    boxShadow = '0 4px 12px rgba(49, 130, 206, 0.18)';
    bg = '#E6F4FF';
  } else if (state === 'preview') {
    borderColor = '#3DADFF';
    boxShadow = '0 4px 12px rgba(49, 130, 206, 0.15)';
    bg = '#D3DEF2';
  }

  return (
    <>
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
          backgroundColor: bg,
          border: `2px solid ${borderColor}`,
          boxShadow,
        }}
      >
        <div style={cardContentWrapper}>
          <div style={mainContentStyle}>
            {renderTitle()}
            {mode === 'normal' ? renderSummary() : renderExpandedContent()}
          </div>
          <div style={footerStyle}>
            <div style={tagStyle}>{tag}</div>
            <div style={timeStyle}>{formatUpdatedAt(updatedAt)}</div>
          </div>
        </div>
      </BaseCard>
      
      {/* 富文本工具栏 - 渲染在BaseCard外面 */}
      {isEditing && showRichToolbar && (
        <div 
          className="rich-text-toolbar"
          style={{
            position: 'fixed',
            left: `${x + 12 * scale}px`,
            top: `${y + height + 8 * scale}px`,
            zIndex: 10000,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => {
            // 标记正在点击工具栏
            isClickingToolbarRef.current = true;
            // 阻止事件冒泡，防止触发canvas的mousedown处理
            e.stopPropagation();
            console.log('[RichToolbar] mousedown on wrapper - prevented');
          }}
          onMouseUp={(e) => {
            // 阻止事件冒泡
            e.stopPropagation();
            // 延迟重置标记，确保blur事件能检测到
            setTimeout(() => {
              isClickingToolbarRef.current = false;
              console.log('[RichToolbar] mouseup - reset flag');
            }, 100);
          }}
          onClick={(e) => {
            // 阻止点击事件冒泡到canvas
            e.stopPropagation();
            console.log('[RichToolbar] click prevented from reaching canvas');
            
            // 点击后恢复焦点到活动字段
            setTimeout(() => {
              if (activeField) {
                const cardElement = document.getElementById(`card-${id}`);
                if (cardElement) {
                  const fieldWrapper = cardElement.querySelector(`[data-field="${activeField}"]`);
                  if (fieldWrapper) {
                    const editableDiv = fieldWrapper.querySelector('[contenteditable="true"]');
                    if (editableDiv) {
                      editableDiv.focus();
                      console.log('[RichToolbar] restored focus to', activeField);
                    }
                  }
                }
              }
            }, 50);
          }}
        >
          <RichTextToolbar
            scale={scale}
            onCommand={handleRichCommand}
          />
        </div>
      )}
      {/* Debug: 显示工具栏状态 */}
      {isEditing && (
        <div style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y - 20}px`,
          fontSize: '10px',
          color: 'red',
          background: 'yellow',
          padding: '2px 4px',
          zIndex: 10001,
        }}>
          Toolbar: {showRichToolbar ? 'ON' : 'OFF'} | Field: {activeField || 'none'}
        </div>
      )}
    </>
  );
});

// 移除 defaultProps 定义（关键修复）
export default TextCard;