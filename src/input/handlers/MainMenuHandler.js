// src/input/handlers/MainMenuHandler.js
// 主菜单点击处理（命中检测 + 按 id 分发），镜像 PauseHandler.handlePauseMousedown。
// 注意命名用 handleMainMenuMousedown：InputManager 已从 MenuHandler 导入 handleMenuMousedown
// （背包/军械库），重名会冲突。
//
// 动作回调通过 setMenuActions 注入，而非 import main.js —— 避免
// main → InputManager → MainMenuHandler → main 的循环依赖。
import { GameState } from '../../core/GameState.js';
import { playUISound } from '../../utils/SoundManager.js';
import { toCanvasCoords } from '../canvasCoords.js';

// 由 main.js 在 boot 阶段注入的动作回调
let actions = { startMatch: null, quitGame: null };
export function setMenuActions(a) {
    actions = { ...actions, ...a };
}

// ─── 主菜单 mousedown（战地模式 / 设置 / 退出游戏；快速开始/战役无反应） ───
// 命中返回 true（吞掉事件，防止穿透到 handleNormalMousedown 开火）。
export function handleMainMenuMousedown(e, canvas) {
    const { x, y } = toCanvasCoords(e, canvas);
    for (const area of GameState.mainMenuHitAreas) {
        if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
            // 快速开始 / 战役模式：未开放，完全无反应（不发声、不动作）
            if (area.disabled) {
                e.preventDefault();
                return true;
            }
            switch (area.id) {
                case 'battle':
                    playUISound('click');
                    if (actions.startMatch) actions.startMatch();
                    break;
                case 'settings':
                    playUISound('click');
                    GameState.toggleSettings();
                    break;
                case 'quit':
                    playUISound('click');
                    if (actions.quitGame) actions.quitGame();
                    break;
            }
            e.preventDefault();
            return true;
        }
    }
    return false;
}
