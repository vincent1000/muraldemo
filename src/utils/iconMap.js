// src/icons/iconMap.js
// 映射：Icon 名称 → SVG 路径
export const iconMap = {
  undo: () => import('../assets/undo.svg?react'), // Vite 支持 ?react 直接转为组件
  edit: () => import('../assets/edit.svg?react'),
  color: () => import('../assets/color.svg?react'),
  scale: () => import('../assets/scale.svg?react'),
  delete: () => import('../assets/delete.svg?react'),
  // 新增 Icon 只需添加一行
  // add: () => import('./svg/add.svg?react'),
};

// 导出所有 Icon 名称（用于类型提示）
export const iconNames = Object.keys(iconMap);