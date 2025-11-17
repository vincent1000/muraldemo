// src/components/mural/ImageCard.jsx
import React, { useState, useRef } from 'react';
import BaseCard from './BaseCard';

/**
 * 图片卡片（扩展 BaseCard）
 * @param {Object} props - 继承 BaseCard 所有属性 + 图片专属属性
 * @param {string|null} props.imageUrl - 图片地址
 * @param {Function} props.onUploadImage - 图片上传回调
 */
const ImageCard = ({
  id,
  x,
  y,
  width,
  height,
  isSelected,
  mode,
  imageUrl,
  onClick,
  onMouseDown,
  onToggleMode,
  onDelete,
  onUploadImage,
  cardRef,
}) => {
  const fileInputRef = useRef(null);
  const [isHover, setIsHover] = useState(false);

  // 触发图片上传
  const handleUploadClick = (e) => {
    e.stopPropagation(); // 阻止冒泡到 BaseCard 的选中事件
    fileInputRef.current.click();
  };

  // 处理图片选择
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 简单校验图片格式
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('请上传 JPG/PNG/WEBP 格式的图片');
      return;
    }

    // 转成临时 URL 预览（实际项目中需上传到服务器，获取正式 URL）
    const tempUrl = URL.createObjectURL(file);
    onUploadImage(id, tempUrl);

    // 清空文件输入，避免重复上传同一文件触发不了 change 事件
    e.target.value = '';
  };

  // 图片容器样式（专属样式）
  const imageContainerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '4px',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  };
  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover', // 保持图片比例，填充容器
  };

  const uploadBtnStyle = {
    position: 'absolute',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: isHover || !imageUrl ? 1 : 0,
    transition: 'opacity 0.2s',
  };

  return (
    <BaseCard
      id={id}
      type="image"
      x={x}
      y={y}
      width={width}
      height={height}
      isSelected={isSelected}
      mode={mode}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onToggleMode={onToggleMode}
      onDelete={onDelete}
      cardRef={cardRef}
    >
      {/* 图片专属内容 */}
      <div
        style={imageContainerStyle}
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Card image" style={imageStyle} />
        ) : (
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>点击上传图片</span>
        )}
        {/* <button style={uploadBtnStyle} onClick={handleUploadClick}>
          {imageUrl ? '更换图片' : '上传图片'}
        </button> */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </BaseCard>
  );
};

export default ImageCard;