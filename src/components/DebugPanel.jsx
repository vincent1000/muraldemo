import { useState, useEffect } from 'react';

// 定义控件类型常量（与主组件保持一致）
export const CONTROL_TYPES = {
  CARD: 'card',
  IMAGE: 'image',
};

const DebugPanel = ({
  visible = false,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  widgets = [],
  selectedWidgetId = null,
  canvasWidth = 0,
  canvasHeight = 0,
  onEditWidget,
  onCenterWidget,
  onDeleteWidget,
  onSetErrorMsg,
}) => {
  // 坐标转换：逻辑 → 视图（复用原逻辑）
  const logicToView = (logicX, logicY) => ({
    x: (logicX * scale) - offsetX,
    y: (logicY * scale) - offsetY,
  });

  // 监听依赖变化，更新内部状态（可选，用于优化渲染）
  const [panelData, setPanelData] = useState({
    widgets: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    selectedWidgetId: null,
  });

  useEffect(() => {
    setPanelData({
      widgets,
      scale,
      offsetX,
      offsetY,
      selectedWidgetId,
    });
  }, [widgets, scale, offsetX, offsetY, selectedWidgetId]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 8,
        width: 320,
        maxHeight: '70vh',
        overflow: 'auto',
        background: '#fff',
        color: '#333',
        borderRadius: 8,
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        zIndex: 99999,
        pointerEvents: 'auto',
        padding: 0,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          padding: 8,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          Widget Coordinates (Total {panelData.widgets.length})
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          scale {panelData.scale.toFixed(2)}
        </div>
      </div>

      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          offsetX: {panelData.offsetX.toFixed(2)}, offsetY: {panelData.offsetY.toFixed(2)}
        </div>
        {panelData.widgets.map((widget) => {
          const view = logicToView(widget.x, widget.y);
          const viewRightBottom = logicToView(
            widget.x + widget.width,
            widget.y + widget.height
          );

          // 判断控件是否在画布可视区域内
          const visibleInCanvas =
            panelData.scale > 0 &&
            view.x < canvasWidth &&
            viewRightBottom.x > 0 &&
            view.y < canvasHeight &&
            viewRightBottom.y > 0;

          return (
            <div
              key={widget.id}
              style={{
                marginBottom: 8,
                padding: 8,
                borderRadius: 6,
                background: panelData.selectedWidgetId === widget.id
                  ? 'rgba(66,133,244,0.06)'
                  : 'rgba(0,0,0,0.02)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {widget.type.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: visibleInCanvas ? '#16a34a' : '#dc2626',
                  }}
                >
                  {visibleInCanvas ? 'Visible' : 'Hidden'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                id: {widget.id}
              </div>
              <div style={{ fontSize: 12, color: '#333' }}>
                logic: x: {widget.x.toFixed(2)}, y: {widget.y.toFixed(2)} ({widget.width}×{widget.height})
              </div>
              <div style={{ fontSize: 12, color: '#333' }}>
                view: x: {view.x.toFixed(1)}, y: {view.y.toFixed(1)} — right/bottom: x: {viewRightBottom.x.toFixed(1)}, y: {viewRightBottom.y.toFixed(1)}
              </div>

              {/* 图片控件专属信息 */}
              {widget.type === CONTROL_TYPES.IMAGE && (
                <>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    rotation: {widget.rotation || 0}°
                  </div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    locked: {widget.isLocked ? 'Yes' : 'No'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#666',
                      marginTop: 6,
                      wordBreak: 'break-all',
                    }}
                  >
                    src: {widget.src ? (widget.src.length > 60 ? `${widget.src.slice(0, 60)}...` : widget.src) : '(none)'}
                  </div>
                </>
              )}

              {/* 卡片控件专属信息 */}
              {widget.type === CONTROL_TYPES.CARD && (
                <>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    editable: {widget.isEditable ? 'Yes' : 'No'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#666',
                      marginTop: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    title: {widget.title || '(none)'}
                  </div>
                </>
              )}

              {/* 操作按钮组 */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    background: '#e6f4ea',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    opacity: (widget.isLocked || (widget.type === CONTROL_TYPES.CARD && !widget.isEditable)) ? 0.6 : 1,
                  }}
                  onClick={() => {
                    if (widget.isLocked) {
                      onSetErrorMsg?.("该控件已锁定，无法编辑");
                      return;
                    }
                    // 调用主组件的编辑回调，传递控件信息
                    onEditWidget?.(widget);
                  }}
                  disabled={widget.isLocked || (widget.type === CONTROL_TYPES.CARD && !widget.isEditable)}
                >
                  Edit
                </button>
                <button
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    background: '#e8f0ff',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    // 计算控件中心点逻辑坐标
                    const controlCenterLogicX = widget.x + widget.width / 2;
                    const controlCenterLogicY = widget.y + widget.height / 2;
                    // 计算新的偏移量（让控件中心点居中到画布）
                    const newOffsetX = controlCenterLogicX * panelData.scale - canvasWidth / 2;
                    const newOffsetY = controlCenterLogicY * panelData.scale - canvasHeight / 2;
                    // 调用主组件的居中回调
                    onCenterWidget?.(newOffsetX, newOffsetY);
                  }}
                >
                  Center
                </button>
                <button
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    background: '#ffefef',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    // 调用主组件的删除回调
                    onDeleteWidget?.(widget.id).catch((err) => {
                      onSetErrorMsg?.(err.message);
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DebugPanel;