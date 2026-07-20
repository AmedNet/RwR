// src/data/SupportConfig.js
// 支援系统配置数据（从 SupportSystem.js 分离）
import { AIRank } from '../core/RankSystem.js';

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
    VEHICLE_DROP: 'vehicle_drop',
    BTR80_DROP: 'btr80_drop'
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
        name: 'Jeep空投',
        icon: 'src/pkg/vehicle/jeep/jeep_uhd.png',
        description: '空投一辆威利斯MB吉普车到标记点',
        rpCost: 200,
        cooldown: 1800,
        minStars: 3,
        dropHeight: 400,
        dropDuration: 90
    },
    [SupportType.BTR80_DROP]: {
        name: 'BTR-80空投',
        icon: 'src/pkg/vehicle/btr80/btr80_drop.png',
        description: '空投一辆BTR-80装甲输送车到标记点',
        rpCost: 1000,
        cooldown: 1800,
        minStars: 3,
        dropHeight: 400,
        dropDuration: 90,
        vehicleId: 'btr80'
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
