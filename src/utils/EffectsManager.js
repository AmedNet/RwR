// src/utils/EffectsManager.js

import { playShellLand } from './SoundManager.js';

// 粒子类型
export const ParticleType = {
    SPARK: 0,    // 子弹击中
    EXPLOSION: 1, // 敌人死亡
    HIT: 2,      // 命中反馈
    KILL: 3,     // 击杀提示
    CAPTURE: 4,   // 占领据点
    GRENADE_BLAST: 5, // 手雷爆炸
    SMOKE: 6,    // 烟雾
    HEAL: 7,     // 治疗
    ROCKET_TRAIL: 8 // 火箭拖尾
};

// 弹壳形态配置（按武器类型）
const ShellConfig = {
    pistol:  { w: 3, h: 5,  color: '#D4A017' },
    rifle:   { w: 3, h: 7,  color: '#C5960C' },
    shotgun: { w: 5, h: 8,  color: '#B22222' },
    sniper:  { w: 3, h: 10, color: '#B8860B' }
};

export const EffectsManager = {
    particles: [],
    screenShake: { x: 0, y: 0, timer: 0, intensity: 0 },
    damageNumbers: [],
    explosions: [], // 爆炸效果数组
    shellCasings: [], // 弹壳数组

    // 生成粒子
    spawnParticles(x, y, type, count = 8) {
        const colors = {
            [ParticleType.SPARK]: ['#FFD740', '#ffab00', '#ff6d00'],
            [ParticleType.EXPLOSION]: ['#ff1744', '#ff5252', '#ff8a80', '#ff9100'],
            [ParticleType.HIT]: ['#4CAF50', '#81C784', '#A5D6A7'],
            [ParticleType.KILL]: ['#FFD740', '#FFC107', '#FF8F00'],
            [ParticleType.CAPTURE]: ['#4CAF50', '#66BB6A', '#A5D6A7']
        };
        const palette = colors[type] || colors[ParticleType.SPARK];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 4;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: 20 + Math.random() * 20,
                maxLife: 40,
                color: palette[Math.floor(Math.random() * palette.length)],
                size: 2 + Math.random() * 4,
                type
            });
        }
    },

    // 生成手雷爆炸效果
    spawnGrenadeExplosion(x, y, radius) {
        // 冲击波环
        this.explosions.push({
            x, y,
            radius,
            currentRadius: 0,
            maxRadius: radius,
            life: 20,
            maxLife: 20,
            type: 'shockwave'
        });

        // 内层闪光
        this.explosions.push({
            x, y,
            radius: radius * 0.3,
            life: 10,
            maxLife: 10,
            type: 'flash'
        });

        // 外层烟雾
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * (1 + Math.random() * 2),
                vy: Math.sin(angle) * (1 + Math.random() * 2) - 2,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                color: '#333',
                size: 3 + Math.random() * 5,
                type: ParticleType.SMOKE
            });
        }

        // 碎片粒子
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: 25 + Math.random() * 15,
                maxLife: 40,
                color: ['#ff5252', '#ff1744', '#ff9100'][Math.floor(Math.random() * 3)],
                size: 2 + Math.random() * 3,
                type: ParticleType.GRENADE_BLAST
            });
        }

        // 屏幕震动
        this.triggerShake(20, 25);
    },

    // 添加伤害数字
    addDamageNumber(x, y, damage, isPlayer = false) {
        this.damageNumbers.push({
            x, y,
            text: damage.toString(),
            isPlayer,
            life: 40,
            maxLife: 40,
            vy: -2.5 // 向上飘
        });
    },

    // 生成治疗效果
    spawnHealEffect(x, y, amount) {
        // 绿色粒子向上飘散
        for (let i = 0; i < 12; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
            const speed = 1.5 + Math.random() * 2.5;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                color: ['#4CAF50', '#81C784', '#A5D6A7', '#66BB6A'][Math.floor(Math.random() * 4)],
                size: 3 + Math.random() * 3,
                type: ParticleType.HEAL
            });
        }

        // 显示治疗数字
        this.damageNumbers.push({
            x, y: y - 20,
            text: `+${amount}`,
            isHeal: true,
            life: 50,
            maxLife: 50,
            vy: -1.5 // 向上飘
        });
    },

    // 生成火箭弹拖尾特效
    spawnRocketTrail(x, y) {
        // 火焰粒子（橙色/黄色）
        for (let i = 0; i < 3; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 4,
                y: y + (Math.random() - 0.5) * 4,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                life: 12 + Math.random() * 8,
                maxLife: 20,
                color: ['#ff6d00', '#ffab00', '#ff9100'][i % 3],
                size: 2.5 + Math.random() * 2,
                type: ParticleType.ROCKET_TRAIL
            });
        }
        // 烟雾粒子
        this.particles.push({
            x: x + (Math.random() - 0.5) * 6,
            y: y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.3 - Math.random() * 0.5,
            life: 25 + Math.random() * 15,
            maxLife: 40,
            color: '#555',
            size: 3 + Math.random() * 3,
            type: ParticleType.SMOKE
        });
    },

    // 生成抛壳效果
    spawnShellCasing(x, y, weaponType) {
        const cfg = ShellConfig[weaponType] || ShellConfig.rifle;
        // 随机抛出方向（偏上方±60°范围）
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 2 / 3);
        const speed = 2 + Math.random() * 2;
        this.shellCasings.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.4,
            w: cfg.w,
            h: cfg.h,
            color: cfg.color,
            weaponType: weaponType, // 存储武器类型用于音效
            bounceCount: 0,
            maxBounces: 2 + Math.floor(Math.random() * 2), // 2-3次弹跳
            groundY: y + 15 + Math.random() * 30, // 落地点（更大随机范围，避免同一水平线）
            state: 'flying', // flying | stopped
            stopTimer: 0,
            maxStopTime: 180, // 停留3秒(180帧)
            fadeAlpha: 1,
            trailTimer: 0
        });
    },

    // 触发屏幕震动
    triggerShake(intensity = 8, duration = 12) {
        this.screenShake.intensity = intensity;
        this.screenShake.timer = duration;
    },

    // 更新所有特效
    update() {
        // 更新粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12; // 重力
            p.vx *= 0.95; // 阻力
            p.vy *= 0.95;
            p.life--;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // 更新伤害数字
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.y += d.vy;
            d.vy *= 0.95;
            d.life--;
            if (d.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }

        // 更新爆炸效果
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const e = this.explosions[i];
            e.life--;
            if (e.type === 'shockwave') {
                e.currentRadius = (1 - e.life / e.maxLife) * e.maxRadius;
            }
            if (e.life <= 0) {
                this.explosions.splice(i, 1);
            }
        }

        // 更新弹壳
        for (let i = this.shellCasings.length - 1; i >= 0; i--) {
            const s = this.shellCasings[i];
            if (s.state === 'flying') {
                s.x += s.vx;
                s.y += s.vy;
                s.vy += 0.15; // 重力
                s.vx *= 0.98;
                s.rotation += s.rotationSpeed;
                // 飞行中拖尾火花
                s.trailTimer++;
                if (s.trailTimer % 3 === 0) {
                    this.particles.push({
                        x: s.x, y: s.y,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: (Math.random() - 0.5) * 0.5,
                        life: 8 + Math.random() * 6,
                        maxLife: 14,
                        color: '#FFD740',
                        size: 1 + Math.random(),
                        type: ParticleType.SPARK
                    });
                }
                // 落地检测
                if (s.y >= s.groundY) {
                    s.y = s.groundY;
                    // 触发弹壳落地音效
                    playShellLand(s.weaponType, s.bounceCount, 0);
                    s.bounceCount++;
                    if (s.bounceCount >= s.maxBounces) {
                        s.state = 'stopped';
                        s.vx = 0;
                        s.vy = 0;
                        s.rotationSpeed *= 0.2;
                    } else {
                        // 弹跳衰减
                        s.vy = -Math.abs(s.vy) * 0.4;
                        s.vx *= 0.6;
                        s.rotationSpeed *= 0.5;
                    }
                }
            } else {
                // stopped状态：淡出
                s.stopTimer++;
                if (s.stopTimer > s.maxStopTime * 0.6) {
                    s.fadeAlpha = Math.max(0, 1 - (s.stopTimer - s.maxStopTime * 0.6) / (s.maxStopTime * 0.4));
                }
                if (s.stopTimer >= s.maxStopTime) {
                    this.shellCasings.splice(i, 1);
                }
            }
        }

        // 更新屏幕震动
        if (this.screenShake.timer > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.timer--;
            // 震动衰减
            if (this.screenShake.timer < 6) {
                this.screenShake.intensity *= 0.6;
            }
        } else {
            this.screenShake.x = 0;
            this.screenShake.y = 0;
            this.screenShake.intensity = 0;
        }
    },

    // 绘制所有特效
    draw(ctx, camera) {
        const zoom = camera.zoom || 1;
        const offsetX = camera.offsetX || 0;
        const offsetY = camera.offsetY || 0;
        const logicalW = ctx.canvas.clientWidth || ctx.canvas.width;
        const logicalH = ctx.canvas.clientHeight || ctx.canvas.height;
        const cx = logicalW / 2;
        const cy = logicalH / 2;
        
        // 辅助函数：世界坐标转屏幕坐标
        const toScreen = (wx, wy) => ({
            x: (wx - camera.x) * zoom + cx * (1 - zoom) - offsetX,
            y: (wy - camera.y) * zoom + cy * (1 - zoom) - offsetY
        });

        // 绘制爆炸效果（在粒子前绘制，确保可见）
        for (const e of this.explosions) {
            const pos = toScreen(e.x, e.y);
            const sx = pos.x + this.screenShake.x;
            const sy = pos.y + this.screenShake.y;
            const alpha = e.life / e.maxLife;
            
            ctx.save();
            if (e.type === 'shockwave') {
                // 冲击波环
                ctx.beginPath();
                ctx.arc(sx, sy, e.currentRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 100, 0, ${alpha * 0.8})`;
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (e.type === 'flash') {
                // 内层闪光
                ctx.beginPath();
                ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
                ctx.fill();
            }
            ctx.restore();
        }

        // 绘制粒子
        for (const p of this.particles) {
            const pos = toScreen(p.x, p.y);
            const sx = pos.x + this.screenShake.x;
            const sy = pos.y + this.screenShake.y;
            const alpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size * alpha * zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 绘制弹壳
        for (const s of this.shellCasings) {
            const pos = toScreen(s.x, s.y);
            const sx = pos.x + this.screenShake.x;
            const sy = pos.y + this.screenShake.y;
            ctx.save();
            ctx.globalAlpha = s.fadeAlpha;
            ctx.translate(sx, sy);
            ctx.rotate(s.rotation);
            ctx.scale(zoom, zoom);
            ctx.fillStyle = s.color;
            ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
            // 弹壳高光边
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
            ctx.restore();
        }

        // 绘制伤害数字
        for (const d of this.damageNumbers) {
            const pos = toScreen(d.x, d.y);
            const sx = pos.x + this.screenShake.x;
            const sy = pos.y + this.screenShake.y;
            const alpha = d.life / d.maxLife;
            const scale = 1 + (1 - alpha) * 0.3; // 放大效果
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(sx, sy);
            ctx.scale(scale * zoom, scale * zoom);
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 阴影
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(d.text, 1, 1);
            // 文字颜色：治疗数字用亮绿色
            if (d.isHeal) {
                ctx.fillStyle = '#69F0AE';
            } else {
                ctx.fillStyle = d.isPlayer ? '#ff5252' : '#4CAF50';
            }
            ctx.fillText(d.text, 0, 0);
            ctx.restore();
        }
    },

    // 清除所有特效
    clear() {
        this.particles.length = 0;
        this.damageNumbers.length = 0;
        this.shellCasings.length = 0;
        this.screenShake.timer = 0;
        this.screenShake.x = 0;
        this.screenShake.y = 0;
    }
};