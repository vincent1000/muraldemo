// src/services/dataService.js
import { v4 as uuidv4 } from "uuid"; // 生成唯一控件ID（需安装：npm install uuid）
import {
  connectSocket,
  disconnectSocket,
  subscribeToSocketEvent,
  sendUiOperation,
  getSocketStatus,
} from "../network/socket";

import {
  executePrompt,
  fetchUserDefinedButtons,
} from "../network/rest";
// -------------------------- 核心状态管理（单例模式） --------------------------
// 私有状态：仅在模块内访问，避免外部直接修改
let state = {
  socketConnected: false,
  canvasData: {
    widgets: [],
    imageVariations: [],
    lastClick: {}
  },
  selectedWidgetId: null,
  selectedWidget: null,
  history: [],
  historyIndex: -1,
  userButtons: []
};

// 订阅状态变化的回调函数集合
let subscribers = new Set();

// -------------------------- 核心工具方法 --------------------------
/**
 * 保存历史快照（状态变更前调用）
 * 仅保存控件列表和选中状态，避免快照体积过大
 */
function saveHistory() {
  const snapshot = {
    // 深拷贝：避免修改当前状态时污染历史记录
    widgets: JSON.parse(JSON.stringify(state.canvasData.widgets)),
    selectedWidgetId: state.selectedWidgetId,
  };

  // 如果当前不是最新历史（撤销后又做新操作），清空后续历史
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }

  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;

  // 限制历史记录数量（最多20步，避免内存占用过多）
  if (state.history.length > 20) {
    state.history.shift();
    state.historyIndex--;
  }
}

// 添加控件方法
export async function addWidget(widget) {
  const existingWidgets = state.canvasData.widgets || [];
  if (existingWidgets.some(w => w.id === widget.id)) {
    console.log(`【Service】控件 ${widget.id} 已存在，跳过添加`);
    return existingWidgets.find(w => w.id === widget.id); // 返回已存在的控件
  }

  console.log("【Service】addWidget 被调用，本地 Socket 状态：", state.socketConnected);

  // 优化：不要因为 socket 未连接就阻止本地添加。
  // 支持离线/临时添加：本地立即更新界面，后台异步尝试同步（失败不影响本地展示）。
  const widgetId = widget.id || `widget-${Date.now()}`;
  const newWidget = { id: widgetId, ...widget };

  try {
    // 本地更新控件（优先保证本地显示）
    const newWidgets = [...state.canvasData.widgets, newWidget];
    console.log("【Service】addWidget 本地更新控件，新增后数量：", newWidgets.length);
    updateState({
      canvasData: { ...state.canvasData, widgets: newWidgets },
      selectedWidgetId: null
    });

    // 仅当 socket 已连接时尝试后端同步；否则记录日志，后面可做重试机制
    const socketStatus = state.socketConnected || getSocketStatus?.().connected;
    if (socketStatus) {
      try {
        await sendUiOperation("add_widget", { widget: newWidget });
        console.log("【Service】addWidget 后端同步成功：", widgetId);
      } catch (err) {
        console.error("【Service】addWidget 后端同步失败（本地已添加）：", err?.message || err);
        // 不抛出，保证 UI 不受影响
      }
    } else {
      console.warn("【Service】addWidget 后端未连接，已本地添加，后续需同步：", widgetId);
    }

    return newWidget;
  } catch (err) {
    console.error("【Service】addWidget 整体失败：", err?.message || err);
    throw err;
  }
}

// 内部更新状态方法（不通知订阅者）
function updateStateInternal(newState) {
  // 合并状态
  state = { ...state, ...newState };

  // 如果显式提供了 selectedWidgetId（即 newState 中包含该字段），再去更新 selectedWidget；
  // 避免在部分更新时把 selectedWidget 意外清空（之前用 truthy 检查会误清空）。
  if (Object.prototype.hasOwnProperty.call(newState, "selectedWidgetId")) {
    state.selectedWidget = state.canvasData.widgets.find(w => w.id === newState.selectedWidgetId) || null;
  } else {
    // 保持现有 selectedWidget（除非显式修改）
    state.selectedWidget = state.canvasData.widgets.find(w => w.id === state.selectedWidgetId) || state.selectedWidget || null;
  }
}

// 更新状态方法（通知订阅者）
function updateState(newState) {
  updateStateInternal(newState);
  
  console.log("【Service】updateState 触发，当前控件数量：", state.canvasData.widgets.length);
  // 通知所有订阅者
  subscribers.forEach(callback => {
    try {
      callback(state);
    } catch (err) {
      console.error("【Service】通知订阅者失败：", err.message);
    }
  });
}

// -------------------------- 对外暴露的订阅接口 --------------------------
/**
 * 订阅画布状态变化（UI组件调用）
 * @param {Function} callback - 状态变化后的回调函数（参数为最新完整状态）
 * @returns {Function} 取消订阅的函数
 */
export function subscribeToCanvasState(callback) {
  if (typeof callback !== "function") {
    console.error("订阅回调必须是函数");
    return () => {};
  }

  // 正确：直接操作模块内的私有变量 subscribers（Set 实例）
  subscribers.add(callback);

  // 立即推送当前状态（组件初始化时获取初始数据）
  callback(JSON.parse(JSON.stringify(state)));

  // 正确：从 subscribers 中删除回调
  return () => subscribers.delete(callback);
}

// -------------------------- 初始化与销毁 --------------------------
/**
 * 初始化画布服务（组件挂载时调用）
 * 1. 连接Socket 2. 加载用户按钮 3. 订阅后端Socket事件
 * @param {Array} initialWidgets - 初始控件列表（可选）
 */
export async function initCanvasService(initialWidgets = []) {
  try {
    // 0. 同步初始控件到状态（直接替换，不累加）
    console.log("【Service】initCanvasService 同步初始控件数量：", initialWidgets.length, "当前状态控件数量：", state.canvasData.widgets.length);
    updateState({
      canvasData: {
        ...state.canvasData,
        widgets: initialWidgets, // 直接替换，确保前后端一致
      },
    });
    
    // 1. 连接Socket
    await connectSocket();
    // 🔴 明确更新 Socket 连接状态（关键：之前可能未同步）
    const socketStatus = getSocketStatus();
    console.log("【Service】initCanvasService Socket 连接状态：", socketStatus.connected);
    updateState({ socketConnected: socketStatus.connected });

    // 2. 加载用户自定义按钮（REST API）
    const userButtons = await fetchUserDefinedButtons();
    updateState({ userButtons });

    // 3. 订阅后端Socket事件（同步后端状态到前端）
    subscribeToSocketEvent("cache_control_notify", (data) => {
      try {
        console.log("【Service】收到 cache_control_notify:", data);
        
        // 解析后端消息字段（兼容多种命名）
        const controlId = data?.controlId || data?.control_id || data?.id || null;
        const content = data?.controlContent || data?.content || data?.result || null;
        const controlType = data?.controlType || data?.control_type || data?.type || null;

        if (!controlId) {
          console.warn("【Service】cache_control_notify 缺少 controlId，忽略：", data);
          return;
        }

        if (!content && content !== '') {
          console.warn("【Service】cache_control_notify 缺少 content，忽略：", data);
          return;
        }

        console.log(`【Service】准备更新控件: ID=${controlId}, Type=${controlType}, Content长度=${content.length}`);

        // 更新 widgets 数组中的对应控件
        const updatedWidgets = state.canvasData.widgets.map((w) => {
          if (w.id !== controlId) return w;

          console.log(`【Service】找到匹配控件，当前类型: ${w.type}`);

          if (w.type === "image" || controlType === "image") {
            // ImageCard: 更新 imageUrl 字段
            console.log("【Service】更新 ImageCard imageUrl");
            return { 
              ...w, 
              imageUrl: content,
              src: content,  // 兼容旧字段名
              updatedAt: new Date().toISOString()
            };
          } else if (w.type === "text" || controlType === "text") {
            // TextCard: 更新 summary 和 content，保留 title
            console.log("【Service】更新 TextCard summary 和 content");
            return { 
              ...w, 
              summary: content,  // 用于 normal 模式显示
              content: content,  // 用于 expanded 模式显示
              updatedAt: new Date().toISOString()
              // title 保持不变
            };
          } else {
            // 未知类型，通用更新
            console.warn(`【Service】未知控件类型: ${w.type}，使用通用更新`);
            return { ...w, content };
          }
        });

        // 更新状态（包括 selectedWidget 如果它被更新了）
        const newState = {
          canvasData: {
            ...state.canvasData,
            widgets: updatedWidgets,
          },
        };
        
        // 如果更新的是当前选中的卡片，也更新 selectedWidget
        if (state.selectedWidgetId === controlId) {
          const updatedWidget = updatedWidgets.find(w => w.id === controlId);
          if (updatedWidget) {
            newState.selectedWidget = updatedWidget;
            console.log(`【Service】同时更新了 selectedWidget`);
          }
        }
        
        updateState(newState);

        console.log(`【Service】cache_control_notify 已更新本地控件 ${controlId}`);
      } catch (err) {
        console.error("【Service】处理 cache_control_notify 出错：", err);
      }
    });
    subscribeToSocketEvent("selection_type", (data) => {
      const newCanvasData = {
        ...state.canvasData,
        selectionHighlight: data.type,
      };
      updateState({
        selectionType: data.type,
        canvasData: newCanvasData,
      });
    });

    subscribeToSocketEvent("image_variations", (data) => {
      updateState({
        canvasData: {
          ...state.canvasData,
          imageVariations: data.variations || [],
        },
      });
    });

    // 4. 订阅后端控件同步事件（多客户端协作时用）
    subscribeToSocketEvent("widget_sync", (data) => {
      const { type, widgetId, widget, updates } = data;
      switch (type) {
        case "created":
          updateState({
            canvasData: {
              ...state.canvasData,
              widgets: [...state.canvasData.widgets, widget],
            },
          });
          break;
        case "updated":
          const updatedWidgets = state.canvasData.widgets.map((w) =>
            w.id === widgetId ? { ...w, ...updates } : w
          );
          updateState({
            canvasData: { ...state.canvasData, widgets: updatedWidgets },
          });
          break;
        case "deleted":
          const filteredWidgets = state.canvasData.widgets.filter(
            (w) => w.id !== widgetId
          );
          updateState({
            canvasData: { ...state.canvasData, widgets: filteredWidgets },
            selectedWidgetId: null,
            selectedWidget: null,
          });
          break;
      }
    });

    // 🔴 监听 Socket 连接状态变化（确保断开后也能同步）
    subscribeToSocketEvent("connect", () => {
      console.log("【Service】Socket 连接成功（事件监听）");
      updateState({ socketConnected: true });
    });

    subscribeToSocketEvent("disconnect", () => {
      console.log("【Service】Socket 断开连接（事件监听）");
      updateState({ socketConnected: false });
    });
  } catch (err) {
    console.error("画布服务初始化失败:", err);
    updateState({ socketConnected: false });
    throw err;
  }
}
/**
 * 销毁画布服务（组件卸载时调用）
 * 1. 断开Socket 2. 清空状态 3. 清空订阅者
 */
export function destroyCanvasService() {
  disconnectSocket();
  // 重置所有状态
  Object.assign(state, {
    userButtons: [],
    socketConnected: false,
    selectionType: "",
    canvasData: { widgets: [], imageVariations: [], lastClick: {} },
    selectedWidgetId: null,
    selectedWidget: null,
    history: [],
    historyIndex: -1,
  });
  subscribers.clear(); // 清空订阅者，避免内存泄露
}

// -------------------------- 画布基础操作 --------------------------
/**
 * 处理画布点击（记录最后点击位置）
 * @param {number} x - 点击X坐标
 * @param {number} y - 点击Y坐标
 */
export async function handleCanvasClick(x, y) {
  if (!state.socketConnected) {
    // 允许本地记录点击位置，即使 socket 未连接也不要直接阻塞
    console.warn("Socket未连接，仍记录本地点击位置");
  }

  try {
    // 记录最后点击位置（用于粘贴默认位置）
    const updatedCanvasData = {
      ...state.canvasData,
      lastClick: { x, y },
    };
    updateState({ canvasData: updatedCanvasData });

    // 发送点击事件到后端（若连接）
    if (state.socketConnected) {
      await sendUiOperation("canvas_click", { x, y });
    }
  } catch (err) {
    console.error("Canvas点击操作失败:", err);
    throw err;
  }
}

/**
 * 处理用户自定义按钮点击
 * @param {Object} button - 按钮数据（含id、prompt、inputType等）
 */
export async function handleUserButtonClick(button) {
  if (!state.socketConnected) {
    throw new Error("Socket未连接，无法执行操作");
  }

  if (!button?.id) {
    throw new Error("按钮数据不完整");
  }

  try {
    const resp = await sendUiOperation("user_button_click", {
      buttonId: button.id,
      prompt: button.prompt,
      inputType: button.inputType,
    });

    // 同步后端返回的画布数据
    if (resp?.canvasData) {
      updateState({
        canvasData: { ...state.canvasData, ...resp.canvasData },
      });
    }
  } catch (err) {
    console.error(`按钮${button.label}点击失败:`, err);
    throw err;
  }
}

// -------------------------- 控件核心操作（增删改查） --------------------------
/**
 * 设置当前选中的控件ID（同步选中控件完整信息）
 * @param {string|null} widgetId - 控件ID（null表示取消选中）
 */
export function setSelectedWidgetId(widgetId) {
  if (!widgetId) {
    updateState({
      selectedWidgetId: null,
      selectedWidget: null,
    });
    return;
  }

  // 查找选中的控件完整信息
  const selectedWidget = state.canvasData.widgets.find(
    (widget) => widget.id === widgetId
  );

  updateState({
    selectedWidgetId: widgetId,
    selectedWidget: selectedWidget || null,
  });
}

/**
 * 处理画布粘贴操作（生成图片/文字卡片控件）
 * @param {Object} pasteData - 粘贴数据：{ type: "image/text", content: 内容（base64/文字） }
 * @param {Object} position - 粘贴位置：{ x, y }
 */
export async function handleCanvasPaste(pasteData, position) {
  if (!pasteData || !position) {
    throw new Error("粘贴数据或位置不完整");
  }

  // 1. 生成对应类型的控件
  let newWidget = null;
  const widgetId = `widget-${uuidv4()}`; // 生成唯一ID
  const defaultStyle = {
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
    border: "1px solid #eee",
    padding: "8px",
  };

  switch (pasteData.type) {
    // 图片控件
    case "image":
      newWidget = {
        id: widgetId,
        type: "image",
        src: pasteData.content, // base64编码
        x: position.x,
        y: position.y,
        width: 200, // 默认宽度
        height: 350, // 默认高度
        rotation: 0, // 旋转角度
        isLocked: false, // 是否锁定（不可移动/编辑）
      };
      break;

    // 文字卡片控件
    case "text":
      newWidget = {
        id: widgetId,
        type: "text",
        title: "TextFromWeb",
        content: pasteData.content,
        summary: pasteData.content,
        x: position.x,
        y: position.y,
        width: 250, // 默认宽度
        height: 350, // 默认高度
        style: defaultStyle,
        isEditable: true, // 是否可编辑
      };
      break;

    default:
      throw new Error(`不支持的粘贴类型：${pasteData.type}`);
  }

  // 2. 保存历史记录（用于撤销）
  saveHistory();

  // 3. 更新控件列表
  const updatedWidgets = [...state.canvasData.widgets, newWidget];
  const updatedCanvasData = {
    ...state.canvasData,
    widgets: updatedWidgets,
  };

  // 4. 同步状态到UI
  updateState({
    canvasData: updatedCanvasData,
    selectedWidgetId: widgetId, // 粘贴后自动选中该控件
    selectedWidget: newWidget,
  });

  // 5. 同步到后端（多客户端协作）
  if (state.socketConnected) {
    await sendUiOperation("widget_created", { widget: newWidget });
  } else {
    console.warn("handleCanvasPaste: socket 未连接，本地已添加控件，后续需同步");
  }
}

/**
 * 更新控件属性（编辑内容、样式、位置等）
 * @param {string} widgetId - 控件ID
 * @param {Object} updates - 要更新的属性（如 { content: "新文字", style: { color: "#f00" } }）
 */
export async function updateWidget(widgetId, updates) {
  if (!widgetId || !Object.keys(updates).length) {
    throw new Error("控件ID或更新属性不能为空");
  }

  // 查找控件是否存在
  const widgetExists = state.canvasData.widgets.some(
    (w) => w.id === widgetId
  );
  if (!widgetExists) {
    throw new Error(`未找到ID为${widgetId}的控件`);
  }

  // 1. 保存历史记录
  saveHistory();

  // 2. 更新控件属性
  const updatedWidgets = state.canvasData.widgets.map((widget) => {
    return widget.id === widgetId ? { ...widget, ...updates } : widget;
  });

  // 3. 更新选中控件信息（如果更新的是当前选中控件）
  let newSelectedWidget = state.selectedWidget;
  if (state.selectedWidgetId === widgetId) {
    newSelectedWidget = { ...newSelectedWidget, ...updates };
  }

  // 4. 同步状态到UI
  const updatedCanvasData = {
    ...state.canvasData,
    widgets: updatedWidgets,
  };
  updateState({
    canvasData: updatedCanvasData,
    selectedWidget: newSelectedWidget,
  });

  // 5. 同步到后端
  if (state.socketConnected) {
    await sendUiOperation("widget_updated", { widgetId, updates });
  } else {
    console.warn("updateWidget: socket 未连接，本地已更新控件，后续需同步", widgetId);
  }
}

/**
 * 删除控件（静默模式，不通知订阅者，用于前端已删除只需同步 dataService 内部状态）
 * @param {string} widgetId - 控件ID
 * @param {boolean} silent - 是否静默删除（不通知订阅者）
 */
export async function deleteWidget(widgetId, silent = false) {
  if (!widgetId) {
    throw new Error("请选中要删除的控件");
  }

  // 1. 保存历史记录
  saveHistory();

  // 2. 过滤掉要删除的控件
  const updatedWidgets = state.canvasData.widgets.filter(
    (widget) => widget.id !== widgetId
  );

  // 3. 同步状态（根据 silent 参数决定是否通知订阅者）
  const updatedCanvasData = {
    ...state.canvasData,
    widgets: updatedWidgets,
  };
  
  if (silent) {
    // 静默更新，不通知订阅者
    updateStateInternal({
      canvasData: updatedCanvasData,
      selectedWidgetId: null,
      selectedWidget: null,
    });
    console.log("【Service】deleteWidget 静默删除，控件数量：", updatedWidgets.length);
  } else {
    // 正常更新，通知订阅者
    updateState({
      canvasData: updatedCanvasData,
      selectedWidgetId: null,
      selectedWidget: null,
    });
  }

  // 4. 同步到后端
  if (state.socketConnected) {
    await sendUiOperation("widget_deleted", { widgetId });
  } else {
    console.warn("deleteWidget: socket 未连接，已本地删除，后续需同步", widgetId);
  }
}

/**
 * 放大/缩小控件
 * @param {string} widgetId - 控件ID
 * @param {number} scaleRatio - 缩放比例（1.2=放大20%，0.8=缩小20%）
 */
export async function scaleWidget(widgetId, scaleRatio) {
  if (!widgetId || typeof scaleRatio !== "number" || scaleRatio <= 0) {
    throw new Error("控件ID不能为空，缩放比例必须是正数");
  }

  const widget = state.canvasData.widgets.find((w) => w.id === widgetId);
  if (!widget) {
    throw new Error(`未找到ID为${widgetId}的控件`);
  }

  // 1. 保存历史记录
  saveHistory();

  // 2. 计算缩放后的宽高（保持中心位置不变）
  const newWidth = widget.width * scaleRatio;
  const newHeight = widget.height * scaleRatio;
  const offsetX = (newWidth - widget.width) / 2; // 水平偏移（保持中心）
  const offsetY = (newHeight - widget.height) / 2; // 垂直偏移

  // 3. 更新控件属性
  const updates = {
    width: newWidth,
    height: newHeight,
    x: widget.x - offsetX, // 向左上偏移，保持中心不变
    y: widget.y - offsetY,
  };

  await updateWidget(widgetId, updates); // 复用updateWidget方法
}

// -------------------------- 撤销/重做操作 --------------------------
/**
 * 撤销上一步操作
 */
export function undo() {
  if (state.historyIndex < 0) {
    throw new Error("没有可撤销的操作");
  }

  // 1. 获取上一步快照
  const prevSnapshot = state.history[state.historyIndex];
  // 2. 回退历史索引
  const newHistoryIndex = state.historyIndex - 1;

  // 3. 查找上一步的选中控件信息
  const selectedWidget = prevSnapshot.widgets.find(
    (w) => w.id === prevSnapshot.selectedWidgetId
  );

  // 4. 恢复状态
  updateState({
    canvasData: {
      ...state.canvasData,
      widgets: prevSnapshot.widgets,
    },
    selectedWidgetId: prevSnapshot.selectedWidgetId,
    selectedWidget: selectedWidget || null,
    historyIndex: newHistoryIndex,
  });
}

/**
 * 重做上一步撤销的操作
 */
export function redo() {
  if (state.historyIndex >= state.history.length - 1) {
    throw new Error("没有可重做的操作");
  }

  // 1. 获取下一步快照
  const nextSnapshot = state.history[state.historyIndex + 1];
  // 2. 前进历史索引
  const newHistoryIndex = state.historyIndex + 1;

  // 3. 查找下一步的选中控件信息
  const selectedWidget = nextSnapshot.widgets.find(
    (w) => w.id === nextSnapshot.selectedWidgetId
  );

  // 4. 恢复状态
  updateState({
    canvasData: {
      ...state.canvasData,
      widgets: nextSnapshot.widgets,
    },
    selectedWidgetId: nextSnapshot.selectedWidgetId,
    selectedWidget: selectedWidget || null,
    historyIndex: newHistoryIndex,
  });
}

// -------------------------- 对外暴露的辅助方法 --------------------------
/**
 * 获取当前选中的控件信息
 * @returns {Object|null} 选中的控件信息
 */
export function getSelectedWidget() {
  return JSON.parse(JSON.stringify(state.selectedWidget));
}

/**
 * 获取所有控件列表
 * @returns {Array} 控件列表（深拷贝）
 */
export function getWidgets() {
  return JSON.parse(JSON.stringify(state.canvasData.widgets));
}

/**
 * 清空所有控件
 */
export async function clearAllWidgets() {
  if (state.canvasData.widgets.length === 0) return;

  // 1. 保存历史记录
  saveHistory();

  // 2. 清空控件列表
  updateState({
    canvasData: { ...state.canvasData, widgets: [] },
    selectedWidgetId: null,
    selectedWidget: null,
  });

  // 3. 同步到后端
  if (state.socketConnected) {
    await sendUiOperation("widget_clear_all");
  } else {
    console.warn("clearAllWidgets: socket 未连接，本地已清空，后续需同步");
  }
}

// canvasService.js 新增方法
/**
 * 发送控件点击事件（让后端缓存内容）
 * @param {Object} card - 完整的卡片对象
 */
export async function sendControlClickEvent(card) {
  if (!state.socketConnected) {
    throw new Error("Socket未连接，无法缓存控件内容");
  }
  if (!card || !card.id) {
    throw new Error("卡片对象或ID不能为空");
  }

  try {
    console.log(`控件${card.id}完整信息已发送到后端缓存`);
    
    // 准备发送的数据（包含所有富文本信息）
    const payload = {
      controlId: card.id,
      controlType: card.type || "text",
    };
    
    if (card.type === 'text') {
      // 文本卡片：发送所有字段（title、summary、content），这些字段中包含完整的 HTML 富文本
      payload.title = card.title || '';
      payload.summary = card.summary || '';
      payload.content = card.content || '';
      // 主要内容（优先使用 content，因为它包含最完整的富文本）
      payload.controlContent = card.content || card.summary || card.title || '';
      
      console.log('[dataService] 发送文本卡片富文本信息:');
      console.log('  - title:', card.title?.substring(0, 100));
      console.log('  - summary:', card.summary?.substring(0, 100));
      console.log('  - content:', card.content?.substring(0, 100));
    } else if (card.type === 'image') {
      // 图片卡片：发送 imageUrl
      payload.controlContent = card.imageUrl || card.src || '';
      payload.imageUrl = card.imageUrl || card.src || '';
    }

    // 发送事件到后端（Socket通信，推荐）
    await sendUiOperation("control_click", payload);
    console.log(`控件${card.id}完整信息已发送到后端缓存`);
  } catch (err) {
    console.error("发送控件点击事件失败：", err);
    throw err;
  }
}


/**
 * 发送按钮处理请求（触发LLM处理缓存内容）
 * @param {string} buttonId - 处理按钮ID
 * @param {string} controlId - 选中的控件ID
 */
export async function sendButtonProcessRequest(buttonId, controlId) {
  if (!state.socketConnected) {
    throw new Error("Socket未连接，无法触发处理");
  }
  if (!buttonId || !controlId) {
    throw new Error("按钮ID或控件ID不能为空");
  }

  try {
    // 发送处理请求到后端
    const response = await sendUiOperation("button_process", {
      button_id: buttonId,
      control_id: controlId
    });
    return response; // 后端返回的LLM处理结果
  } catch (err) {
    console.error("发送按钮处理请求失败：", err);
    throw err;
  }
}