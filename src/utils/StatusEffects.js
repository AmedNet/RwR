// src/utils/StatusEffects.js
// 状态效果系统 - 可扩展的效果基类与具体效果实现
// 时间单位：帧（60fps 下 90 帧 = 1.5 秒）

// 状态效果配置常量
export const STATUS_EFFECT_CONFIG = {
    // 缓慢效果
    SLOW: {
        DEFAULT_DURATION: 90,      // 默认持续时间（帧）
        SPEED_MULTIPLIER: 0.5      // 速度倍率
    },
    // 燃烧效果
    BURN: {
        DEFAULT_DURATION: 330,     // 默认持续时间（帧，5.5秒）
        MIN_DURATION: 300,         // 最小持续时间（帧，5秒）
        MAX_DURATION: 360,         // 最大持续时间（帧，6秒）
        DAMAGE_INTERVAL: 60,       // 伤害间隔（帧，1秒）
        MIN_DAMAGE: 1,             // 最小伤害
        MAX_DAMAGE: 3,             // 最大伤害
        TRIGGER_CHANCE: 0.25,      // 触发概率（25%）
        PARTICLE_SPAWN_CHANCE: 0.6 // 粒子生成概率
    }
};

export class StatusEffect {
    constructor(name, label, icon, duration, color) {
        this.name = name;
        this.label = label;
        this.icon = icon;
        this.duration = duration;
        this.remaining = duration;
        this.color = color;
    }
    update() {
        this.remaining--;
    }
    isExpired() {
        return this.remaining <= 0;
    }
    getSpeedMultiplier() {
        return 1;
    }
    draw(ctx, entity) {
        // 子类重写
    }
}

// 缓慢效果：降低移动速度到 50%
export class SlowEffect extends StatusEffect {
    constructor(duration = STATUS_EFFECT_CONFIG.SLOW.DEFAULT_DURATION) {
        super('slow', '缓慢', '❄', duration, '#4FC3F7');
    }
    getSpeedMultiplier() {
        return STATUS_EFFECT_CONFIG.SLOW.SPEED_MULTIPLIER;
    }
}

// 燃烧效果：持续扣血 + 火焰粒子视觉
export class BurnEffect extends StatusEffect {
    constructor(duration = STATUS_EFFECT_CONFIG.BURN.DEFAULT_DURATION) {
        super('burn', '燃烧', '🔥', duration, '#FF5722');
        this.damageTimer = 0;
        this.damageInterval = STATUS_EFFECT_CONFIG.BURN.DAMAGE_INTERVAL;
        this.particles = [];
    }
    update(entity) {
        this.remaining--;
        this.damageTimer++;
        
        // 每秒造成伤害（每次伤害随机）
        if (this.damageTimer >= this.damageInterval) {
            this.damageTimer = 0;
            if (entity && entity.alive) {
                const { MIN_DAMAGE, MAX_DAMAGE } = STATUS_EFFECT_CONFIG.BURN;
                const damageThisTick = MIN_DAMAGE + Math.floor(Math.random() * (MAX_DAMAGE - MIN_DAMAGE + 1));
                entity.health -= damageThisTick;
                if (entity.health <= 0) {
                    entity.health = 0;
                    entity.alive = false;
                }
            }
        }
        
        // 更新火焰粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life--;
            p.y -= p.vy;
            p.x += (Math.random() - 0.5) * 0.5;
            p.size *= 0.95;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // 生成新粒子
        if (Math.random() < STATUS_EFFECT_CONFIG.BURN.PARTICLE_SPAWN_CHANCE && entity) {
            this.particles.push({
                x: (Math.random() - 0.5) * entity.radius * 1.5,
                y: (Math.random() - 0.5) * entity.radius * 0.5 - entity.radius * 0.3,
                size: 3 + Math.random() * 4,
                life: 20 + Math.random() * 15,
                maxLife: 35,
                vy: 0.8 + Math.random() * 0.6
            });
        }
    }
    draw(ctx, entity) {
        if (!entity) return;
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            gradient.addColorStop(0, `rgba(255, 200, 50, ${alpha})`);
            gradient.addColorStop(0.5, `rgba(255, 100, 20, ${alpha * 0.7})`);
            gradient.addColorStop(1, `rgba(200, 50, 0, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
