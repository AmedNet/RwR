// src/entities/Enemy.js
import { Entity } from './Entity.js';
import { GameState } from '../core/GameState.js';
import { Bullet } from './Bullet.js';
import { MovementSystem } from '../utils/MovementSystem.js';

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
        // 角色：0=防守兵, 1=突击兵, 2=游击兵
        this.role = Math.random() < 0.4 ? 0 : (Math.random() < 0.67 ? 1 : 2);
        // 防守兵绑定一个己方据点
        this.guardPoint = this.assignGuardPoint();
        // 游击兵游走
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

    assignGuardPoint() {
        const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
        if (enemyPoints.length === 0) return null;
        return enemyPoints[Math.floor(Math.random() * enemyPoints.length)];
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
            if (point.owner === 'enemy') continue;
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

        const { target: captureTarget } = this.getClosestTargetPoint();
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
        let urgentCombat = false;

        if (this.role === 0) {
            // === 防守兵：守卫己方据点 ===
            if (this.guardPoint) {
                this.stuckState.fallbackPoints = [this.guardPoint];
                const distToPoint = Math.hypot(this.guardPoint.x - this.x, this.guardPoint.y - this.y);
                const guardRadius = 180;
                
                if (closestTarget && closestDist < guardRadius + 60) {
                    // 敌人进入据点范围 → 攻击
                    urgentCombat = true;
                    // 保持在据点附近战斗
                    targetX = this.guardPoint.x;
                    targetY = this.guardPoint.y;
                } else if (distToPoint > guardRadius) {
                    // 远离据点了 → 回去
                    targetX = this.guardPoint.x;
                    targetY = this.guardPoint.y;
                } else {
                    // 在据点周围巡逻
                    const angle = Math.atan2(this.guardPoint.y - this.y, this.guardPoint.x - this.x);
                    const patrolX = this.guardPoint.x + Math.cos(angle + Math.PI / 2) * 80;
                    const patrolY = this.guardPoint.y + Math.sin(angle + Math.PI / 2) * 80;
                    targetX = patrolX;
                    targetY = patrolY;
                }
            } else {
                // 无据点可守 → 转为突击
                this.role = 1;
            }
        }

        if (this.role === 1) {
            // === 突击兵：主动出击 ===
            if (closestTarget) {
                // 如果在据点附近，先去占点
                if (captureTarget && closestDist > 400) {
                    targetX = captureTarget.x;
                    targetY = captureTarget.y;
                    this.stuckState.fallbackPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
                } else {
                    // 追击目标，但会保持距离迂回
                    urgentCombat = true;
                    const angleToTarget = Math.atan2(closestTarget.y - this.y, closestTarget.x - this.x);
                    // 在距离目标 200-250 的位置徘徊，不从正面直冲
                    const offsetAngle = angleToTarget + (Math.sin(this.shootCooldown * 0.1) > 0 ? Math.PI / 3 : -Math.PI / 3);
                    targetX = closestTarget.x + Math.cos(offsetAngle) * 220;
                    targetY = closestTarget.y + Math.sin(offsetAngle) * 220;
                }
            } else if (captureTarget) {
                targetX = captureTarget.x;
                targetY = captureTarget.y;
                this.stuckState.fallbackPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
            }
        }

        if (this.role === 2) {
            // === 游击兵：游走骚扰 ===
            this.stuckState.fallbackPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
            
            if (closestTarget && closestDist < 350) {
                // 打近处的敌人
                urgentCombat = true;
                const angleToTarget = Math.atan2(closestTarget.y - this.y, closestTarget.x - this.x);
                const offsetAngle = angleToTarget + (Math.random() - 0.5) * Math.PI;
                targetX = closestTarget.x + Math.cos(offsetAngle) * 250;
                targetY = closestTarget.y + Math.sin(offsetAngle) * 250;
            } else {
                // 在据点之间游走
                this.wanderTimer++;
                if (this.wanderTimer > 200 || !this.wanderTarget) {
                    const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
                    if (enemyPoints.length > 0) {
                        this.wanderTarget = enemyPoints[Math.floor(Math.random() * enemyPoints.length)];
                    } else if (captureTarget) {
                        this.wanderTarget = captureTarget;
                    }
                    this.wanderTimer = 0;
                }
                if (this.wanderTarget) {
                    targetX = this.wanderTarget.x;
                    targetY = this.wanderTarget.y;
                } else if (captureTarget) {
                    targetX = captureTarget.x;
                    targetY = captureTarget.y;
                }
            }
        }

        // 移动
        if (targetX !== null && targetY !== null) {
            MovementSystem.moveToward(this, targetX, targetY, this.stuckState);
        }

        // 射击
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (urgentCombat && closestTarget && closestDist < 400) {
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
        // 根据角色绘制不同边框
        if (this.role === 0) {
            ctx.strokeStyle = '#FFD740'; // 防守兵 - 金色
        } else if (this.role === 1) {
            ctx.strokeStyle = '#ff5252'; // 突击兵 - 亮红
        } else {
            ctx.strokeStyle = '#E040FB'; // 游击兵 - 紫色
        }
        ctx.lineWidth = 3;
        ctx.stroke();

        const hpPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, -25, 40, 5);
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
        ctx.fillRect(-20, -25, 40 * hpPercent, 5);

        // 角色图标（使用文字替代emoji）
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icons = ['◆', '▲', '●']; // 防守/突击/游击
        ctx.fillText(icons[this.role] || '✧', 0, 0);
        ctx.restore();
    }
}