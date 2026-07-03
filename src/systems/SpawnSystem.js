// src/systems/SpawnSystem.js
import { GameState } from '../core/GameState.js';
import { Enemy } from '../entities/Enemy.js';

export const SpawnSystem = {
    spawnEnemy() {
        const canvas = document.getElementById('gameCanvas');
        const pad = 30;
        let x, y;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = Math.random() * canvas.width; y = -pad; }
        else if (side === 1) { x = canvas.width + pad; y = Math.random() * canvas.height; }
        else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + pad; }
        else { x = -pad; y = Math.random() * canvas.height; }

        const player = GameState.player;
        if (player) {
            const dx = x - player.x;
            const dy = y - player.y;
            if (Math.sqrt(dx*dx + dy*dy) < 150) {
                x = Math.random() * canvas.width;
                y = Math.random() * canvas.height;
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