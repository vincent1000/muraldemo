// src/icons/Icon.jsx
import { iconMap, iconNames } from './iconMap';

export default function Icon({
  name, // Icon 名称（必须在 iconNames 中）
  size = 18,
  color,
  hoverColor,
  activeColor,
  disabled = false,
  isActive = false,
  style = {},
  ...props
}) {
  // 校验 Icon 名称是否存在
  if (!iconNames.includes(name)) {
    console.error(`Icon "${name}" 不存在，请检查 iconMap.js`);
    return null;
  }

  // 获取 SVG URL
  const svgUrl = iconMap[name];

  // 合并样式
  const imgStyle = {
    width: size,
    height: size,
    display: 'block',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.2s ease',
    ...style,
  };

  return (
    <img
      src={svgUrl}
      alt={name}
      style={imgStyle}
      {...props}
    />
  );
}