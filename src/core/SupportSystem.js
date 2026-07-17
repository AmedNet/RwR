// src/core/SupportSystem.js
// 呼叫支援系统
import { GameState } from './GameState.js';
import { Weapon } from './Weapon.js';
import { Teammate } from '../entities/Teammate.js';
import { Enemy } from '../entities/Enemy.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { EffectsManager, ParticleType } from '../utils/EffectsManager.js';
import { WeaponPickup } from '../entities/WeaponPickup.js';
import { getRankStars } from './RankSystem.js';
import { playExplosion } from '../utils/SoundManager.js';
import { AIRank } from './RankSystem.js';
import { UnitClass } from './ClassSystem.js';
import { Vehicle } from '../entities/Vehicle.js';
import { VehicleRegistry } from './VehicleRegistry.js';

// 支援类型定义
export const SupportType = {
    SUPPLY_DROP: 'supply_drop',
    ARTILLERY_SINGLE: 'artillery_single',
    ARTILLERY_DOUBLE: 'artillery_double',
    PARATROOPERS: 'paratroopers',
    ELITE_SQUAD: 'elite_squad',
    SMOKE_SCREEN: 'smoke_screen',
    WEAPON_DROP: 'weapon_drop',
    REAPER_STRIKE: 'reaper_strike',
    A10_STRAFE: 'a10_strafe',
    VEHICLE_DROP: 'vehicle_drop'
};

// 支援配置
export const SupportConfig = {
    [SupportType.SUPPLY_DROP]: {
        name: '空投补给',
        icon: '📦',
        description: '空投医疗包和手雷到标记点',
        rpCost: 80,
        cooldown: 600,
        minStars: 2,
        radius: 60,
        items: ['cat', 'm67']
    },
    [SupportType.ARTILLERY_SINGLE]: {
        name: '一轮火炮支援',
        icon: '💥',
        description: '500范围内18发火炮覆盖轰炸',
        rpCost: 180,
        cooldown: 1800,
        minStars: 2,
        bombRadius: 500,
        rounds: 18,
        damage: 120,
        explosionRadius: 200,
        shrapnelRadius: 300,
        shrapnelDamage: 40,
        interval: 15,
        phases: 1
    },
    [SupportType.ARTILLERY_DOUBLE]: {
        name: '两轮火炮支援',
        icon: '💥💥',
        description: '两轮各18发火炮覆盖，中间装填',
        rpCost: 280,
        cooldown: 2400,
        minStars: 2,
        bombRadius: 500,
        rounds: 18,
        damage: 120,
        explosionRadius: 200,
        shrapnelRadius: 300,
        shrapnelDamage: 40,
        interval: 15,
        phases: 2,
        reloadTime: 180
    },
    [SupportType.PARATROOPERS]: {
        name: '伞兵支援',
        icon: '🪂',
        description: '8名伞兵空降增援战场',
        rpCost: 150,
        cooldown: 1200,
        minStars: 2,
        count: 8,
        batches: [3, 3, 2],
        batchInterval: 30,
        dropHeight: 300,
        dropDuration: 120
    },
    [SupportType.ELITE_SQUAD]: {
        name: '精英小队',
        icon: '⭐',
        description: '4名精英伞兵（含3星狙击手）',
        rpCost: 300,
        cooldown: 1800,
        minStars: 3,
        count: 4,
        batches: [2, 2],
        batchInterval: 45,
        dropHeight: 300,
        dropDuration: 120,
        elite: true
    },
    [SupportType.SMOKE_SCREEN]: {
        name: '烟雾掩护',
        icon: '🌫️',
        description: '在标记区域生成烟雾遮蔽视线',
        rpCost: 60,
        cooldown: 450,
        minStars: 3,
        radius: 150,
        duration: 480
    },
    [SupportType.WEAPON_DROP]: {
        name: '武器空投',
        icon: '🔫',
        description: '空投一把高级武器到标记点',
        rpCost: 200,
        cooldown: 1500,
        minStars: 4,
        weapons: ['ak47', 'm4a1', 'awp', 'sa28', 'hkmp5']
    },
    [SupportType.REAPER_STRIKE]: {
        name: '死神支援',
        icon: 'src/pkg/radio/mq9/mq9.png',
        description: 'MQ-9无人机投下重磅炸弹',
        rpCost: 400,
        cooldown: 3000,
        minStars: 3,
        bombRadius: 800,
        damage: 500,
        droneFlyDuration: 540,  // 9秒飞机飞过
        bombFallDuration: 60,   // 1秒炸弹下落
        audioPath: 'src/pkg/radio/mq9/mq9.m4a'
    },
    [SupportType.A10_STRAFE]: {
        name: '疣猪支援',
        icon: 'src/pkg/radio/a10/a10.png',
        description: 'A-10攻击机机炮扫射',
        rpCost: 350,
        cooldown: 2400,
        minStars: 3,
        strafeLength: 1200,      // 扫射长度1200
        strafeWidth: 300,        // 扫射宽度300
        bulletCount: 60,
        bulletDamage: 150,       // 每发伤害增加到150
        bulletInterval: 3,
        flyInDuration: 300,      // 前摇5秒
        strafeDuration: 180,
        audioPath: 'src/pkg/radio/a10/a10.m4a'
    },
    [SupportType.VEHICLE_DROP]: {
        name: '载具空投',
        icon: 'src/pkg/vehicle/jeep/jeep_uhd.png',
        description: '空投一辆威利斯MB吉普车到标记点',
        rpCost: 200,
        cooldown: 1800,
        minStars: 3,
        dropHeight: 400,
        dropDuration: 90
    }
};

// 敌方RP经济配置
export const EnemyRPEconomy = {
    initial: 100,
    perSecond: 1,
    killPlayerReward: 50,
    killTeammateReward: 20
};

// AI呼叫支援范围配置（按军衔）
export const AIRangeConfig = {
    [AIRank.PRIVATE]: { range: 0, canCall: false },
    [AIRank.SERGEANT]: { range: 600, canCall: false },
    [AIRank.OFFICER]: { range: 900, canCall: true },
    [AIRank.COMMANDER]: { range: 1200, canCall: true }
};

// 斐波那契螺旋分布算法（均匀分布点在圆内）
function fibonacciDiskPoints(count, radius, centerX, centerY) {
    const points = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const r = radius * Math.sqrt((i + 0.5) / count);
        const theta = i * goldenAngle;
        points.push({
            x: centerX + r * Math.cos(theta),
            y: centerY + r * Math.sin(theta)
        });
    }
    return points;
}

export const SupportSystem = {
    playerCooldowns: {},
    enemyCooldowns: {},
    enemyRP: 0,
    enemyRPTimer: 0,
    smokeZones: [],
    artillerySequences: [],
    supplyDrops: [],
    paratroopers: [],
    reaperStrikes: [],
    a10Strafes: [],
    vehicleDrops: [],

    init() {
        this.playerCooldowns = {};
        this.enemyCooldowns = {};
        this.enemyRP = 0;
        this.enemyRPTimer = 0;
        this.smokeZones = [];
        this.artillerySequences = [];
        this.supplyDrops = [];
        this.paratroopers = [];
        this.reaperStrikes = [];
        this.a10Strafes = [];
        this.vehicleDrops = [];
        this.aiGlobalTimer = 0;
        console.log('📡 支援系统初始化完成');
    },

    update() {
        // 更新冷却
        for (const type in this.playerCooldowns) {
            if (this.playerCooldowns[type] > 0) this.playerCooldowns[type]--;
        }
        for (const type in this.enemyCooldowns) {
            if (this.enemyCooldowns[type] > 0) this.enemyCooldowns[type]--;
        }

        // 更新敌方RP
        this.enemyRPTimer++;
        if (this.enemyRPTimer >= 60) {
            this.enemyRP += EnemyRPEconomy.perSecond;
            this.enemyRPTimer = 0;
        }

        // 更新烟雾区域
        for (let i = this.smokeZones.length - 1; i >= 0; i--) {
            this.smokeZones[i].duration--;
            if (this.smokeZones[i].duration <= 0) this.smokeZones.splice(i, 1);
        }

        // 更新炮击序列
        for (let i = this.artillerySequences.length - 1; i >= 0; i--) {
            const seq = this.artillerySequences[i];
            seq.timer--;

            if (seq.timer <= 0 && seq.roundsLeft > 0) {
                // 获取当前爆炸点坐标
                const hitX = seq.points[seq.currentRound].x;
                const hitY = seq.points[seq.currentRound].y;

                // 爆炸效果（更大的视觉半径）
                EffectsManager.spawnGrenadeExplosion(hitX, hitY, seq.explosionRadius);
                playExplosion({ x: hitX, y: hitY });

                // 主伤害判定（explosionRadius 内全伤害）
                this._applyExplosionDamage(hitX, hitY, seq.explosionRadius, seq.damage, true);

                // 破片伤害（shrapnelRadius 内衰减伤害 + 击退）
                this._applyShrapnelDamage(hitX, hitY, seq.shrapnelRadius, seq.shrapnelDamage);

                seq.currentRound++;
                seq.roundsLeft--;
                seq.timer = seq.interval;

            } else if (seq.timer <= 0 && seq.roundsLeft <= 0 && seq.phasesLeft > 1) {
                // 装填间隔
                seq.phasesLeft--;
                seq.roundsLeft = seq.roundsPerPhase;
                seq.currentRound = 0;
                seq.timer = seq.reloadTime;

            } else if (seq.timer <= 0 && seq.roundsLeft <= 0 && seq.phasesLeft <= 1) {
                this.artillerySequences.splice(i, 1);
            }
        }

        // 更新空投物
        for (let i = this.supplyDrops.length - 1; i >= 0; i--) {
            const drop = this.supplyDrops[i];
            drop.timer--;
            if (drop.timer <= 0) {
                this._spawnDropItems(drop);
                this.supplyDrops.splice(i, 1);
            }
        }

        // 更新伞兵空降
        for (let i = this.paratroopers.length - 1; i >= 0; i--) {
            const p = this.paratroopers[i];
            p.timer--;
            const progress = 1 - (p.timer / p.maxTimer);
            // 从上方降落到目标点
            p.currentX = p.startX + (p.targetX - p.startX) * progress;
            p.currentY = p.startY + (p.targetY - p.startY) * progress;

            if (p.timer <= 0) {
                // 落地，根据阵营加入对应数组
                const t = p.teammate;
                t.x = p.targetX;
                t.y = p.targetY;
                if (p.faction === 'enemy') {
                    GameState.enemies.push(t);
                } else {
                    GameState.teammates.push(t);
                }
                EffectsManager.spawnParticles(p.targetX, p.targetY, ParticleType.HEAL, 8);
                this.paratroopers.splice(i, 1);
            }
        }

        // 更新死神支援
        for (let i = this.reaperStrikes.length - 1; i >= 0; i--) {
            const strike = this.reaperStrikes[i];
            strike.timer--;
            
            const elapsed = strike.totalDuration - strike.timer;
            
            // 阶段切换：飞机飞过 → 炸弹下落
            if (elapsed >= strike.droneFlyDuration && strike.phase === 'drone') {
                strike.phase = 'bomb';
            }
            
            // 音频控制：飞机阶段淡入，炸弹阶段淡出
            if (strike.audio) {
                if (strike.phase === 'drone') {
                    // 飞机阶段：音量逐渐增大到0.8
                    const droneProgress = elapsed / strike.droneFlyDuration;
                    strike.audio.volume = Math.min(0.8, droneProgress * 0.8);
                } else if (strike.phase === 'bomb') {
                    // 炸弹阶段：音量快速淡出
                    const bombElapsed = elapsed - strike.droneFlyDuration;
                    const bombProgress = bombElapsed / strike.bombFallDuration;
                    strike.audio.volume = Math.max(0, (1 - bombProgress) * 0.8);
                }
            }
            
            // 落地爆炸
            if (strike.timer <= 0 && strike.phase !== 'exploded') {
                strike.phase = 'exploded';
                const hitX = strike.x;
                const hitY = strike.y;
                
                // 巨大爆炸效果
                EffectsManager.spawnGrenadeExplosion(hitX, hitY, strike.bombRadius);
                
                // 额外的强烈屏幕震动（比普通手雷更强烈）
                EffectsManager.triggerShake(25, 45);  // 强度25，持续45帧
                
                // 额外的火光粒子（大量橙色/红色碎片）
                for (let i = 0; i < 40; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 3 + Math.random() * 6;
                    EffectsManager.particles.push({
                        x: hitX,
                        y: hitY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 3,
                        life: 50 + Math.random() * 30,
                        maxLife: 80,
                        color: ['#ff6600', '#ff3300', '#ffaa00', '#ff0000'][Math.floor(Math.random() * 4)],
                        size: 3 + Math.random() * 5,
                        type: 'grenade_blast'
                    });
                }
                
                // 额外的烟雾粒子（大量灰色烟雾）
                for (let i = 0; i < 25; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1 + Math.random() * 3;
                    EffectsManager.particles.push({
                        x: hitX,
                        y: hitY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 2,
                        life: 80 + Math.random() * 40,
                        maxLife: 120,
                        color: '#444',
                        size: 8 + Math.random() * 12,
                        type: 'smoke'
                    });
                }
                
                playExplosion({ x: hitX, y: hitY }, true);  // true = 死神支援增强音效
                
                // 范围伤害
                this._applyExplosionDamage(hitX, hitY, strike.bombRadius, strike.damage, true);
                
                // 开始淡出音效
                strike.fadeOutTimer = 240;  // 4秒持续爆炸效果
            }
            
            // 淡出效果（4秒持续爆炸）
            if (strike.phase === 'exploded' && strike.fadeOutTimer > 0) {
                strike.fadeOutTimer--;
                
                // 持续产生爆炸粒子（前2秒）
                if (strike.fadeOutTimer > 120 && strike.fadeOutTimer % 3 === 0) {
                    // 持续火光
                    for (let i = 0; i < 3; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 2 + Math.random() * 4;
                        EffectsManager.particles.push({
                            x: strike.x + (Math.random() - 0.5) * 100,
                            y: strike.y + (Math.random() - 0.5) * 100,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 2,
                            life: 40 + Math.random() * 20,
                            maxLife: 60,
                            color: ['#ff6600', '#ff3300', '#ffaa00'][Math.floor(Math.random() * 3)],
                            size: 4 + Math.random() * 4,
                            type: 'grenade_blast'
                        });
                    }
                    
                    // 持续烟雾
                    if (strike.fadeOutTimer % 6 === 0) {
                        EffectsManager.particles.push({
                            x: strike.x + (Math.random() - 0.5) * 150,
                            y: strike.y + (Math.random() - 0.5) * 150,
                            vx: (Math.random() - 0.5) * 2,
                            vy: -1 - Math.random() * 2,
                            life: 100 + Math.random() * 50,
                            maxLife: 150,
                            color: '#555',
                            size: 15 + Math.random() * 15,
                            type: 'smoke'
                        });
                    }
                    
                    // 间歇性屏幕震动
                    if (strike.fadeOutTimer % 20 === 0) {
                        EffectsManager.triggerShake(8, 15);
                    }
                }
                
                // 音效淡出（最后1.5秒）
                if (strike.audio) {
                    const audioFadeStart = 90;  // 最后1.5秒开始淡出
                    if (strike.fadeOutTimer < audioFadeStart) {
                        strike.audio.volume = Math.max(0, strike.fadeOutTimer / audioFadeStart) * 0.8;
                    }
                }
                
                if (strike.fadeOutTimer <= 0) {
                    if (strike.audio) {
                        strike.audio.pause();
                        strike.audio = null;
                    }
                    this.reaperStrikes.splice(i, 1);
                }
            }
        }

        // 更新疣猪支援
        for (let i = this.a10Strafes.length - 1; i >= 0; i--) {
            const strafe = this.a10Strafes[i];
            strafe.timer--;

            const elapsed = strafe.totalDuration - strafe.timer;

            // 阶段切换：飞机飞入 → 扫射
            if (elapsed >= strafe.flyInDuration && strafe.phase === 'flyIn') {
                strafe.phase = 'strafing';
            }

            // 音频控制
            if (strafe.audio && !strafe.audio.ended) {
                if (strafe.phase === 'flyIn') {
                    const flyProgress = elapsed / strafe.flyInDuration;
                    strafe.audio.volume = Math.min(0.8, flyProgress * 0.8);
                } else if (strafe.phase === 'strafing') {
                    strafe.audio.volume = 0.8;
                } else if (strafe.phase === 'fadeOut') {
                    const fadeProgress = strafe.fadeOutTimer / 180;
                    strafe.audio.volume = Math.max(0, fadeProgress * 0.8);
                }
            }

            // 扫射阶段：直接产生爆炸效果
            if (strafe.phase === 'strafing' && strafe.bulletsFired < strafe.bulletCount) {
                strafe.bulletTimer--;
                if (strafe.bulletTimer <= 0) {
                    // 计算当前爆炸位置（沿扫射方向均匀分布）
                    const progress = strafe.bulletsFired / strafe.bulletCount;
                    const hitX = strafe.startX + (strafe.endX - strafe.startX) * progress;
                    const hitY = strafe.startY + (strafe.endY - strafe.startY) * progress;
                    
                    // 添加随机偏移（在扫射宽度范围内）
                    const perpAngle = strafe.angle + Math.PI / 2;
                    const offset = (Math.random() - 0.5) * strafe.strafeWidth * 0.8;
                    const finalX = hitX + Math.cos(perpAngle) * offset;
                    const finalY = hitY + Math.sin(perpAngle) * offset;

                    // 中型爆炸效果（机炮命中）
                    const explosionRadius = 80 + Math.random() * 40;
                    EffectsManager.spawnGrenadeExplosion(finalX, finalY, explosionRadius);
                    playExplosion({ x: finalX, y: finalY });
                    
                    // 造成范围伤害
                    this._applyStrafeDamage(finalX, finalY, explosionRadius, strafe.bulletDamage);

                    strafe.bulletsFired++;
                    strafe.bulletTimer = strafe.bulletInterval;
                }
            }

            // 扫射结束后淡出
            if (strafe.phase === 'strafing' && strafe.bulletsFired >= strafe.bulletCount) {
                strafe.phase = 'fadeOut';
                strafe.fadeOutTimer = 180;  // 3秒淡出
            }

            // 淡出阶段
            if (strafe.phase === 'fadeOut') {
                strafe.fadeOutTimer--;
                if (strafe.fadeOutTimer <= 0) {
                    if (strafe.audio) {
                        strafe.audio.pause();
                        strafe.audio.currentTime = 0;
                        strafe.audio = null;
                    }
                    this.a10Strafes.splice(i, 1);
                }
            }
        }

        // 更新载具空投
        for (let i = this.vehicleDrops.length - 1; i >= 0; i--) {
            const drop = this.vehicleDrops[i];
            drop.timer--;
            const progress = 1 - (drop.timer / drop.maxTimer);
            // 从上方降落到目标点
            drop.currentX = drop.startX + (drop.targetX - drop.startX) * progress;
            drop.currentY = drop.startY + (drop.targetY - drop.startY) * progress;

            if (drop.timer <= 0) {
                // 落地：生成载具（支援召唤不受上限限制）
                const vehicle = new Vehicle(drop.targetX, drop.targetY, VehicleRegistry.jeep);
                GameState.vehicles.push(vehicle);
                EffectsManager.spawnParticles(drop.targetX, drop.targetY, ParticleType.HEAL, 12);
                console.log(`🚗 载具空投到达: ${vehicle.name}`);
                this.vehicleDrops.splice(i, 1);
            }
        }
    },

    // 爆炸主伤害（友伤开启）
    _applyExplosionDamage(hitX, hitY, radius, damage, withKnockback) {
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive)
        ];
        if (GameState.player && GameState.player.alive) entities.push(GameState.player);

        for (const entity of entities) {
            const isPlayer = entity === GameState.player;
            const d = Math.hypot(entity.x - hitX, entity.y - hitY);
            
            if (d < radius) {
                const dmg = Math.floor(damage * (1 - d / radius * 0.5));
                if (dmg > 0) {
                    entity.takeDamage(dmg, hitX, hitY);
                    EffectsManager.addDamageNumber(entity.x, entity.y, dmg, isPlayer);
                }
                // 击退
                if (withKnockback && d > 0) {
                    const angle = Math.atan2(entity.y - hitY, entity.x - hitX);
                    const knockback = 80 * (1 - d / radius);
                    entity.x += Math.cos(angle) * knockback;
                    entity.y += Math.sin(angle) * knockback;
                }
            }
        }
    },

    // 破片伤害（更远范围，衰减伤害，友伤开启）
    _applyShrapnelDamage(hitX, hitY, radius, damage) {
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive)
        ];
        if (GameState.player && GameState.player.alive) entities.push(GameState.player);

        for (const entity of entities) {
            const isPlayer = entity === GameState.player;
            const d = Math.hypot(entity.x - hitX, entity.y - hitY);
            
            if (d >= radius * 0.5 && d < radius) {
                const dmg = Math.floor(damage * (1 - (d - radius * 0.5) / (radius * 0.5)));
                if (dmg > 0) {
                    entity.takeDamage(dmg, hitX, hitY);
                    EffectsManager.addDamageNumber(entity.x, entity.y, dmg, isPlayer);
                }
                // 破片击退（较小）
                if (d > 0) {
                    const angle = Math.atan2(entity.y - hitY, entity.x - hitX);
                    const knockback = 40 * (1 - d / radius);
                    entity.x += Math.cos(angle) * knockback;
                    entity.y += Math.sin(angle) * knockback;
                }
            }
        }
    },

    canPlayerCall(type) {
        const config = SupportConfig[type];
        if (!config) return false;
        const player = GameState.player;
        if (!player) return false;
        const stars = getRankStars(player.rank);
        if (stars < config.minStars) return false;
        if (GameState.rp < config.rpCost) return false;
        if (this.playerCooldowns[type] > 0) return false;
        return true;
    },

    callSupport(type, worldX, worldY) {
        if (!this.canPlayerCall(type)) return false;
        const config = SupportConfig[type];
        GameState.rp -= config.rpCost;
        this.playerCooldowns[type] = config.cooldown;
        console.log(`📡 呼叫支援: ${config.name} 到 (${Math.round(worldX)}, ${Math.round(worldY)})`);
        this._executeSupport(type, worldX, worldY, 'player');
        return true;
    },

    enemyCallSupport(type, worldX, worldY) {
        const config = SupportConfig[type];
        if (!config) return false;
        if (this.enemyRP < config.rpCost) return false;
        if (this.enemyCooldowns[type] > 0) return false;
        this.enemyRP -= config.rpCost;
        this.enemyCooldowns[type] = config.cooldown;
        console.log(`🔴 敌方呼叫支援: ${config.name}`);
        this._executeSupport(type, worldX, worldY, 'enemy');
        return true;
    },

    _executeSupport(type, x, y, faction) {
        switch (type) {
            case SupportType.SUPPLY_DROP: this._executeSupplyDrop(x, y, faction); break;
            case SupportType.ARTILLERY_SINGLE: this._executeArtillery(x, y, faction, false); break;
            case SupportType.ARTILLERY_DOUBLE: this._executeArtillery(x, y, faction, true); break;
            case SupportType.PARATROOPERS: this._executeParatroopers(x, y, faction, false); break;
            case SupportType.ELITE_SQUAD: this._executeParatroopers(x, y, faction, true); break;
            case SupportType.SMOKE_SCREEN: this._executeSmokeScreen(x, y); break;
            case SupportType.WEAPON_DROP: this._executeWeaponDrop(x, y); break;
            case SupportType.REAPER_STRIKE: this._executeReaperStrike(x, y); break;
            case SupportType.A10_STRAFE: this._executeA10Strafe(x, y); break;
            case SupportType.VEHICLE_DROP: this._executeVehicleDrop(x, y); break;
        }
    },

    _executeSupplyDrop(x, y, faction) {
        const config = SupportConfig[SupportType.SUPPLY_DROP];
        this.supplyDrops.push({
            x, y, faction,
            timer: 90,
            items: config.items,
            radius: config.radius
        });
        EffectsManager.spawnParticles(x, y, ParticleType.EXPLOSION, 5);
    },

    _spawnDropItems(drop) {
        // 敌方空投：给范围内敌方单位回血
        if (drop.faction === 'enemy') {
            const healAmount = 80;
            const healRadius = drop.radius * 2;
            let healedCount = 0;
            for (const enemy of GameState.enemies) {
                if (!enemy.alive) continue;
                const dist = Math.hypot(enemy.x - drop.x, enemy.y - drop.y);
                if (dist < healRadius && enemy.health < enemy.maxHealth) {
                    enemy.health = Math.min(enemy.health + healAmount, enemy.maxHealth);
                    healedCount++;
                }
            }
            EffectsManager.spawnHealEffect(drop.x, drop.y, healRadius);
            console.log(`🔴 敌方空投补给：治疗了 ${healedCount} 个敌方单位`);
            return;
        }
        if (drop.items) {
            for (const itemId of drop.items) {
                const weapon = new Weapon(itemId);
                const offsetX = (Math.random() - 0.5) * drop.radius * 0.5;
                const offsetY = (Math.random() - 0.5) * drop.radius * 0.5;
                GameState.weaponPickups.push(new WeaponPickup(drop.x + offsetX, drop.y + offsetY, weapon));
            }
        }
        if (drop.weapons) {
            for (const weaponId of drop.weapons) {
                const weapon = new Weapon(weaponId);
                GameState.weaponPickups.push(new WeaponPickup(drop.x, drop.y, weapon));
            }
        }
        EffectsManager.spawnHealEffect(drop.x, drop.y, 0);
    },

    _executeArtillery(x, y, faction, isDouble) {
        const config = isDouble ? SupportConfig[SupportType.ARTILLERY_DOUBLE] : SupportConfig[SupportType.ARTILLERY_SINGLE];
        // 斐波那契螺旋分布爆炸点
        const points = fibonacciDiskPoints(config.rounds, config.bombRadius, x, y);

        this.artillerySequences.push({
            x, y, faction,
            points: points,
            currentRound: 0,
            roundsLeft: config.rounds,
            roundsPerPhase: config.rounds,
            phasesLeft: config.phases || 1,
            interval: config.interval,
            reloadTime: config.reloadTime || 0,
            damage: config.damage,
            explosionRadius: config.explosionRadius,
            shrapnelRadius: config.shrapnelRadius,
            shrapnelDamage: config.shrapnelDamage,
            bombRadius: config.bombRadius,
            timer: 30
        });
    },

    _executeParatroopers(x, y, faction, isElite) {
        const config = isElite ? SupportConfig[SupportType.ELITE_SQUAD] : SupportConfig[SupportType.PARATROOPERS];
        const count = config.count;
        const batches = config.batches;

        let batchIndex = 0;
        let batchCount = 0;
        let delayFrames = 0;

        for (let i = 0; i < count; i++) {
            if (batchCount >= batches[batchIndex]) {
                batchIndex++;
                batchCount = 0;
                delayFrames += config.batchInterval;
            }

            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 30 + Math.random() * 60;
            const targetX = x + Math.cos(angle) * dist;
            const targetY = y + Math.sin(angle) * dist;

            const startX = targetX + (Math.random() - 0.5) * 100;
            const startY = targetY - config.dropHeight;

            let unit;
           if (faction === 'enemy') {
               // 敌方伞兵：创建 Enemy 实例
               unit = new Enemy(targetX, targetY, GameState.config.enemy);
               if (isElite) {
                   unit.setRank(AIRank.OFFICER);
               }
                // 分配武器（与普通敌人生成逻辑一致）
                const enemyWeapons = SpawnSystem.generateRandomWeapons(unit.rank, unit.unitClass);
                unit.setWeapons(enemyWeapons);
           } else if (isElite) {
                unit = this._createEliteTeammate(targetX, targetY, i);
            } else {
                unit = new Teammate(targetX, targetY, GameState.config.teammate);
                SpawnSystem.equipTeammate(unit);
            }

            this.paratroopers.push({
                startX, startY,
                targetX, targetY,
                currentX: startX,
                currentY: startY,
                timer: config.dropDuration + delayFrames,
                maxTimer: config.dropDuration + delayFrames,
                teammate: unit,
                faction: faction,
                elite: isElite,
                batchIndex: batchIndex
            });

            batchCount++;
        }
    },

    _createEliteTeammate(x, y, index) {
        const t = new Teammate(x, y, GameState.config.teammate);

        // 4人固定组合：0=狙击手(3星), 1=医疗兵(2星), 2=弹药兵(2星), 3=突击兵(2星)
        const roles = [
            { unitClass: UnitClass.SNIPER, rank: AIRank.OFFICER, weapons: ['awp', 'm67'] },
            { unitClass: UnitClass.MEDIC, rank: AIRank.SERGEANT, weapons: ['m4a1', 'cat', 'm67'] },
            { unitClass: UnitClass.AMMO, rank: AIRank.SERGEANT, weapons: ['hkmp5', 'm67'] },
            { unitClass: UnitClass.ASSAULT, rank: AIRank.SERGEANT, weapons: ['ak47', 'm67'] }
        ];

        const role = roles[index % roles.length];
        t.setClass(role.unitClass);
        t.setRank(role.rank);

        // 装备武器
        const weapons = [];
        weapons.push(new Weapon('knife'));
        const mainWeapon = new Weapon(role.weapons[0]);
        mainWeapon.isInfiniteAmmo = true;
        weapons.push(mainWeapon);

        // 副武器/配件
        if (role.weapons.length > 1) {
            const acc = new Weapon(role.weapons[1]);
            weapons.push(acc);
        } else {
            weapons.push(null);
        }
        if (role.weapons.length > 2) {
            const acc2 = new Weapon(role.weapons[2]);
            weapons.push(acc2);
        } else {
            weapons.push(null);
        }

        t.setWeapons(weapons);
        return t;
    },

    _executeSmokeScreen(x, y) {
        const config = SupportConfig[SupportType.SMOKE_SCREEN];
        this.smokeZones.push({
            x, y,
            radius: config.radius,
            duration: config.duration,
            maxDuration: config.duration
        });
    },

    _executeWeaponDrop(x, y) {
        const config = SupportConfig[SupportType.WEAPON_DROP];
        const weaponId = config.weapons[Math.floor(Math.random() * config.weapons.length)];
        this.supplyDrops.push({
            x, y,
            faction: 'player',
            timer: 90,
            weapons: [weaponId],
            radius: 40
        });
    },

    _executeVehicleDrop(x, y) {
        const config = SupportConfig[SupportType.VEHICLE_DROP];
        const startX = x + (Math.random() - 0.5) * 60;
        const startY = y - config.dropHeight;

        this.vehicleDrops.push({
            startX, startY,
            targetX: x,
            targetY: y,
            currentX: startX,
            currentY: startY,
            timer: config.dropDuration,
            maxTimer: config.dropDuration
        });

        console.log(`🚗 载具空投: 吉普车正在降落到 (${Math.round(x)}, ${Math.round(y)})`);
    },

    // 死神支援执行
   _executeReaperStrike(x, y) {
       const config = SupportConfig[SupportType.REAPER_STRIKE];
       
        // 创建音频实例（自然播放完毕，不循环）
       const audio = new Audio(config.audioPath);
        audio.loop = false;
       audio.volume = 0;
       audio.play().catch(e => console.log('Audio play failed:', e));
       
        // 添加到死神支援数组
        this.reaperStrikes.push({
            x, y,
            bombRadius: config.bombRadius,
            damage: config.damage,
            droneFlyDuration: config.droneFlyDuration,
            bombFallDuration: config.bombFallDuration,
            totalDuration: config.droneFlyDuration + config.bombFallDuration,
            timer: config.droneFlyDuration + config.bombFallDuration,
            audio: audio,
            phase: 'drone',  // 'drone' | 'bomb' | 'exploded'
            fadeOutTimer: 0
        });
        
        console.log(`🔥 死神支援: MQ-9无人机正在飞往 (${Math.round(x)}, ${Math.round(y)})`);
    },

    // 疣猪支援执行
    _executeA10Strafe(x, y) {
        const config = SupportConfig[SupportType.A10_STRAFE];
        
        // 随机扫射方向
        const angle = Math.random() * Math.PI * 2;
        
        // 计算扫射起点和终点（以目标点为中心）
        const halfLength = config.strafeLength / 2;
        const startX = x - Math.cos(angle) * halfLength;
        const startY = y - Math.sin(angle) * halfLength;
        const endX = x + Math.cos(angle) * halfLength;
        const endY = y + Math.sin(angle) * halfLength;
        
        // 创建音频实例（不循环，自然播放完毕）
        const audio = new Audio(config.audioPath);
        audio.volume = 0;
        audio.play().catch(e => console.log('Audio play failed:', e));
        
        // 添加到疣猪支援数组
        this.a10Strafes.push({
            x, y,
            startX, startY,
            endX, endY,
            angle,
            strafeLength: config.strafeLength,
            strafeWidth: config.strafeWidth,
            bulletCount: config.bulletCount,
            bulletDamage: config.bulletDamage,
            bulletInterval: config.bulletInterval,
            flyInDuration: config.flyInDuration,
            strafeDuration: config.strafeDuration,
            totalDuration: config.flyInDuration + config.strafeDuration,
            timer: config.flyInDuration + config.strafeDuration,
            audio: audio,
            phase: 'flyIn',
            bulletsFired: 0,
            bulletTimer: 0,
            fadeOutTimer: 0
        });
        
        console.log(`✈️ 疣猪支援: A-10正在飞往 (${Math.round(x)}, ${Math.round(y)})`);
    },
    
    // 机炮扫射伤害（对范围内所有实体造成伤害）
    _applyStrafeDamage(hitX, hitY, radius, damage) {
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive)
        ];
        if (GameState.player && GameState.player.alive) entities.push(GameState.player);
        
        for (const entity of entities) {
            const isPlayer = entity === GameState.player;
            const d = Math.hypot(entity.x - hitX, entity.y - hitY);
            if (d < radius) {
                const dmg = Math.floor(damage * (1 - d / radius * 0.5));
                if (dmg > 0) {
                    entity.takeDamage(dmg, hitX, hitY);
                    EffectsManager.addDamageNumber(entity.x, entity.y, dmg, isPlayer);
                }
                // 轻微击退
                if (d > 0) {
                    const angle = Math.atan2(entity.y - hitY, entity.x - hitX);
                    const knockback = 20 * (1 - d / radius);
                    entity.x += Math.cos(angle) * knockback;
                    entity.y += Math.sin(angle) * knockback;
                }
            }
        }
    },


    getPlayerAvailableSupport() {
        const player = GameState.player;
        if (!player) return [];
        const stars = getRankStars(player.rank);
        const available = [];
        for (const [type, config] of Object.entries(SupportConfig)) {
            if (stars >= config.minStars) {
                available.push({
                    type,
                    config,
                    canCall: this.canPlayerCall(type),
                    cooldownRemaining: this.playerCooldowns[type] || 0
                });
            }
        }
        return available;
    },

    isInSmoke(x, y) {
        for (const zone of this.smokeZones) {
            const dist = Math.hypot(x - zone.x, y - zone.y);
            if (dist < zone.radius) return true;
        }
        return false;
    },

    onEnemyKill(isPlayer) {
        const reward = isPlayer ? EnemyRPEconomy.killPlayerReward : EnemyRPEconomy.killTeammateReward;
        this.enemyRP += reward;
    },

    // AI决策：基于位置范围的支援呼叫
    aiGlobalTimer: 0,
    aiShouldCallSupport() {
        this.aiGlobalTimer++;
        if (this.aiGlobalTimer < 1800) return null;
        if (Math.random() > 0.005) return null;

        // 找到能呼叫支援的敌人（军官或指挥官）
        const callers = GameState.enemies.filter(e => {
            if (!e.alive) return false;
            const rangeConfig = AIRangeConfig[e.rank];
            return rangeConfig && rangeConfig.canCall;
        });

        if (callers.length === 0) return null;

        // 随机选一个呼叫者
        const caller = callers[Math.floor(Math.random() * callers.length)];
        const rangeConfig = AIRangeConfig[caller.rank];
        const callRange = rangeConfig.range;

        // 在呼叫者附近找目标
        let targetX, targetY;

        // 优先攻击范围内的玩家
        if (GameState.player && GameState.player.alive) {
            const distToPlayer = Math.hypot(GameState.player.x - caller.x, GameState.player.y - caller.y);
            if (distToPlayer <= callRange) {
                targetX = GameState.player.x + (Math.random() - 0.5) * 200;
                targetY = GameState.player.y + (Math.random() - 0.5) * 200;
            }
        }

        // 或者攻击范围内的据点
        if (!targetX) {
            const playerPoints = GameState.capturePoints.filter(p => {
                if (p.owner !== 'player') return false;
                const dist = Math.hypot(p.x - caller.x, p.y - caller.y);
                return dist <= callRange;
            });
            if (playerPoints.length > 0) {
                const point = playerPoints[Math.floor(Math.random() * playerPoints.length)];
                targetX = point.x + (Math.random() - 0.5) * 100;
                targetY = point.y + (Math.random() - 0.5) * 100;
            }
        }

        // 或者攻击范围内的队友
        if (!targetX) {
            const nearbyTeammates = GameState.teammates.filter(t => {
                if (!t.alive) return false;
                return Math.hypot(t.x - caller.x, t.y - caller.y) <= callRange;
            });
            if (nearbyTeammates.length > 0) {
                const t = nearbyTeammates[Math.floor(Math.random() * nearbyTeammates.length)];
                targetX = t.x + (Math.random() - 0.5) * 100;
                targetY = t.y + (Math.random() - 0.5) * 100;
            }
        }

        if (!targetX) return null;

        // 选择支援类型
        const available = [];
        for (const [type, config] of Object.entries(SupportConfig)) {
            if (this.enemyRP >= config.rpCost && (this.enemyCooldowns[type] || 0) <= 0) {
                available.push(type);
            }
        }
        if (available.length === 0) return null;

        const priority = [SupportType.ARTILLERY_SINGLE, SupportType.ARTILLERY_DOUBLE, SupportType.PARATROOPERS, SupportType.ELITE_SQUAD, SupportType.SUPPLY_DROP, SupportType.SMOKE_SCREEN, SupportType.WEAPON_DROP];
        for (const type of priority) {
            if (available.includes(type)) {
                return { type, x: targetX, y: targetY };
            }
        }
        return null;
    }
};
