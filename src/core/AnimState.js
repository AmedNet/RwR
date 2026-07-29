// src/core/AnimState.js
// UI 动画状态工厂 —— 统一面板开/关、焦点滑动、弹出动画的创建与重置。
// GameState.panels / GameState.focus / GameState.appear 下的每个条目
// 都由这里的 factory 产出，reset 时重新调用 factory 即可，无需逐字段清零。

// ─── 面板开/关动画（倒带式，支持中途反向打断） ───
// open: 面板是否处于打开态（同时充当游戏逻辑门控标志）
// progress: 0→1 动画进度（开/关共用，倒带式）
// direction: 'opening' | 'closing' | null（支持中途反向打断）
// _lastTime: performance.now() 基准（渲染函数内自驱 deltaTime）
// extra: 面板特有字段（如 radioNoPermit.showTimer、menuPreview.id）
export const makePanelAnim = (extra) => ({
  open: false,
  progress: 0,
  direction: null,
  _lastTime: null,
  ...extra,
});

// 通用面板切换（支持中途反向打断：progress 不归零，从半路反向继续播）
export function togglePanel(p) {
  if (p.direction === 'closing') {
    p.direction = 'opening';
  } else if (p.direction === 'opening') {
    p.direction = 'closing';
  } else if (p.open) {
    p.direction = 'closing';
  } else {
    p.open = true;
    p.progress = 0;
    p.direction = 'opening';
  }
  p._lastTime = null;
}

// ─── 焦点滑动动画（选中项切换时高亮从旧位置滑到新位置） ───
// x/y: 当前显示位置（null=未初始化）
// fromX/fromY: 本次滑动起点
// index: 焦点当前归属的选中索引（检测变化用）
// anim: 滑动进度 0→1（easeOut 前）
// _lastTime: deltaTime 计时基准
export const makeFocusAnim = () => ({
  x: null,
  y: null,
  fromX: null,
  fromY: null,
  index: -1,
  anim: 0,
  _lastTime: null,
});

// ─── 弹出动画（延迟 + easeOut 弹出） ───
// 用于死亡界面、快速结算、战报、主菜单等「先延迟再弹出」的场景
// delay: 已延迟秒数（0→1 期间只渲染战场/渐黑）
// progress: 弹出进度 0→1
// _lastTime: deltaTime 计时基准
export const makeAppearAnim = () => ({
  delay: 0,
  progress: 0,
  _lastTime: null,
});