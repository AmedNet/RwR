// src/entities/Teammate.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { Bullet } from './Bullet.js';
import { MovementSystem } from '../utils/MovementSystem.js';

export class Teammate extends Entity {
    constructor(x, y, config) {
        super(x, y, {
            health: config.health || 60,
            speed: config.speed || 2.5,
            radius: config.radius || 15
        });
        this.shootCooldown = 0;
        this.shootDelay = config.shootDelay || 25;
        this.damage = config.damage || 15;
        this.bulletSpeed = config.bulletSpeed || 6;
        this.color = '#42A5F5';
        this.alive = true;
        // 随机分配角色：0=防守, 1=进攻, 2=游走
        this.role = Math.random() < 0.4 ? 0 : (Math.random() < 0.6 ? 1 : 2);
        // 每个队友绑定一个己方据点作为基地
        this.homeBase = this.assignHomeBase();
        // 巡逻参数
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.patrolTimer = Math.random() * 1000;
        this.patrolRadius = 80 + Math.random() * 100;
        // 游走目标（进攻组/游走组用）
        this.wanderTarget = null;
        this.wanderTimer = 0;
        // 卡住状态
        this.stuckState = {
            timer: 0,
            lastX: x,
            lastY: y,
            fallbackPoints: null
        };
    }

    assignHomeBase() {
        const friendlyPoints = GameState.capturePoints.filter(p => p.owner === 'player');
        if (friendlyPoints.length === 0) return null;
        return friendlyPoints[Math.floor(Math.random() * friendlyPoints.length)];
    }

    // 动态角色调整：后期己方据点多时，防守兵转为进攻
    updateRole() {
        const friendlyPoints = GameState.capturePoints.filter(p => p.owner === 'player');
        const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
        
        // 己方据点明显多于敌方 → 防守兵转为进攻
        if (this.role === 0 && friendlyPoints.length > enemyPoints.length + 1) {
            if (Math.random() < 0.005) { // 0.5%/帧，约3秒内完成转换
                this.role = 1;
                this.homeBase = null;
            }
        }
        // 所有据点都是己方的 → 全部转为进攻/游走
        if (this.role === 0 && enemyPoints.length === 0) {
            this.role = Math.random() < 0.5 ? 1 : 2;
            this.homeBase = null;
        }
    }

    getClosestEnemy() {
        let target = null;
        let minDist = Infinity;
        for (const enemy of GameState.enemies) {
            if (!enemy.alive) continue;
            const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (d < minDist) {
                minDist = d;
                target = enemy;
            }
        }
        return { target, distance: minDist };
    }

    getClosestEnemyPoint() {
        let target = null;
        let minDist = Infinity;
        for (const point of GameState.capturePoints) {
            if (point.owner === 'player') continue;
            // 计算据点附近已有队友数量
            let nearbyAllies = 0;
            for (const t of GameState.teammates) {
                if (t !== this && t.alive && Math.hypot(t.x - point.x, t.y - point.y) < 200) {
                    nearbyAllies++;
                }
            }
            // 有效距离 = 实际距离 + 队友拥挤惩罚
            const effectiveDist = Math.hypot(point.x - this.x, point.y - this.y) + nearbyAllies * 150;
            if (effectiveDist < minDist) {
                minDist = effectiveDist;
                target = point;
            }
        }
        return { target, distance: minDist };
    }

    // 生成一个随机游走目标
    pickWanderTarget() {
        const world = GameState.config.world;
        const map = GameState.map;
        for (let i = 0; i < 20; i++) {
            const x = 200 + Math.random() * (world.width - 400);
            const y = 200 + Math.random() * (world.height - 400);
            if (!map || map.isWalkable(x, y, this.radius)) {
                return { x, y };
            }
        }
        return { x: world.width / 2, y: world.height / 2 };
    }

    update() {
        if (GameState.gameOver || !this.alive) return;
        const player = GameState.player;
        if (!player || !player.alive) return;

        // 动态调整角色
        this.updateRole();

        const { target: enemy, distance: enemyDist } = this.getClosestEnemy();
        const { target: captureTarget, distance: captureDist } = this.getClosestEnemyPoint();

        let targetX = null, targetY = null;
        let hasEnemyTarget = false;

        const hasNearbyEnemy = enemy && enemyDist < 400;

        if (hasNearbyEnemy) {
            // 附近有敌人 -> 战斗
            // 不直接冲向敌人，而是保持距离环绕
            hasEnemyTarget = true;
            const angleToEnemy = Math.atan2(enemy.y - this.y, enemy.x - this.x);
            // 在敌人周围保持 150-200 距离游走
            const orbitAngle = angleToEnemy + (Math.sin(this.patrolTimer * 0.02) > 0 ? Math.PI / 2 : -Math.PI / 2);
            targetX = enemy.x + Math.cos(orbitAngle) * 180;
            targetY = enemy.y + Math.sin(orbitAngle) * 180;
        } else if (this.role === 0) {
            // 防守组：在己方据点周围巡逻
            if (this.homeBase) {
                this.stuckState.fallbackPoints = [this.homeBase];
                const dx = this.homeBase.x - this.x;
                const dy = this.homeBase.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > this.patrolRadius) {
                    // 离基地太远，回去
                    targetX = this.homeBase.x;
                    targetY = this.homeBase.y;
                } else {
                    // 在基地周围巡逻
                    this.patrolTimer++;
                    const angle = this.patrolAngle + Math.sin(this.patrolTimer * 0.01) * 2;
                    const patrolDist = 40 + Math.sin(this.patrolTimer * 0.02) * this.patrolRadius * 0.5;
                    targetX = this.homeBase.x + Math.cos(angle) * patrolDist;
                    targetY = this.homeBase.y + Math.sin(angle) * patrolDist;
                }
            } else {
                // 无基地，跟随玩家
                targetX = player.x + (Math.random() - 0.5) * 200;
                targetY = player.y + (Math.random() - 0.5) * 200;
            }
        } else if (this.role === 1) {
            // 进攻组：优先攻占据点
            if (captureTarget) {
                targetX = captureTarget.x;
                targetY = captureTarget.y;
            } else {
                this.wanderTimer++;
                if (this.wanderTimer > 300 || !this.wanderTarget) {
                    this.wanderTarget = this.pickWanderTarget();
                    this.wanderTimer = 0;
                }
                targetX = this.wanderTarget.x;
                targetY = this.wanderTarget.y;
            }
        } else {
            // 游走组：自由探索地图
            this.wanderTimer++;
            if (this.wanderTimer > 200 || !this.wanderTarget) {
                if (captureTarget && Math.random() < 0.4) {
                    this.wanderTarget = { x: captureTarget.x, y: captureTarget.y };
                } else {
                    this.wanderTarget = this.pickWanderTarget();
                }
                this.wanderTimer = 0;
            }
            targetX = this.wanderTarget.x;
            targetY = this.wanderTarget.y;
        }

        // 移动
        if (targetX !== null && targetY !== null) {
            MovementSystem.moveToward(this, targetX, targetY, this.stuckState);
        }

        // 射击
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (hasNearbyEnemy && enemy) {
            const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
            const bullet = new Bullet(
                this.x + Math.cos(angle) * this.radius,
                this.y + Math.sin(angle) * this.radius,
                Math.cos(angle) * this.bulletSpeed,
                Math.sin(angle) * this.bulletSpeed,
                false,
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
        ctx.strokeStyle = '#0D47A1';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#BBDEFB';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', 0, -2);

        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-18, -25, 36, 4);
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
        ctx.fillRect(-18, -25, 36 * hpPercent, 4);
        ctx.restore();
    }
}