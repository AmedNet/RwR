// src/systems/SpawnSystem.js
import { GameState } from '../core/GameState.js';
import { Enemy } from '../entities/Enemy.js';

export const SpawnSystem = {
    spawnEnemy() {
        const world = GameState.config.world;
        const pad = 30;
        let x, y;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = Math.random() * world.width; y = -pad; }
        else if (side === 1) { x = world.width + pad; y = Math.random() * world.height; }
        else if (side === 2) { x = Math.random() * world.width; y = world.height + pad; }
        else { x = -pad; y = Math.random() * world.height; }

        const player = GameState.player;
        if (player) {
            const dx = x - player.x;
            const dy = y - player.y;
            if (Math.sqrt(dx*dx + dy*dy) < 150) {
                // 若太近，生成在世界内部随机位置（简化处理）
                x = Math.random() * world.width;
                y = Math.random() * world.height;
            }
        }
        return new Enemy(x, y, GameState.config.enemy);
    },

    update() {
        if (GameState.gameOver) return;
        GameState.spawnTimer++;
        const config = GameState.config.enemy;
        const rate = Math.max(10, config.spawnBaseRate - Math.floor(GameState.kills / 10));
        if (GameState.spawnTimer >= rate && GameState.enemies.length < config.maxEnemies) {
            GameState.enemies.push(this.spawnEnemy());
            GameState.spawnTimer = 0;
        }
    }
};