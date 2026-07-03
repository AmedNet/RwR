// src/input/InputManager.js
import { GameState } from '../core/GameState.js';

export const InputManager = {
    setup() {
        const canvas = document.getElementById('gameCanvas');

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            if (GameState.gameOver) {
                // 死亡时关闭军械库界面
                if (GameState.arsenalOpen) {
                    GameState.arsenalOpen = false;
                }

                // 永久战败，不能复活
                if (GameState.permanentDefeat) {
                    e.preventDefault();
                    return;
                }
                // 死亡时：数字键 1-6 选择据点复活
                const num = parseInt(e.key);
                if (num >= 1 && num <= 6) {
                    const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
                    if (playerPoints[num - 1]) {
                        window.dispatchEvent(new CustomEvent('respawnPlayer', { detail: { pointIndex: num - 1 } }));
                        e.preventDefault();
                        return;
                    }
                }
                if (key === 'r') {
                    window.dispatchEvent(new CustomEvent('respawnPlayer'));
                    e.preventDefault();
                    return;
                }
                return; // 死亡状态下不处理其他按键
            }
            
            // E 键：打开/关闭军械库
            if (key === 'e') {
                const arsenal = GameState.arsenal;
                const player = GameState.player;
                if (arsenal && player && arsenal.contains(player)) {
                    GameState.arsenalOpen = !GameState.arsenalOpen;
                    console.log(GameState.arsenalOpen ? '🔫 打开军械库' : '🔫 关闭军械库');
                }
                e.preventDefault();
                return;
            }
            
            // Q 键：打开/关闭背包
            if (key === 'q') {
                GameState.inventoryOpen = !GameState.inventoryOpen;
                console.log(GameState.inventoryOpen ? '🎒 打开背包' : '🎒 关闭背包');
                e.preventDefault();
                return;
            }
            
            if (key in GameState.keys) {
                GameState.keys[key] = true;
                e.preventDefault();
            }
            if (key === ' ' || key === 'space') {
                if (GameState.player) GameState.player.shoot();
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in GameState.keys) {
                GameState.keys[key] = false;
                e.preventDefault();
            }
        });

        // 鼠标移动：将坐标映射到逻辑像素
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            // 使用 canvas 的 CSS 像素尺寸（逻辑像素）
            const logicalWidth = canvas.clientWidth;
            const logicalHeight = canvas.clientHeight;
            const scaleX = logicalWidth / rect.width;
            const scaleY = logicalHeight / rect.height;
            GameState.mouse.x = (e.clientX - rect.left) * scaleX;
            GameState.mouse.y = (e.clientY - rect.top) * scaleY;
        });

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 && GameState.player) {
                GameState.player.shoot();
                e.preventDefault();
            }
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
};