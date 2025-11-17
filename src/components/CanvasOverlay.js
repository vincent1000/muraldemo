
// CanvasOverlay.js
import React from 'react';
import { createPortal } from 'react-dom';

export function DebugPanel({ canvasState, state, canvasRef, logicToView, deleteWidget, setErrorMsg, setState, handleCardClick, containerRef }) {
  const widgets = canvasState.canvasData.widgets || [];
  return createPortal(
    <div style={{ position: 'fixed', top: 60, right: 8, width: 320, maxHeight: '70vh', overflow: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', zIndex: 99999, padding: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Widget Coordinates (Total {widgets.length})</div>
      {widgets.map(widget => {
        const view = logicToView(widget.x, widget.y);
        return (
          <div key={widget.id} style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: '#f9f9f9', border: '1px solid #eee' }}>
            <div style={{ fontSize: 12 }}>id: {widget.id}</div>
            <div style={{ fontSize: 12 }}>type: {widget.type}</div>
            <div style={{ fontSize: 12 }}>logic: x: {widget.x.toFixed(2)}, y: {widget.y.toFixed(2)}</div>
            <div style={{ fontSize: 12 }}>view: x: {view.x.toFixed(1)}, y: {view.y.toFixed(1)}</div>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

export function BottomActionBar({ canvasRef, containerRef, canvasState, viewToLogic, addWidget, setDebugOpen }) {
  return createPortal(
    <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, padding: 12, background: '#fff', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', zIndex: 99999 }}>
      <button onClick={async () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !canvasState.socketConnected) return;
        const centerViewX = canvas.width / 2;
        const centerViewY = canvas.height / 2;
        const centerLogic = viewToLogic(centerViewX, centerViewY);
        await addWidget({
          type: 'text',
          x: centerLogic.x - 100,
          y: centerLogic.y - 75,
          width: 200,
          height: 150,
          title: 'New Card',
          content: 'Editable content',
          bgColor: '#f0f0f0',
          style: { color: '#333', fontSize: 14 },
          isEditable: true
        });
      }}>Add Card</button>
      <button onClick={async () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !canvasState.socketConnected) return;
        const centerViewX = canvas.width / 2;
        const centerViewY = canvas.height / 2;
        const centerLogic = viewToLogic(centerViewX, centerViewY);
        await addWidget({
          type: 'image',
          x: centerLogic.x - 150,
          y: centerLogic.y - 100,
          width: 300,
          height: 200,
          src: `https://picsum.photos/seed/${Date.now()}/300/200`,
          rotation: 0,
          isLocked: false
        });
      }}>Add Image</button>
      <button onClick={() => setDebugOpen(prev => !prev)}>Toggle Debug</button>
    </div>,
    document.body
  );
}
