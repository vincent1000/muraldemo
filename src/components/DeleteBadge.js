import React from "react";
import { Group, Circle, Text } from "react-konva";

export default function DeleteBadge({ x, y, onClick }) {
  // Konva Group-based badge
  return (
    <Group x={x} y={y} onClick={onClick} listening>
      <Circle radius={12} fill="rgba(220,50,50,0.95)" />
      <Text text="×" fontSize={18} fill="#fff" offsetX={6} offsetY={9} />
    </Group>
  );
}