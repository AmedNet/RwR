// src/input/handlers/QuickResultHandler.js
// 快速模式结算界面的按键/点击处理（重试/下一把/返回主菜单），镜像 PauseHandler。
// 动作回调通过 setQuickResultActions 注入，而非 import main.js —— 避免循环依赖。
import { GameState } from '../../core/GameState.js';
import { playUISound } from '../../utils/SoundManager.js';
import { toCanvasCoords } from '../canvasCoords.js';

// 由 main.js 在 boot 阶段注入的动作回调
let actions = { retry: null, next: null, menu: null };
export function setQuickResultActions(a) {
    actions = { ...actions, ...a };
}

function activate(id) {
    playUISound('click');
    if (id === 'retry' && actions.retry) actions.retry();
    else if (id === 'next' && actions.next) actions.next();
    else if (id === 'menu' && actions.menu) actions.menu();
}

// ─── 结算界面 mousedown（重试 / 下一把 / 返回主菜单） ───
// 命中与否都吞掉事件，防止穿透到 handleNormalMousedown 开火。
export function handleQuickResultMousedown(e, canvas) {
    // 弹出动画未放完不响应（等动画）
    if (GameState.quickResultAppearAnim < 1) {
        e.preventDefault();
        return true;
    }
    const { x, y } = toCanvasCoords(e, canvas);
    for (const area of GameState.quickResultHitAreas) {
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
            activate(area.id);
            e.preventDefault();
            return true;
        }
    }
    e.preventDefault();
    return true;
}

// ─── 结算界面 keydown（R 重试 / N 下一把 / ESC 主菜单，吞噬其余键） ───
export function handleQuickResultKeydown(e, key) {
    if (GameState.quickResultAppearAnim >= 1) {
        if (key === 'r') activate('retry');
        else if (key === 'n') activate('next');
        else if (key === 'escape') activate('menu');
    }
    e.preventDefault();
    return true;
}
