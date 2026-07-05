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

    // 检查据点是否安全（无敌人接近）
    isPointSafe() {
        if (!this.guardPoint) return false;
        const threatRadius = 300;
        const targets = this.getTargets();
        for (const t of targets) {
            if (!t.alive) continue;
            const d = Math.hypot(t.x - this.guardPoint.x, t.y - this.guardPoint.y);
            if (d < threatRadius) return false;
        }
        return true;
    }

    // 动态角色调整：后期敌方据点少时，部分防守兵转为突击兵
    updateRole() {
        const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
        const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');

        // 劣势时更快转换：概率提高到3%/帧
        if (this.role === 0 && (enemyPoints.length <= 2 || playerPoints.length > enemyPoints.length * 1.5)) {
            if (Math.random() < 0.03) {
                this.role = 1;
                this.guardPoint = null;
            }
        }
        // 只剩1个据点时，防守兵立即转为突击兵
        if (this.role === 0 && enemyPoints.length <= 1) {
            this.role = 1;
            this.guardPoint = null;
        }
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

        // 动态调整角色
        this.updateRole();

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
            // === 防守兵：守卫己方据点，但据点安全时主动出击 ===
            if (this.guardPoint) {
                this.stuckState.fallbackPoints = [this.guardPoint];
                const distToPoint = Math.hypot(this.guardPoint.x - this.x, this.guardPoint.y - this.y);
                const guardRadius = 180;
                const pointSafe = this.isPointSafe();
                
                if (closestTarget && closestDist < guardRadius + 80) {
                    // 敌人进入据点范围 → 攻击
                    urgentCombat = true;
                    targetX = this.guardPoint.x;
                    targetY = this.guardPoint.y;
                } else if (pointSafe && closestTarget && closestDist < 500) {
                    // 据点安全且附近有敌人 → 主动出击
                    urgentCombat = true;
                    targetX = closestTarget.x;
                    targetY = closestTarget.y;
                } else if (distToPoint > guardRadius) {
                    // 远离据点了 → 回去
                    targetX = this.guardPoint.x;
                    targetY = this.guardPoint.y;
                } else {
                    // 在据点周围巡逻，但逐渐向前线推进
                    const forwardAngle = captureTarget ? 
                        Math.atan2(captureTarget.y - this.guardPoint.y, captureTarget.x - this.guardPoint.x) : 0;
                    const patrolAngle = forwardAngle + Math.sin(Date.now() * 0.001 + this.x) * Math.PI / 2;
                    const patrolX = this.guardPoint.x + Math.cos(patrolAngle) * 120;
                    const patrolY = this.guardPoint.y + Math.sin(patrolAngle) * 120;
                    targetX = patrolX;
                    targetY = patrolY;
                }
            } else {
                // 无据点可守 → 转为突击
                this.role = 1;
            }
        }

        if (this.role === 1) {
            // === 突击兵：主动出击，积极寻找敌人 ===
            if (closestTarget && closestDist < 600) {
                // 发现敌人 → 追击
                urgentCombat = true;
                const angleToTarget = Math.atan2(closestTarget.y - this.y, closestTarget.x - this.x);
                // 迂回接近，不从正面直冲
                const offsetAngle = angleToTarget + (Math.sin(this.shootCooldown * 0.1 + this.x * 0.01) > 0 ? Math.PI / 4 : -Math.PI / 4);
                const combatDist = 180 + Math.sin(Date.now() * 0.002) * 40; // 动态距离
                targetX = closestTarget.x + Math.cos(offsetAngle) * combatDist;
                targetY = closestTarget.y + Math.sin(offsetAngle) * combatDist;
            } else if (captureTarget) {
                // 没发现敌人 → 去占点
                targetX = captureTarget.x;
                targetY = captureTarget.y;
                this.stuckState.fallbackPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
            } else if (closestTarget) {
                // 没据点可占但远处有敌人 → 追击
                urgentCombat = true;
                targetX = closestTarget.x;
                targetY = closestTarget.y;
            }
        }

        if (this.role === 2) {
            // === 游击兵：向玩家方向或前线游走骚扰 ===
            this.stuckState.fallbackPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
            
            if (closestTarget && closestDist < 450) {
                // 发现敌人 → 骚扰攻击
                urgentCombat = true;
                const angleToTarget = Math.atan2(closestTarget.y - this.y, closestTarget.x - this.x);
                // 随机绕圈，让敌人难以预测
                const offsetAngle = angleToTarget + Math.sin(Date.now() * 0.003 + this.y * 0.01) * Math.PI * 0.7;
                targetX = closestTarget.x + Math.cos(offsetAngle) * 280;
                targetY = closestTarget.y + Math.sin(offsetAngle) * 280;
            } else {
                // 向玩家方向或前线游走
                this.wanderTimer++;
                if (this.wanderTimer > 150 || !this.wanderTarget) {
                    // 优先向玩家方向游走
                    if (GameState.player && GameState.player.alive && Math.random() < 0.6) {
                        this.wanderTarget = { 
                            x: GameState.player.x + (Math.random() - 0.5) * 400,
                            y: GameState.player.y + (Math.random() - 0.5) * 400
                        };
                    } else if (captureTarget) {
                        // 其次向前线据点游走
                        this.wanderTarget = captureTarget;
                    } else {
                        // 最后在己方据点间游走
                        const enemyPoints = GameState.capturePoints.filter(p => p.owner === 'enemy');
                        if (enemyPoints.length > 0) {
                            this.wanderTarget = enemyPoints[Math.floor(Math.random() * enemyPoints.length)];
                        }
                    }
                    this.wanderTimer = 0;
                }
                if (this.wanderTarget) {
                    targetX = this.wanderTarget.x;
                    targetY = this.wanderTarget.y;
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