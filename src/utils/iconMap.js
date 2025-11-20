// src/icons/iconMap.js
// 映射：Icon 名称 → SVG 路径
import undoSvg from '../assets/undo.svg';
import editSvg from '../assets/edit.svg';
import colorDisableSvg from '../assets/colorDisable.svg';
import colorEnableSvg from '../assets/colorEnable.svg';
import saveSvg from '../assets/save.svg';
import toExpandSvg from '../assets/toExpand.svg';
import toNormalSvg from '../assets/toNormal.svg';
import deleteSvg from '../assets/delete.svg';

export const iconMap = {
  undo: undoSvg,
  edit: editSvg,
  colorDisable: colorDisableSvg,
  colorEnable: colorEnableSvg,
  save: saveSvg,
  toExpand: toExpandSvg,
  toNormal: toNormalSvg,
  delete: deleteSvg,
};

// 导出所有 Icon 名称（用于类型提示）
export const iconNames = Object.keys(iconMap);