// src/utils/MovementSystem.js
import { GameState } from '../core/GameState.js';
import { WeatherSystem } from '../core/WeatherSystem.js';

export const MovementSystem = {
    /**
     * 朝目标移动，带滑动避障和卡住传送
     * @param {Object} entity - 实体对象（必须有 x, y, radius, speed 属性）
     * @param {number} targetX - 目标 X
     * @param {number} targetY - 目标 Y
     * @param {Object} [stuckState] - 卡住状态（可选，传了才会检测卡住）
     * @returns {boolean} 是否到达目标附近（距离 < 10）
     */
    moveToward(entity, targetX, targetY, stuckState) {
        const dx = targetX - entity.x;
        const dy = targetY - entity.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 10) return true; // 已到达

        const speedFactor = GameState.map ? GameState.map.getSpeedFactor(entity.x, entity.y) : 1;
        const weatherSpeed = WeatherSystem.getSpeedMultiplier();
        const currentWeather = WeatherSystem.current;
        const isSnow = currentWeather === 'snow' || currentWeather === 'blizzard';
        const slipFactor = isSnow ? 0.82 : 1.0;

        const finalSpeed = entity.speed * speedFactor * weatherSpeed * slipFactor;
        const normX = dx / dist;
        const normY = dy / dist;

        // 初始化AI滑移速度
        if (entity.slipVX === undefined) { entity.slipVX = 0; entity.slipVY = 0; }

        // 尝试移动
        let moved = this.tryMove(entity, normX * finalSpeed, normY * finalSpeed);

        // 如果没移动成功，尝试沿障碍物滑动
        if (!moved) {
            moved = this.slideMove(entity, normX, normY, finalSpeed);
        }
        const safeX = entity.x;
        const safeY = entity.y;

        // 雪地惯性：积累滑移速度
        if (isSnow && moved) {
            const moveX = normX * finalSpeed;
            const moveY = normY * finalSpeed;
            entity.slipVX = entity.slipVX * 0.82 + moveX * 0.18;
            entity.slipVY = entity.slipVY * 0.82 + moveY * 0.18;
        } else if (isSnow) {
            entity.slipVX *= 0.93;
            entity.slipVY *= 0.93;
        }

        // 应用滑移速度
        if (isSnow && (Math.abs(entity.slipVX) > 0.01 || Math.abs(entity.slipVY) > 0.01)) {
            const slipX = entity.x + entity.slipVX;
            const slipY = entity.y + entity.slipVY;
            if (!GameState.map || GameState.map.isWalkable(slipX, slipY, entity.radius)) {
                entity.x = slipX;
                entity.y = slipY;
            } else {
                entity.slipVX *= 0.5;
                entity.slipVY *= 0.5;
            }
        }

        // 天气风力影响
        if (moved) {
            const windForce = WeatherSystem.getWindForce();
            const tornadoForce = WeatherSystem.getTornadoForce(entity.x, entity.y);
            const windScale = currentWeather === 'windStorm' || currentWeather === 'sandstorm' ? 0.12 : 0.3;
            entity.x += windForce.x * windScale + tornadoForce.x;
            entity.y += windForce.y * windScale + tornadoForce.y;
        }

        // 世界边界限制
        const world = GameState.world;
        entity.x = Math.max(entity.radius, Math.min(world.width - entity.radius, entity.x));
        entity.y = Math.max(entity.radius, Math.min(world.height - entity.radius, entity.y));

        if (GameState.map && !GameState.map.isWalkable(entity.x, entity.y, entity.radius)) {
            entity.x = safeX;
            entity.y = safeY;
            entity.slipVX = 0;
            entity.slipVY = 0;
        }

        // 卡住检测
        if (stuckState) {
            this.checkStuck(entity, stuckState);
        }

        return false;
    },

    /**
     * 尝试移动到新位置
     */
    tryMove(entity, moveX, moveY) {
        const newX = entity.x + moveX;
        const newY = entity.y + moveY;
        
        if (!GameState.map || GameState.map.isWalkable(newX, newY, entity.radius)) {
            entity.x = newX;
            entity.y = newY;
            return true;
        }
        return false;
    },

    /**
     * 沿障碍物滑动：尝试多种方向
     */
    slideMove(entity, normX, normY, speed) {
        const map = GameState.map;
        if (!map) return false;

        // 尝试方向列表：先沿X轴、沿Y轴，再尝试45度偏移
        const attempts = [
            { dx: normX, dy: 0 },           // 水平
            { dx: 0, dy: normY },           // 垂直
            { dx: normX * 0.7, dy: normY * 0.7 }, // 对角线
            { dx: normX * 0.5, dy: normY * 0.9 }, // 偏Y
            { dx: normX * 0.9, dy: normY * 0.5 }, // 偏X
            { dx: -normY, dy: normX },       // 垂直方向
            { dx: normY, dy: -normX },       // 反垂直方向
        ];

        for (const attempt of attempts) {
            const newX = entity.x + attempt.dx * speed;
            const newY = entity.y + attempt.dy * speed;
            if (map.isWalkable(newX, newY, entity.radius)) {
                entity.x = newX;
                entity.y = newY;
                return true;
            }
        }

        return false; // 所有方向都失败
    },

    /**
     * 卡住检测：连续 90 帧（1.5秒）没移动就传送
     */
    checkStuck(entity, state) {
        const moved = Math.abs(entity.x - state.lastX) > 0.5 || 
                      Math.abs(entity.y - state.lastY) > 0.5;
        
        if (moved) {
            state.timer = 0;
            state.lastX = entity.x;
            state.lastY = entity.y;
        } else {
            state.timer++;
        }

        if (state.timer > 90) { // 1.5秒
            this.teleportToSafe(entity, state);
            state.timer = 0;
        }
    },

    /**
     * 传送到安全位置
     */
    teleportToSafe(entity, state) {
        const map = GameState.map;
        const world = GameState.world;
        
        // 如果有指定传送点，优先使用
        if (state.fallbackPoints && state.fallbackPoints.length > 0) {
            const point = state.fallbackPoints[Math.floor(Math.random() * state.fallbackPoints.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * 80;
            entity.x = point.x + Math.cos(angle) * dist;
            entity.y = point.y + Math.sin(angle) * dist;
            return;
        }

        // 否则在附近随机找位置
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 100 + Math.random() * 200;
            const nx = entity.x + Math.cos(angle) * dist;
            const ny = entity.y + Math.sin(angle) * dist;
            if (nx > entity.radius && nx < world.width - entity.radius &&
                ny > entity.radius && ny < world.height - entity.radius &&
                (!map || map.isWalkable(nx, ny, entity.radius))) {
                entity.x = nx;
                entity.y = ny;
                return;
            }
        }
        
        // 最后的 fallback：地图中心
        entity.x = world.width / 2;
        entity.y = world.height / 2;
    }
};
