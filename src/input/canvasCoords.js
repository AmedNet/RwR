// src/input/canvasCoords.js
// 共享坐标换算：鼠标事件 clientX/Y → canvas 逻辑像素坐标（补偿 CSS 缩放）。
// 供各 handler 的命中检测复用（PauseHandler 已接入；MenuHandler/RadioHandler 为历史内联拷贝）。
export function toCanvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / rect.width;
    const scaleY = canvas.clientHeight / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
}
