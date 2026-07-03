// src/input/InputManager.js
import { GameState } from '../core/GameState.js';

export const InputManager = {
    setup() {
        const canvas = document.getElementById('gameCanvas');

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'r' && GameState.gameOver) {
                window.dispatchEvent(new CustomEvent('restartGame'));
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