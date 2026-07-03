// src/systems/SpawnSystem.js
import { GameState } from '../core/GameState.js';
import { Enemy } from '../entities/Enemy.js';

export const SpawnSystem = {
    spawnEnemy() {
        const config = GameState.config.enemy;
        const world = GameState.config.world;
        const map = GameState.map;
        let x, y;
        let attempts = 0;
        // 尝试生成在可通行的位置，最多尝试50次
        do {
            x = Math.random() * world.width;
            y = Math.random() * world.height;
            attempts++;
        } while (attempts < 50 && map && !map.isWalkable(x, y, config.radius));
        // 如果50次都找不到合适位置，就用默认位置（但大概率会被碰撞系统推出）
        return new Enemy(x, y, config);
    },

    update() {
        if (GameState.gameOver) return;
        const config = GameState.config.enemy;
        if (GameState.enemies.length >= config.maxEnemies) return;
        
        GameState.spawnTimer++;
        // 动态生成速率：随击杀数增加而加快
        const rate = Math.max(10, config.spawnBaseRate - Math.floor(GameState.kills / 5));
        if (GameState.spawnTimer >= rate) {
            GameState.enemies.push(this.spawnEnemy());
            GameState.spawnTimer = 0;
        }
    }
};