import { useState, useRef, useCallback, Suspense } from 'react';
import { useDrag, useDrop, DndContext } from 'react-dnd'; // 命名导出 useDrag/useDrop/DndContext
import DragDropManager from 'react-dnd/dist/cjs/core/DragDropManager'; // 明确路径导入 DragDropManager
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createEditor, Editor, Transforms, Range } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { styled } from '@emotion/styled';





import { initialValue, withUndoRedo } from '../utils/slateHelpers';

// 关键：导入统一 Icon 组件（路径根据你的文件结构调整）
import Icon from '../utils/icon';
// 导入加载中占位符（可选，优化动态导入体验）
const LoadingIcon = () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" />;





// 初始化 DnD 管理器
const manager = DragDropManager({ backend: HTML5Backend });

// 样式组件（不变）
const CardContainer = styled.div`
  position: relative;
  width: 100%;
  height: 600px;
  padding: 50px;
  background-color: #f9fafb;
  border-radius: 8px;
`;

const Toolbar = styled.div`
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 100;
`;

const ToolButton = styled.button`
  border: none;
  background: transparent;
  padding: 6px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: #f5f5f5;
  }
  &:active {
    background: #eee;
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const ResizableCard = styled.div`
  position: relative;
  background-color: ${({ cardColor }) => cardColor};
  border: ${({ isSelected }) => (isSelected ? '2px solid #4299e1' : '1px solid #e2e8f0')};
  border-radius: 8px;
  box-shadow: ${({ isSelected }) => (isSelected ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.05)')};
  transition: all 0.2s ease;
  overflow: hidden;
  padding: 16px;
  min-width: 200px;
  min-height: 150px;
  max-width: 500px;
  max-height: 400px;
  &::after {
    content: '';
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 16px;
    height: 16px;
    border-right: 2px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
    cursor: se-resize;
  }
`;

const EditableContent = styled.div`
  width: 100%;
  height: 100%;
  outline: none;
  font-size: 16px;
  color: #2d3748;
  line-height: 1.5;
  &:empty::before {
    content: '点击编辑...';
    color: #94a3b8;
  }
`;

// 单个可拖拽、可编辑、可缩放的 Card 组件
function DraggableEditableCard({ card, onUpdateCard, onDeleteCard }) {
  const [isSelected, setIsSelected] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isScalingMode, setIsScalingMode] = useState(false); // 缩放模式状态
  const cardRef = useRef(null);
  const editorRef = useRef(null);

  // 初始化 Slate 编辑器
  const editor = useCallback(() => {
    if (!editorRef.current) {
      const slateEditor = withReact(createEditor());
      editorRef.current = withUndoRedo(slateEditor);
    }
    return editorRef.current;
  }, []);

  // React-DnD：拖拽功能
  const [{ isDragging }, dragRef] = useDrag({
    type: 'CARD',
    item: { id: card.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    begin: () => setIsSelected(true),
  });

  // React-DnD：放置功能
  const [, dropRef] = useDrop({
    accept: 'CARD',
    hover: (item, monitor) => {
      if (item.id === card.id) return;
      const dragIndex = item.id;
      const hoverIndex = card.id;
      if (dragIndex < hoverIndex) return;
      console.log(`拖动卡片 ${dragIndex} 到卡片 ${hoverIndex} 位置`);
    },
  });

  // 合并拖拽和放置的 ref
  const combinedRef = useCallback((node) => {
    dragRef(node);
    dropRef(node);
    cardRef.current = node;
  }, [dragRef, dropRef]);

  // 缩放功能
  const handleMouseDown = (e) => {
    if (e.target === cardRef.current?.querySelector('div:last-child') || e.target === cardRef.current?.lastChild) {
      setIsResizing(true);
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
    } else {
      setIsSelected(true);
    }
  };

  const handleResize = (e) => {
    if (!isResizing || !cardRef.current) return;
    const card = cardRef.current;
    const newWidth = Math.max(200, Math.min(500, e.clientX - card.getBoundingClientRect().left));
    const newHeight = Math.max(150, Math.min(400, e.clientY - card.getBoundingClientRect().top));
    onUpdateCard(card.id, { width: newWidth, height: newHeight });
  };

  const stopResize = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  };

  // 工具栏功能
  const handleUndo = () => {
    const slateEditor = editor();
    slateEditor.undo();
  };

  const handleEdit = () => {
    setIsSelected(true);
    const editable = cardRef.current?.querySelector('[contenteditable="true"]');
    editable?.focus();
  };

  const handleChangeColor = () => {
    const colors = ['#ffffff', '#fef7fb', '#e8f4f8', '#f0f8fb', '#f5fafe'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    onUpdateCard(card.id, { color: randomColor });
  };

  const handleToggleScaleMode = () => {
    setIsScalingMode(!isScalingMode);
    setIsSelected(true);
  };

  const handleDelete = () => {
    if (window.confirm('确定删除该卡片？')) {
      onDeleteCard(card.id);
    }
  };

  // 检查是否可撤销
  const canUndo = editor().history.undos.length > 0;

  return (
    <ResizableCard
      ref={combinedRef}
      cardColor={card.color}
      isSelected={isSelected || isDragging}
      style={{ width: card.width, height: card.height, opacity: isDragging ? 0.7 : 1 }}
      onMouseDown={handleMouseDown}
    >
      <Slate editor={editor()} value={card.content || initialValue} onChange={(value) => onUpdateCard(card.id, { content: value })}>
        <Editable
          renderElement={(props) => <EditableContent {...props} />}
          placeholder="点击编辑卡片内容..."
          onFocus={() => setIsSelected(true)}
        />
      </Slate>

      {/* 选中时显示工具栏：使用统一 Icon 组件 */}
      {isSelected && (
        <Toolbar>
          {/* 撤销 Icon：传递 name 和 disabled 状态 */}
          <ToolButton onClick={handleUndo} disabled={!canUndo}>
            <Suspense fallback={<LoadingIcon />}>
              <Icon name="undo" disabled={!canUndo} />
            </Suspense>
          </ToolButton>

          {/* 编辑 Icon */}
          <ToolButton onClick={handleEdit}>
            <Suspense fallback={<LoadingIcon />}>
              <Icon name="edit" />
            </Suspense>
          </ToolButton>

          {/* 颜色切换 Icon */}
          <ToolButton onClick={handleChangeColor}>
            <Suspense fallback={<LoadingIcon />}>
              <Icon name="color" />
            </Suspense>
          </ToolButton>

          {/* 缩放模式 Icon：传递 isActive 状态 */}
          <ToolButton onClick={handleToggleScaleMode}>
            <Suspense fallback={<LoadingIcon />}>
              <Icon name="scale" isActive={isScalingMode} />
            </Suspense>
          </ToolButton>

          {/* 删除 Icon：自定义颜色 */}
          <ToolButton onClick={handleDelete}>
            <Suspense fallback={<LoadingIcon />}>
              <Icon name="delete" color="#e53e3e" />
            </Suspense>
          </ToolButton>
        </Toolbar>
      )}
    </ResizableCard>
  );
}

// 外层容器：管理多个卡片
export default function EditableCardList({ initialCards }) {
  const [cards, setCards] = useState(initialCards || [
    {
      id: 'card-1',
      color: '#ffffff',
      width: 300,
      height: 200,
      content: initialValue,
      x: 100,
      y: 100,
    },
    {
      id: 'card-2',
      color: '#fef7fb',
      width: 300,
      height: 200,
      content: [{ type: 'paragraph', children: [{ text: '卡片 2：支持拖拽排序' }] }],
      x: 450,
      y: 100,
    },
  ]);

  const handleUpdateCard = (id, updates) => {
    setCards(cards.map((card) => (card.id === id ? { ...card, ...updates } : card)));
  };

  const handleDeleteCard = (id) => {
    setCards(cards.filter((card) => card.id !== id));
  };

  return (
    <DndContext manager={manager}>
      <CardContainer>
        {cards.map((card) => (
          <div key={card.id} style={{ position: 'absolute', left: card.x, top: card.y }}>
            <DraggableEditableCard
              card={card}
              onUpdateCard={handleUpdateCard}
              onDeleteCard={handleDeleteCard}
            />
          </div>
        ))}
      </CardContainer>
    </DndContext>
  );
}