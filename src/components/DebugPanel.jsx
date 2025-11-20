import React from 'react';

const DebugPanel = ({ 
  cards, 
  canvasState, 
  canvasRef,
  onEditCard,
  onCenterCard,
  onDeleteCard 
}) => {

  return (
    <div
      className="debug-panel"
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
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div style={{ 
        padding: 8, 
        borderBottom: '1px solid rgba(0,0,0,0.06)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          Card Coordinates (Total {cards.length})
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          scale {canvasState.scale.toFixed(2)}
        </div>
      </div>

      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          offsetX: {canvasState.offsetX.toFixed(2)}, offsetY: {canvasState.offsetY.toFixed(2)}
        </div>
        {cards.map((card) => {
          const viewX = (card.x * canvasState.scale) - canvasState.offsetX;
          const viewY = (card.y * canvasState.scale) - canvasState.offsetY;
          const viewRight = viewX + (card.width * canvasState.scale);
          const viewBottom = viewY + (card.height * canvasState.scale);
          const canvasEl = canvasRef.current;
          const rect = canvasEl ? canvasEl.getBoundingClientRect() : { width: 0, height: 0 };
          const visibleInCanvas = canvasEl && (
            viewX < rect.width &&
            viewRight > 0 &&
            viewY < rect.height &&
            viewBottom > 0
          );

          return (
            <div 
              key={card.id} 
              style={{ 
                marginBottom: 8, 
                padding: 8, 
                borderRadius: 6, 
                background: canvasState.selectedCardId === card.id 
                  ? 'rgba(66,133,244,0.06)' 
                  : 'rgba(0,0,0,0.02)', 
                border: '1px solid rgba(0,0,0,0.04)' 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {card.type.toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: visibleInCanvas ? '#16a34a' : '#dc2626' }}>
                  {visibleInCanvas ? 'Visible' : 'Hidden'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                id: {card.id}
              </div>
              <div style={{ fontSize: 12, color: '#333' }}>
                logic: x: {card.x.toFixed(2)}, y: {card.y.toFixed(2)} ({card.width}×{card.height})
              </div>
              <div style={{ fontSize: 12, color: '#333' }}>
                view: x: {viewX.toFixed(1)}, y: {viewY.toFixed(1)} — right/bottom: x: {viewRight.toFixed(1)}, y: {viewBottom.toFixed(1)}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                mode: {card.mode}, state: {card.state}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4, wordBreak: 'break-all' }}>
                title: {card.title || '(none)'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button 
                  style={{ 
                    fontSize: 12, 
                    padding: '4px 8px', 
                    background: '#e6f4ea', 
                    borderRadius: 4, 
                    border: 'none', 
                    cursor: 'pointer' 
                  }}
                  onClick={() => onEditCard(card.id)}
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
                    cursor: 'pointer' 
                  }}
                  onClick={() => onCenterCard(card)}
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
                    cursor: 'pointer' 
                  }}
                  onClick={() => onDeleteCard(card.id)}
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