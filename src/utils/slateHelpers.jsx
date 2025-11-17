// 初始化编辑内容
export const initialValue = [
  {
    type: 'paragraph',
    children: [{ text: '点击编辑卡片内容...' }],
  },
];

// 自定义 Slate 插件：支持撤销/重做（基于 Slate 内置 history）
export const withUndoRedo = (editor) => {
  // Slate 已内置 undo/redo 方法，无需额外扩展
  return editor;
};