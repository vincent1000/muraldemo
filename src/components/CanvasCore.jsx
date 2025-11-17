import { useRef, useEffect } from 'react';

export const CanvasCore = ({
  onCanvasMount,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel
}) => {
  const canvasRef = useRef(null);

  // 初始化画布并通知主组件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      onCanvasMount(canvas, ctx);
    }
  }, [onCanvasMount]);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    />
  );
};

export default CanvasCore;