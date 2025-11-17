import { io } from "socket.io-client";

const BASE_URL = "http://localhost:8000";
const socket = io(BASE_URL, {
  autoConnect: false,
});

const socketSubscribers = new Map(); // key: 消息类型（如 "selection_type"）, value: 回调函数数
// -------------------------- Socket 核心方法 --------------------------
/**
 * 连接 Socket.IO
 * @returns {Promise} 连接成功/失败的 Promise
 */
export function connectSocket() {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve("已连接");
      return;
    }

    // 监听连接成功
    const onConnect = () => {
      console.log("Socket 连接成功");
      socket.off("connect", onConnect); // 移除监听，避免重复触发
      resolve("连接成功");
    };

    // 监听连接失败
    const onConnectError = (error) => {
      console.error("Socket 连接失败:", error.message);
      socket.off("connect_error", onConnectError);
      reject(error);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.connect(); // 手动触发连接
  });
}

/**
 * 断开 Socket.IO 连接
 */
export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
    console.log("Socket 已断开连接");
  }
}

/**
 * 订阅 Socket 消息（Python 后端发送的消息）
 * @param {string} eventType 消息类型（如 "selection_type"、"image_variations"）
 * @param {Function} callback 消息处理回调（参数为后端发送的数据）
 */
export function subscribeToSocketEvent(eventType, callback) {
  if (!socketSubscribers.has(eventType)) {
    socketSubscribers.set(eventType, []);
  }
  // 存储回调，避免重复订阅
  const callbacks = socketSubscribers.get(eventType);
  if (!callbacks.includes(callback)) {
    callbacks.push(callback);
  }

  // 注册 Socket 事件监听（只注册一次）
  socket.off(eventType, handleSocketEvent); // 先移除旧监听，避免重复
  socket.on(eventType, handleSocketEvent);

  // 消息处理函数：触发所有订阅者的回调
  function handleSocketEvent(data) {
    console.debug(`收到 Socket 消息 [${eventType}]:`, data);
    callbacks.forEach((cb) => cb(data));
  }

  // 返回取消订阅方法
  return () => {
    const updatedCallbacks = callbacks.filter((cb) => cb !== callback);
    socketSubscribers.set(eventType, updatedCallbacks);
    if (updatedCallbacks.length === 0) {
      socket.off(eventType, handleSocketEvent); // 无订阅者时移除监听
      socketSubscribers.delete(eventType);
    }
  };
}

/**
 * 发送 UI 操作到 Python 后端（通过 Socket.IO）
 * @param {string} eventType 操作类型（如 "canvas_click"、"update_selection"）
 * @param {Object} data 操作数据（如坐标、选中状态等）
 * @returns {Promise} 发送成功/失败的 Promise
 */
export function sendUiOperation(eventType, data) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Socket 未连接，请先连接"));
      return;
    }

    console.debug(`发送 UI 操作 [${eventType}]:`, data);
    // 发送事件到后端，后端通过 @sio.event 接收（如 @sio.event async def canvas_click(sid, data)）
    socket.emit(eventType, data, (ack) => {
      // ack 是后端的确认响应（可选，后端可通过 return 传递数据）
      if (ack?.status === "success") {
        resolve(ack.data);
      } else {
        reject(new Error(ack?.error || "发送失败"));
      }
    });
  });
}

export function getSocketStatus() {
  return {
    connected: socket.connected,
    id: socket.id, // 客户端唯一标识
  };
}