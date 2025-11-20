import React from 'react';

const RichTextToolbar = ({ scale = 1, onCommand, style }) => {
  const [showLinkDialog, setShowLinkDialog] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const linkInputRef = React.useRef(null);
  const savedSelectionRef = React.useRef(null);

  const commands = [
    { name: 'bold', label: 'B', title: '加粗 (Ctrl+B)', style: { fontWeight: 'bold' } },
    { name: 'italic', label: 'I', title: '斜体 (Ctrl+I)', style: { fontStyle: 'italic' } },
    { name: 'underline', label: 'U', title: '下划线 (Ctrl+U)', style: { textDecoration: 'underline' } },
    { name: 'strikeThrough', label: 'S', title: '删除线', style: { textDecoration: 'line-through' } },
    { name: 'separator', label: '|', isDisabled: true },
    { name: 'createLink', label: '🔗', title: '插入链接' },
    { name: 'separator', label: '|', isDisabled: true },
    { name: 'insertUnorderedList', label: '•', title: '无序列表' },
    { name: 'insertOrderedList', label: '1.', title: '有序列表' },
    { name: 'separator', label: '|', isDisabled: true },
    { name: 'justifyLeft', label: '⇤', title: '左对齐' },
    { name: 'justifyCenter', label: '⇥', title: '居中对齐' },
    { name: 'justifyRight', label: '⇥', title: '右对齐' },
    { name: 'separator', label: '|', isDisabled: true },
    { name: 'removeFormat', label: '✕', title: '清除格式' },
  ];

  const toolbarStyle = {
    display: 'flex',
    gap: `${4 * scale}px`,
    padding: `${6 * scale}px ${8 * scale}px`,
    backgroundColor: '#ffffff',
    borderRadius: `${6 * scale}px`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #e2e8f0',
    alignItems: 'center',
    userSelect: 'none',
    ...style,
  };

  const buttonStyle = {
    padding: `${4 * scale}px ${8 * scale}px`,
    border: 'none',
    borderRadius: `${4 * scale}px`,
    backgroundColor: 'transparent',
    color: '#2d3748',
    cursor: 'pointer',
    fontSize: `${14 * scale}px`,
    transition: 'background-color 0.2s ease',
    minWidth: `${24 * scale}px`,
    height: `${24 * scale}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const separatorStyle = {
    width: '1px',
    height: `${20 * scale}px`,
    backgroundColor: '#e2e8f0',
    margin: `0 ${2 * scale}px`,
  };

  // 保存当前选区
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      savedSelectionRef.current = {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      };
      console.log('[RichTextToolbar] saved selection:', range.toString());
    }
  };

  // 恢复选区
  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      try {
        const range = document.createRange();
        range.setStart(savedSelectionRef.current.startContainer, savedSelectionRef.current.startOffset);
        range.setEnd(savedSelectionRef.current.endContainer, savedSelectionRef.current.endOffset);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        console.log('[RichTextToolbar] restored selection');
        return true;
      } catch (err) {
        console.warn('[RichTextToolbar] restore selection failed:', err);
        return false;
      }
    }
    return false;
  };

  const handleCommand = (commandName) => {
    if (commandName === 'separator') return;
    
    // 如果是创建链接命令，保存选区并显示对话框
    if (commandName === 'createLink') {
      saveSelection();
      setShowLinkDialog(true);
      // 延迟聚焦到输入框
      setTimeout(() => {
        if (linkInputRef.current) {
          linkInputRef.current.focus();
          linkInputRef.current.select();
          console.log('[RichTextToolbar] focused input');
        }
      }, 150);
      return;
    }
    
    // 执行浏览器命令
    document.execCommand(commandName, false, null);
    
    // 通知父组件
    if (onCommand) {
      onCommand(commandName);
    }
  };

  const handleCreateLink = () => {
    if (linkUrl.trim()) {
      // 先恢复选区
      const restored = restoreSelection();
      
      if (restored) {
        // 确保URL有协议
        let url = linkUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        
        // 执行创建链接命令
        document.execCommand('createLink', false, url);
        
        // 通知父组件
        if (onCommand) {
          onCommand('createLink');
        }
        
        console.log('[RichTextToolbar] link created:', url);
      } else {
        console.warn('[RichTextToolbar] could not restore selection for link');
      }
    }
    
    // 重置状态
    setShowLinkDialog(false);
    setLinkUrl('');
    savedSelectionRef.current = null;
  };

  const handleCancelLink = () => {
    setShowLinkDialog(false);
    setLinkUrl('');
    savedSelectionRef.current = null;
  };

  const handleMouseDown = (e) => {
    // 阻止默认行为，避免失去焦点
    e.preventDefault();
    // 阻止事件冒泡
    e.stopPropagation();
    console.log('[RichTextToolbar] mousedown prevented');
  };

  // 链接对话框样式
  const linkDialogStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: `${8 * scale}px`,
    padding: `${12 * scale}px`,
    backgroundColor: '#ffffff',
    borderRadius: `${6 * scale}px`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: `${8 * scale}px`,
    minWidth: `${280 * scale}px`,
    zIndex: 10001,
  };

  const linkInputStyle = {
    padding: `${6 * scale}px ${10 * scale}px`,
    border: '1px solid #cbd5e0',
    borderRadius: `${4 * scale}px`,
    fontSize: `${14 * scale}px`,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const linkButtonsStyle = {
    display: 'flex',
    gap: `${8 * scale}px`,
    justifyContent: 'flex-end',
  };

  const linkButtonStyle = {
    padding: `${6 * scale}px ${12 * scale}px`,
    border: 'none',
    borderRadius: `${4 * scale}px`,
    fontSize: `${13 * scale}px`,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  };

  return (
    <div 
      className="rich-text-toolbar"
      style={{ ...toolbarStyle, position: 'relative' }} 
      onMouseDown={handleMouseDown}
    >
      {commands.map((cmd, index) => {
        if (cmd.name === 'separator') {
          return <div key={`sep-${index}`} style={separatorStyle} />;
        }

        return (
          <button
            key={cmd.name}
            style={{ ...buttonStyle, ...cmd.style }}
            onClick={() => handleCommand(cmd.name)}
            title={cmd.title}
            disabled={cmd.isDisabled}
          >
            {cmd.label}
          </button>
        );
      })}
      
      {/* 链接输入对话框 */}
      {showLinkDialog && (
        <div 
          style={linkDialogStyle}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <input
            ref={linkInputRef}
            type="text"
            placeholder="输入链接 URL (例: example.com)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onMouseDown={(e) => {
              // 允许输入框接收焦点
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelLink();
              }
            }}
            style={linkInputStyle}
          />
          <div style={linkButtonsStyle}>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleCancelLink();
              }}
              style={{
                ...linkButtonStyle,
                backgroundColor: '#e2e8f0',
                color: '#2d3748',
              }}
            >
              取消
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleCreateLink();
              }}
              style={{
                ...linkButtonStyle,
                backgroundColor: '#3182ce',
                color: '#ffffff',
              }}
            >
              插入
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextToolbar;
