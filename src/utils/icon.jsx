// src/icons/Icon.jsx
import { useState, lazy, Suspense } from 'react';
import { iconMap, iconNames } from './iconMap';

// 加载中占位符（可选）
const LoadingIcon = () => <svg width={18} height={18} viewBox="0 0 24 24" />;

export default function Icon({
  name, // Icon 名称（必须在 iconNames 中）
  size = 18,
  color = '#4a5568',
  hoverColor = '#4299e1',
  activeColor = '#2563eb',
  disabled = false,
  isActive = false,
  ...props
}) {
  // 校验 Icon 名称是否存在
  if (!iconNames.includes(name)) {
    console.error(`Icon "${name}" 不存在，请检查 iconMap.js`);
    return null;
  }

  // 动态导入 SVG 组件
  const SvgComponent = lazy(iconMap[name]);
  const [isHovered, setIsHovered] = useState(false);

  // 计算最终颜色
  const finalColor = disabled
    ? '#cbd5e1'
    : isActive
      ? activeColor
      : isHovered
        ? hoverColor
        : color;

  return (
    <Suspense fallback={<LoadingIcon />}>
      <SvgComponent
        width={size}
        height={size}
        fill="none"
        stroke={finalColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        onMouseEnter={() => !disabled && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        {...props}
      />
    </Suspense>
  );
}