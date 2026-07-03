// src/utils/EffectsManager.js

// 粒子类型
export const ParticleType = {
    SPARK: 0,    // 子弹击中
    EXPLOSION: 1, // 敌人死亡
    HIT: 2,      // 命中反馈
    KILL: 3,     // 击杀提示
    CAPTURE: 4   // 占领据点
};

export const EffectsManager = {
    particles: [],
    screenShake: { x: 0, y: 0, timer: 0, intensity: 0 },
    damageNumbers: [],

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
        // 绘制粒子
        for (const p of this.particles) {
            const sx = p.x - camera.x + this.screenShake.x;
            const sy = p.y - camera.y + this.screenShake.y;
            const alpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 绘制伤害数字
        for (const d of this.damageNumbers) {
            const sx = d.x - camera.x + this.screenShake.x;
            const sy = d.y - camera.y + this.screenShake.y;
            const alpha = d.life / d.maxLife;
            const scale = 1 + (1 - alpha) * 0.3; // 放大效果
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(sx, sy);
            ctx.scale(scale, scale);
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 阴影
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(d.text, 1, 1);
            // 文字颜色
            ctx.fillStyle = d.isPlayer ? '#ff5252' : '#4CAF50';
            ctx.fillText(d.text, 0, 0);
            ctx.restore();
        }
    },

    // 清除所有特效
    clear() {
        this.particles.length = 0;
        this.damageNumbers.length = 0;
        this.screenShake.timer = 0;
        this.screenShake.x = 0;
        this.screenShake.y = 0;
    }
};