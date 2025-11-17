// src/components/mural/types.ts
/** 卡片类型枚举 */
export type CardType = 'text' | 'image';

/** 卡片基础属性 */
export interface CardBase {
  id: string;
  type: CardType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  mode: 'normal' | 'expand';
  isSelected: boolean;
  isEditing: boolean;
}

/** 文本卡片属性 */
export interface TextCardData extends CardBase {
  type: 'text';
  content: string;
}

/** 图片卡片属性 */
export interface ImageCardData extends CardBase {
  type: 'image';
  imageUrl: string | null;
}

/** 所有卡片类型联合 */
export type CardData = TextCardData | ImageCardData;

/** 画布状态 */
export interface CanvasState {
  scale: number;
  translateX: number;
  translateY: number;
  isPanning: boolean;
  lastPanX: number;
  lastPanY: number;
}

/** 卡片工具栏属性 */
export interface CardToolbarProps {
  cardId: string;
  cardType: CardType;
  isEditing: boolean;
  onToggleEdit: (cardId: string) => void;
  onFormatText: (command: string, value?: string | null) => void;
  style?: React.CSSProperties;
}

/** 文本卡片组件属性 */
export interface TextCardProps extends TextCardData {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggleMode: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onEditContent: (cardId: string, content: string) => void;
  onEditTitle: (cardId: string, title: string) => void;
  cardRef: React.Ref<HTMLDivElement>;
}

/** 图片卡片组件属性 */
export interface ImageCardProps extends ImageCardData {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggleMode: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onUploadImage: (cardId: string, imageUrl: string) => void;
  cardRef: React.Ref<HTMLDivElement>;
}

/** 基础卡片组件属性 */
export interface BaseCardProps extends Omit<CardBase, 'type'> {
  type: CardType;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onToggleMode: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  cardRef: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}