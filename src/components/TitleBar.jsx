import React from 'react';
import iconUrl from '../assets/icon.png';

function TitleBar({
  debugOpen,
  setDebugOpen,
  scale,
  generateNewCard,
  generateNewImage
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#E6E6E6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 999,
        backdropFilter: 'blur(8px)',
        gap: 16,
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        userSelect: 'none'
      }}
    >
      <div>
        <span style={{
          fontWeight: '400',
          fontSize: '16px',
          color: '#000000',
          marginRight: '8px'
        }}>Hello Johnson</span>
        <span style={{ 
          fontWeight: '400',
          fontSize: '16px',
          color: '#737373'
        }}>let’s continue your work</span>
      </div>

      <div>
        {<img 
          src={iconUrl} 
          style={{ width: '40px', height: '40px' }}
        />}
      </div>
    </div>
  );
}

export default TitleBar;