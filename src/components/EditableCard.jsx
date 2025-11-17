import React, { useEffect, useRef, useState } from "react";
import '../index.css';
function EditableCard({title, summary, body, tags, timestamp, isDragging, widgetId }) {
  const [mode, setMode] = useState("normal");
  const [editTarget, setEditTarget] = useState("none");
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentSummary, setCurrentSummary] = useState(summary);
  const [currentBody, setCurrentBody] = useState(body);
  const [bodyHistory, setBodyHistory] = useState([]);
  const [textColor, setTextColor] = useState("#000");
  const [curwidgetId, setcurwidgetId] = useState(widgetId);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".card")) {
        if (editTarget !== "none") {
          setEditTarget("none");
        } else if (mode === "toolbar" || mode === "expanded") {
          setMode("normal");
        }
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [editTarget, mode]);

  const handleBodyChange = (e) => {
    const newText = e.target.value;
    setBodyHistory([...bodyHistory.slice(-19), currentBody]);
    setCurrentBody(newText);
  };

  const handleUndo = () => {
    if (bodyHistory.length > 0) {
      const last = bodyHistory.pop();
      setCurrentBody(last);
      setBodyHistory([...bodyHistory]);
    }
  };

  const handleColorChange = () => {
    const nextColor = textColor === "#000" ? "#007bff" : "#000";
    setTextColor(nextColor);
  };

  return (
  <div
    className={`card ${mode === "expanded" ? "expanded" : ""}`}
    data-widget-id={curwidgetId}
    onClick={(e) => {
      if (mode === "normal") setMode("toolbar");
    }}
    onMouseDown={(e) => {
    // 主动触发 Canvas 的 mousedown 事件
    const canvasElement = document.querySelector('canvas'); // 找到 Canvas 元素
    if (canvasElement) {
      // 克隆事件并转发（保持坐标一致）
      const canvasEvent = new MouseEvent('mousedown', {
        clientX: e.clientX,
        clientY: e.clientY,
        bubbles: true,
        cancelable: true
      });
      canvasElement.dispatchEvent(canvasEvent);
    }
  }}
    onDoubleClick={(e) => {
      e.stopPropagation();
      setMode("expanded");
      setEditTarget("none");
    }}
    
    style={{ color: textColor, pointerEvents: editTarget === "none" ? 'auto' : 'auto',}}
  >
    <div className="drag-handle">
    </div>
        {mode === "expanded" ? (
          <>
            <h3>{currentTitle}</h3>
            {editTarget === "body" ? (
              <textarea
                value={currentBody}
                onChange={handleBodyChange}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <p>{currentBody}</p>
            )}
          </>
        ) : editTarget === "summary" ? (
          <>
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}

              data-edit-target="title"
            />
            <textarea
              value={currentSummary}
              onChange={(e) => setCurrentSummary(e.target.value)}
              onClick={(e) => e.stopPropagation()}

              data-edit-target="body" 
            />
          </>
        ) : (
          <>
            <h3>{currentTitle}</h3>
            <p>{currentSummary}</p>
          </>
        )}

        <div className="card-footer">
          <span className="tags">{tags}</span>
          <span className="timestamp">{timestamp}</span>
        </div>

        {(mode === "toolbar" || mode === "expanded") && (
          <div className="toolbar">
            {mode === "toolbar" && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setEditTarget("summary"); }}>编辑</button>
                <button onClick={(e) => { e.stopPropagation(); setMode("expanded"); setEditTarget("none"); }}>放大</button>
                <button onClick={(e) => { e.stopPropagation(); alert("删除卡片"); }}>删除</button>
              </>
            )}
            {mode === "expanded" && (
              <>
                <button onClick={(e) => { e.stopPropagation(); handleUndo(); }}>撤销</button>
                <button onClick={(e) => { e.stopPropagation(); setEditTarget("body"); }}>编辑正文</button>
                <button onClick={(e) => { e.stopPropagation(); handleColorChange(); }}>颜色</button>
                <button onClick={(e) => { e.stopPropagation(); setMode("normal"); setEditTarget("none"); }}>恢复</button>
                <button onClick={(e) => { e.stopPropagation(); alert("删除卡片"); }}>删除</button>
              </>
            )}
          </div>
        )}
      </div>
    // </Draggable>
  );
}
export default EditableCard;