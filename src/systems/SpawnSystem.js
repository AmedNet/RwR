// src/systems/SpawnSystem.js
import { GameState } from '../core/GameState.js';
import { Enemy } from '../entities/Enemy.js';

export const SpawnSystem = {
    spawnEnemy() {
        const config = GameState.config.enemy;
        const world = GameState.config.world;
        
        // 只在敌方据点生成敌人
        const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
        
        if (enemyPoints.length === 0) {
            // 没有敌方据点，不生成敌人
            return null;
        }
        
        const point = enemyPoints[Math.floor(Math.random() * enemyPoints.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 100;
        let x = point.x + Math.cos(angle) * dist;
        let y = point.y + Math.sin(angle) * dist;
        
        // 确保不超出边界
        x = Math.max(config.radius, Math.min(world.width - config.radius, x));
        y = Math.max(config.radius, Math.min(world.height - config.radius, y));
        
        console.log(`👾 敌人生成于据点附近 (${Math.round(x)}, ${Math.round(y)})`);
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
            const enemy = this.spawnEnemy();
            if (enemy) {
                GameState.enemies.push(enemy);
            }
            GameState.spawnTimer = 0;
        }
    }
};