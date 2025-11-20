import React from 'react';

const BottomActionBar = ({ 
  onNewTextCard, 
  onNewImageCard, 
  debugOpen, 
  onToggleDebug 
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 12,
        padding: 12,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        zIndex: 99999,
        pointerEvents: 'auto',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* 新增文字卡片 */}
      <button
        onClick={onNewTextCard}
        style={{
          padding: '8px 16px',
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          transition: 'background-color 0.2s ease'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#16a34a'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#22c55e'}
      >
        New Card
      </button>

      {/* 新增图片卡片 */}
      <button
        onClick={onNewImageCard}
        style={{
          padding: '8px 16px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          transition: 'background-color 0.2s ease'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
      >
        New Image
      </button>

      {/* 切换 Debug 面板 */}
      <button
        onClick={onToggleDebug}
        style={{
          padding: '8px 16px',
          background: debugOpen ? '#facc15' : '#e5e7eb',
          color: debugOpen ? '#1f2937' : '#4b5563',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          transition: 'background-color 0.2s ease'
        }}
      >
        {debugOpen ? 'Close Debug' : 'Open Debug'}
      </button>
    </div>
  );
};

export default BottomActionBar;
