import React, { useState, useEffect } from 'react';

/**
 * ImageCard - 图片卡片组件
 * 特点：
 * 1. 两种模式：normal (560x560) 和 expanded (953x953)
 * 2. 简洁外观：纯图片展示，右下角时间戳，左下角 tag
 * 3. 选中时工具栏：undo、缩放、删除（无 edit 和 color）
 * 4. 支持图片更新接口
 */
const ImageCard = React.memo(({
  id,
  x,
  y,
  width,
  height,
  mode = 'normal',
  scale = 1,
  isSelected = false,
  imageUrl,
  tag = '',
  updatedAt = null,
  onClick = () => {},
  onMouseDown = () => {},
  onUpdateImage = () => {}, // 图片更新接口
  cardRef = null,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // 监听图片URL变化，重置加载状态
  useEffect(() => {
    if (imageUrl) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [imageUrl]);
  // 格式化时间戳（与 TextCard 保持一致）
  const formatTimestamp = (iso) => {
    if (!iso) return '';
    const then = new Date(iso);
    if (isNaN(then.getTime())) return '';
    const now = new Date();
    const diff = Math.floor((now - then) / 1000); // seconds
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 7 * 86400) {
      return then.toLocaleDateString('en-US', { weekday: 'short' });
    }
    const sameYear = now.getFullYear() === then.getFullYear();
    if (sameYear) {
      return `${then.getMonth() + 1}/${then.getDate()}`;
    }
    return `${then.getFullYear()}`;
  };

  // 卡片容器样式
  const cardStyle = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease',
    userSelect: 'none',
    borderRadius: '8px',
    border: isSelected ? '2px solid #4285f4' : '2px solid transparent',
    boxShadow: isSelected ? '0 4px 12px rgba(66, 133, 244, 0.3)' : 'none',
    boxSizing: 'border-box',
  };

  // 内容容器样式
  const contentStyle = {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    borderRadius: '6px',
  };

  // 图片样式
  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    borderRadius: '6px',
  };

  // Tag 样式（左下角）- 字体根据 scale 缩放
  const tagStyle = {
    position: 'absolute',
    bottom: `${12 * scale}px`,
    left: `${12 * scale}px`,
    padding: `${4 * scale}px ${12 * scale}px`,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#ffffff',
    fontSize: `${12 * scale}px`,
    fontWeight: '500',
    borderRadius: `${4 * scale}px`,
    backdropFilter: 'blur(4px)',
  };

  // 时间戳样式（右下角）- 字体根据 scale 缩放
  const timestampStyle = {
    position: 'absolute',
    bottom: `${12 * scale}px`,
    right: `${12 * scale}px`,
    padding: `${4 * scale}px ${8 * scale}px`,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#ffffff',
    fontSize: `${11 * scale}px`,
    borderRadius: `${4 * scale}px`,
    backdropFilter: 'blur(4px)',
  };

  return (
    <div
      id={`card-${id}`}
      ref={cardRef}
      style={cardStyle}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      <div style={contentStyle}>
        {/* 图片加载状态 */}
        {imageLoading && imageUrl && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            zIndex: 1,
          }}>
            <div style={{
              width: `${40 * scale}px`,
              height: `${40 * scale}px`,
              border: `${4 * scale}px solid #e0e0e0`,
              borderTopColor: '#4285f4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
        )}

        {/* 图片 */}
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Card content" 
            style={imageStyle}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: `${14 * scale}px`,
            backgroundColor: '#f5f5f5'
          }}>
            No Image
          </div>
        )}

        {/* 图片加载错误 */}
        {imageError && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ef4444',
            fontSize: `${14 * scale}px`,
            textAlign: 'center',
          }}>
            Failed to load image
          </div>
        )}

        {/* Tag（左下角） */}
        {tag && (
          <div style={tagStyle}>
            {tag}
          </div>
        )}

        {/* 时间戳（右下角） */}
        {updatedAt && (
          <div style={timestampStyle}>
            {formatTimestamp(updatedAt)}
          </div>
        )}
      </div>
      
      {/* 添加 CSS 动画 */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

ImageCard.displayName = 'ImageCard';

export default ImageCard;