// src/services/textEditService.js
// 文本编辑服务：处理富文本编辑、颜色应用、选区管理等

// -------------------------- 选区管理 --------------------------
/**
 * 保存当前选区
 */
export function saveSelection(savedSelectionRef) {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    savedSelectionRef.current = null;
    return;
  }
  
  const range = selection.getRangeAt(0);
  if (range.collapsed || !range.toString().trim()) {
    savedSelectionRef.current = null;
    return;
  }
  
  // 保存选区信息
  savedSelectionRef.current = {
    startContainer: range.startContainer,
    startOffset: range.startOffset,
    endContainer: range.endContainer,
    endOffset: range.endOffset,
    text: range.toString()
  };
  console.log('[textEdit] saved selection:', savedSelectionRef.current.text);
}

// -------------------------- 颜色应用 --------------------------
/**
 * 应用颜色到选中文本（如果有选区）或整个字段
 */
export function applyColorToSelection(fieldElement, color, savedSelectionRef) {
  if (!fieldElement) return null;
  
  // 尝试恢复选区
  let range = null;
  if (savedSelectionRef.current) {
    try {
      const { startContainer, startOffset, endContainer, endOffset } = savedSelectionRef.current;
      range = document.createRange();
      range.setStart(startContainer, startOffset);
      range.setEnd(endContainer, endOffset);
      
      // 验证range是否仍然有效
      if (!fieldElement.contains(range.commonAncestorContainer)) {
        range = null;
      }
    } catch (err) {
      console.warn('[textEdit] restore selection failed', err);
      range = null;
    }
  }
  
  // 如果没有保存的选区，尝试使用当前选区
  if (!range) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    range = selection.getRangeAt(0);
    
    // 检查选区是否在目标字段内
    if (!fieldElement.contains(range.commonAncestorContainer)) return null;
  }
  
  // 如果有选中文本，只对选中部分应用颜色
  if (!range.collapsed && range.toString().trim()) {
    try {
      // 将选中内容提取到临时容器
      const contents = range.extractContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(contents);
      
      // 递归清理选中内容中的旧颜色样式
      const cleanColorStyles = (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'SPAN' && node.style.color) {
            // 移除颜色样式，保留其他样式
            node.style.removeProperty('color');
            
            // 如果没有其他样式了，移除整个 style 属性
            if (!node.getAttribute('style') || node.getAttribute('style').trim() === '') {
              node.removeAttribute('style');
            }
            
            // 如果 span 没有任何属性了，用其内容替换它
            if (!node.attributes.length) {
              const fragment = document.createDocumentFragment();
              while (node.firstChild) {
                fragment.appendChild(node.firstChild);
              }
              node.parentNode.replaceChild(fragment, node);
              return;
            }
          }
          
          // 递归处理子节点
          const children = Array.from(node.childNodes);
          children.forEach(child => cleanColorStyles(child));
        }
      };
      
      // 清理临时容器中的颜色样式
      Array.from(tempDiv.childNodes).forEach(child => cleanColorStyles(child));
      
      // 创建包含新颜色样式的 span
      const span = document.createElement('span');
      span.style.color = color;
      
      // 将清理后的内容放入新 span
      while (tempDiv.firstChild) {
        span.appendChild(tempDiv.firstChild);
      }
      
      // 插入新的带颜色的 span
      range.insertNode(span);
      
      // 清除选区并将光标移到新插入内容的末尾
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      newRange.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      // 清除保存的选区
      savedSelectionRef.current = null;
      
      return fieldElement.innerHTML;
    } catch (err) {
      console.warn('[textEdit] apply color to selection failed', err);
      return null;
    }
  }
  
  // 没有选中文本，返回 null 表示需要应用到整个字段
  return null;
}

/**
 * 应用颜色到整个文本，智能处理已有颜色标签
 */
export function applyColorToText(text, color) {
  if (!text) return text;
  
  // 创建临时 DOM 来解析和处理 HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = text;
  
  // 递归处理所有节点，移除或更新颜色样式
  const processNode = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      // 如果是 span 标签且有 style 属性
      if (node.tagName === 'SPAN' && node.style.color) {
        // 移除颜色样式，保留其他样式
        node.style.removeProperty('color');
        
        // 如果没有其他样式了，移除整个 style 属性
        if (!node.getAttribute('style') || node.getAttribute('style').trim() === '') {
          node.removeAttribute('style');
        }
        
        // 如果 span 没有任何属性了，用其内容替换它
        if (!node.attributes.length) {
          const fragment = document.createDocumentFragment();
          while (node.firstChild) {
            fragment.appendChild(node.firstChild);
          }
          node.parentNode.replaceChild(fragment, node);
          return;
        }
      }
      
      // 递归处理子节点
      const children = Array.from(node.childNodes);
      children.forEach(child => processNode(child));
    }
  };
  
  // 处理所有子节点
  Array.from(tempDiv.childNodes).forEach(child => processNode(child));
  
  // 获取清理后的 HTML
  const cleanText = tempDiv.innerHTML;
  
  // 应用新颜色
  return `<span style="color: ${color}">${cleanText}</span>`;
}

/**
 * 处理颜色变化（主入口）
 */
export function handleColorChange(
  cardId, 
  color, 
  cards, 
  setCards, 
  saveHistoryFn, 
  lastFocusedFieldRef, 
  savedSelectionRef
) {
  // 检查卡片是否处于编辑模式
  const targetCard = cards.find(c => c.id === cardId);
  if (!targetCard || targetCard.state !== 'edit') {
    console.log('[textEdit] color change ignored: card not in edit mode');
    return;
  }
  
  // 保存当前选区（在点击工具栏按钮前可能已经失去焦点）
  saveSelection(savedSelectionRef);
  
  // 先尝试对选中文本应用颜色
  const activeElement = document.activeElement;
  let fieldElement = null;
  let field = null;
  
  if (activeElement && activeElement.contentEditable === 'true') {
    const editableParent = activeElement.closest('[data-field]');
    if (editableParent) {
      field = editableParent.getAttribute('data-field');
      // 查找实际的 contentEditable div
      fieldElement = editableParent.querySelector('[contenteditable="true"]');
    }
  }
  
  // 如果没有焦点，使用上次记录的焦点字段
  if (!field && lastFocusedFieldRef.current) {
    field = lastFocusedFieldRef.current;
    // 尝试查找对应的编辑元素
    const cardElement = document.getElementById(`card-${cardId}`);
    if (cardElement) {
      const fieldWrapper = cardElement.querySelector(`[data-field="${field}"]`);
      if (fieldWrapper) {
        fieldElement = fieldWrapper.querySelector('[contenteditable="true"]');
      }
    }
  }
  
  // 尝试应用到选中文本
  let newContent = null;
  if (fieldElement) {
    newContent = applyColorToSelection(fieldElement, color, savedSelectionRef);
  }
  
  setCards(prev => prev.map(card => {
    if (card.id === cardId) {
      saveHistoryFn(cardId, card);
      
      let updatedCard = { ...card };
      
      // 如果成功应用到选中文本，更新对应字段
      if (newContent !== null && field) {
        if (field === 'title') {
          updatedCard = { ...card, title: newContent, updatedAt: new Date().toISOString() };
        } else if (field === 'summary') {
          updatedCard = { ...card, summary: newContent, updatedAt: new Date().toISOString() };
        } else if (field === 'content') {
          updatedCard = { ...card, content: newContent, updatedAt: new Date().toISOString() };
        }
      } else if (field === 'title') {
        // 否则应用到整个字段
        updatedCard = { ...card, title: applyColorToText(card.title, color), updatedAt: new Date().toISOString() };
      } else if (field === 'summary') {
        updatedCard = { ...card, summary: applyColorToText(card.summary, color), updatedAt: new Date().toISOString() };
      } else if (field === 'content') {
        updatedCard = { ...card, content: applyColorToText(card.content, color), updatedAt: new Date().toISOString() };
      } else if (card.mode === 'normal') {
        // 如果都没有，根据模式决定
        // normal模式：同时改变title和summary
        updatedCard = {
          ...card,
          title: applyColorToText(card.title, color),
          summary: applyColorToText(card.summary, color),
          updatedAt: new Date().toISOString(),
        };
      } else {
        // expanded模式：改变content
        updatedCard = {
          ...card,
          content: applyColorToText(card.content, color),
          updatedAt: new Date().toISOString(),
        };
      }
      
      // 同步到后端（异步，不阻塞UI）
      (async () => {
        try {
          const { updateWidget } = await import('./dataService');
          // 只同步变更的字段
          const updates = {};
          if (updatedCard.title !== card.title) updates.title = updatedCard.title;
          if (updatedCard.summary !== card.summary) updates.summary = updatedCard.summary;
          if (updatedCard.content !== card.content) updates.content = updatedCard.content;
          if (updatedCard.updatedAt) updates.updatedAt = updatedCard.updatedAt;
          
          if (Object.keys(updates).length > 0) {
            await updateWidget(cardId, updates);
            console.log('[textEdit] 颜色变化已同步到后端:', cardId, updates);
          }
        } catch (err) {
          console.warn('[textEdit] 同步颜色变化到后端失败:', err);
        }
      })();
      
      return updatedCard;
    }
    return card;
  }));
}
