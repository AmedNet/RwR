// src/rendering/Camera.js
import { GameState } from '../core/GameState.js';

export const Camera = {
    // 跟随目标（玩家），平滑或直接跟随
    follow(target) {
        if (!target) return;
        const config = GameState.config.world;
        // 直接跟随（也可改为 lerp 平滑）
        this.x = target.x - window.innerWidth / 2; // 若画布即窗口，可改用 canvas 宽高
        this.y = target.y - window.innerHeight / 2;
        // 边界限制
        this.x = Math.max(0, Math.min(config.width - 800, this.x)); // 假设画布宽800，可根据实际动态获取
        this.y = Math.max(0, Math.min(config.height - 600, this.y));
    },

    // 世界坐标转屏幕坐标
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.x,
            y: worldY - this.y
        };
    }
};