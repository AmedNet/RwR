// src/input/InputManager.js
import { GameState } from '../core/GameState.js';

export const InputManager = {
    setup() {
        const canvas = document.getElementById('gameCanvas');

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'r' && GameState.gameOver) {
                // 重新开始由 main 暴露一个 restart 函数，这里通过事件触发
                // 我们将在 main 中监听 restart 事件
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

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
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