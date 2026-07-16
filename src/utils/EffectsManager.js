// src/utils/EffectsManager.js

import { playShellLand } from './SoundManager.js';
import { WeatherSystem } from '../core/WeatherSystem.js';

import { GameState } from '../core/GameState.js';
import { DayNightSystem } from '../core/DayNightSystem.js';

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
    ROCKET_TRAIL: 8, // 火箭拖尾
    BLOOD_DROP: 9   // 血滴粒子（带方向，落地变血迹）
};

// 血迹纹理尺寸
const BLOOD_TEX_SIZE = 128;
// 血迹纹理数量
const BLOOD_TEX_COUNT = 6;

// 弹壳形态配置（按武器类型）
const ShellConfig = {
    pistol:  { w: 3, h: 5,  color: '#D4A017' },
    rifle:   { w: 3, h: 7,  color: '#C5960C' },
    shotgun: { w: 5, h: 8,  color: '#B22222' },
    sniper:  { w: 3, h: 10, color: '#B8860B' }
};

/** 特效系统物理与视觉配置常量 */
const FX = {
    // 物理
    GRAVITY: 0.12,
    DRAG: 0.95,
    SHELL_GRAVITY: 0.15,
    SHELL_DRAG: 0.98,
    // 粒子
    PARTICLE_SPEED_MIN: 1.5,
    PARTICLE_SPEED_RANGE: 4,
    PARTICLE_LIFE_BASE: 20,
    PARTICLE_LIFE_RANGE: 20,
    PARTICLE_SIZE_BASE: 2,
    PARTICLE_SIZE_RANGE: 4,
    // 伤害数字
    DMG_NUM_LIFE: 40,
    DMG_NUM_VY: -2.5,
    DMG_NUM_SCALE_FACTOR: 0.3,
    DMG_NUM_FONT_SIZE: 16,
    // 屏幕震动
    SHAKE_DECAY_THRESHOLD: 6,
    SHAKE_DECAY_FACTOR: 0.6,
    // 手雷爆炸
    GRENADE_SHOCKWAVE_LIFE: 20,
    GRENADE_FLASH_LIFE: 10,
    GRENADE_FLASH_RADIUS_FACTOR: 0.3,
    GRENADE_SMOKE_COUNT: 12,
    GRENADE_SMOKE_LIFE_BASE: 40,
    GRENADE_SMOKE_LIFE_RANGE: 30,
    GRENADE_SMOKE_SIZE_BASE: 3,
    GRENADE_SMOKE_SIZE_RANGE: 5,
    GRENADE_FRAGMENT_COUNT: 25,
    GRENADE_FRAGMENT_SPEED_BASE: 3,
    GRENADE_FRAGMENT_SPEED_RANGE: 5,
    GRENADE_FRAGMENT_LIFE_BASE: 25,
    GRENADE_FRAGMENT_LIFE_RANGE: 15,
    GRENADE_SHAKE_INTENSITY: 20,
    GRENADE_SHAKE_DURATION: 25,
    // 治疗效果
    HEAL_PARTICLE_COUNT: 12,
    HEAL_LIFE_BASE: 30,
    HEAL_LIFE_RANGE: 20,
    HEAL_NUM_LIFE: 50,
    HEAL_NUM_VY: -1.5,
    HEAL_NUM_OFFSET_Y: -20,
    // 火箭拖尾
    ROCKET_FIRE_COUNT: 3,
    ROCKET_FIRE_LIFE_BASE: 12,
    ROCKET_FIRE_LIFE_RANGE: 8,
    ROCKET_SMOKE_LIFE_BASE: 25,
    ROCKET_SMOKE_LIFE_RANGE: 15,
    // 枪口火焰
    MUZZLE_OFFSET: 30,
    MUZZLE_FLASH_LIFE: 4,
    MUZZLE_SMOKE_LIFE_BASE: 8,
    MUZZLE_SMOKE_LIFE_RANGE: 6,
    // 弹壳
    SHELL_BOUNCE_MIN: 2,
    SHELL_BOUNCE_RANDOM: 2,
    SHELL_GROUND_OFFSET: 15,
    SHELL_GROUND_RANDOM: 30,
    SHELL_MAX_STOP_TIME: 180,
    SHELL_BOUNCE_DAMPING: 0.4,
    SHELL_HORIZ_DAMPING: 0.6,
    SHELL_ROT_DAMPING: 0.2,
    SHELL_TRAIL_INTERVAL: 3,
    // 血液
    BLOOD_BASE_DAMAGE: 30,
    BLOOD_DROP_BASE: 12,
    BLOOD_DROP_RANDOM: 8,
    BLOOD_MIST_LIFE: 12,
    BLOOD_MIST_BASE: 8,
    BLOOD_MIST_RANDOM: 6,
    BLOOD_MIST_COUNT_BASE: 4,
    BLOOD_MIST_COUNT_RANDOM: 4,
    BLOOD_STAIN_SCALE_BASE: 0.04,
    BLOOD_STAIN_SCALE_RANGE: 0.06,
   BLOOD_VIEWPORT_MARGIN: 80,
   BLOOD_MIST_EXPANSION: 1.5,
    // 火箭筒后焰（backblast）
    BACKBLAST_FIRE_COUNT: 15,
    BACKBLAST_SMOKE_COUNT: 8,
    BACKBLAST_FIRE_LIFE_BASE: 10,
    BACKBLAST_FIRE_LIFE_RANGE: 8,
    BACKBLAST_SMOKE_LIFE_BASE: 30,
    BACKBLAST_SMOKE_LIFE_RANGE: 15,
    BACKBLAST_SPREAD: 0.6,
    BACKBLAST_SPEED_BASE: 3,
    BACKBLAST_SPEED_RANGE: 4,
    BACKBLAST_FLASH_LIFE: 6,
    BACKBLAST_FLASH_RADIUS: 20,
    BACKBLAST_SHAKE_INTENSITY: 8,
    BACKBLAST_SHAKE_DURATION: 10
};

export const EffectsManager = {
    particles: [],
    screenShake: { x: 0, y: 0, timer: 0, intensity: 0 },
    damageNumbers: [],
    explosions: [], // 爆炸效果数组
    shellCasings: [], // 弹壳数组
    bloodStains: [],  // 血迹数据: { x, y, texIndex, scale, rotation, alpha }
    bloodTextures: [], // 预渲染的血迹纹理 Canvas 数组
    bloodTexturesReady: false,

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
            const speed = FX.PARTICLE_SPEED_MIN + Math.random() * FX.PARTICLE_SPEED_RANGE;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: FX.PARTICLE_LIFE_BASE + Math.random() * FX.PARTICLE_LIFE_RANGE,
                maxLife: 40,
                color: palette[Math.floor(Math.random() * palette.length)],
                size: FX.PARTICLE_SIZE_BASE + Math.random() * FX.PARTICLE_SIZE_RANGE,
                type
            });
        }
    },

    spawnGlassShards(x, y, count = 6) {
        const colors = ['#d8f3f0', '#a9d8d2', '#7fb6b2', '#eefcf9'];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 4;
            const life = 18 + Math.random() * 18;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                life,
                maxLife: life,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 1.5 + Math.random() * 2.5,
                type: ParticleType.SPARK
            });
        }
    },

    spawnVehicleExhaust(x, y, driftX = 0, driftY = 0, intensity = 0) {
        const life = 24 + Math.random() * 18;
        this.particles.push({
            x: x + (Math.random() - 0.5) * 3,
            y: y + (Math.random() - 0.5) * 3,
            vx: driftX + (Math.random() - 0.5) * 0.35,
            vy: driftY - 0.25 - Math.random() * 0.3,
            life,
            maxLife: 42,
            color: intensity > 0.65 ? '#4b4d48' : '#6d706b',
            size: 2.5 + intensity * 2 + Math.random() * 1.5,
            type: ParticleType.SMOKE
        });
    },
    // 生成车辆行驶时的尘土效果（从车轮位置扬起）
    spawnVehicleDust(x, y, driftX = 0, driftY = 0, intensity = 0) {
        const count = Math.floor(2 + intensity * 2);
        const dustColors = ['#c9b896', '#d4c4a8', '#bfae92', '#e0d0b8'];
        for (let i = 0; i < count; i++) {
            const life = 25 + Math.random() * 15;
            // 向四周随机飞溅，不只是后方
            const spreadAngle = Math.random() * Math.PI * 2;
            const spread = 0.8 + Math.random() * 2.0;
            const baseSize = 1.5 + Math.random() * 2.5;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 25,
                y: y + (Math.random() - 0.5) * 15,
                vx: driftX * 0.2 + Math.cos(spreadAngle) * spread,
                vy: driftY * 0.2 + Math.sin(spreadAngle) * spread,
                life,
                maxLife: life,
                color: dustColors[Math.floor(Math.random() * dustColors.length)],
                size: baseSize,
                baseSize: baseSize,
                type: ParticleType.SPARK,
                isDust: true
            });
        }
    },


    // 生成手雷爆炸效果
    spawnGrenadeExplosion(x, y, radius) {
        // 冲击波环
        this.explosions.push({
            x, y, radius,
            currentRadius: 0,
            maxRadius: radius,
            life: FX.GRENADE_SHOCKWAVE_LIFE,
            maxLife: FX.GRENADE_SHOCKWAVE_LIFE,
            type: 'shockwave'
        });

        // 内层闪光
        this.explosions.push({
            x, y,
            radius: radius * FX.GRENADE_FLASH_RADIUS_FACTOR,
            life: FX.GRENADE_FLASH_LIFE,
            maxLife: FX.GRENADE_FLASH_LIFE,
            type: 'flash'
        });

        // 动态光源：爆炸照亮周围
        DayNightSystem.addLight(x, y, 300, '255,180,60', 20);

        // 外层烟雾
        for (let i = 0; i < FX.GRENADE_SMOKE_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * (1 + Math.random() * 2),
                vy: Math.sin(angle) * (1 + Math.random() * 2) - 2,
                life: FX.GRENADE_SMOKE_LIFE_BASE + Math.random() * FX.GRENADE_SMOKE_LIFE_RANGE,
                maxLife: 70,
                color: '#333',
                size: FX.GRENADE_SMOKE_SIZE_BASE + Math.random() * FX.GRENADE_SMOKE_SIZE_RANGE,
                type: ParticleType.SMOKE
            });
        }

        // 碎片粒子
        for (let i = 0; i < FX.GRENADE_FRAGMENT_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = FX.GRENADE_FRAGMENT_SPEED_BASE + Math.random() * FX.GRENADE_FRAGMENT_SPEED_RANGE;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: FX.GRENADE_FRAGMENT_LIFE_BASE + Math.random() * FX.GRENADE_FRAGMENT_LIFE_RANGE,
                maxLife: 40,
                color: ['#ff5252', '#ff1744', '#ff9100'][Math.floor(Math.random() * 3)],
                size: 2 + Math.random() * 3,
                type: ParticleType.GRENADE_BLAST
            });
        }

        // 屏幕震动
        this.triggerShake(FX.GRENADE_SHAKE_INTENSITY, FX.GRENADE_SHAKE_DURATION);
    },

    // 添加伤害数字
    addDamageNumber(x, y, damage, isPlayer = false) {
        this.damageNumbers.push({
            x, y,
            text: damage.toString(),
            isPlayer,
            life: FX.DMG_NUM_LIFE,
            maxLife: FX.DMG_NUM_LIFE,
            vy: FX.DMG_NUM_VY
        });
    },

    // 生成治疗效果
    spawnHealEffect(x, y, amount) {
        // 绿色粒子向上飘散
        for (let i = 0; i < FX.HEAL_PARTICLE_COUNT; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
            const speed = 1.5 + Math.random() * 2.5;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: FX.HEAL_LIFE_BASE + Math.random() * FX.HEAL_LIFE_RANGE,
                maxLife: 50,
                color: ['#4CAF50', '#81C784', '#A5D6A7', '#66BB6A'][Math.floor(Math.random() * 4)],
                size: 3 + Math.random() * 3,
                type: ParticleType.HEAL
            });
        }

        // 显示治疗数字
        this.damageNumbers.push({
            x, y: y + FX.HEAL_NUM_OFFSET_Y,
            text: `+${amount}`,
            isHeal: true,
            life: FX.HEAL_NUM_LIFE,
            maxLife: FX.HEAL_NUM_LIFE,
            vy: FX.HEAL_NUM_VY
        });
    },

    // 生成火箭弹拖尾特效
    spawnRocketTrail(x, y) {
        // 火焰粒子（橙色/黄色）
        for (let i = 0; i < FX.ROCKET_FIRE_COUNT; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 4,
                y: y + (Math.random() - 0.5) * 4,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                life: FX.ROCKET_FIRE_LIFE_BASE + Math.random() * FX.ROCKET_FIRE_LIFE_RANGE,
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
            life: FX.ROCKET_SMOKE_LIFE_BASE + Math.random() * FX.ROCKET_SMOKE_LIFE_RANGE,
            maxLife: 40,
            color: '#555',
            size: 3 + Math.random() * 3,
            type: ParticleType.SMOKE
        });
    },

    // 生成枪口火焰效果
    // shooterX, shooterY: 射击者位置
    // angle: 射击方向（弧度）
    // weaponType: 武器类型字符串
    spawnMuzzleFlash(shooterX, shooterY, angle, weaponType) {
        const offset = FX.MUZZLE_OFFSET;
        const mx = shooterX + Math.cos(angle) * offset;
        const my = shooterY + Math.sin(angle) * offset;

        // 动态光源：枪口火焰照亮周围
        DayNightSystem.addLight(mx, my, 120, '255,200,80', 6);

        // 按武器类型配置火焰大小和颜色
        let flashSize, flashColors, particleCount, smokeCount;
        switch (weaponType) {
            case 'shotgun':
                flashSize = 12;
                flashColors = ['#FF6D00', '#FF9100', '#FFAB00', '#FFF176'];
                particleCount = 8;
                smokeCount = 3;
                break;
            case 'sniper':
                flashSize = 14;
                flashColors = ['#FFEB3B', '#FFF176', '#FFFFFF', '#FFD54F'];
                particleCount = 10;
                smokeCount = 4;
                break;
            case 'launcher':
                flashSize = 18;
                flashColors = ['#FF3D00', '#FF6D00', '#FF9100', '#FFAB00'];
                particleCount = 12;
                smokeCount = 6;
                break;
            case 'rifle':
                flashSize = 9;
                flashColors = ['#FF6D00', '#FF9100', '#FFAB00', '#FFD740'];
                particleCount = 6;
                smokeCount = 2;
                break;
            case 'smg':
                flashSize = 7;
                flashColors = ['#FFD740', '#FFAB00', '#FF9100', '#FFF176'];
                particleCount = 5;
                smokeCount = 1;
                break;
            case 'pistol':
            default:
                flashSize = 8;
                flashColors = ['#FFD740', '#FFAB00', '#FF9100', '#FFF176'];
                particleCount = 5;
                smokeCount = 2;
                break;
        }

        // 中心闪光（用爆炸效果数组渲染径向渐变）
        this.explosions.push({
            x: mx, y: my,
            radius: flashSize,
            life: FX.MUZZLE_FLASH_LIFE,
            maxLife: FX.MUZZLE_FLASH_LIFE,
            type: 'muzzle_flash',
            color: flashColors[0]
        });

        // 火焰粒子（沿射击方向扇形喷射）
        for (let i = 0; i < particleCount; i++) {
            const spread = (Math.random() - 0.5) * 0.8; // ±0.4弧度扇形
            const pAngle = angle + spread;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: mx + (Math.random() - 0.5) * 3,
                y: my + (Math.random() - 0.5) * 3,
                vx: Math.cos(pAngle) * speed,
                vy: Math.sin(pAngle) * speed,
                life: FX.MUZZLE_FLASH_LIFE + Math.random() * 3,
                maxLife: FX.MUZZLE_FLASH_LIFE + 3,
                color: flashColors[Math.floor(Math.random() * flashColors.length)],
                size: 2 + Math.random() * 3,
                type: ParticleType.SPARK
            });
        }

        // 枪口烟雾（缓慢扩散）
        for (let i = 0; i < smokeCount; i++) {
            const spread = (Math.random() - 0.5) * 1.2;
            const pAngle = angle + spread;
            const speed = 0.3 + Math.random() * 0.8;
            this.particles.push({
                x: mx + Math.cos(pAngle) * 4,
                y: my + Math.sin(pAngle) * 4,
                vx: Math.cos(pAngle) * speed,
                vy: Math.sin(pAngle) * speed - 0.3,
                life: FX.MUZZLE_SMOKE_LIFE_BASE + Math.random() * FX.MUZZLE_SMOKE_LIFE_RANGE,
                maxLife: FX.MUZZLE_SMOKE_LIFE_BASE + FX.MUZZLE_SMOKE_LIFE_RANGE,
                color: '#888',
                size: 2 + Math.random() * 2,
                type: ParticleType.SMOKE
            });
        }
    },

    // 生成火箭筒后焰喷射效果（武器尾部，非火箭弹拖尾）
    spawnBackblast(shooterX, shooterY, angle) {
        const backAngle = angle + Math.PI;
        const rearOffset = 15;
        const bx = shooterX + Math.cos(backAngle) * rearOffset;
        const by = shooterY + Math.sin(backAngle) * rearOffset;

        // 动态光源：后焰照亮后方区域
        DayNightSystem.addLight(bx, by, 180, '255,160,40', 10);

        // 中心闪光
        this.explosions.push({
            x: bx, y: by,
            radius: FX.BACKBLAST_FLASH_RADIUS,
            life: FX.BACKBLAST_FLASH_LIFE,
            maxLife: FX.BACKBLAST_FLASH_LIFE,
            type: 'muzzle_flash',
            color: '#FF6D00'
        });

        // 火焰粒子（沿后方扇形喷射）
        for (let i = 0; i < FX.BACKBLAST_FIRE_COUNT; i++) {
            const spread = (Math.random() - 0.5) * FX.BACKBLAST_SPREAD;
            const pAngle = backAngle + spread;
            const speed = FX.BACKBLAST_SPEED_BASE + Math.random() * FX.BACKBLAST_SPEED_RANGE;
            this.particles.push({
                x: bx + (Math.random() - 0.5) * 4,
                y: by + (Math.random() - 0.5) * 4,
                vx: Math.cos(pAngle) * speed,
                vy: Math.sin(pAngle) * speed,
                life: FX.BACKBLAST_FIRE_LIFE_BASE + Math.random() * FX.BACKBLAST_FIRE_LIFE_RANGE,
                maxLife: FX.BACKBLAST_FIRE_LIFE_BASE + FX.BACKBLAST_FIRE_LIFE_RANGE,
                color: ['#FF3D00', '#FF6D00', '#FF9100', '#FFAB00'][Math.floor(Math.random() * 4)],
                size: 3 + Math.random() * 4,
                type: ParticleType.SPARK
            });
        }

        // 烟雾粒子（后焰产生的大量浓烟）
        for (let i = 0; i < FX.BACKBLAST_SMOKE_COUNT; i++) {
            const spread = (Math.random() - 0.5) * FX.BACKBLAST_SPREAD * 1.5;
            const pAngle = backAngle + spread;
            const speed = 1 + Math.random() * 2;
            this.particles.push({
                x: bx + (Math.random() - 0.5) * 8,
                y: by + (Math.random() - 0.5) * 8,
                vx: Math.cos(pAngle) * speed,
                vy: Math.sin(pAngle) * speed - 0.5,
                life: FX.BACKBLAST_SMOKE_LIFE_BASE + Math.random() * FX.BACKBLAST_SMOKE_LIFE_RANGE,
                maxLife: FX.BACKBLAST_SMOKE_LIFE_BASE + FX.BACKBLAST_SMOKE_LIFE_RANGE,
                color: '#666',
                size: 4 + Math.random() * 4,
                type: ParticleType.SMOKE
            });
        }

        // 屏幕震动（后焰冲击感）
        this.triggerShake(FX.BACKBLAST_SHAKE_INTENSITY, FX.BACKBLAST_SHAKE_DURATION);
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
            maxBounces: FX.SHELL_BOUNCE_MIN + Math.floor(Math.random() * FX.SHELL_BOUNCE_RANDOM),
            groundY: y + FX.SHELL_GROUND_OFFSET + Math.random() * FX.SHELL_GROUND_RANDOM,
            state: 'flying', // flying | stopped
            stopTimer: 0,
            maxStopTime: FX.SHELL_MAX_STOP_TIME,
            fadeAlpha: 1,
            trailTimer: 0
        });
    },

    // 生成跳弹特效（金属火花 + 灰色"resist!"文字）
    spawnRicochetEffect(x, y) {
        // 银白色金属火花（增强版）
        const sparkColors = ['#FFFFFF', '#E0E0E0', '#BDBDBD', '#CFD8DC', '#FFD700', '#FFA500'];
        for (let i = 0; i < 15; i++) {  // 增加粒子数量：8 -> 15
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 4;  // 增加速度：2-5 -> 3-7
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,  // 增加向上初速度
                life: 25 + Math.random() * 15,  // 延长生命周期：15-25 -> 25-40
                maxLife: 40,
                color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
                size: 2.5 + Math.random() * 3,  // 增加粒子尺寸：1.5-3.5 -> 2.5-5.5
                type: ParticleType.SPARK,
                isRicochetSpark: true  // 标记为跳弹火花，用于特殊渲染
            });
        }
        // 灰色 "resist!" 伤害数字
        this.damageNumbers.push({
            x, y: y - 10,
            text: 'resist!',
            isRicochet: true,
            life: 40,
            maxLife: 40,
            vy: -2.5
        });
    },

    // 生成血液喷溅效果（命中时调用）
    // hitX, hitY: 命中位置
    // bulletVx, bulletVy: 子弹速度方向（决定溅射方向）
    // damage: 伤害值（可选，用于缩放飞溅程度）
    spawnBloodSplatter(hitX, hitY, bulletVx = 0, bulletVy = 0, damage = 30) {
        const bulletAngle = Math.atan2(bulletVy, bulletVx);
        const hasDirection = bulletVx !== 0 || bulletVy !== 0;
        // 按伤害量缩放（基准30伤害=1.0倍）
        const dmgScale = Math.min(2.0, Math.max(0.5, damage / FX.BLOOD_BASE_DAMAGE));

       // 生成血滴粒子（带方向，落地后变血迹）
       const dropCount = Math.floor((FX.BLOOD_DROP_BASE + Math.random() * FX.BLOOD_DROP_RANDOM) * dmgScale);
       for (let i = 0; i < dropCount; i++) {
           let angle;
           if (hasDirection) {
                angle = bulletAngle + (Math.random() - 0.5) * Math.PI * 1.5;
           } else {
               angle = Math.random() * Math.PI * 2;
           }
           const speed = (2 + Math.random() * 3) * dmgScale;
           const bloodColors = ['#8B0000', '#A00000', '#B22222', '#CC0000', '#990000', '#7A0000'];
            const randomAngle = Math.random() * Math.PI * 2;
            const randomOffset = Math.random() * 1.5;
           this.particles.push({
               x: hitX + (Math.random() - 0.5) * 6,
               y: hitY + (Math.random() - 0.5) * 6,
                vx: Math.cos(angle) * speed + Math.cos(randomAngle) * randomOffset,
                vy: Math.sin(angle) * speed + Math.sin(randomAngle) * randomOffset,
               life: 50 + Math.random() * 40,
               maxLife: 90,
               color: bloodColors[Math.floor(Math.random() * bloodColors.length)],
               size: 3 + Math.random() * 4,
               type: ParticleType.BLOOD_DROP,
               isBloodDrop: true,
               groundY: hitY + 15 + Math.random() * 35
           });
       }

        // 大血雾扩散效果（命中瞬间的红色半透明圆）
        this.explosions.push({
            x: hitX, y: hitY,
            radius: (FX.BLOOD_MIST_BASE + Math.random() * FX.BLOOD_MIST_RANDOM) * dmgScale,
            life: FX.BLOOD_MIST_LIFE,
            maxLife: FX.BLOOD_MIST_LIFE,
            type: 'blood_mist'
        });

        // 命中瞬间的小血雾粒子
        const mistCount = Math.floor((FX.BLOOD_MIST_COUNT_BASE + Math.random() * FX.BLOOD_MIST_COUNT_RANDOM) * dmgScale);
        for (let i = 0; i < mistCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 2;
            this.particles.push({
                x: hitX,
                y: hitY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 10 + Math.random() * 8,
                maxLife: 18,
                color: 'rgba(139, 0, 0, 0.6)',
                size: 4 + Math.random() * 5,
                type: ParticleType.HIT
            });
        }
    },

    // 预渲染血迹纹理（启动时调用一次）
    initBloodTextures() {
        if (this.bloodTexturesReady) return;
        this.bloodTextures = [];
        const bloodColors = ['#5A0000', '#6B0000', '#4A0000', '#7A0000', '#3D0000', '#550000'];
        for (let t = 0; t < BLOOD_TEX_COUNT; t++) {
            const canvas = document.createElement('canvas');
            canvas.width = BLOOD_TEX_SIZE;
            canvas.height = BLOOD_TEX_SIZE;
            const ctx = canvas.getContext('2d');
            const cx = BLOOD_TEX_SIZE / 2;
            const cy = BLOOD_TEX_SIZE / 2;
            const color = bloodColors[t % bloodColors.length];
            // 主体血斑（多个偏移圆形叠加）
            const blobCount = 4 + Math.floor(Math.random() * 4);
            for (let i = 0; i < blobCount; i++) {
                const ox = (Math.random() - 0.5) * BLOOD_TEX_SIZE * 0.4;
                const oy = (Math.random() - 0.5) * BLOOD_TEX_SIZE * 0.35;
                const r = BLOOD_TEX_SIZE * (0.1 + Math.random() * 0.2);
                ctx.beginPath();
                ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
            // 溅射小血滴
            const splatCount = 3 + Math.floor(Math.random() * 4);
            for (let i = 0; i < splatCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = BLOOD_TEX_SIZE * (0.2 + Math.random() * 0.35);
                const r = 2 + Math.random() * 4;
                ctx.beginPath();
                ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
            this.bloodTextures.push(canvas);
        }
        this.bloodTexturesReady = true;
        console.log(`🩸 血迹纹理预渲染完成: ${BLOOD_TEX_COUNT} 种`);
    },

    // 添加永久血迹（由血滴粒子落地时调用）— 存储纹理索引，渲染时盖章
    addBloodStain(x, y, size) {
        if (!this.bloodTexturesReady) this.initBloodTextures();
        const texIndex = Math.floor(Math.random() * BLOOD_TEX_COUNT);
        // scale：纹理实际显示尺寸 = BLOOD_TEX_SIZE * scale
        // size范围3~7，原血滴实际半径约2~4px，保留相近大小
        const scale = FX.BLOOD_STAIN_SCALE_BASE + Math.random() * FX.BLOOD_STAIN_SCALE_RANGE;
        const rotation = Math.random() * Math.PI * 2;
        const alpha = 0.5 + Math.random() * 0.4;
        this.bloodStains.push({ x, y, texIndex, scale, rotation, alpha });
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
            // 尘土粒子不受重力影响
            if (!p.isDust) {
                p.vy += FX.GRAVITY;
            }
            p.vx *= FX.DRAG;
            p.vy *= FX.DRAG;
            // 血滴粒子落地检测 → 转为永久血迹
            if (p.isBloodDrop && p.y >= p.groundY) {
                this.addBloodStain(p.x, p.groundY, p.size);
                this.particles.splice(i, 1);
                continue;
            }
            p.life--;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // 更新伤害数字
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const d = this.damageNumbers[i];
            d.y += d.vy;
            d.vy *= FX.DRAG;
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
                s.vy += FX.SHELL_GRAVITY;
                s.vx *= FX.SHELL_DRAG;
                s.rotation += s.rotationSpeed;
                // 飞行中拖尾火花
                s.trailTimer++;
                if (s.trailTimer % FX.SHELL_TRAIL_INTERVAL === 0) {
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
                    playShellLand(s.weaponType, s.bounceCount, s);
                    s.bounceCount++;
                    if (s.bounceCount >= s.maxBounces) {
                        s.state = 'stopped';
                        s.vx = 0;
                        s.vy = 0;
                        s.rotationSpeed *= FX.SHELL_ROT_DAMPING;
                    } else {
                        // 弹跳衰减
                        s.vy = -Math.abs(s.vy) * FX.SHELL_BOUNCE_DAMPING;
                        s.vx *= FX.SHELL_HORIZ_DAMPING;
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
            if (this.screenShake.timer < FX.SHAKE_DECAY_THRESHOLD) {
                this.screenShake.intensity *= FX.SHAKE_DECAY_FACTOR;
            }
        } else {
            this.screenShake.x = 0;
            this.screenShake.y = 0;
            this.screenShake.intensity = 0;
        }
    },

    // 专门绘制尘土粒子（在车辆之前调用，让车辆覆盖尘土）
    drawDustOnly(ctx, camera) {
        if (this.particles.length === 0) return;
        const zoom = camera.zoom || 1;
        const offsetX = camera.offsetX || 0;
        const offsetY = camera.offsetY || 0;
        const logicalW = ctx.canvas.clientWidth || ctx.canvas.width;
        const logicalH = ctx.canvas.clientHeight || ctx.canvas.height;
        const cx = logicalW / 2;
        const cy = logicalH / 2;
        const toScreen = (wx, wy) => ({
            x: (wx - camera.x) * zoom + cx * (1 - zoom) - offsetX,
            y: (wy - camera.y) * zoom + cy * (1 - zoom) - offsetY
        });

        for (const p of this.particles) {
            if (!p.isDust) continue;
            const pos = toScreen(p.x, p.y);
            const sx = pos.x + this.screenShake.x;
            const sy = pos.y + this.screenShake.y;
            const alpha = p.life / p.maxLife;
            ctx.save();
            const dustSize = (p.baseSize || p.size) * zoom;
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, dustSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
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
                // 冲击波圆环
                ctx.beginPath();
                ctx.arc(sx, sy, e.currentRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 100, 0, ${alpha * 0.8})`;
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (e.type === 'flash') {
                // 白色闪光
                ctx.beginPath();
                ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
                ctx.fill();
            } else if (e.type === 'muzzle_flash') {
                // 枪口火焰 - 明亮的径向渐变闪光
                const flashRadius = e.radius * (1 + (1 - alpha) * 0.5);
                const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, flashRadius);
                gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
                gradient.addColorStop(0.3, `rgba(255, 180, 0, ${alpha * 0.8})`);
                gradient.addColorStop(1, `rgba(255, 80, 0, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(sx, sy, flashRadius, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'blood_mist') {
                // 血雾扩散效果 - 红色渐变圆
                const mistRadius = e.radius * (1 + (1 - alpha) * FX.BLOOD_MIST_EXPANSION);
                const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, mistRadius);
                gradient.addColorStop(0, `rgba(180, 0, 0, ${alpha * 0.7})`);
                gradient.addColorStop(0.5, `rgba(139, 0, 0, ${alpha * 0.4})`);
                gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(sx, sy, mistRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 绘制粒子（跳过尘土，已在 drawDustOnly 中绘制）
        for (const p of this.particles) {
            if (p.isDust) continue;
            const pos = toScreen(p.x, p.y);
            const sx = pos.x + this.screenShake.x;
            const sy = pos.y + this.screenShake.y;
            const alpha = p.life / p.maxLife;
            ctx.save();
            // 普通粒子
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

            let alpha = s.fadeAlpha;

            // 地图亮度 / 云影亮度对弹壳明暗的影响
            let envLight = 1.0;
            const map = GameState.map;
            if (map && typeof map.getLightFactor === 'function') {
                const light = map.getLightFactor(s.x, s.y);
                if (typeof light === 'number' && !Number.isNaN(light)) {
                    envLight *= light;
                }
            }

            const currDef = WeatherSystem.getWeatherDef();
            if (currDef && currDef.cloudShadows) {
                const clouds = WeatherSystem.clouds;
                if (clouds && clouds.length > 0) {
                    let cloudDark = 0;
                    for (const c of clouds) {
                        const left = c.x - c.w * 0.5;
                        const right = c.x + c.w * 0.5;
                        const top = c.y - c.h * 0.5;
                        const bottom = c.y + c.h * 0.5;
                        if (s.x >= left && s.x <= right && s.y >= top && s.y <= bottom) {
                            cloudDark = Math.max(cloudDark, c.alpha / 0.22);
                        }
                    }
                    envLight *= Math.max(0.55, 1.0 - cloudDark * (currDef.cloudAlpha || 0));
                }
            }

            alpha *= Math.max(0.35, Math.min(1.0, envLight));

            ctx.save();
            ctx.globalAlpha = alpha;
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
            const scale = 1 + (1 - alpha) * FX.DMG_NUM_SCALE_FACTOR;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(sx, sy);
            ctx.scale(scale * zoom, scale * zoom);
            ctx.font = `bold ${FX.DMG_NUM_FONT_SIZE}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 阴影
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(d.text, 1, 1);
            // 文字颜色：跳弹用灰色，治疗用亮绿色
            if (d.isRicochet) {
                ctx.fillStyle = '#B0BEC5';
            } else if (d.isHeal) {
                ctx.fillStyle = '#69F0AE';
            } else {
                ctx.fillStyle = d.isPlayer ? '#ff5252' : '#4CAF50';
            }
            ctx.fillText(d.text, 0, 0);
            ctx.restore();
        }
    },

    // 绘制地面血迹（预渲染纹理 + drawImage盖章 + 视口裁剪）
    drawBloodStains(ctx, camera) {
        if (this.bloodStains.length === 0) return;
        if (!this.bloodTexturesReady) this.initBloodTextures();

        const zoom = camera.zoom || 1;
        const offsetX = camera.offsetX || 0;
        const offsetY = camera.offsetY || 0;
        const logicalW = ctx.canvas.clientWidth || ctx.canvas.width;
        const logicalH = ctx.canvas.clientHeight || ctx.canvas.height;
        const cx = logicalW / 2;
        const cy = logicalH / 2;

        // 使用与 Renderer.toScreen 一致的坐标转换
        const toScreen = (wx, wy) => ({
            x: (wx - camera.x) * zoom + cx * (1 - zoom) - offsetX,
            y: (wy - camera.y) * zoom + cy * (1 - zoom) - offsetY
        });

        // 计算屏幕边缘对应的世界坐标（用于视口裁剪）
        // 公式推导: screenX = (wx - camera.x) * zoom + cx*(1-zoom) - offsetX
        // wx = camera.x + (screenX - cx*(1-zoom) + offsetX) / zoom
        const viewLeft = camera.x + (0 - cx * (1 - zoom) + offsetX) / zoom;
        const viewRight = camera.x + (logicalW - cx * (1 - zoom) + offsetX) / zoom;
        const viewTop = camera.y + (0 - cy * (1 - zoom) + offsetY) / zoom;
        const viewBottom = camera.y + (logicalH - cy * (1 - zoom) + offsetY) / zoom;
        const margin = FX.BLOOD_VIEWPORT_MARGIN;

        for (const stain of this.bloodStains) {
            // 视口裁剪
            if (stain.x < viewLeft - margin || stain.x > viewRight + margin ||
                stain.y < viewTop - margin || stain.y > viewBottom + margin) continue;

            const tex = this.bloodTextures[stain.texIndex];
            if (!tex) continue;
            const pos = toScreen(stain.x, stain.y);
            const drawSize = BLOOD_TEX_SIZE * stain.scale * zoom;
            const halfSize = drawSize / 2;

            ctx.save();
            ctx.globalAlpha = stain.alpha;
            ctx.translate(pos.x, pos.y);
            ctx.rotate(stain.rotation);
            ctx.drawImage(tex, -halfSize, -halfSize, drawSize, drawSize);
            ctx.restore();
        }
    },

    // 清除所有特效
    clear() {
        this.particles.length = 0;
        this.damageNumbers.length = 0;
        this.shellCasings.length = 0;
        this.bloodStains.length = 0;
        this.screenShake.timer = 0;
        this.screenShake.x = 0;
        this.screenShake.y = 0;
    }
};
