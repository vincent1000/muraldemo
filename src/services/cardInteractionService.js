// src/services/cardInteractionService.js
// 卡片交互逻辑服务：管理卡片的点击、双击、拖拽、粘贴等操作

import { v4 as uuidv4 } from 'uuid';
import { addWidget } from './dataService';

// -------------------------- 坐标转换工具 --------------------------
/**
 * 视图坐标转逻辑坐标
 */
export function viewToLogic(viewX, viewY, canvasState) {
  return {
    x: (viewX + canvasState.offsetX) / canvasState.scale,
    y: (viewY + canvasState.offsetY) / canvasState.scale
  };
}

/**
 * 逻辑坐标转视图坐标
 */
export function logicToView(logicX, logicY, canvasState) {
  return {
    x: (logicX * canvasState.scale) - canvasState.offsetX,
    y: (logicY * canvasState.scale) - canvasState.offsetY
  };
}

// -------------------------- 卡片点击处理 --------------------------
/**
 * 处理卡片单击
 */
export function handleCardClick(cardId, cards, setCards, setState, setToolbarVisible) {
  setCards(prev => prev.map(card => {
    const isSelected = card.id === cardId;
    // ImageCard 不需要 state 属性
    if (card.type === 'image') {
      return { ...card, isSelected };
    }
    // TextCard 需要 state
    return { 
      ...card, 
      state: isSelected ? 'preview' : 'normal',
      isSelected 
    };
  }));
  setState(prev => ({ ...prev, selectedCardId: cardId }));
  setToolbarVisible(true);
}

/**
 * 处理卡片双击（展开/收起）
 */
export function handleCardDoubleClick(cardId, setCards, setState, setToolbarVisible) {
  setCards(prev => prev.map(card => {
    if (card.id === cardId && card.mode === 'normal') {
      // ImageCard: 560x560 -> 953x953
      if (card.type === 'image') {
        return {
          ...card,
          mode: 'expanded',
          isSelected: true,
          width: 953,
          height: 953,
          originalHeight: card.originalHeight || 560,
        };
      }
      // TextCard: 仅高度变化
      return {
        ...card,
        mode: 'expanded',
        state: 'preview',
        isSelected: true,
        height: 400,
        originalHeight: card.originalHeight || card.height,
      };
    }
    // 其他卡片取消选中
    if (card.type === 'image') {
      return { ...card, isSelected: false };
    }
    return { ...card, isSelected: false, state: 'normal' };
  }));
  setState(prev => ({ ...prev, selectedCardId: cardId }));
  setToolbarVisible(true);
}

/**
 * 处理画布点击（取消选中）
 */
export function handleCanvasClick(e, didPanRef, didDragRef, setCards, setState, setToolbarVisible) {
  // 如果刚发生了平移或拖拽，则忽略本次 click
  if (didPanRef.current || didDragRef.current) return;
  
  // 检查是否点击了卡片
  const clickedCard = e.target.closest('[id^="card-"]');
  if (clickedCard) return;
  
  // 检查是否点击了工具栏
  const clickedToolbar = e.target.closest('.rich-text-toolbar') || 
                        e.target.closest('[class*="CardToolbar"]');
  if (clickedToolbar) {
    console.log('[cardInteraction] clicked toolbar, ignoring canvas click');
    return;
  }
  
  // 仅在点击空白区域时清除选中状态
  setCards(prev => prev.map(card => ({ ...card, isSelected: false, state: 'normal' })));
  setState(prev => ({ ...prev, selectedCardId: null }));
  setToolbarVisible(false);
}

// -------------------------- 卡片编辑处理 --------------------------
/**
 * 保存历史记录
 */
export function saveHistory(cardId, currentState, setCards) {
  setCards(prev => prev.map(card => {
    if (card.id !== cardId) return card;
    const newHistory = [...card.history, { ...currentState }];
    if (newHistory.length > 20) newHistory.shift();
    return { ...card, history: newHistory };
  }));
}

/**
 * 撤销操作
 */
export function handleUndo(cardId, setCards) {
  setCards(prev => prev.map(card => {
    if (card.id !== cardId || card.history.length === 0) return card;
    const newHistory = [...card.history];
    const lastState = newHistory.pop();
    return { ...lastState, history: newHistory };
  }));
}

/**
 * 切换卡片模式（normal/expanded）
 */
export function handleToggleCardMode(cardId, setCards) {
  setCards(prev => prev.map(card => {
    if (card.id === cardId) {
      const isExpanding = card.mode === 'normal';
      
      // ImageCard: 560x560 <-> 953x953
      if (card.type === 'image') {
        return {
          ...card,
          mode: isExpanding ? 'expanded' : 'normal',
          width: isExpanding ? 953 : 560,
          height: isExpanding ? 953 : 560,
          originalHeight: card.originalHeight || 560,
        };
      }
      
      // TextCard: 仅高度变化
      return {
        ...card,
        mode: isExpanding ? 'expanded' : 'normal',
        height: isExpanding ? 400 : (card.originalHeight || 256),
        originalHeight: card.originalHeight || card.height,
      };
    }
    return card;
  }));
}

/**
 * 切换编辑模式
 */
export function toggleEditMode(cardId, setCards, saveHistoryFn, lastFocusedFieldRef, savedSelectionRef) {
  setCards(prev => prev.map(card => {
    if (card.id === cardId) {
      const newState = card.state === 'edit' ? 'preview' : 'edit';
      if (newState === 'edit') {
        saveHistoryFn(cardId, card);
      } else {
        // 退出编辑模式时清除焦点和选区信息
        if (lastFocusedFieldRef) lastFocusedFieldRef.current = null;
        if (savedSelectionRef) savedSelectionRef.current = null;
      }
      return { ...card, state: newState };
    }
    return card;
  }));
}

/**
 * 删除卡片
 */
export async function handleDeleteCard(cardId, setCards, setState, setToolbarVisible) {
  // 先更新前端 UI
  setCards(prev => prev.filter(card => card.id !== cardId));
  setState(prev => ({ ...prev, selectedCardId: null }));
  setToolbarVisible(false);
  
  // 静默同步到 dataService（更新内部 state 并通知后端，但不触发前端回调避免重复渲染）
  try {
    const { deleteWidget } = await import('./dataService');
    await deleteWidget(cardId, true); // silent = true
    console.log('[cardInteraction] 删除卡片已静默同步到 dataService 和后端:', cardId);
  } catch (err) {
    console.warn('[cardInteraction] 同步删除失败:', err);
  }
}

/**
 * 更新图片
 */
export function handleUpdateImage(cardId, newImageUrl, setCards, saveHistoryFn) {
  setCards(prev => prev.map(card => {
    if (card.id === cardId && card.type === 'image') {
      saveHistoryFn(cardId, card);
      return {
        ...card,
        imageUrl: newImageUrl,
        updatedAt: new Date().toISOString(),
      };
    }
    return card;
  }));
}

/**
 * 编辑标题
 */
export function handleEditTitle(cardId, newTitle, setCards, saveHistoryFn) {
  setCards(prev => prev.map(card => {
    if (card.id === cardId) {
      saveHistoryFn(cardId, card);
      const updatedCard = { ...card, title: newTitle, updatedAt: new Date().toISOString() };
      
      // 同步到后端（异步）
      (async () => {
        try {
          const { updateWidget } = await import('./dataService');
          await updateWidget(cardId, { title: newTitle, updatedAt: updatedCard.updatedAt });
          console.log('[cardInteraction] 标题编辑已同步到后端:', cardId);
        } catch (err) {
          console.warn('[cardInteraction] 同步标题到后端失败:', err);
        }
      })();
      
      return updatedCard;
    }
    return card;
  }));
}

/**
 * 编辑摘要
 */
export function handleEditSummary(cardId, newSummary, setCards, saveHistoryFn) {
  setCards(prev => prev.map(card => {
    if (card.id === cardId) {
      saveHistoryFn(cardId, card);
      const updatedCard = { ...card, summary: newSummary, updatedAt: new Date().toISOString() };
      
      // 同步到后端（异步）
      (async () => {
        try {
          const { updateWidget } = await import('./dataService');
          await updateWidget(cardId, { summary: newSummary, updatedAt: updatedCard.updatedAt });
          console.log('[cardInteraction] 摘要编辑已同步到后端:', cardId);
        } catch (err) {
          console.warn('[cardInteraction] 同步摘要到后端失败:', err);
        }
      })();
      
      return updatedCard;
    }
    return card;
  }));
}

/**
 * 编辑内容
 */
export function handleEditCardContent(cardId, newContent, setCards, saveHistoryFn) {
  setCards(prev => prev.map(card => {
    if (card.id === cardId) {
      saveHistoryFn(cardId, card);
      const updatedCard = { ...card, content: newContent, updatedAt: new Date().toISOString() };
      
      // 同步到后端（异步）
      (async () => {
        try {
          const { updateWidget } = await import('./dataService');
          await updateWidget(cardId, { content: newContent, updatedAt: updatedCard.updatedAt });
          console.log('[cardInteraction] 内容编辑已同步到后端:', cardId);
        } catch (err) {
          console.warn('[cardInteraction] 同步内容到后端失败:', err);
        }
      })();
      
      return updatedCard;
    }
    return card;
  }));
}

// -------------------------- 粘贴处理 --------------------------
/**
 * 处理剪贴板粘贴
 */
export async function handleClipboardPaste(e, cards, canvasRef, canvasState, viewToLogicFn, setCards, setErrorMsg) {
  // 如果当前有卡片处于编辑模式,不处理画布级别的粘贴
  const editingCard = cards.find(c => c.state === 'edit');
  if (editingCard) return;

  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) {
    setErrorMsg('Browser does not support clipboard operations');
    setTimeout(() => setErrorMsg(''), 3000);
    return;
  }

  try {
    const items = clipboardData.items;
    let hasImage = false;
    let hasText = false;
    let imageData = null;
    let textData = '';

    // 检查所有项目，收集图片和文本
    if (items && items.length) {
      // 先检查是否有图片文件
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile && item.getAsFile();
          if (blob) {
            hasImage = true;
            imageData = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            console.log('[paste] Found image file:', imageData?.substring(0, 50));
            break;
          }
        }
      }

      // 获取文本数据
      const plainText = clipboardData.getData('text/plain') || '';
      const htmlData = clipboardData.getData('text/html') || '';
      
      if (plainText && plainText.trim()) {
        hasText = true;
        textData = plainText.trim();
        console.log('[paste] Found plain text:', textData.substring(0, 50));
      }

      // 检查 HTML 中是否包含图片
      if (!hasImage && htmlData && htmlData.includes('<img')) {
        console.log('[paste] Found <img> in HTML, extracting image src');
        const imgMatch = htmlData.match(/<img[^>]+src="([^"]+)"/i);
        if (imgMatch && imgMatch[1]) {
          hasImage = true;
          imageData = imgMatch[1];
          console.log('[paste] Extracted image from HTML:', imageData.substring(0, 50));
        }
      }
    }

    // 如果既没有图片也没有文本
    if (!hasImage && !hasText) {
      setErrorMsg('No valid content in clipboard');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    // 计算粘贴位置（画布中心）
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const centerViewX = rect.width / 2;
    const centerViewY = rect.height / 2;
    const logicPos = viewToLogicFn(centerViewX, centerViewY);

    // 创建新卡片
    let newCard = null;
    if (hasImage && hasText) {
      // 图文混合：创建包含图片的 TextCard
      const imageHtml = `<img src="${imageData}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" alt="Pasted image" />`;
      const summaryText = textData.substring(0, 100);
      const contentHtml = `${textData}<br>${imageHtml}`;
      
      console.log('[paste] Mixed content:', { textData, imageData: imageData?.substring(0, 50), summaryText, contentHtml: contentHtml.substring(0, 100) });
      
      newCard = {
        id: uuidv4(),
        type: 'text',
        x: logicPos.x - 280,
        y: logicPos.y - 128,
        width: 560,
        height: 256,
        originalHeight: 256,
        isSelected: false,
        mode: 'normal',
        state: 'normal',
        title: 'Pasted Content',
        summary: summaryText,
        content: contentHtml,
        tag: 'Mixed',
        updatedAt: new Date().toISOString(),
        history: [],
      };
      setCards(prev => [...prev, newCard]);
    } else if (hasImage && !hasText) {
      // 纯图片：创建 ImageCard
      newCard = {
        id: uuidv4(),
        type: 'image',
        x: logicPos.x - 280,
        y: logicPos.y - 280,
        width: 560,
        height: 560,
        originalHeight: 560,
        isSelected: false,
        mode: 'normal',
        imageUrl: imageData,
        tag: 'Image',
        updatedAt: new Date().toISOString(),
        history: [],
      };
      setCards(prev => [...prev, newCard]);
    } else if (hasText && !hasImage) {
      // 纯文本：创建 TextCard
      newCard = {
        id: uuidv4(),
        type: 'text',
        x: logicPos.x - 280,
        y: logicPos.y - 128,
        width: 560,
        height: 256,
        originalHeight: 256,
        isSelected: false,
        mode: 'normal',
        state: 'normal',
        title: 'Pasted Content',
        summary: textData.substring(0, 100).replace(/<[^>]*>/g, ''),
        content: textData,
        tag: 'Text',
        updatedAt: new Date().toISOString(),
        history: [],
      };
      setCards(prev => [...prev, newCard]);
    }
    
    // 同步到 dataService
    if (newCard) {
      try {
        await addWidget(newCard);
        console.log('[cardInteraction] 粘贴卡片已同步到 dataService:', newCard.id);
      } catch (err) {
        console.warn('[cardInteraction] 同步粘贴卡片到 dataService 失败:', err);
      }
    }
  } catch (err) {
    setErrorMsg('Paste failed: ' + (err?.message || err));
    setTimeout(() => setErrorMsg(''), 3000);
  }
}

// -------------------------- 新建卡片 --------------------------
/**
 * 新建文字卡片
 */
export async function createNewTextCard(canvasRef, canvasState, setCards) {
  const canvasEl = canvasRef.current;
  if (!canvasEl) return;
  const rect = canvasEl.getBoundingClientRect();
  const centerViewX = rect.width / 2;
  const centerViewY = rect.height / 2;
  const centerLogicX = (centerViewX + canvasState.offsetX) / canvasState.scale;
  const centerLogicY = (centerViewY + canvasState.offsetY) / canvasState.scale;
  
  const newCard = {
    id: uuidv4(),
    type: 'text',
    x: centerLogicX - 280,
    y: centerLogicY - 128,
    width: 560,
    height: 256,
    originalHeight: 256,
    isSelected: false,
    mode: 'normal',
    state: 'normal',
    title: 'New Card',
    summary: 'This is a new text card',
    content: 'Supports rich text editing',
    tag: 'New',
    updatedAt: new Date().toISOString(),
    history: [],
  };
  
  setCards(prev => [...prev, newCard]);
  
  // 同步到 dataService
  try {
    await addWidget(newCard);
    console.log('[cardInteraction] 新建文字卡片已同步到 dataService:', newCard.id);
  } catch (err) {
    console.warn('[cardInteraction] 同步新卡片到 dataService 失败:', err);
  }
}

/**
 * 新建图片卡片
 */
export async function createNewImageCard(canvasRef, canvasState, setCards) {
  const canvasEl = canvasRef.current;
  if (!canvasEl) return;
  const rect = canvasEl.getBoundingClientRect();
  const centerViewX = rect.width / 2;
  const centerViewY = rect.height / 2;
  const centerLogicX = (centerViewX + canvasState.offsetX) / canvasState.scale;
  const centerLogicY = (centerViewY + canvasState.offsetY) / canvasState.scale;
  
  const newCard = {
    id: uuidv4(),
    type: 'image',
    x: centerLogicX - 280,
    y: centerLogicY - 280,
    width: 560,
    height: 560,
    originalHeight: 560,
    isSelected: false,
    mode: 'normal',
    imageUrl: `https://picsum.photos/seed/${Date.now()}/560/560`,
    tag: 'Image',
    updatedAt: new Date().toISOString(),
    history: [],
  };
  
  setCards(prev => [...prev, newCard]);
  
  // 同步到 dataService
  try {
    await addWidget(newCard);
    console.log('[cardInteraction] 新建图片卡片已同步到 dataService:', newCard.id);
  } catch (err) {
    console.warn('[cardInteraction] 同步新卡片到 dataService 失败:', err);
  }
}
