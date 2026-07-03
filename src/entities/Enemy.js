// src/entities/Enemy.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { Bullet } from './Bullet.js';
import { PathFinder } from '../utils/PathFinder.js';

export class Enemy extends Entity {
    constructor(x, y, config) {
        const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
        super(x, y, {
            health: config.health,
            speed: speed,
            radius: config.radius
        });
        this.shootCooldown = 0;
        this.shootDelay = config.shootDelayMin + Math.floor(Math.random() * (config.shootDelayMax - config.shootDelayMin));
        const colors = GameState.config.colors;
        const hue = colors.enemyHueMin + Math.random() * (colors.enemyHueMax - colors.enemyHueMin);
        this.color = `hsl(${hue}, 70%, 50%)`;
        this.damage = config.damage;
        this.config = config;
        // 寻路缓存
        this.currentPath = null;
        this.pathIndex = 0;
        this.pathTarget = null; // {x, y} 当前路径的目标点
        this.pathCheckTimer = 0; // 降低寻路频率
        // 卡住检测
        this.stuckTimer = 0;
        this.lastX = x;
        this.lastY = y;
    }

    getTargets() {
        const targets = [];
        if (GameState.player && GameState.player.alive) {
            targets.push(GameState.player);
        }
        for (const teammate of GameState.teammates) {
            if (teammate.alive) {
                targets.push(teammate);
            }
        }
        return targets;
    }

    // 寻找最近的敌方据点（非敌方阵营的据点）
    getClosestTargetPoint() {
        let target = null;
        let minDist = Infinity;
        for (const point of GameState.capturePoints) {
            if (point.owner === 'enemy') continue; // 己方据点不去
            const d = Math.hypot(point.x - this.x, point.y - this.y);
            if (d < minDist) {
                minDist = d;
                target = point;
            }
        }
        return { target, distance: minDist };
    }

    update() {
        if (GameState.gameOver) return;

        // 优先级1: 寻找最近的己方据点（敌方归属）-> 前往占领
        const { target: captureTarget, distance: captureDist } = this.getClosestTargetPoint();
        
        // 优先级2: 寻找附近的敌人（玩家/队友）
        const targets = this.getTargets();
        let closestTarget = null;
        let closestDist = Infinity;
        for (const t of targets) {
            if (!t.alive) continue;
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d < closestDist) {
                closestDist = d;
                closestTarget = t;
            }
        }

        let targetX = null, targetY = null;
        let hasEnemyTarget = false;

        // 决策逻辑：如果有据点可占领，优先去据点
        // 但如果敌人挡在路上或离得很近，先打敌人
        if (captureTarget && (closestDist > 300 || !closestTarget)) {
            // 去占领据点
            targetX = captureTarget.x;
            targetY = captureTarget.y;
        } else if (closestTarget) {
            // 攻击最近的敌人
            targetX = closestTarget.x;
            targetY = closestTarget.y;
            hasEnemyTarget = true;
        }

        // 使用 A* 寻路移动
        if (targetX !== null && targetY !== null) {
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);
            
            // 短距离直接移动，不寻路
            if (dist < 200) {
                this.currentPath = null; // 清除路径
                const normX = dx / dist;
                const normY = dy / dist;
                const speedFactor = GameState.map ? GameState.map.getSpeedFactor(this.x, this.y) : 1;
                const finalSpeed = this.speed * speedFactor;
                let newX = this.x + normX * finalSpeed;
                let newY = this.y + normY * finalSpeed;
                if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                    if (GameState.map.isWalkable(newX, this.y, this.radius)) {
                        this.x = newX;
                    } else if (GameState.map.isWalkable(this.x, newY, this.radius)) {
                        this.y = newY;
                    }
                } else {
                    this.x = newX;
                    this.y = newY;
                }
            } else {
                // 降低寻路频率：每 30 帧检查一次
                this.pathCheckTimer++;
                const needNewPath = !this.currentPath || 
                    !this.pathTarget || 
                    Math.hypot(this.pathTarget.x - targetX, this.pathTarget.y - targetY) > 100 ||
                    this.pathIndex >= this.currentPath.length;

                if (needNewPath && this.pathCheckTimer >= 30 && GameState.map) {
                    // 计算新路径
                    this.currentPath = PathFinder.findPath(GameState.map, this.x, this.y, targetX, targetY);
                    this.pathIndex = 0;
                    this.pathTarget = { x: targetX, y: targetY };
                    this.pathCheckTimer = 0;
                }

                // 沿路径移动
                if (this.currentPath && this.pathIndex < this.currentPath.length) {
                    const waypoint = this.currentPath[this.pathIndex];
                    const wdx = waypoint.x - this.x;
                    const wdy = waypoint.y - this.y;
                    const wdist = Math.hypot(wdx, wdy);
                    
                    if (wdist < 10) {
                        // 到达当前路径点，前往下一个
                        this.pathIndex++;
                    } else if (wdist > 2) {
                        // 向路径点移动
                        const normX = wdx / wdist;
                        const normY = wdy / wdist;
                        const speedFactor = GameState.map ? GameState.map.getSpeedFactor(this.x, this.y) : 1;
                        const finalSpeed = this.speed * speedFactor;
                        let newX = this.x + normX * finalSpeed;
                        let newY = this.y + normY * finalSpeed;
                        
                        // 地图碰撞检测
                        if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                            if (GameState.map.isWalkable(newX, this.y, this.radius)) {
                                this.x = newX;
                            } else if (GameState.map.isWalkable(this.x, newY, this.radius)) {
                                this.y = newY;
                            } else {
                                // 无法移动，放弃当前路径
                                this.currentPath = null;
                            }
                        } else {
                            this.x = newX;
                            this.y = newY;
                        }
                    }
                } else if (dist > 10) {
                    // 没有路径，直接朝目标移动（fallback）
                    const normX = dx / dist;
                    const normY = dy / dist;
                    const speedFactor = GameState.map ? GameState.map.getSpeedFactor(this.x, this.y) : 1;
                    const finalSpeed = this.speed * speedFactor;
                    let newX = this.x + normX * finalSpeed;
                    let newY = this.y + normY * finalSpeed;
                    if (GameState.map && !GameState.map.isWalkable(newX, newY, this.radius)) {
                        if (GameState.map.isWalkable(newX, this.y, this.radius)) {
                            this.x = newX;
                        } else if (GameState.map.isWalkable(this.x, newY, this.radius)) {
                            this.y = newY;
                        }
                    } else {
                        this.x = newX;
                        this.y = newY;
                    }
                }
            }
        }

        // 世界边界
        const world = GameState.config.world;
        this.x = Math.max(this.radius, Math.min(world.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(world.height - this.radius, this.y));

        // 卡住检测：如果连续3秒没移动，传送到最近的敌方据点
        const moved = Math.abs(this.x - this.lastX) > 0.5 || Math.abs(this.y - this.lastY) > 0.5;
        if (moved) {
            this.stuckTimer = 0;
            this.lastX = this.x;
            this.lastY = this.y;
        } else {
            this.stuckTimer++;
        }

        if (this.stuckTimer > 180) { // 3秒（60fps * 3）
            const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
            if (enemyPoints.length > 0) {
                // 找最近的敌方据点
                let nearest = enemyPoints[0];
                let minDist = Infinity;
                for (const p of enemyPoints) {
                    const d = Math.hypot(p.x - this.x, p.y - this.y);
                    if (d < minDist) {
                        minDist = d;
                        nearest = p;
                    }
                }
                // 传送到据点附近
                const angle = Math.random() * Math.PI * 2;
                const dist = 50 + Math.random() * 80;
                this.x = nearest.x + Math.cos(angle) * dist;
                this.y = nearest.y + Math.sin(angle) * dist;
                this.stuckTimer = 0;
                this.currentPath = null; // 清除路径
            } else {
                // 无敌方据点，传送到地图右侧中心
                this.x = GameState.config.world.width * 0.75;
                this.y = GameState.config.world.height / 2;
                this.stuckTimer = 0;
                this.currentPath = null;
            }
        }

        // 射击：只攻击敌人目标（不射击据点）
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (hasEnemyTarget && closestTarget && closestDist < 400) {
            const angle = Math.atan2(closestTarget.y - this.y, closestTarget.x - this.x);
            const speed = 4.5;
            const bullet = new Bullet(
                this.x + Math.cos(angle) * this.radius,
                this.y + Math.sin(angle) * this.radius,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                true,
                this.damage
            );
            GameState.bullets.push(bullet);
            this.shootCooldown = this.shootDelay;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#4a0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, -25, 40, 5);
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
        ctx.fillRect(-20, -25, 40 * hpPercent, 5);

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✧', 0, 0);
        ctx.restore();
    }
}