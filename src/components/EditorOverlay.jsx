
// EditorOverlay.js
import React from 'react';

export default function EditorOverlay({ canvasState, state, setState, updateWidget, deleteWidget, logicToView, editingText, setEditingText }) {
  const selectedWidgetId = canvasState.selectedWidgetId;
  if (!selectedWidgetId || !state.isEditing) return null;

  const widgets = canvasState.canvasData.widgets || [];
  const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
  if (!selectedWidget) return null;

  const viewPos = logicToView(selectedWidget.x, selectedWidget.y);
  const scale = state.scale;

  if (selectedWidget.type === 'text') {
    return (
      <div style={{
        position: 'absolute',
        left: viewPos.x,
        top: viewPos.y,
        width: selectedWidget.width * scale,
        height: selectedWidget.height * scale,
        padding: 10 * scale,
        background: selectedWidget.bgColor || '#f0f0f0',
        border: '2px solid #4285f4',
        zIndex: 1000
      }}>
        <input
          type="text"
          value={editingText.title}
          onChange={(e) => setEditingText(prev => ({ ...prev, title: e.target.value }))}
          style={{ width: '100%', fontSize: 16 * scale, marginBottom: 10 * scale }}
          placeholder="Title"
        />
        <textarea
          value={editingText.content}
          onChange={(e) => setEditingText(prev => ({ ...prev, content: e.target.value }))}
          style={{ width: '100%', height: 'calc(100% - 60px)', fontSize: 12 * scale }}
          placeholder="Content"
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 * scale }}>
          <button onClick={() => {
            updateWidget(selectedWidget.id, { title: editingText.title, content: editingText.content });
            setState(prev => ({ ...prev, isEditing: false }));
          }}>Save</button>
          <button onClick={() => setState(prev => ({ ...prev, isEditing: false }))}>Cancel</button>
        </div>
      </div>
    );
  }

  return null;
}
