import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import TextCard from './TextCard';
import ImageCard from './ImageCard';
import CardToolbar from './CardToolbar';
import DebugPanel from './DebugPanel';
import BottomActionBar from './BottomActionBar';
import { 
  initCanvasService, 
  destroyCanvasService, 
  sendControlClickEvent,
  subscribeToCanvasState 
} from '../services/dataService';
import {
  handleCardClick as cardClickHandler,
  handleCardDoubleClick as cardDoubleClickHandler,
  handleCanvasClick as canvasClickHandler,
  handleDeleteCard as deleteCardHandler,
  handleUndo as undoHandler,
  handleToggleCardMode as toggleCardModeHandler,
  toggleEditMode as toggleEditModeHandler,
  handleUpdateImage as updateImageHandler,
  handleEditTitle as editTitleHandler,
  handleEditSummary as editSummaryHandler,
  handleEditCardContent as editCardContentHandler,
  handleClipboardPaste as clipboardPasteHandler,
  createNewTextCard,
  createNewImageCard,
  saveHistory as saveHistoryUtil
} from '../services/cardInteractionService';
import {
  saveSelection,
  handleColorChange as colorChangeHandler
} from '../services/textEditService';

const MuralDemo = () => {
  // 画布状态管理（整合缩放和平移核心逻辑）
  const [canvasState, setState] = useState({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    isDragging: false,      // 卡片拖拽状态
    isPanning: false,       // 画布平移状态
    lastX: 0,
    lastY: 0,
    selectedCardId: null,   // 当前选中卡片ID
  });

  const [cards, setCards] = useState([
    {
      id: uuidv4(),
      type: 'text',
      x: 200,
      y: 200,
      width: 560,
      height: 256,
      originalHeight: 256, // Save original height
      isSelected: false,
      mode: 'normal',
      state: 'normal',
      title: 'Welcome to Mural',
      summary: 'Scroll Wheel → Zoom at cursor | Drag canvas → Pan | Click → Preview | Double-click → Expand',
      content: '<strong>Rich text example</strong><br><br>Supports bold, line breaks, italic and more',
      tag: 'Demo',
      updatedAt: new Date().toISOString(),
      history: [],
    },
  ]);

  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const cardRefs = useRef({});
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);

  // 交互 refs（避免闭包问题）
  const isDraggingRef = useRef(false); // 拖动卡片
  const isPanningRef = useRef(false); // 平移画布
  const selectedCardRef = useRef(null); // 被拖动卡片 id
  const lastPosRef = useRef({ x: 0, y: 0 }); // 上一次鼠标位置（用于卡片拖拽，视图坐标）
  const lastPanRef = useRef({ x: 0, y: 0 }); // 上一次鼠标位置（用于平移，视图坐标）
  const isInitializedRef = useRef(false); // 标记是否已初始化过（避免重复设置 offset）
  const scaleTimeoutRef = useRef(null);
  const selectedIdRef = useRef(canvasState.selectedCardId);
  const isZoomingRef = useRef(false);

  useEffect(() => {
    selectedIdRef.current = canvasState.selectedCardId;
  }, [canvasState.selectedCardId]);

  // 同步用于事件处理的变换快照，避免在频繁事件中读取过时 state

  const transformRef = useRef({ offsetX: canvasState.offsetX, offsetY: canvasState.offsetY, scale: canvasState.scale });
  useEffect(() => {
    transformRef.current.offsetX = canvasState.offsetX;
    transformRef.current.offsetY = canvasState.offsetY;
    transformRef.current.scale = canvasState.scale;
  }, [canvasState.offsetX, canvasState.offsetY, canvasState.scale]);

  // 坐标转换：视图坐标 → 逻辑坐标（与 CanvasEditor 保持一致）
  const viewToLogic = useCallback((viewX, viewY) => ({
    x: (viewX + canvasState.offsetX) / canvasState.scale,
    y: (viewY + canvasState.offsetY) / canvasState.scale
  }), [canvasState.offsetX, canvasState.offsetY, canvasState.scale]);

  // 坐标转换：逻辑坐标 → 视图坐标（与 CanvasEditor 保持一致）
  const logicToView = useCallback((logicX, logicY) => ({
    x: (logicX * canvasState.scale) - canvasState.offsetX,
    y: (logicY * canvasState.scale) - canvasState.offsetY
  }), [canvasState.scale, canvasState.offsetX, canvasState.offsetY]);

  // 鼠标中心缩放实现
const handleWheel = useCallback((e) => {
  e.preventDefault();
  if (!canvasRef.current) return;

  // 计算此次 wheel 是否会实际改变 scale（若已到达 min/max 就不认为是缩放）
  const currentScale = transformRef.current.scale || canvasState.scale || 1;
  const willZoomIn = e.deltaY < 0;
  const candidateNewScale = willZoomIn ? Math.min(currentScale * 1.1, 5) : Math.max(currentScale / 1.1, 0.1);
  const scaleWillChange = Math.abs(candidateNewScale - currentScale) > 1e-6;

  if (scaleWillChange) {
    // 标记正在缩放，隐藏工具栏并在缩放停止后恢复（防抖）
    isZoomingRef.current = true;
    setToolbarVisible(false);
    if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
    scaleTimeoutRef.current = setTimeout(() => {
      isZoomingRef.current = false;
      // 仅在有选中卡片且未在拖拽/平移时恢复显示
      if (selectedIdRef.current && !isDraggingRef.current && !isPanningRef.current) {
        setToolbarVisible(true);
        // 清除上一次测量结果使 useLayoutEffect 在工具栏挂载时重新测量
        setToolbarPos(null);
      }
      scaleTimeoutRef.current = null;
    }, 250);
  }

  // 下面的 setState 保持不变：计算 newScale/newOffset 并更新 state（即便 scale 未变化，这里也是 safe 的）
  const rect = canvasRef.current.getBoundingClientRect();
  const viewX = e.clientX - rect.left;
  const viewY = e.clientY - rect.top;
  const logicPos = viewToLogic(viewX, viewY);

  setState(prev => {
    const newScale = e.deltaY < 0
      ? Math.min(prev.scale * 1.1, 5)
      : Math.max(prev.scale / 1.1, 0.1);

    const newOffsetX = (logicPos.x * newScale) - viewX;
    const newOffsetY = (logicPos.y * newScale) - viewY;

    return { ...prev, scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
  });
}, [viewToLogic]);
  // 开始画布平移 / 卡片拖拽（DOM 卡片实现）
  const handleCanvasMouseDown = useCallback((e) => {
    // 如果点击到卡片元素（id 前缀 card-），不要触发画布平移
    const clickedCard = e.target.closest('[id^="card-"]');
    if (clickedCard) return;

    // 开始平移：保留当前卡片的选中样式，但在平移期间隐藏工具栏
    isPanningRef.current = true;
    lastPanRef.current = { x: e.clientX, y: e.clientY };
    setState(prev => ({ ...prev, isPanning: true, isDragging: false, lastX: e.clientX, lastY: e.clientY }));
    setToolbarVisible(false);
    console.log('[mural] canvas mousedown start panning client', { x: e.clientX, y: e.clientY }, 'offset', { x: canvasState.offsetX, y: canvasState.offsetY });
  }, []);

  // 鼠标移动处理（与 CanvasEditor 保持一致）
  const handleMouseMove = (e) => {
    if (isDraggingRef.current && selectedCardRef.current) {
      // 使用 refs 保证读到最新的上次位置
      const last = lastPosRef.current;
      const deltaX = e.clientX - last.x;
      const deltaY = e.clientY - last.y;
      const scale = transformRef.current.scale || 1;
      const deltaLogicX = deltaX / scale;
      const deltaLogicY = deltaY / scale;

      // 拖拽开始：隐藏工具栏（首次执行会将 toolbarVisible 设为 false）
      if (toolbarVisibleRef.current) setToolbarVisible(false);
      // 标记已发生拖拽（用于 click 处理逻辑）
      didDragRef.current = true;
      console.log('[mural] dragging card', selectedCardRef.current, 'deltaView', deltaX, deltaY, 'scale', scale, 'deltaLogic', deltaLogicX.toFixed(3), deltaLogicY.toFixed(3));
      setCards(prev => prev.map(card => {
        if (card.id === selectedCardRef.current) {
          const newX = card.x + deltaLogicX;
          const newY = card.y + deltaLogicY;
          console.log('[mural] card move', card.id, 'from', card.x.toFixed(3), card.y.toFixed(3), 'to', newX.toFixed(3), newY.toFixed(3));
          return { ...card, x: newX, y: newY };
        }
        return card;
      }));

      // 更新 last pos refs & state
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      setState(prev => ({ ...prev, lastX: e.clientX, lastY: e.clientY }));
    } else if (isPanningRef.current) {
      // 平移开始：隐藏工具栏（首次执行会将 toolbarVisible 设为 false）
      if (toolbarVisibleRef.current) setToolbarVisible(false);
      // 标记已发生平移（用于 click 处理逻辑）
      didPanRef.current = true;
      const last = lastPanRef.current;
      const deltaX = e.clientX - last.x;
      const deltaY = e.clientY - last.y;
      console.log('[mural] panning view deltaView', deltaX, deltaY);

      // 更新 ref
      lastPanRef.current = { x: e.clientX, y: e.clientY };

      setState(prev => {
        const newOffsetX = prev.offsetX - deltaX;
        const newOffsetY = prev.offsetY - deltaY;
        console.log('[mural] setState panning prevOffset', { offsetX: prev.offsetX, offsetY: prev.offsetY }, 'newOffset', { offsetX: newOffsetX, offsetY: newOffsetY });
        return {
          ...prev,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
          lastX: e.clientX,
          lastY: e.clientY
        };
      });
    }
  };

  const handleMouseUp = (e) => {
    const wasDragging = isDraggingRef.current;
    const wasPanning = isPanningRef.current;

    if (wasDragging) {
      console.log('[mural] mouseup after dragging, card:', selectedCardRef.current);
    }
    // output current card positions for debugging
    const currentCard = selectedCardRef.current ? cards.find(c => c.id === selectedCardRef.current) : null;
    console.log('[mural] mouseup currentCard (from state):', currentCard ? { id: currentCard.id, x: currentCard.x, y: currentCard.y } : null);

    // 清理 refs（selectedCardId 保持，cards 中的 isSelected 保留）
    isDraggingRef.current = false;
    isPanningRef.current = false;
    selectedCardRef.current = null;
    lastPosRef.current = { x: 0, y: 0 };
    lastPanRef.current = { x: 0, y: 0 };

    setState(prev => ({ ...prev, isDragging: false, isPanning: false }));

    // 如果刚结束拖拽或平移，且当前存在选中的卡片，则恢复工具栏显示（如果未在缩放中）
    if (!isZoomingRef.current && (wasDragging || wasPanning) && selectedIdRef.current) {
      setToolbarVisible(true);
      setToolbarPos(null);
    }

    // 在 mouseup 后短时间内保留 didPan/didDrag 标记以便 click 事件检测
    setTimeout(() => {
      didPanRef.current = false;
      didDragRef.current = false;
    }, 0);
  };

  const handleCardMouseDown = (card, e) => {
    // 编辑模式下：不启动拖拽，允许文本编辑/选择
    if (card.state === 'edit') {
      // 不阻止事件冒泡和默认行为，让编辑框正常工作
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    // 开始准备拖拽：无论之前是否选中，都将该卡片标记为选中样式
    isDraggingRef.current = true;
    selectedCardRef.current = card.id;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setState(prev => ({ ...prev, isDragging: true, selectedCardId: card.id, lastX: e.clientX, lastY: e.clientY }));
    setCards(prev => prev.map(c => {
      if (c.id === card.id) return { ...c, isSelected: true, state: 'preview' };
      return { ...c, isSelected: false, state: 'normal' };
    }));
    console.log('[mural] card mousedown (start potential drag) ', card.id, 'client', { x: e.clientX, y: e.clientY });
    // 注意：不在 mousedown 时立即隐藏 toolbar，等实际移动时再隐藏以避免点击闪烁
  };
  // 获取画布光标样式
  const getCanvasCursor = useCallback(() => {
    if (canvasState.isPanning) return 'grabbing';
    if (canvasState.isDragging) return 'move';
    return 'grab';
  }, [canvasState.isPanning, canvasState.isDragging]);

  // 使用服务层的函数（包装为 useCallback）
  const saveHistory = useCallback((cardId, currentState) => {
    saveHistoryUtil(cardId, currentState, setCards);
  }, []);

  const handleUndo = useCallback((cardId) => {
    undoHandler(cardId, setCards);
  }, []);

  const handleToggleCardMode = useCallback((cardId) => {
    toggleCardModeHandler(cardId, setCards);
  }, []);

  const toggleEditMode = useCallback((cardId) => {
    toggleEditModeHandler(cardId, setCards, saveHistory, lastFocusedFieldRef, savedSelectionRef);
  }, [saveHistory]);

  // 文本编辑相关 refs
  const lastFocusedFieldRef = useRef(null);
  const savedSelectionRef = useRef(null);

  // 包装文本编辑服务的函数
  const saveSelectionCallback = useCallback(() => {
    saveSelection(savedSelectionRef);
  }, []);

  const handleColorChange = useCallback((cardId, color) => {
    colorChangeHandler(cardId, color, cards, setCards, saveHistory, lastFocusedFieldRef, savedSelectionRef);
  }, [cards, saveHistory]);

  // 处理编辑框焦点变化
  const handleFieldFocus = useCallback((field) => {
    lastFocusedFieldRef.current = field;
  }, []);

  // 使用服务层的卡片操作函数
  const handleDeleteCard = useCallback((cardId) => {
    deleteCardHandler(cardId, setCards, setState, setToolbarVisible);
  }, []);

  const handleUpdateImage = useCallback((cardId, newImageUrl) => {
    updateImageHandler(cardId, newImageUrl, setCards, saveHistory);
  }, [saveHistory]);

  const handleClipboardPaste = useCallback(async (e) => {
    await clipboardPasteHandler(e, cards, canvasRef, canvasState, viewToLogic, setCards, setErrorMsg);
  }, [cards, canvasState, viewToLogic]);

  const handleEditTitle = useCallback((cardId, newTitle) => {
    editTitleHandler(cardId, newTitle, setCards, saveHistory);
  }, [saveHistory]);

  const handleEditSummary = useCallback((cardId, newSummary) => {
    editSummaryHandler(cardId, newSummary, setCards, saveHistory);
  }, [saveHistory]);

  const handleEditCardContent = useCallback((cardId, newContent) => {
    editCardContentHandler(cardId, newContent, setCards, saveHistory);
  }, [saveHistory]);

  const handleCardClick = useCallback((cardId, e) => {
    e.stopPropagation();
    cardClickHandler(cardId, cards, setCards, setState, setToolbarVisible);
  }, [cards]);

  const handleCardDoubleClick = useCallback((cardId, e) => {
    e.stopPropagation();
    cardDoubleClickHandler(cardId, setCards, setState, setToolbarVisible);
  }, []);

  const handleCanvasClick = useCallback((e) => {
    canvasClickHandler(e, didPanRef, didDragRef, setCards, setState, setToolbarVisible);
  }, []);

  // 工具栏 ref（用于测量实际尺寸）
  const toolbarRef = useRef(null);
  const [toolbarPos, setToolbarPos] = useState(null); // { x, y, width, height, scale, cardId }
  // 最小视觉缩放阈值，低于此值时仍按该阈值显示 toolbar，避免布局从横向切换为纵向
  const MIN_VISUAL_SCALE = 0.4;
  const toolbarVisibleRef = useRef(toolbarVisible);
  useEffect(() => { toolbarVisibleRef.current = toolbarVisible; }, [toolbarVisible]);
  // 标记是否发生过平移或拖拽（避免 mouseup 之后触发 click 导致误清除选中）
  const didPanRef = useRef(false);
  const didDragRef = useRef(false);
  // 记录上次工具栏放置方向，'above' 或 'below'，用于在空间不足时保留上次方向
  const lastPlacementRef = useRef('above');
  // 缓存上次测量到的工具栏尺寸，供 render 时估算放置方向使用
  const toolbarMeasuredRef = useRef({ width: null, height: null });
  
  // Debug 面板状态
  const [debugOpen, setDebugOpen] = useState(false);
  
  // Socket 连接状态
  const [socketConnected, setSocketConnected] = useState(false);

  // 绘制点阵背景到 canvas
  const canvasBackgroundRef = useRef(null);
  
  useEffect(() => {
    const drawDotPattern = () => {
      const canvas = canvasBackgroundRef.current;
      const canvasEl = canvasRef.current;
      if (!canvas || !canvasEl) return;
      
      const ctx = canvas.getContext('2d');
      const rect = canvasEl.getBoundingClientRect();
      if (!rect) return;
      
      // 设置 canvas 尺寸为视口尺寸
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // 背景色
      ctx.fillStyle = '#D9D9D9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 计算点阵的起始偏移（让点阵随着画布移动）
      const dotSpacing = 23;
      const offsetX = (-canvasState.offsetX) % dotSpacing;
      const offsetY = (-canvasState.offsetY) % dotSpacing;
      
      // 绘制点阵（2x2 像素的点）
      ctx.fillStyle = '#C9C9C9';
      for (let x = offsetX; x < canvas.width; x += dotSpacing) {
        for (let y = offsetY; y < canvas.height; y += dotSpacing) {
          ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
        }
      }
    };
    
    drawDotPattern();
    
    // 监听窗口大小变化
    const handleResize = () => drawDotPattern();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasState.offsetX, canvasState.offsetY, canvasState.scale]);

  // 当工具栏 ref 可用时，用 layout effect 记录实际尺寸（便于调试 DPI/缩放问题）
  useLayoutEffect(() => {
    // 当工具栏渲染并且可见时，测量其实际尺寸并计算最终放置位置（以视图像素为准）
    // 如果正在缩放，跳过测量（避免抖动/闪烁）
    if (isZoomingRef.current) return;
    if (!toolbarRef.current) return;
    try {
      // 使用 canvas scale 直接作为 visual scale（移除 DPR 相关计算）
      const visualScale = canvasState.scale || 1;
      const cap = Math.max(MIN_VISUAL_SCALE, Math.min(visualScale, 2));
      const r = toolbarRef.current.getBoundingClientRect();
      toolbarMeasuredRef.current = { width: r.width, height: r.height };
      const selectedCard = cards.find(c => c.id === canvasState.selectedCardId);
      if (!selectedCard) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const viewPos = logicToView(selectedCard.x, selectedCard.y);
      const cardAbsoluteY = rect.top + viewPos.y;
      const cardLeft = rect.left + viewPos.x;
      const viewportHeight = window.innerHeight;

      const toolbarActualHeight = r.height;
      const toolbarGap = 8 * cap;

      // 计算卡片左上角位置（左对齐 toolbar），直接使用逻辑宽度乘以 scale
      const cardViewWidth = selectedCard.width * canvasState.scale;
      const cardViewHeight = selectedCard.height * canvasState.scale;
      const cardAbsoluteBottom = cardAbsoluteY + cardViewHeight;
      const spaceAbove = cardAbsoluteY;
      const spaceBelow = viewportHeight - cardAbsoluteBottom;

      let placement = 'above';
      if (spaceAbove >= toolbarActualHeight + toolbarGap) {
        placement = 'above';
      } else if (spaceBelow >= toolbarActualHeight + toolbarGap) {
        placement = 'below';
      } else {
        placement = lastPlacementRef.current || 'above';
      }

      let topPx = placement === 'above' ? cardAbsoluteY : cardAbsoluteBottom;
      let transform = placement === 'above'
        ? `translate(0, calc(-100% - ${toolbarGap}px))`
        : `translate(0, ${toolbarGap}px)`;

      lastPlacementRef.current = placement;

      const leftPx = cardLeft;

      console.log('[mural] toolbar measured', { width: r.width, height: r.height, scale: canvasState.scale, left: leftPx, topAnchor: topPx, transform });

      if (toolbarRef.current) {
        toolbarRef.current.style.left = `${leftPx}px`;
        toolbarRef.current.style.top = `${topPx}px`;
        toolbarRef.current.style.transform = transform;
      }
    } catch (err) {
      console.warn('[mural] toolbar measure failed', err);
    }
  }, [canvasState.scale, canvasState.selectedCardId]);

  // 渲染工具栏
  const renderCardToolbar = () => {
    const selectedCard = cards.find(c => c.id === canvasState.selectedCardId);
    // 使用 toolbarVisible 控制显示：只有存在选中卡片且 toolbarVisible 为 true 时渲染
    if (!selectedCard || !toolbarVisible) return null;

    const canvasEl = canvasRef.current;
    if (!canvasEl) return null;

    const rect = canvasEl.getBoundingClientRect();
    // 计算工具栏位置（基于视图坐标）
    const viewPos = logicToView(selectedCard.x, selectedCard.y);
    const visualScale = canvasState.scale || 1;
    const cap = Math.max(MIN_VISUAL_SCALE, Math.min(visualScale, 2));

    // 卡片在绝对视口中的位置
    const cardAbsoluteY = rect.top + viewPos.y;
    const cardLeft = rect.left + viewPos.x;
    const viewportHeight = window.innerHeight;

    // 初始估算位置（会被 useLayoutEffect 更新）
    // toolbar 的估算 gap 要随 visualScale 变化
    const toolbarGap = 8 * cap;

    // 计算卡片左上角用于左对齐锚点
    const cardViewWidth = selectedCard.width * canvasState.scale;
    const cardViewHeight = selectedCard.height * canvasState.scale;
    const cardAbsoluteBottom = cardAbsoluteY + cardViewHeight;

    // 初始锚点：优先根据已知的上次测量尺寸估算放置方向，尽量避免放到不可视区域
    const estimatedToolbarHeight = (toolbarMeasuredRef.current && toolbarMeasuredRef.current.height) || (32 * cap);
    const spaceAbove = cardAbsoluteY;
    const spaceBelow = viewportHeight - cardAbsoluteBottom;
    let initialPlacement = lastPlacementRef.current || 'above';
    if (spaceAbove >= estimatedToolbarHeight + toolbarGap) initialPlacement = 'above';
    else if (spaceBelow >= estimatedToolbarHeight + toolbarGap) initialPlacement = 'below';
    const toolbarTopAnchor = initialPlacement === 'above' ? cardAbsoluteY : cardAbsoluteBottom;
    const defaultTransform = initialPlacement === 'above'
      ? `translate(0, calc(-100% - ${toolbarGap}px))`
      : `translate(0, ${toolbarGap}px)`;

    return (
      <CardToolbar
        ref={toolbarRef}
        // toolbar 的 visual scale 使用 visualScale（基于 canvasScale）以匹配 card 的视觉尺寸
        scale={cap}
        style={{ 
          left: `${cardLeft}px`, 
          top: `${toolbarTopAnchor}px`, 
          transform: defaultTransform,
          position: 'fixed', 
          zIndex: 9999,
        }}
        card={selectedCard}
        cardType={selectedCard.type} // 传递卡片类型
        onUndo={handleUndo}
        onToggleEdit={toggleEditMode}
        onColorChange={(color) => handleColorChange(selectedCard.id, color)}
        onResize={handleToggleCardMode}
        onDelete={handleDeleteCard}
      />
    );
  };

  // 渲染卡片（应用坐标转换）
  const renderCards = () => {
    // 将选中的卡片移到最后渲染（显示在最上方）
    const sortedCards = [...cards].sort((a, b) => {
      if (a.id === canvasState.selectedCardId) return 1;
      if (b.id === canvasState.selectedCardId) return -1;
      return 0;
    });
    
    return sortedCards.map(card => {
      if (card.type === 'image') {
        return (
          <ImageCard
            key={card.id}
            id={card.id}
            x={(card.x * canvasState.scale) - canvasState.offsetX}
            y={(card.y * canvasState.scale) - canvasState.offsetY}
            width={card.width * canvasState.scale}
            height={card.height * canvasState.scale}
            mode={card.mode}
            scale={canvasState.scale}
            isSelected={card.isSelected}
            imageUrl={card.imageUrl}
            tag={card.tag}
            updatedAt={card.updatedAt}
            onClick={(e) => handleCardClick(card.id, e)}
            onMouseDown={(e) => handleCardMouseDown(card, e)}
            onUpdateImage={(newImageUrl) => handleUpdateImage(card.id, newImageUrl)}
            cardRef={el => cardRefs.current[card.id] = el}
          />
        );
      }
      
      return (
        <TextCard
          key={card.id}
          {...card}
          x={(card.x * canvasState.scale) - canvasState.offsetX}
          y={(card.y * canvasState.scale) - canvasState.offsetY}
          width={card.width * canvasState.scale}
          height={card.height * canvasState.scale}
          scale={canvasState.scale}
          onClick={(e) => handleCardClick(card.id, e)}
          onDoubleClick={(e) => handleCardDoubleClick(card.id, e)}
          onMouseDown={(e) => handleCardMouseDown(card, e)}
          onEditTitle={handleEditTitle}
          onEditSummary={handleEditSummary}
          onEditContent={handleEditCardContent}
          onFieldFocus={handleFieldFocus}
          cardRef={el => cardRefs.current[card.id] = el}
        />
      );
    });
  };

  // 初始化：居中显示卡片（仅在第一次挂载时执行）
  useEffect(() => {
    if (canvasRef.current && cards.length > 0 && !isInitializedRef.current) {
      isInitializedRef.current = true; // 标记已初始化，防止重复执行
      const firstCard = cards[0];
      const canvasEl = canvasRef.current;
      const rect = canvasEl.getBoundingClientRect();
      
      // 计算初始偏移量使卡片居中
      // offset = logicX * scale - viewWidth/2
      const cardCenterX = firstCard.x + (firstCard.width) / 2;
      const cardCenterY = firstCard.y + (firstCard.height) / 2;
      const centerX = (cardCenterX * canvasState.scale) - (rect.width / 2);
      const centerY = (cardCenterY * canvasState.scale) - (rect.height / 2);

      setState(prev => ({ ...prev, offsetX: centerX, offsetY: centerY }));
      console.log('[mural] init centering offset to', { offsetX: centerX, offsetY: centerY });
    }
  }, []); // 移除依赖，仅在挂载时执行一次

  // 绑定滚轮事件
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Debug: 输出 cards/offset 状态定期快照（方便观察回退问题）
  useEffect(() => {
    const t = setInterval(() => {
      console.log('[mural] snapshot offset, scale, cards:', { offsetX: canvasState.offsetX, offsetY: canvasState.offsetY, scale: canvasState.scale, cardsCount: cards.length });
    }, 3000);
    return () => clearInterval(t);
  }, [canvasState.offsetX, canvasState.offsetY, canvasState.scale, cards.length]);

  // 监听选区变化，自动保存选区信息
  useEffect(() => {
    const handleSelectionChange = () => {
      // 只在编辑模式下保存选区
      const selectedCard = cards.find(c => c.id === canvasState.selectedCardId);
      if (selectedCard && selectedCard.state === 'edit') {
        saveSelectionCallback();
      }
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [cards, canvasState.selectedCardId, saveSelectionCallback]);

  // 绑定全局鼠标事件（仅在挂载时绑定一次，处理逻辑通过 refs 保证最新值）
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 绑定 paste 事件
  useEffect(() => {
    document.addEventListener('paste', handleClipboardPaste);
    return () => {
      document.removeEventListener('paste', handleClipboardPaste);
    };
  }, [handleClipboardPaste]);

  // 初始化 Canvas Service（连接后端 Socket）
  useEffect(() => {
    let unsubscribe = null;
    
    const initService = async () => {
      try {
        // 不传入初始 widgets，让后端作为数据源
        // 前端的初始卡片仅用于首次加载的 UI 展示
        await initCanvasService([]);
        console.log('[mural] Canvas Service 初始化成功');
        setSocketConnected(true);
        
        // 订阅后端状态变化
        unsubscribe = subscribeToCanvasState((backendState) => {
          console.log('[mural] 接收到后端状态更新:', backendState);
          
          // 将后端的 widgets 数据同步到本地 cards
          if (backendState?.canvasData?.widgets && Array.isArray(backendState.canvasData.widgets)) {
            setCards(prevCards => {
              const backendWidgets = backendState.canvasData.widgets;
              
              // 如果后端为空，清空前端（以后端为准）
              if (backendWidgets.length === 0) {
                // 如果前端也是空的，不需要更新
                if (prevCards.length === 0) {
                  return prevCards;
                }
                // 如果前端有卡片但后端为空，说明后端执行了清空操作
                console.log('[mural] 后端已清空，同步清空前端卡片（包括初始欢迎卡片）');
                return [];
              }
              
              // 创建 ID 到卡片的映射
              const updatedCardsMap = new Map(prevCards.map(c => [c.id, c]));
              const backendWidgetIds = new Set(backendWidgets.map(w => w.id));
              
              let hasChanges = false;
              
              // 合并后端更新的数据
              backendWidgets.forEach(widget => {
                if (updatedCardsMap.has(widget.id)) {
                  // 更新已存在的卡片
                  const existingCard = updatedCardsMap.get(widget.id);
                  
                  // 检查是否有实际变化（比较 updatedAt 或内容）
                  const needsUpdate = 
                    widget.updatedAt !== existingCard.updatedAt ||
                    widget.content !== existingCard.content ||
                    widget.summary !== existingCard.summary ||
                    widget.imageUrl !== existingCard.imageUrl;
                  
                  if (needsUpdate) {
                    const updatedCard = {
                      ...existingCard,
                      ...widget,
                      // 保留本地的 UI 状态和布局信息
                      isSelected: existingCard.isSelected,
                      mode: existingCard.mode,
                      state: existingCard.state,
                      // 关键：保留本地的尺寸信息（expanded 模式时尺寸不同）
                      width: existingCard.width,
                      height: existingCard.height,
                      originalHeight: existingCard.originalHeight,
                      // 保留位置信息（避免卡片跳动）
                      x: existingCard.x,
                      y: existingCard.y,
                    };
                    updatedCardsMap.set(widget.id, updatedCard);
                    hasChanges = true;
                    console.log(`[mural] 已更新卡片 ${widget.id}`);
                    console.log(`  - 旧 content/summary:`, existingCard.summary?.substring(0, 50));
                    console.log(`  - 新 content/summary:`, widget.summary?.substring(0, 50));
                    console.log(`  - 保留模式: ${existingCard.mode}, 尺寸: ${existingCard.width}x${existingCard.height}`);
                  }
                } else {
                  // 后端有新卡片，前端没有，添加它
                  updatedCardsMap.set(widget.id, {
                    ...widget,
                    isSelected: false,
                    mode: widget.mode || 'normal',
                    state: widget.state || 'normal',
                    history: widget.history || [],
                  });
                  hasChanges = true;
                  console.log(`[mural] 添加新卡片 ${widget.id} 来自后端`);
                }
              });
              
              // 检查前端是否有后端没有的卡片（已被删除）
              prevCards.forEach(card => {
                if (!backendWidgetIds.has(card.id)) {
                  updatedCardsMap.delete(card.id);
                  hasChanges = true;
                  console.log(`[mural] 删除卡片 ${card.id}，后端已不存在`);
                }
              });
              
              // 如果没有变化，返回原数组（避免触发重新渲染）
              if (!hasChanges) {
                return prevCards;
              }
              
              const updatedCards = Array.from(updatedCardsMap.values());
              console.log(`[mural] 同步完成，卡片数量: ${prevCards.length} -> ${updatedCards.length}`);
              return updatedCards;
            });
          }
        });
      } catch (err) {
        console.error('[mural] Canvas Service 初始化失败:', err);
        setSocketConnected(false);
      }
    };
    
    initService();
    
    return () => {
      if (unsubscribe) unsubscribe();
      destroyCanvasService();
      console.log('[mural] Canvas Service 已清理');
    };
  }, []); // 仅在组件挂载时初始化一次

  // 跟踪上次通知后端的卡片ID（避免重复发送）
  const lastNotifiedCardIdRef = useRef(null);

  // 当选中卡片时，通知后端
  useEffect(() => {
    if (!socketConnected || !canvasState.selectedCardId) {
      lastNotifiedCardIdRef.current = null;
      return;
    }
    
    // 如果是同一张卡片，不重复发送
    if (lastNotifiedCardIdRef.current === canvasState.selectedCardId) {
      return;
    }
    
    const selectedCard = cards.find(c => c.id === canvasState.selectedCardId);
    if (!selectedCard) return;
    
    // 准备发送的内容
    let content = '';
    if (selectedCard.type === 'text') {
      // 文本卡片：发送完整HTML内容（包含所有样式）
      content = selectedCard.content || selectedCard.summary || selectedCard.title || '';
    } else if (selectedCard.type === 'image') {
      // 图片卡片：发送 imageUrl
      content = selectedCard.imageUrl || '';
    }
    
    if (!content) {
      console.warn('[mural] 选中的卡片内容为空，不发送到后端');
      return;
    }
    
    // 发送到后端
    const notifyBackend = async () => {
      try {
        await sendControlClickEvent(selectedCard.id, content);
        lastNotifiedCardIdRef.current = selectedCard.id; // 记录已通知的卡片ID
        console.log('[mural] 已通知后端选中卡片:', selectedCard.id, '类型:', selectedCard.type);
        console.log('[mural] 内容预览:', content.substring(0, 100));
      } catch (err) {
        console.error('[mural] 通知后端失败:', err);
      }
    };
    
    notifyBackend();
  }, [socketConnected, canvasState.selectedCardId, cards]);

  // 使用服务层的新建卡片函数
  const handleNewTextCard = useCallback(async () => {
    await createNewTextCard(canvasRef, canvasState, setCards);
  }, [canvasState]);

  const handleNewImageCard = useCallback(async () => {
    await createNewImageCard(canvasRef, canvasState, setCards);
  }, [canvasState]);

  // 处理编辑卡片（从 Debug 面板调用）
  const handleEditCardFromDebug = useCallback((cardId) => {
    handleCardClick(cardId, { stopPropagation: () => {} });
    toggleEditMode(cardId);
  }, [handleCardClick, toggleEditMode]);

  // 处理居中卡片（从 Debug 面板调用）
  const handleCenterCardFromDebug = useCallback((card) => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const viewCenterX = rect.width / 2;
    const viewCenterY = rect.height / 2;
    const cardCenterLogicX = card.x + (card.width / 2);
    const cardCenterLogicY = card.y + (card.height / 2);
    const newOffsetX = (cardCenterLogicX * canvasState.scale) - viewCenterX;
    const newOffsetY = (cardCenterLogicY * canvasState.scale) - viewCenterY;
    setState(prev => ({ ...prev, offsetX: newOffsetX, offsetY: newOffsetY }));
  }, [canvasState.scale]);

  // 切换 Debug 面板
  const handleToggleDebug = useCallback(() => {
    setDebugOpen(prev => !prev);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Socket 连接状态指示器 */}
      <div style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        padding: '4px 8px',
        borderRadius: 4,
        background: socketConnected ? '#22c55e' : '#ef4444',
        color: 'white',
        fontSize: 12,
        fontWeight: 500,
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'white',
          animation: socketConnected ? 'pulse 2s infinite' : 'none'
        }} />
        {socketConnected ? 'Backend Connected' : 'Backend Disconnected'}
      </div>
      
      {/* 错误提示 */}
      {errorMsg && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ff4444',
          color: 'white',
          padding: '8px 16px',
          borderRadius: 4,
          zIndex: 99999,
          fontSize: 14
        }}>
          {errorMsg}
        </div>
      )}
      <div
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#D9D9D9',
          cursor: getCanvasCursor(),
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
        }}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
      >
        {/* 点阵背景层 */}
        <canvas
          ref={canvasBackgroundRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
        <div
          ref={viewportRef}
          style={{
            width: '5000px',
            height: '5000px',
            position: 'absolute',
          }}
        >
          {renderCards()}
        </div>
      </div>
      {renderCardToolbar()}
      {debugOpen && createPortal(
        <DebugPanel
          cards={cards}
          canvasState={canvasState}
          canvasRef={canvasRef}
          onEditCard={handleEditCardFromDebug}
          onCenterCard={handleCenterCardFromDebug}
          onDeleteCard={handleDeleteCard}
        />,
        document.body
      )}
      {createPortal(
        <BottomActionBar
          onNewTextCard={handleNewTextCard}
          onNewImageCard={handleNewImageCard}
          debugOpen={debugOpen}
          onToggleDebug={handleToggleDebug}
        />,
        document.body
      )}
    </div>
  );
};

export default MuralDemo;