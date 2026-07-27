// src/input/InputManager.js
// 薄调度层：注册事件，按状态分发给各 handler
import { GameState } from '../core/GameState.js';
import { handleDeathKeydown, handleDeathMousedown } from './handlers/DeathHandler.js';
import { handleMenuKeydown, handleMenuMousedown, handleMenuContextmenu, handleMenuWheel } from './handlers/MenuHandler.js';
import { handleRadioKeydown, handleRadioMousedown, handleRadioContextmenu } from './handlers/RadioHandler.js';
import { handleDebugKeydown, handleDebugMousedown } from './handlers/DebugHandler.js';
import { handleGameplayKeydown, handleGameplayKeyup } from './handlers/GameplayHandler.js';
import { handleMousemove, handleNormalMousedown, handleMouseup, handleBlur } from './handlers/MouseHandler.js';
import { handlePauseKeydown, handlePauseMousedown, handleSettingsKeydown, handleSettingsMousedown } from './handlers/PauseHandler.js';
import { handleDialogueKeydown, handleDialogueMousedown } from './handlers/DialogueHandler.js';
import { handleMainMenuMousedown } from './handlers/MainMenuHandler.js';
import { handleQuickResultKeydown, handleQuickResultMousedown } from './handlers/QuickResultHandler.js';

// 首次手势回调（presskey → menu），由 main.js 注入避免循环依赖
let firstGestureHandler = null;
export function setFirstGestureHandler(fn) {
    firstGestureHandler = fn;
}

export const InputManager = {
    setup() {
        const canvas = document.getElementById('gameCanvas');

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            // presskey / warming 阶段：任意键进入主菜单（忽略 autorepeat；按键顺带解锁音频）
            // warming 时 onFirstGesture 自行 guard（phase!=='presskey' 直接 return），此处仅吞键防穿透
            if (GameState.phase === 'presskey' || GameState.phase === 'warming') {
                if (!e.repeat && firstGestureHandler) firstGestureHandler();
                e.preventDefault();
                return;
            }

            // menu 阶段：吞噬游戏操作键（设置打开时由下方 settingsOpen 分支处理）
            if (GameState.phase === 'menu' && !GameState.settingsOpen && GameState.settingsAnimDirection !== 'closing') {
                e.preventDefault();
                return;
            }

            // 快速模式结算界面（优先于死亡处理：快速模式不可复活）
            if (GameState.mode === 'quick' && GameState.quickResult) {
                handleQuickResultKeydown(e, key);
                return;
            }

            // 死亡状态
            if (GameState.gameOver) {
                handleDeathKeydown(e, key);
                return;
            }

            // 对话演出打开（空格/回车推进，吞噬其余键；世界保持冻结）
            if (GameState.dialogueOpen || GameState.dialogueAnimDirection === 'closing') {
                handleDialogueKeydown(e, key);
                return;
            }

            // 设置面板打开（ESC 退回暂停菜单，吞噬其余键；世界保持冻结）
            if (GameState.settingsOpen || GameState.settingsAnimDirection === 'closing') {
                handleSettingsKeydown(e, key);
                return;
            }

            // 暂停菜单打开（ESC 恢复游戏，吞噬其余键）
            if (GameState.paused || GameState.pauseAnimDirection === 'closing') {
                handlePauseKeydown(e, key);
                return;
            }

            // 菜单打开
            if (GameState.inventoryOpen || GameState.arsenalOpen) {
                const consumed = handleMenuKeydown(e, key);
                if (consumed) return;
                // F 键穿透到拾取逻辑
            }

            // 电台界面
            if (GameState.radioOpen) {
                handleRadioKeydown(e, key);
                return;
            }

            // Debug面板
            if (GameState.debugOpen) {
                handleDebugKeydown(e, key);
                return;
            }

            // 正常游戏操作
            handleGameplayKeydown(e, key);
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            handleGameplayKeyup(e, key);
        });

        // 鼠标移动
        canvas.addEventListener('mousemove', (e) => {
            handleMousemove(e, canvas);
        });

        // 鼠标点击
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                GameState.mouse.rightDown = true;
                e.preventDefault();
            }
            if (e.button === 0) {
                GameState.mouse.down = true;

                // presskey / warming 阶段：任意点击进入主菜单（warming 时 onFirstGesture 自行 guard）
                if (GameState.phase === 'presskey' || GameState.phase === 'warming') {
                    if (firstGestureHandler) firstGestureHandler();
                    e.preventDefault();
                    return;
                }

                // menu 阶段：主菜单按钮点击（命中则分发；无论命中与否都吞掉，防穿透开火）
                if (GameState.phase === 'menu' && !GameState.settingsOpen && GameState.settingsAnimDirection !== 'closing') {
                    handleMainMenuMousedown(e, canvas);
                    e.preventDefault();
                    return;
                }

                // 对话演出点击（推进对话，优先于其它面板）
                if (GameState.dialogueOpen || GameState.dialogueAnimDirection === 'closing') {
                    handleDialogueMousedown(e, canvas);
                    return;
                }

                // 设置面板点击（优先于暂停菜单，设置叠在上层）
                if (GameState.settingsOpen || GameState.settingsAnimDirection === 'closing') {
                    handleSettingsMousedown(e, canvas);
                    return;
                }

                // 暂停菜单点击
                if (GameState.paused || GameState.pauseAnimDirection === 'closing') {
                    handlePauseMousedown(e, canvas);
                    return;
                }

                // 电台界面点击
                if (GameState.radioOpen) {
                    handleRadioMousedown(e, canvas);
                    return;
                }

                // 快速模式结算界面点击（优先于死亡界面）
                if (GameState.mode === 'quick' && GameState.quickResult) {
                    handleQuickResultMousedown(e, canvas);
                    return;
                }

                // 死亡界面点击
                if (GameState.gameOver) {
                    if (handleDeathMousedown(e)) return;
                }

                // Debug面板点击
                if (GameState.debugOpen) {
                    handleDebugMousedown(e, canvas);
                    return;
                }

                // 背包界面点击选中格子
                if (handleMenuMousedown(e, canvas)) return;

                // 正常射击
                handleNormalMousedown(e);
            }
        });

        // 鼠标释放
        canvas.addEventListener('mouseup', (e) => {
            handleMouseup(e);
        });

        window.addEventListener('blur', () => {
            handleBlur();
        });

        // 右键菜单
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (GameState.radioOpen) {
                handleRadioContextmenu(e);
                return;
            }
            handleMenuContextmenu(e);
        });

        // 军械库鼠标滚轮
        canvas.addEventListener('wheel', (e) => {
            handleMenuWheel(e);
        }, { passive: false });
    }
};
