import React, { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import TextCard from './TextCard';
import CardToolbar from './CardToolbar';

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
      width: 220,
      height: 140,
      isSelected: false,
      mode: 'normal',
      state: 'normal',
      title: '欢迎使用Mural',
      summary: '滚轮→鼠标中心缩放 | 拖拽画布→平移 | 单击→预览 | 双击→扩展',
      content: '<strong>富文本内容示例</strong><br><br>支持加粗、换行、斜体等格式',
      history: [],
    },
  ]);

  const [toolbarVisible, setToolbarVisible] = useState(false);
  const cardRefs = useRef({});
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);

  // 坐标转换：视图坐标 → 逻辑坐标
  const viewToLogic = useCallback((viewX, viewY) => ({
    x: (viewX + canvasState.offsetX) / canvasState.scale,
    y: (viewY + canvasState.offsetY) / canvasState.scale
  }), [canvasState.offsetX, canvasState.offsetY, canvasState.scale]);

  // 坐标转换：逻辑坐标 → 视图坐标
  const logicToView = useCallback((logicX, logicY) => ({
    x: (logicX * canvasState.scale) - canvasState.offsetX,
    y: (logicY * canvasState.scale) - canvasState.offsetY
  }), [canvasState.scale, canvasState.offsetX, canvasState.offsetY]);

  // 鼠标中心缩放实现
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // 计算鼠标在画布内的视图坐标
    const viewX = e.clientX - rect.left;
    const viewY = e.clientY - rect.top;
    // 转换为逻辑坐标（缩放中心点）
    const logicPos = viewToLogic(viewX, viewY);

    setState(prev => {
      // 计算新缩放比例（限制范围0.1-5倍）
      const newScale = e.deltaY < 0
        ? Math.min(prev.scale * 1.1, 5)
        : Math.max(prev.scale / 1.1, 0.1);
      
      // 重新计算偏移量，确保缩放中心不变
      const newOffsetX = (logicPos.x * newScale) - viewX;
      const newOffsetY = (logicPos.y * newScale) - viewY;
      
      return { ...prev, scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
    });
  }, [viewToLogic]);

  // 开始画布平移
// 修改handleCanvasMouseDown，确保只有空白区域才触发平移
const handleCanvasMouseDown = useCallback((e) => {
  // 检查是否点击了卡片元素
  const isCard = e.target.closest('[id^="card-"]');
  if (!isCard) { // 只有点击非卡片区域才触发平移
    isPanning.current = true;
    lastPanPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewportRef.current?.scrollLeft || 0,
      scrollTop: viewportRef.current?.scrollTop || 0,
    };
    setToolbarVisible(false);
  }
}, []);

  // 鼠标移动处理（同时支持卡片拖拽和画布平移）
const handleMouseMove = useCallback((e) => {
  if (!canvasState.isDragging.current || !selectedCardRef.current) return;

  const { clientX, clientY } = e;
  // 修复：将减号改为加号，使卡片移动方向与鼠标一致
  const dx = (clientX - lastPosRef.current.x) / canvasState.scale;
  const dy = (clientY - lastPosRef.current.y) / canvasState.scale;

  setCards(prev => prev.map(card => {
    if (card.id === selectedCardRef.current.id) {
      // 修复：将减号改为加号，使坐标移动方向正确
      return { ...card, x: card.x + dx, y: card.y + dy };
    }
    return card;
  }));

  lastPosRef.current = { x: clientX, y: clientY };
}, [canvasState.scale]);

// 在handleMouseUp中添加document鼠标离开事件处理
const handleMouseUp = useCallback(() => {
  if (isDragging.current && selectedCardRef.current) {
    setToolbarVisible(true);
  }
  isDragging.current = false;
  selectedCardRef.current = null;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('mouseleave', handleMouseUp); // 新增
}, [handleMouseMove]);

// 在handleCardMouseDown中添加鼠标离开监听
const handleCardMouseDown = useCallback((card, e) => {
  if (card.state === 'edit' || isPanning.current) return;
  e.stopPropagation();
  e.preventDefault();

  setToolbarVisible(false);
  isDragging.current = true;
  selectedCardRef.current = card;
  lastPosRef.current = { x: e.clientX, y: e.clientY };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('mouseleave', handleMouseUp); // 新增
}, []);
  // 获取画布光标样式
  const getCanvasCursor = useCallback(() => {
    if (canvasState.isPanning) return 'grabbing';
    if (canvasState.isDragging) return 'move';
    return 'grab';
  }, [canvasState.isPanning, canvasState.isDragging]);

  // 其他原有功能保持不变
  const saveHistory = useCallback((cardId, currentState) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      const newHistory = [...card.history, { ...currentState }];
      if (newHistory.length > 20) newHistory.shift();
      return { ...card, history: newHistory };
    }));
  }, []);

  const handleUndo = useCallback((cardId) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId || card.history.length === 0) return card;
      const newHistory = [...card.history];
      const lastState = newHistory.pop();
      return { ...lastState, history: newHistory };
    }));
  }, []);

  const handleToggleCardMode = useCallback((cardId) => {
    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        return {
          ...card,
          mode: card.mode === 'normal' ? 'expanded' : 'normal',
          height: card.mode === 'normal' ? 300 : 140,
        };
      }
      return card;
    }));
  }, []);

  const toggleEditMode = useCallback((cardId) => {
    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        const newState = card.state === 'edit' ? 'preview' : 'edit';
        if (newState === 'edit') saveHistory(cardId, card);
        return { ...card, state: newState };
      }
      return card;
    }));
  }, [saveHistory]);

  const handleColorChange = useCallback((cardId, color) => {
    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        saveHistory(cardId, card);
        return {
          ...card,
          content: `<span style="color: ${color}">${card.content}</span>`,
          summary: `<span style="color: ${color}">${card.summary}</span>`,
        };
      }
      return card;
    }));
  }, [saveHistory]);

  const handleDeleteCard = useCallback((cardId) => {
    setCards(prev => prev.filter(card => card.id !== cardId));
    setState(prev => ({ ...prev, selectedCardId: null }));
    setToolbarVisible(false);
  }, []);

  const handleEditTitle = useCallback((cardId, newTitle) => {
    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        saveHistory(cardId, card);
        return { ...card, title: newTitle };
      }
      return card;
    }));
  }, [saveHistory]);

  const handleEditSummary = useCallback((cardId, newSummary) => {
    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        saveHistory(cardId, card);
        return { ...card, summary: newSummary };
      }
      return card;
    }));
  }, [saveHistory]);

  const handleEditCardContent = useCallback((cardId, newContent) => {
    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        saveHistory(cardId, card);
        return { ...card, content: newContent };
      }
      return card;
    }));
  }, [saveHistory]);

  const handleCardClick = useCallback((cardId, e) => {
    e.stopPropagation();
    setCards(prev => prev.map(card => {
      const isSelected = card.id === cardId;
      return { 
        ...card, 
        state: isSelected ? 'preview' : 'normal',
        isSelected 
      };
    }));
    setState(prev => ({ ...prev, selectedCardId: cardId }));
    setToolbarVisible(true);
  }, []);

  const handleCardDoubleClick = useCallback((cardId, e) => {
    e.stopPropagation();
    setCards(prev => prev.map(card => {
      if (card.id === cardId && card.mode === 'normal') {
        return {
          ...card,
          mode: 'expanded',
          state: 'preview',
          isSelected: true,
          height: 300,
        };
      }
      return { ...card, isSelected: false, state: 'normal' };
    }));
    setState(prev => ({ ...prev, selectedCardId: cardId }));
    setToolbarVisible(true);
  }, []);

  const handleCanvasClick = useCallback((e) => {
    if (e.target === canvasRef.current || e.target === viewportRef.current) {
      setCards(prev => prev.map(card => {
        if (card.state === 'edit') {
          return { ...card, state: 'preview' };
        } else if (card.state === 'preview') {
          return { ...card, state: 'normal', isSelected: false };
        }
        return card;
      }));
      setState(prev => ({ ...prev, selectedCardId: null }));
      setToolbarVisible(false);
    }
  }, []);

  // 渲染工具栏
  const renderCardToolbar = () => {
    const selectedCard = cards.find(c => c.id === canvasState.selectedCardId);
    if (!selectedCard || !toolbarVisible || canvasState.isDragging || canvasState.isPanning) return null;

    const canvasEl = canvasRef.current;
    if (!canvasEl) return null;

    const rect = canvasEl.getBoundingClientRect();
    // 计算工具栏位置（基于视图坐标）
    const viewPos = logicToView(selectedCard.x, selectedCard.y);
    const toolbarX = rect.left + viewPos.x + selectedCard.width * canvasState.scale - 200;
    const toolbarY = rect.top + viewPos.y - 50;

    return (
      <CardToolbar
        style={{ left: `${toolbarX}px`, top: `${toolbarY}px`, position: 'fixed', zIndex: 9999 }}
        card={selectedCard}
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
    return cards.map(card => {
      const viewPos = logicToView(card.x, card.y);
      return (
        <TextCard
          key={card.id}
          {...card}
          x={viewPos.x}
          y={viewPos.y}
          width={card.width * canvasState.scale}
          height={card.height * canvasState.scale}
          onClick={(e) => handleCardClick(card.id, e)}
          onDoubleClick={(e) => handleCardDoubleClick(card.id, e)}
          onMouseDown={(e) => handleCardMouseDown(card, e)}
          onEditTitle={handleEditTitle}
          onEditSummary={handleEditSummary}
          onEditContent={handleEditCardContent}
          cardRef={el => cardRefs.current[card.id] = el}
        />
      );
    });
  };

  // 初始化：居中显示卡片
  useEffect(() => {
    if (canvasRef.current && cards.length > 0) {
      const firstCard = cards[0];
      const canvasEl = canvasRef.current;
      const rect = canvasEl.getBoundingClientRect();
      
      // 计算初始偏移量使卡片居中
      const centerX = (firstCard.x + firstCard.width / 2) * canvasState.scale - rect.width / 2;
      const centerY = (firstCard.y + firstCard.height / 2) * canvasState.scale - rect.height / 2;
      
      setState(prev => ({ ...prev, offsetX: centerX, offsetY: centerY }));
    }
  }, [cards, canvasState.scale]);

  // 绑定滚轮事件
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // 绑定全局鼠标事件
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f5f5f5',
          cursor: getCanvasCursor(),
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
        }}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
      >
        <div
          ref={viewportRef}
          style={{
            width: '5000px',
            height: '5000px',
            position: 'absolute',
            transform: `translate(${-canvasState.offsetX}px, ${-canvasState.offsetY}px)`,
            transformOrigin: '0 0',
          }}
        >
          <div 
            style={{ 
              position: 'absolute', 
              width: '5000px', 
              height: '5000px',
              transform: `scale(${canvasState.scale})`,
              transformOrigin: '0 0',
            }}
          >
            {renderCards()}
          </div>
        </div>
      </div>
      {renderCardToolbar()}
    </div>
  );
};

export default MuralDemo;