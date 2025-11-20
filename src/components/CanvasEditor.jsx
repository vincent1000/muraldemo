import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import {
  initCanvasService,
  destroyCanvasService,
  subscribeToCanvasState,
  handleCanvasClick,
  handleUserButtonClick,
  handleCanvasPaste as serviceHandleCanvasPaste,
  setSelectedWidgetId,
  deleteWidget,
  scaleWidget,
  updateWidget,
  undo,
  redo,
  getSelectedWidget,
  sendControlClickEvent,
  addWidget,
  getWidgets
} from "../services/dataService";

// 控件类型定义（与 Service 层对齐：text-card/image）
const CONTROL_TYPES = {
  CARD: 'text',
  IMAGE: 'image'
};

// 图片缓存池：优化图片加载性能
const imageCache = new Map();

const OptimizedCanvasEditor = forwardRef((props, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const toolbarRef = useRef(null); // 仅用于高度计算，无实际内容
  const [context, setContext] = useState(null);
  const isDrawingRef = useRef(false);
  const [editingText, setEditingText] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [debugOpen, setDebugOpen] = useState(true);
  const [hasAddedDefaultWidgets, setHasAddedDefaultWidgets] = useState(false);

  // 核心状态：完全依赖 Service 层同步的状态（包含 widgets）
  const [canvasState, setCanvasState] = useState({
    userButtons: [],
    socketConnected: false,
    selectionType: "",
    canvasData: {
      widgets: [],
      imageVariations: [],
      lastClick: {}
    },
    selectedWidgetId: null,
    selectedWidget: null,
    history: [],
    historyIndex: -1
  });

  // 画布交互状态（拖拽、缩放、选中）
  const [state, setState] = useState({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    selectedControlId: null, // 兼容原有逻辑，与 canvasState.selectedWidgetId 同步
    isEditing: false,
    isDraggingControl: false
  });

  // 绘制函数引用：解决循环依赖
  const drawRef = useRef(null);

  // 动态计算容器高度（匹配工具栏高度）
  useEffect(() => {
    const updateContainerHeight = () => {
      const container = containerRef.current;
      const toolbar = toolbarRef.current;
      if (!container || !toolbar) return;

      const toolbarHeight = toolbar.offsetHeight;
      const containerHeight = window.innerHeight - toolbarHeight;
      container.style.height = `${containerHeight}px`;

      // 同步 Canvas 尺寸并重新绘制
      if (canvasRef.current) {
        canvasRef.current.width = container.offsetWidth;
        canvasRef.current.height = containerHeight;
        if (drawRef.current) drawRef.current();
      }
    };

    updateContainerHeight();
    window.addEventListener('resize', updateContainerHeight);
    const toolbarObserver = new ResizeObserver(updateContainerHeight);
    if (toolbarRef.current) toolbarObserver.observe(toolbarRef.current);

    return () => {
      window.removeEventListener('resize', updateContainerHeight);
      if (toolbarRef.current) toolbarObserver.unobserve(toolbarRef.current);
    };
  }, []);

  // Canvas 尺寸同步（监听容器变化）
  useEffect(() => {
    const syncCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      canvas.width = containerWidth;
      canvas.height = containerHeight;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;

      if (drawRef.current) drawRef.current();
    };

    syncCanvasSize();
    const containerObserver = new ResizeObserver(syncCanvasSize);
    if (containerRef.current) containerObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) containerObserver.unobserve(containerRef.current);
    };
  }, []);

  const initDefaultWidgets = useCallback(async () => {
      // 前置条件：未添加过 + Canvas就绪 + Socket就绪
      if (hasAddedDefaultWidgets) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !canvasState.socketConnected) return;

      console.log("【初始化】开始添加默认控件（同步执行，无延迟）");
      setHasAddedDefaultWidgets(true); // 标记为已添加，永久不再执行

      // 1. 初始化 Canvas 尺寸
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
      const ctx = canvas.getContext("2d");
      setContext(ctx);
      console.log("【初始化】Canvas 尺寸：", canvas.width, "x", canvas.height);

      // 2. 清理可能存在的重复控件（兜底）
      const existingWidgets = getWidgets();
      const cleanWidgets = existingWidgets.filter(w =>
          w.id !== "widget-card-default" && w.id !== "widget-image-default"
      );
      if (cleanWidgets.length !== existingWidgets.length) {
          window.canvasUpdateState?.({
              canvasData: { ...canvasState.canvasData, widgets: cleanWidgets }
          });
          console.log("【初始化】清理重复默认控件");
      }

      // 3. 添加文字卡片（同步）
      try {
          await addWidget({
              id: "widget-card-default",
              type: CONTROL_TYPES.CARD,
              x: 50, // 左上角位置，确保可见
              y: 50,
              width: 200,
              height: 150,
              title: "Sample Card",
              content: "This is an editable card",
              bgColor: "#f0f0f0",
              style: { color: "#333", fontSize: 14 },
              isEditable: true,
          });
          console.log("【初始化】文字卡片添加成功");
      } catch (err) {
          console.error("【初始化】文字卡片添加失败：", err);
          // 本地强制添加（无视 Socket 错误）
          window.canvasUpdateState?.({
              canvasData: {
                  ...canvasState.canvasData,
                  widgets: [...canvasState.canvasData.widgets, {
                      id: "widget-card-default",
                      type: CONTROL_TYPES.CARD,
                      x: 50,
                      y: 50,
                      width: 200,
                      height: 150,
                      title: "Sample Card",
                      content: "This is an editable card",
                      bgColor: "#f0f0f0",
                      style: { color: "#333", fontSize: 14 },
                      isEditable: true,
                  }]
              }
          });
      }

      // 4. 添加图片控件（同步，无延迟）
      try {
          await addWidget({
              id: "widget-image-default",
              type: CONTROL_TYPES.IMAGE,
              x: 300, // 卡片右侧，确保可见
              y: 50,
              width: 300,
              height: 200,
              src: "https://picsum.photos/300/200", // 简化图片链接，提高加载成功率
              rotation: 0,
              isLocked: false,
          });
          console.log("【初始化】图片控件添加成功");
      } catch (err) {
          console.error("【初始化】图片控件添加失败：", err);
          // 本地强制添加（无视 Socket 错误）
          window.canvasUpdateState?.({
              canvasData: {
                  ...canvasState.canvasData,
                  widgets: [...canvasState.canvasData.widgets, {
                      id: "widget-image-default",
                      type: CONTROL_TYPES.IMAGE,
                      x: 300,
                      y: 50,
                      width: 300,
                      height: 200,
                      src: "https://picsum.photos/300/200",
                      rotation: 0,
                      isLocked: false,
                  }]
              }
          });
      }

      // 5. 强制触发 3 次重绘（确保控件显示）
      const triggerRedraw = () => {
          if (drawRef.current) {
              drawRef.current();
              console.log("【初始化】触发重绘");
          }
      };
      triggerRedraw();
      setTimeout(triggerRedraw, 50);
      setTimeout(triggerRedraw, 150);

      console.log("【初始化】默认控件添加完成，当前总数：", getWidgets().length);
  }, [hasAddedDefaultWidgets, canvasState.socketConnected]);

  // 触发条件：组件挂载 + Socket 状态变化
  useEffect(() => {
      // 组件挂载时执行一次
      initDefaultWidgets();
      // Socket 状态从 false 变为 true 时再执行一次（兜底）
      if (canvasState.socketConnected) {
          initDefaultWidgets();
      }
  }, [initDefaultWidgets, canvasState.socketConnected]);

// 绘制函数添加强制日志（确认执行）
  // 核心绘制函数：基于 Service 的 widgets 数据源
  const draw = useCallback(() => {
      if (!context || !canvasRef.current) {
          console.log("【绘制】context 未就绪");
          return;
      }
      if (isDrawingRef.current) return;
      isDrawingRef.current = true;

      requestAnimationFrame(() => {
          try {
              const canvas = canvasRef.current;
              const ctx = context;
              const widgets = canvasState.canvasData.widgets || [];

              console.log("【绘制】开始绘制，控件数：", widgets.length);

              // 强制清空画布并绘制背景（避免残留）
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#e0e0e0';
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              // 遍历绘制所有控件
              widgets.forEach((widget) => {
                  const viewX = (widget.x * state.scale) - state.offsetX;
                  const viewY = (widget.y * state.scale) - state.offsetY;
                  const viewW = widget.width * state.scale;
                  const viewH = widget.height * state.scale;

                  console.log(`【绘制】控件 ${widget.id}：`, { viewX, viewY, viewW, viewH });

                  // 强制绘制占位框（无论类型，确保可见）
                  ctx.strokeStyle = '#4285f4';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(viewX, viewY, viewW, viewH);
                  ctx.fillStyle = 'rgba(66, 133, 244, 0.1)';
                  ctx.fillRect(viewX, viewY, viewW, viewH);

                  // 绘制控件内容（原有逻辑）
                  switch (widget.type) {
                      case CONTROL_TYPES.CARD:
                          drawCard(ctx, viewX, viewY, viewW, viewH, widget, state.scale, canvasState.selectedWidgetId === widget.id, state.isEditing);
                          break;
                      case CONTROL_TYPES.IMAGE:
                          drawImageOptimized(ctx, viewX, viewY, viewW, viewH, widget, state.scale, canvasState.selectedWidgetId === widget.id);
                          break;
                  }
              });
          } catch (err) {
              console.error("【绘制】错误：", err);
          } finally {
              isDrawingRef.current = false;
          }
      });
  }, [context, canvasState.canvasData.widgets, canvasState.selectedWidgetId, state]);
  // 初始化：连接 Service + 生成默认控件（直接添加到 widgets）
  // CanvasEditor.jsx
// CanvasEditor.jsx
// 第一个 useEffect（初始化 Service + 订阅状态）
useEffect(() => {
  console.log("【初始化】第一步：初始化 Service + 订阅状态");
  let isMounted = true;
  let loadingTimeout; // 超时强制关闭加载

  // 1. 初始化 Service
  const initService = async () => {
    try {
      await initCanvasService();
      console.log("【初始化】Service 初始化完成");
      // Service 初始化完成后，强制关闭加载
      if (isMounted) setLoading(false);
    } catch (err) {
      console.error("【初始化】Service 初始化失败：", err.message);
      if (isMounted) {
        setErrorMsg("Service 初始化失败：" + err.message);
        setLoading(false); // 失败也关闭加载
      }
    }
  };
  initService();

  // 🔴 超时保护：3秒后强制关闭加载（防止卡死）
  loadingTimeout = setTimeout(() => {
    if (isMounted) {
      console.log("【初始化】加载超时，强制关闭加载状态");
      setLoading(false);
    }
  }, 3000);

  // 2. 订阅 Service 状态变化
  const unsubscribe = subscribeToCanvasState((newState) => {
    try {
      if (!isMounted) return;
      console.log(
        "【状态订阅】收到新状态：Socket状态=",
        newState.socketConnected,
        "控件数=",
        newState.canvasData.widgets.length
      );
      setCanvasState((prev) => ({ ...prev, ...newState }));
      setState((prev) => ({ ...prev, selectedControlId: newState.selectedWidgetId }));
    } catch (err) {
      console.error("【状态订阅】回调失败：", err.message);
    }
  });

  // 3. 组件卸载时清理
  return () => {
    isMounted = false;
    clearTimeout(loadingTimeout); // 清除超时计时器
    unsubscribe();
    destroyCanvasService();
    console.log("【清理】组件卸载，已取消订阅 + 销毁 Service");
  };
}, []);
// initCanvasAndAddWidgets 函数中，加强去重逻辑
// 移除 useCallback 的依赖数组，确保函数只创建一次
const initCanvasAndAddWidgets = useCallback(async () => {
  const canvas = canvasRef.current;
  const container = containerRef.current;
  if (!canvas || !container) return false; // 返回 false 表示未完成

  // 初始化 Canvas 尺寸
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
  const ctx = canvas.getContext("2d");
  setContext(ctx);
  console.log("【初始化】Canvas 尺寸初始化完成：", canvas.width, "x", canvas.height);

  // 添加默认控件（固定 id + 严格去重）
  const existingWidgets = getWidgets();
  const hasDefaultCard = existingWidgets.some(w => w.id === "widget-card-default");
  const hasDefaultImage = existingWidgets.some(w => w.id === "widget-image-default");
  let allAdded = true; // 标记是否全部添加完成

  // 1. 添加文字卡片（同步执行，无延迟）
  if (!hasDefaultCard) {
    try {
      await addWidget({
        id: "widget-card-default",
        type: CONTROL_TYPES.CARD,
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        title: "Sample Card",
        content: "This is an editable card",
        bgColor: "#f0f0f0",
        style: { color: "#333", fontSize: 14 },
        isEditable: true,
      });
      console.log("【初始化】默认文字卡片添加成功");
    } catch (err) {
      console.error("【初始化】添加文字卡片失败：", err.message);
      setErrorMsg("添加默认卡片失败：" + err.message);
      allAdded = false;
    }
  }

  // 2. 添加图片控件（带延迟和重试，异步执行）
  if (!hasDefaultImage) {
    try {
      // 延迟 500ms 执行（避免连续调用）
      await new Promise(resolve => setTimeout(resolve, 500));
      await addWidget({
        id: "widget-image-default",
        type: CONTROL_TYPES.IMAGE,
        x: 300,
        y: 200,
        width: 300,
        height: 200,
        src: "https://picsum.photos/seed/img1/300/200",
        rotation: 0,
        isLocked: false,
      });
      console.log("【初始化】默认图片控件添加成功");
    } catch (err) {
      console.error("【初始化】添加图片控件失败，尝试重试...", err.message);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await addWidget({
          id: "widget-image-default",
          type: CONTROL_TYPES.IMAGE,
          x: 300,
          y: 200,
          width: 300,
          height: 200,
          src: "https://picsum.photos/seed/img1/300/200",
          rotation: 0,
          isLocked: false,
        });
        console.log("【初始化】默认图片控件重试添加成功");
      } catch (retryErr) {
        console.error("【初始化】添加图片控件重试失败：", retryErr.message);
        // 兜底：本地添加，确保图片控件存在
        const imageWidget = {
          id: "widget-image-default",
          type: CONTROL_TYPES.IMAGE,
          x: 300,
          y: 200,
          width: 300,
          height: 200,
          src: "https://picsum.photos/seed/img1/300/200",
          rotation: 0,
          isLocked: false,
        };
        if (window.canvasUpdateState) {
          window.canvasUpdateState({
            canvasData: {
              ...canvasState.canvasData,
              widgets: [...canvasState.canvasData.widgets.filter(w => w.id !== imageWidget.id), imageWidget]
            }
          });
          console.log("【初始化】兜底方案：本地添加图片控件成功");
          setErrorMsg("");
        } else {
          setErrorMsg("添加默认图片失败：" + retryErr.message);
          allAdded = false;
        }
      }
    }
  }

  // 手动触发重绘（确保两个控件都显示）
  if (drawRef.current) {
    console.log("【初始化】手动触发重绘（双控件）");
    drawRef.current();
    setTimeout(() => drawRef.current(), 100);
  }

  console.log("【初始化】默认控件添加流程结束，当前总数：", getWidgets().length);
  return allAdded; // 返回 true 表示全部添加完成（或兜底完成）
}, []); // 无依赖，函数引用稳定
// 第二个 useEffect：轮询检查 refs 就绪（核心修复：清理旧定时器）
// 第二个 useEffect：轮询检查 refs 就绪（最终版，等待图片添加完成）
useEffect(() => {
  console.log(
    "【初始化】第二步：启动依赖检查轮询（Socket状态=", canvasState.socketConnected, "）"
  );

  let checkTimer;
  let hasInitiated = false; // 标记是否已触发过添加流程（避免重复触发）
  let hasCompleted = false; // 标记是否全部添加完成（包括图片）

  const checkDependencies = async () => {
    const canvasReady = !!canvasRef.current;
    const containerReady = !!containerRef.current;
    const socketReady = canvasState.socketConnected;

    console.log(
      "【初始化】轮询检查依赖：",
      "Canvas=", canvasReady,
      "容器=", containerReady,
      "Socket连接=", socketReady,
      "已触发添加=", hasInitiated,
      "已全部完成=", hasCompleted
    );

    // 条件：依赖就绪 + 未触发过添加流程
    if (canvasReady && containerReady && socketReady && !hasInitiated) {
      hasInitiated = true; // 标记为已触发，避免重复执行
      console.log("【初始化】开始执行控件添加流程（包含图片延迟逻辑）");
      // 等待添加流程全部完成（包括图片的 500ms 延迟 + 重试）
      const result = await initCanvasAndAddWidgets();
      hasCompleted = result; // 标记为已完成
      console.log("【初始化】控件添加流程全部完成，是否成功：", result);
    }

    // 🔴 关键：只有全部添加完成后，才停止轮询
    if (hasCompleted) {
      clearInterval(checkTimer);
      console.log("【初始化】轮询结束（全部控件添加完成）");
    }
  };

  // 启动轮询（每 200ms 检查一次，直到全部完成）
  checkTimer = setInterval(checkDependencies, 200);

  // 组件卸载时清理定时器（无论是否完成）
  return () => {
    console.log("【初始化】清理旧轮询定时器");
    clearInterval(checkTimer);
  };
}, [canvasState.socketConnected]); // 仅依赖 Socket 状态
  // 坐标转换：视图坐标 → 逻辑坐标
  const viewToLogic = useCallback((viewX, viewY) => ({
    x: (viewX + state.offsetX) / state.scale,
    y: (viewY + state.offsetY) / state.scale
  }), [state.offsetX, state.offsetY, state.scale]);

  // 坐标转换：逻辑坐标 → 视图坐标
  const logicToView = useCallback((logicX, logicY) => ({
    x: (logicX * state.scale) - state.offsetX,
    y: (logicY * state.scale) - state.offsetY
  }), [state.scale, state.offsetX, state.offsetY]);

  // 绘制文字卡片（适配 Service 的 text-card 类型）
  const drawCard = (ctx, x, y, w, h, widget, scale, isSelected, isEditing) => {
    // 使用控件自带样式，无则用默认值
    const bgColor = widget.bgColor || '#f0f0f0';
    const textColor = widget.style?.color || '#333';
    const titleFontSize = (widget.style?.fontSize || 16) * scale;
    const contentFontSize = (widget.style?.fontSize || 12) * scale;
    const editHintFontSize = 12 * scale;

    // 绘制卡片背景和边框
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = isSelected ? '#4285f4' : '#bbbbbb';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // 绘制标题（如果有）
    if (widget.title) {
      ctx.fillStyle = textColor;
      ctx.font = `${titleFontSize}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(widget.title, x + 10 * scale, y + 10 * scale);
    }

    // 绘制内容（支持换行）
    ctx.font = `${contentFontSize}px Arial`;
    ctx.fillStyle = textColor || '#666';
    const contentLines = (widget.content || '').split('\n');
    const contentYStart = widget.title ? 40 * scale : 10 * scale;
    contentLines.forEach((line, index) => {
      // 限制内容行数，避免超出卡片
      if (index < 5) {
        ctx.fillText(line, x + 10 * scale, y + contentYStart + (index * 20 * scale));
      } else if (index === 5) {
        ctx.fillText('...', x + 10 * scale, y + contentYStart + (index * 20 * scale));
      }
    });

    // 编辑提示
    if (isSelected && !isEditing && widget.isEditable) {
      ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
      ctx.font = `${editHintFontSize}px Arial`;
      ctx.fillText('Click to edit', x + 10 * scale, y + h - 25 * scale);
    }
  };

  // 绘制图片加载失败占位符
  const drawErrorPlaceholder = (ctx, x, y, w, h) => {
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ff4444';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image load failed', x + w / 2, y + h / 2);
  };

  // 绘制图片到画布
  const drawImageToCanvas = (ctx, img, x, y, w, h, isSelected, scale, widget) => {
    try {
      // 处理图片旋转（如果有）
      if (widget.rotation && widget.rotation !== 0) {
        ctx.save();
        // 旋转中心：图片中心
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((widget.rotation * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y, w, h);
      }
    } catch (err) {
      drawErrorPlaceholder(ctx, x, y, w, h);
      return;
    }

    // 绘制边框
    ctx.strokeStyle = isSelected ? '#4285f4' : 'rgba(187, 187, 187, 0.5)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(x, y, w, h);

    // 锁定状态提示
    if (widget.isLocked) {
      ctx.fillStyle = 'rgba(255, 159, 64, 0.8)';
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillText('Locked', x + 10 * scale, y + 10 * scale);
    } else if (isSelected) {
      ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillText('Image Control', x + 10 * scale, y + 10 * scale);
    }
  };

  // 优化图片绘制（带缓存）
  const drawImageOptimized = (ctx, x, y, w, h, widget, scale, isSelected) => {
    const src = widget.src;
    if (!src) {
      drawErrorPlaceholder(ctx, x, y, w, h);
      return;
    }

  console.log(`【图片绘制】widget-image-default 加载状态：`, imageCache.get(src)?.status);
    const cacheEntry = imageCache.get(src);
    if (cacheEntry) {
      if (cacheEntry.status === 'loaded' && cacheEntry.img) {
        drawImageToCanvas(ctx, cacheEntry.img, x, y, w, h, isSelected, scale, widget);
      } else if (cacheEntry.status === 'error') {
        drawErrorPlaceholder(ctx, x, y, w, h);
      }
      return;
    }

    // 加载图片并缓存
    const img = new Image();
    img.crossOrigin = 'anonymous'; // 解决跨域图片绘制问题
    imageCache.set(src, { status: 'loading', img: null });

    img.onload = () => {
      imageCache.set(src, { status: 'loaded', img });
      if (drawRef.current) drawRef.current();
    };

    img.onerror = () => {
      imageCache.set(src, { status: 'error', img: null });
      if (drawRef.current) drawRef.current();
    };

    img.src = src;
  };

  // 赋值绘制函数到 ref，供其他地方调用
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // 监听状态变化，触发重绘
  useEffect(() => {
    if (drawRef.current) {
      drawRef.current();
    }
  }, [state, canvasState.canvasData.widgets]);

  // 鼠标移动事件（拖拽画布/控件）
  const handleMouseMove = (e) => {
    const widgets = canvasState.canvasData.widgets || [];
    if (state.isDraggingControl && state.selectedControlId !== null) {
      // 拖拽控件（仅允许非锁定控件）
      const selectedWidget = widgets.find(w => w.id === state.selectedControlId);
      if (!selectedWidget || selectedWidget.isLocked) return;

      const deltaX = e.clientX - state.lastX;
      const deltaY = e.clientY - state.lastY;
      const deltaLogicX = deltaX / state.scale;
      const deltaLogicY = deltaY / state.scale;

      // 调用 Service 更新控件位置（同步到 widgets）
      updateWidget(state.selectedControlId, {
        x: selectedWidget.x + deltaLogicX,
        y: selectedWidget.y + deltaLogicY
      }).catch(err => {
        console.error("拖拽控件失败：", err);
        setErrorMsg("拖拽失败：" + err.message);
      });

      setState(prev => ({ ...prev, lastX: e.clientX, lastY: e.clientY }));
    } else if (state.isDragging) {
      // 拖拽画布
      const deltaX = e.clientX - state.lastX;
      const deltaY = e.clientY - state.lastY;

      setState(prev => ({
        ...prev,
        offsetX: prev.offsetX - deltaX,
        offsetY: prev.offsetY - deltaY,
        lastX: e.clientX,
        lastY: e.clientY
      }));
    }
  };

  // 鼠标滚轮缩放事件
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewX = e.clientX - rect.left;
    const viewY = e.clientY - rect.top;
    const logicPos = viewToLogic(viewX, viewY);

    setState(prev => {
      const newScale = e.deltaY < 0
        ? Math.min(prev.scale * 1.1, 5)  // 最大缩放 5 倍
        : Math.max(prev.scale / 1.1, 0.1); // 最小缩放 0.1 倍
      const newOffsetX = (logicPos.x * newScale) - viewX;
      const newOffsetY = (logicPos.y * newScale) - viewY;
      return { ...prev, scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
    });
  }, [viewToLogic]);

  // 文字卡片点击进入编辑模式
  const handleCardClick = (widget) => {
    if (!widget.isEditable) {
      setErrorMsg("该卡片不可编辑");
      return;
    }
    setState(prev => ({
      ...prev,
      selectedControlId: widget.id,
      isEditing: true
    }));
    setEditingText({ title: widget.title || '', content: widget.content || '' });
  };

  // 保存文字卡片编辑内容
  const saveCardEditing = (widgetId) => {
    updateWidget(widgetId, {
      title: editingText.title,
      content: editingText.content
    }).catch(err => setErrorMsg("保存失败：" + err.message));
    setState(prev => ({ ...prev, isEditing: false }));
  };

  // 文字卡片编辑表单
  const renderInCardEditor = () => {
    const selectedWidgetId = canvasState.selectedWidgetId;
    if (!selectedWidgetId || !state.isEditing) return null;

    const widgets = canvasState.canvasData.widgets || [];
    const selectedWidget = widgets.find(w => w.id === selectedWidgetId && w.type === CONTROL_TYPES.CARD);
    if (!selectedWidget || !selectedWidget.isEditable) return null;

    const viewPos = logicToView(selectedWidget.x, selectedWidget.y);
    const scale = state.scale;

    return (
      <div
        style={{
          position: 'absolute',
          left: viewPos.x,
          top: viewPos.y,
          width: selectedWidget.width * scale,
          height: selectedWidget.height * scale,
          padding: 10 * scale,
          boxSizing: 'border-box',
          background: selectedWidget.bgColor || '#f0f0f0',
          border: '2px solid #4285f4',
          borderRadius: 2,
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        <input
          type="text"
          value={editingText.title}
          onChange={(e) => setEditingText(prev => ({ ...prev, title: e.target.value }))}
          style={{
            width: '100%',
            fontSize: 16 * scale,
            marginBottom: 10 * scale,
            border: '1px solid #ddd',
            borderRadius: 3,
            padding: 5 * scale,
            boxSizing: 'border-box',
            outline: 'none',
            backgroundColor: 'white'
          }}
          autoFocus
          placeholder="Title"
        />
        <textarea
          value={editingText.content}
          onChange={(e) => setEditingText(prev => ({ ...prev, content: e.target.value }))}
          style={{
            width: '100%',
            height: 'calc(100% - 80px)',
            fontSize: 12 * scale,
            border: '1px solid #ddd',
            borderRadius: 3,
            padding: 5 * scale,
            boxSizing: 'border-box',
            resize: 'none',
            outline: 'none',
            backgroundColor: 'white'
          }}
          placeholder="Content (supports line breaks)"
        />
        <div style={{
          display: 'flex',
          gap: 10 * scale,
          marginTop: 10 * scale,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => saveCardEditing(selectedWidget.id)}
            style={{
              padding: `5px ${10 * scale}px`,
              background: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12 * scale
            }}
          >
            Save
          </button>
          <button
            onClick={() => setState(prev => ({ ...prev, isEditing: false }))}
            style={{
              padding: `5px ${10 * scale}px`,
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12 * scale,
              color: '#333'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // 图片控件编辑表单
  const renderImageEditForm = () => {
    const selectedWidgetId = canvasState.selectedWidgetId;
    if (!selectedWidgetId || !state.isEditing) return null;

    const widgets = canvasState.canvasData.widgets || [];
    const selectedWidget = widgets.find(w => w.id === selectedWidgetId && w.type === CONTROL_TYPES.IMAGE);
    if (!selectedWidget) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      setState(prev => ({ ...prev, isEditing: false }));
    };

    const handleImageReplace = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        // 清除缓存，重新加载图片
        imageCache.delete(selectedWidget.src);
        await updateWidget(selectedWidget.id, { src: base64 });
        e.target.value = ''; // 重置文件输入
      } catch (err) {
        setErrorMsg("图片替换失败：" + err.message);
      }
    };

    const viewPos = logicToView(selectedWidget.x, selectedWidget.y);
    const imageViewWidth = selectedWidget.width * state.scale;
    const imageViewHeight = selectedWidget.height * state.scale;
    const scale = state.scale;
    const formLeft = viewPos.x + (imageViewWidth - 300 * scale) / 2;
    const formTop = viewPos.y + imageViewHeight + 10 * scale;

    return (
      <div
        style={{
          position: 'absolute',
          left: formLeft,
          top: formTop,
          width: 300 * scale,
          background: 'white',
          padding: 12 * scale,
          border: '1px solid #ddd',
          borderRadius: 6 * scale,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          boxSizing: 'border-box'
        }}
      >
        <h3 style={{
          margin: 0,
          fontSize: 16 * scale,
          marginBottom: 12 * scale,
          color: '#333'
        }}>Edit Image</h3>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ marginBottom: 10 * scale }}>
            <label style={{
              display: 'block',
              fontSize: 12 * scale,
              fontWeight: '500',
              color: '#666',
              marginBottom: 4 * scale
            }}>Image URL:</label>
            <input
              type="text"
              value={selectedWidget.src}
              onChange={(e) => {
                imageCache.delete(selectedWidget.src);
                updateWidget(selectedWidget.id, { src: e.target.value });
              }}
              style={{
                width: '100%',
                padding: 6 * scale,
                border: '1px solid #ddd',
                borderRadius: 3 * scale,
                fontSize: 12 * scale,
                boxSizing: 'border-box'
              }}
              placeholder="Enter image URL"
            />
          </div>
          <div style={{ marginBottom: 10 * scale }}>
            <label style={{
              display: 'block',
              fontSize: 12 * scale,
              fontWeight: '500',
              color: '#666',
              marginBottom: 4 * scale
            }}>Upload Local Image:</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageReplace}
              style={{
                width: '100%',
                fontSize: 12 * scale,
                padding: 4 * scale
              }}
            />
          </div>
          <div style={{ marginBottom: 10 * scale }}>
            <label style={{
              display: 'block',
              fontSize: 12 * scale,
              fontWeight: '500',
              color: '#666',
              marginBottom: 4 * scale
            }}>Rotation:</label>
            <input
              type="number"
              value={selectedWidget.rotation || 0}
              onChange={(e) => {
                const rotation = parseInt(e.target.value) || 0;
                updateWidget(selectedWidget.id, { rotation });
              }}
              style={{
                width: '100%',
                padding: 6 * scale,
                border: '1px solid #ddd',
                borderRadius: 3 * scale,
                fontSize: 12 * scale,
                boxSizing: 'border-box'
              }}
              placeholder="Rotation angle (0-360)"
              min="0"
              max="360"
            />
          </div>
          <div style={{ marginBottom: 10 * scale }}>
            <label style={{
              display: 'inline-block',
              fontSize: 12 * scale,
              fontWeight: '500',
              color: '#666',
              marginRight: 8 * scale
            }}>Lock:</label>
            <input
              type="checkbox"
              checked={selectedWidget.isLocked || false}
              onChange={(e) => {
                updateWidget(selectedWidget.id, { isLocked: e.target.checked });
              }}
              style={{
                width: 14 * scale,
                height: 14 * scale
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            gap: 8 * scale,
            justifyContent: 'flex-end'
          }}>
            <button
              type="submit"
              style={{
                padding: `6px ${12 * scale}px`,
                background: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: 3 * scale,
                cursor: 'pointer',
                fontSize: 12 * scale
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setState(prev => ({ ...prev, isEditing: false }))}
              style={{
                padding: `6px ${12 * scale}px`,
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 3 * scale,
                cursor: 'pointer',
                fontSize: 12 * scale,
                color: '#333'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteWidget(selectedWidget.id).catch(err => setErrorMsg(err.message))}
              style={{
                padding: `6px ${12 * scale}px`,
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: 3 * scale,
                cursor: 'pointer',
                fontSize: 12 * scale
              }}
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    );
  };

  // 动态工具栏（选中控件时显示）
  const renderDynamicToolbar = useCallback(() => {
    const selectedWidgetId = canvasState.selectedWidgetId;
    if (!selectedWidgetId) return null;

    const widgets = canvasState.canvasData.widgets || [];
    const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
    if (!selectedWidget) return null;

    const toolbarWidth = 420;
    const toolbarHeight = 42;
    const canvasRect = containerRef.current?.getBoundingClientRect() || {};
    const viewPos = logicToView(selectedWidget.x, selectedWidget.y);
    const viewWidth = selectedWidget.width * state.scale;
    const viewHeight = selectedWidget.height * state.scale;

    // 工具栏位置计算（水平居中，垂直上方/下方）
    let left = viewPos.x + viewWidth / 2 - toolbarWidth / 2;
    let top = viewPos.y - toolbarHeight - 10;

    // 边界处理
    if (left < 0) left = 10;
    if (left + toolbarWidth > canvasRect.width) left = canvasRect.width - toolbarWidth - 10;
    if (top < 0) top = viewPos.y + viewHeight + 10;

    const isTextCard = selectedWidget.type === CONTROL_TYPES.CARD;
    const canUndo = canvasState.historyIndex >= 0;
    const canRedo = canvasState.historyIndex < (canvasState.history.length - 1);

    return (
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: toolbarWidth,
          height: toolbarHeight,
          backgroundColor: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          zIndex: 999,
          border: "1px solid #f0f0f0",
        }}
      >
        {/* 撤销/重做 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => undo().catch((err) => setErrorMsg(err.message))}
            disabled={!canUndo}
            style={{
              border: "none",
              background: "none",
              cursor: canUndo ? "pointer" : "not-allowed",
              color: canUndo ? "#333" : "#ccc",
              fontSize: 14,
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            Undo
          </button>
          <button
            onClick={() => redo().catch((err) => setErrorMsg(err.message))}
            disabled={!canRedo}
            style={{
              border: "none",
              background: "none",
              cursor: canRedo ? "pointer" : "not-allowed",
              color: canRedo ? "#333" : "#ccc",
              fontSize: 14,
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            Redo
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: "#eee" }}></div>

        {/* 删除 */}
        <button
          onClick={() => {
            deleteWidget(selectedWidgetId).catch((err) => setErrorMsg(err.message));
            setState((prev) => ({ ...prev, selectedControlId: null, isEditing: false }));
          }}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#ff4d4f",
            fontSize: 14,
            padding: "4px 8px",
            borderRadius: 4,
          }}
        >
          del
        </button>

        <div style={{ width: 1, height: 24, background: "#eee" }}></div>

        {/* 放大/缩小 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => scaleWidget(selectedWidgetId, 1.2).catch((err) => setErrorMsg(err.message))}
            disabled={selectedWidget.isLocked}
            style={{
              border: "none",
              background: "none",
              cursor: selectedWidget.isLocked ? "not-allowed" : "pointer",
              color: selectedWidget.isLocked ? "#ccc" : "#333",
              fontSize: 14,
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            ZoomIn
          </button>
          <button
            onClick={() => scaleWidget(selectedWidgetId, 0.8).catch((err) => setErrorMsg(err.message))}
            disabled={selectedWidget.isLocked}
            style={{
              border: "none",
              background: "none",
              cursor: selectedWidget.isLocked ? "not-allowed" : "pointer",
              color: selectedWidget.isLocked ? "#ccc" : "#333",
              fontSize: 14,
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            ZoomOut
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: "#eee" }}></div>

        {/* 缓存内容到后端 */}
        <button
          onClick={() => {
            sendControlClickEvent(selectedWidget)
              .then(() => setErrorMsg("缓存成功！"))
              .catch((err) => setErrorMsg("缓存失败：" + err.message));
          }}
          disabled={selectedWidget.isLocked}
          style={{
            border: "none",
            background: "#facc15",
            color: "#1f2937",
            cursor: selectedWidget.isLocked ? "not-allowed" : "pointer",
            fontSize: 14,
            padding: "4px 8px",
            borderRadius: 4,
          }}
        >
          Cache
        </button>

        <div style={{ width: 1, height: 24, background: "#eee" }}></div>

        {/* 编辑 */}
        <button
          onClick={() => {
            if (isTextCard) {
              handleCardClick(selectedWidget);
            } else {
              setState((prev) => ({ ...prev, isEditing: true }));
            }
          }}
          disabled={selectedWidget.isLocked || (isTextCard && !selectedWidget.isEditable)}
          style={{
            border: "none",
            background: selectedWidget.isLocked || (isTextCard && !selectedWidget.isEditable) ? "#ccc" : "#1890ff",
            color: "#fff",
            cursor: selectedWidget.isLocked || (isTextCard && !selectedWidget.isEditable) ? "not-allowed" : "pointer",
            fontSize: 14,
            padding: "4px 12px",
            borderRadius: 4,
          }}
        >
          Edit
        </button>
      </div>
    );
  }, [
    canvasState.selectedWidgetId,
    canvasState.canvasData.widgets,
    canvasState.history,
    canvasState.historyIndex,
    state.scale,
    state.isEditing,
    containerRef,
    logicToView,
    handleCardClick
  ]);

  // Debug 面板
  const renderDebugPanel = () => {
    const widgets = canvasState.canvasData.widgets || [];
    return (
      <div
        className="debug-panel"
        style={{
          position: 'fixed',
          top: 60,
          right: 8,
          width: 320,
          maxHeight: '70vh',
          overflow: 'auto',
          background: '#fff',
          color: '#333',
          borderRadius: 8,
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          zIndex: 99999,
          pointerEvents: 'auto',
          padding: 0,
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div style={{ padding: 8, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Widget Coordinates (Total {widgets.length})</div>
          <div style={{ fontSize: 12, color: '#666' }}>scale {state.scale.toFixed(2)}</div>
        </div>

        <div style={{ padding: 8 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            offsetX: {state.offsetX.toFixed(2)}, offsetY: {state.offsetY.toFixed(2)}
          </div>
          {widgets.map((widget) => {
            const view = logicToView(widget.x, widget.y);
            const viewRightBottom = logicToView(widget.x + widget.width, widget.y + widget.height);
            const canvas = canvasRef.current;
            const visibleInCanvas = canvas && (
              view.x < canvas.width &&
              viewRightBottom.x > 0 &&
              view.y < canvas.height &&
              viewRightBottom.y > 0
            );
            return (
              <div key={widget.id} style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: canvasState.selectedWidgetId === widget.id ? 'rgba(66,133,244,0.06)' : 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{widget.type.toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: visibleInCanvas ? '#16a34a' : '#dc2626' }}>{visibleInCanvas ? 'Visible' : 'Hidden'}</div>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>id: {widget.id}</div>
                <div style={{ fontSize: 12, color: '#333' }}>logic: x: {widget.x.toFixed(2)}, y: {widget.y.toFixed(2)} ({widget.width}×{widget.height})</div>
                <div style={{ fontSize: 12, color: '#333' }}>view: x: {view.x.toFixed(1)}, y: {view.y.toFixed(1)} — right/bottom: x: {viewRightBottom.x.toFixed(1)}, y: {viewRightBottom.y.toFixed(1)}</div>
                {widget.type === CONTROL_TYPES.IMAGE && (
                  <>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>rotation: {widget.rotation || 0}°</div>
                    <div style={{ fontSize: 11, color: '#666' }}>locked: {widget.isLocked ? 'Yes' : 'No'}</div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 6, wordBreak: 'break-all' }}>src: {widget.src ? (widget.src.length > 60 ? widget.src.slice(0, 60) + '...' : widget.src) : '(none)'}</div>
                  </>
                )}
                {widget.type === CONTROL_TYPES.CARD && (
                  <>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>editable: {widget.isEditable ? 'Yes' : 'No'}</div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4, wordBreak: 'break-all' }}>title: {widget.title || '(none)'}</div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button 
                    style={{ fontSize: 12, padding: '4px 8px', background: '#e6f4ea', borderRadius: 4, border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      if (widget.isLocked) {
                        setErrorMsg("该控件已锁定，无法编辑");
                        return;
                      }
                      if (widget.type === CONTROL_TYPES.CARD) {
                        handleCardClick(widget);
                      } else {
                        setState(prev => ({ ...prev, selectedControlId: widget.id, isEditing: true }));
                      }
                    }}
                    disabled={widget.isLocked || (widget.type === CONTROL_TYPES.CARD && !widget.isEditable)}
                  >
                    Edit
                  </button>
                  <button style={{ fontSize: 12, padding: '4px 8px', background: '#e8f0ff', borderRadius: 4, border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      const canvas = canvasRef.current;
                      const container = containerRef.current;
                      if (!canvas || !container) return;
                      const viewCenterX = canvas.width / 2;
                      const viewCenterY = canvas.height / 2;
                      const controlCenterLogicX = widget.x + (widget.width / 2);
                      const controlCenterLogicY = widget.y + (widget.height / 2);
                      const newOffsetX = (controlCenterLogicX * state.scale) - viewCenterX;
                      const newOffsetY = (controlCenterLogicY * state.scale) - viewCenterY;
                      setState(prev => ({ ...prev, offsetX: newOffsetX, offsetY: newOffsetY }));
                    }}
                  >
                    Center
                  </button>
                  <button style={{ fontSize: 12, padding: '4px 8px', background: '#ffefef', borderRadius: 4, border: 'none', cursor: 'pointer' }}
                    onClick={() => deleteWidget(widget.id).catch(err => setErrorMsg(err.message))}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 底部操作栏
  const renderBottomActionOverlay = () => {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 12,
          padding: 12,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          zIndex: 99999,
          pointerEvents: 'auto',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        {/* 新增文字卡片 */}
        <button
          onClick={async () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container || !canvasState.socketConnected) return;
            
            const centerViewX = canvas.width / 2;
            const centerViewY = canvas.height / 2;
            const centerLogic = viewToLogic(centerViewX, centerViewY);
            
            await addWidget({
              type: CONTROL_TYPES.CARD,
              x: centerLogic.x - 100,
              y: centerLogic.y - 75,
              width: 200,
              height: 150,
              title: 'New Card',
              content: 'Editable content',
              bgColor: '#f0f0f0',
              style: { color: '#333', fontSize: 14 },
              isEditable: true
            });
          }}
          disabled={!canvasState.socketConnected}
          style={{
            padding: '8px 16px',
            background: canvasState.socketConnected ? '#22c55e' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: canvasState.socketConnected ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontWeight: 500,
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => {
            if (canvasState.socketConnected) e.target.style.backgroundColor = '#16a34a';
          }}
          onMouseOut={(e) => {
            if (canvasState.socketConnected) e.target.style.backgroundColor = '#22c55e';
          }}
        >
          Generate New Card
        </button>

        {/* 新增图片控件 */}
        <button
          onClick={async () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container || !canvasState.socketConnected) return;
            
            const centerViewX = canvas.width / 2;
            const centerViewY = canvas.height / 2;
            const centerLogic = viewToLogic(centerViewX, centerViewY);
            
            await addWidget({
              type: CONTROL_TYPES.IMAGE,
              x: centerLogic.x - 150,
              y: centerLogic.y - 100,
              width: 300,
              height: 200,
              src: `https://picsum.photos/seed/${Date.now()}/300/200`,
              rotation: 0,
              isLocked: false
            });
          }}
          disabled={!canvasState.socketConnected}
          style={{
            padding: '8px 16px',
            background: canvasState.socketConnected ? '#a855f7' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: canvasState.socketConnected ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontWeight: 500,
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => {
            if (canvasState.socketConnected) e.target.style.backgroundColor = '#9333ea';
          }}
          onMouseOut={(e) => {
            if (canvasState.socketConnected) e.target.style.backgroundColor = '#a855f7';
          }}
        >
          Generate New Image
        </button>

        {/* 切换 Debug 面板 */}
        <button
          onClick={() => setDebugOpen(prev => !prev)}
          style={{
            padding: '8px 16px',
            background: debugOpen ? '#facc15' : '#e5e7eb',
            color: debugOpen ? '#1f2937' : '#4b5563',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            transition: 'background-color 0.2s ease'
          }}
        >
          {debugOpen ? 'Close Debug Panel' : 'Open Debug Panel'}
        </button>
      </div>
    );
  };

  // 剪切板粘贴处理（适配 Service 的 handleCanvasPaste 方法）
// 将原来的 handleCanvasPaste(useCallback) 改名为 handleClipboardPaste，避免与 service 冲突
const handleClipboardPaste = useCallback(async (e) => {
  // 有时可能通过程序调用（如 document listener）传入的是非 DOM 事件对象，先做保护
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const clipboardData = (e && e.clipboardData) || (window && window.clipboardData);
  if (!clipboardData) {
    setErrorMsg("浏览器不支持剪切板操作");
    return;
  }
  if (!canvasState.socketConnected) {
    setErrorMsg("Socket未连接，无法粘贴");
    return;
  }

  try {
    const items = clipboardData.items;
    let pasteData = null;

    // 先尝试通过标准 getData 快速获取纯文本（更兼容）
    const plainText = (clipboardData.getData && clipboardData.getData('text/plain')) || '';
    if (plainText && plainText.trim()) {
      pasteData = { type: "text", content: plainText.trim() };
    }

    // 如果没有文本，再逐项检查（支持图片、getAsString 回调等）
    if (!pasteData && items && items.length) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 图片（File）
        if (item.type && item.type.startsWith("image/")) {
          const blob = item.getAsFile && item.getAsFile();
          if (!blob) continue;
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          pasteData = { type: "image", content: base64 };
          break;
        }

        // 字符串类型（兼容 getAsString 回调）
        if (item.kind === "string" || item.type === "text/plain") {
          if (typeof item.getAsString === "function") {
            const text = await new Promise((resolve) => {
              item.getAsString((s) => resolve(s));
            });
            if (text && text.trim()) {
              pasteData = { type: "text", content: text.trim() };
              break;
            }
          } else {
            const fallbackText = (clipboardData.getData && clipboardData.getData('text/plain')) || '';
            if (fallbackText && fallbackText.trim()) {
              pasteData = { type: "text", content: fallbackText.trim() };
              break;
            }
          }
        }
      }
    }

    if (!pasteData) {
      setErrorMsg("剪切板无有效内容");
      return;
    }

    // 计算粘贴位置（画布中心）
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerViewX = rect.width / 2;
    const centerViewY = rect.height / 2;
    const logicPos = viewToLogic(centerViewX, centerViewY);

    // 调用 服务层 的 handleCanvasPaste（alias：serviceHandleCanvasPaste），传入 pasteData 与位置
    await serviceHandleCanvasPaste(pasteData, {
      x: pasteData.type === "text" ? logicPos.x - 125 : logicPos.x - 150,
      y: pasteData.type === "text" ? logicPos.y - 50 : logicPos.y - 100
    });
  } catch (err) {
    setErrorMsg("粘贴失败：" + (err?.message || err));
  }
}, [viewToLogic, canvasState.socketConnected, serviceHandleCanvasPaste]);
useEffect(() => {
  const onDocumentPaste = (e) => {
    // 如果焦点在输入框/textarea/contentEditable，跳过以免干扰表单
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) {
      return;
    }
    // 直接传递原生事件给 handleClipboardPaste
    handleClipboardPaste(e);
  };

  document.addEventListener('paste', onDocumentPaste);
  return () => {
    document.removeEventListener('paste', onDocumentPaste);
  };
}, [handleClipboardPaste]);
  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    addWidget: (widget) => addWidget(widget),
    updateWidget: (id, updates) => updateWidget(id, updates),
    deleteWidget: (id) => deleteWidget(id),
    viewToLogic: viewToLogic,
    getWidgets: getWidgets
  }));

  // 加载状态
  if (loading) {
    return (
      <div style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fafafa"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, color: "#1890ff", marginBottom: 16 }}>
            画布编辑器加载中...
          </div>
          <div style={{ width: 40, height: 40, border: "4px solid #eee", borderTopColor: "#1890ff", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden">
      <div className="flex flex-col h-full">
        {/* 空工具栏：仅用于高度计算 */}
        <div
          ref={toolbarRef}
          style={{
            boxSizing: 'border-box',
            width: '100%',
            height: 0,
            visibility: 'hidden'
          }}
        />

        {/* 错误提示 */}
        {errorMsg && (
          <div style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ff4444',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 4,
            zIndex: 99999,
            fontSize: 14
          }}>
            {errorMsg}
          </div>
        )}

        {/* Canvas 容器 */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
           style={{ width: "100%", height: "calc(100vh - 0px)", position: "relative" }} // 明确高度
          onClick={(e) => {
            // 点击空白处取消选中
            if (e.target === canvasRef.current) {
              setSelectedWidgetId(null);
              setState(prev => ({ ...prev, selectedControlId: null, isEditing: false }));
            }
          }}
          onPaste={handleClipboardPaste}
        >
          <canvas
            ref={canvasRef}
            tabIndex={0}
            onMouseDown={(e) => {
               try {
                    if (canvasRef.current && typeof canvasRef.current.focus === 'function') {
                        canvasRef.current.focus();
                      }
              } catch (err) {
                console.warn('focus canvas failed', err);
              }
              const rect = containerRef.current.getBoundingClientRect();
              const viewX = e.clientX - rect.left;
              const viewY = e.clientY - rect.top;
              const logicPos = viewToLogic(viewX, viewY);

              let selectedId = null;
              let selectedWidget = null;
              const widgets = canvasState.canvasData.widgets || [];

              // 反向遍历，优先选中上层控件
              for (let i = widgets.length - 1; i >= 0; i--) {
                const widget = widgets[i];
                if (
                  logicPos.x >= widget.x &&
                  logicPos.x <= widget.x + widget.width &&
                  logicPos.y >= widget.y &&
                  logicPos.y <= widget.y + widget.height
                ) {
                  selectedId = widget.id;
                  selectedWidget = widget;
                  break;
                }
              }

              if (selectedWidget) {
                // 同步选中状态到 Service
                setSelectedWidgetId(selectedId);
                // 发送控件点击事件（缓存内容，传递完整 widget 对象包含富文本）
                sendControlClickEvent(selectedWidget)
                  .catch(err => console.error("缓存控件内容失败：", err));
              } else {
                setSelectedWidgetId(null);
                setState(prev => ({ ...prev, selectedControlId: null, isEditing: false }));
                // 点击空白处记录位置（用于后续操作）
                handleCanvasClick(logicPos.x, logicPos.y).catch(err => console.error("记录点击位置失败：", err));
              }

              // 拖拽/编辑状态切换
              if (selectedWidget && !selectedWidget.isLocked) {
                if (selectedWidget.type === CONTROL_TYPES.CARD) {
                  if (selectedWidget.isEditable) {
                    handleCardClick(selectedWidget);
                  } else {
                    setErrorMsg("该卡片不可编辑");
                  }
                }
                setState(prev => ({
                  ...prev,
                  isDraggingControl: true,
                  lastX: e.clientX,
                  lastY: e.clientY,
                  selectedControlId: selectedId
                }));
              } else if (selectedWidget && selectedWidget.isLocked) {
                setErrorMsg("该控件已锁定，无法操作");
                setState(prev => ({
                  ...prev,
                  isDragging: false,
                  isDraggingControl: false
                }));
              } else {
                setState(prev => ({
                  ...prev,
                  isDragging: selectedId === null,
                  isDraggingControl: selectedId !== null,
                  lastX: e.clientX,
                  lastY: e.clientY,
                  selectedControlId: selectedId,
                  isEditing: false
                }));
              }
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setState(prev => ({
              ...prev,
              isDragging: false,
              isDraggingControl: false
            }))}
            onMouseLeave={() => setState(prev => ({
              ...prev,
              isDragging: false,
              isDraggingControl: false
            }))}
            onWheel={handleWheel}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              display: 'block'
            }}
          />

          {/* 动态工具栏 */}
          {renderDynamicToolbar()}

          {/* 编辑表单 */}
          {renderInCardEditor()}
          {renderImageEditForm()}

          {/* Debug 面板（通过 Portal 挂载到 body） */}
          {debugOpen && typeof document !== 'undefined' && createPortal(renderDebugPanel(), document.body)}

          {/* 底部操作栏（通过 Portal 挂载到 body） */}
          {typeof document !== 'undefined' && createPortal(renderBottomActionOverlay(), document.body)}
        </div>
      </div>
    </div>
  );
});

export default OptimizedCanvasEditor;