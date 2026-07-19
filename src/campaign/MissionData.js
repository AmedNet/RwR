// src/campaign/MissionData.js
// 关卡数据结构定义 + 空模板。剧情设计师只需按此模板填数据，不写逻辑。

// 触发器类型枚举
export const TriggerType = {
    ON_PLAYER_ENTER_REGION: 'onPlayerEnterRegion',   // 玩家进入指定矩形区域
    ON_POINT_CAPTURED:       'onPointCaptured',      // 指定据点被玩家占领
    ON_ENEMY_COUNT_BELOW:    'onEnemyCountBelow',    // 敌方存活数降到阈值
    ON_TIMER_ELAPSED:        'onTimerElapsed',       // 任务开始后 N 秒
    ON_ALL_WAVES_CLEARED:    'onAllWavesCleared',    // 所有生成波次被消灭
    ON_PLAYER_KILL_COUNT:    'onPlayerKillCount',    // 玩家击杀数达到阈值
};

// 动作类型枚举
export const ActionType = {
    SPAWN_WAVE:      'spawnWave',       // 生成一波敌人
    SHOW_DIALOGUE:   'showDialogue',    // 显示对话气泡
    SET_OBJECTIVE:   'setObjective',    // 更新当前目标文本
    UNLOCK_AREA:     'unlockArea',      // 解锁新区域（移除障碍/开放据点）
    COMPLETE_MISSION: 'completeMission', // 任务完成
};

// 单个关卡数据结构
// mapData: 二维数组 tile type（null=空白, 0=草地, 1=树林, 2=房屋, 3=水域, 4=道路）
// capturePoints: [{x, y, radius, owner, id}]
// spawnWaves: [{trigger: TriggerType.ON_TIMER_ELAPSED, delaySec, config: {count, x, y, radius, rank, unitClass}}]
// triggers: [{type, condition, actions[]}]
export const MissionDataTemplate = {
    id: '',
    name: '',
    description: '',
    briefingText: '',
    // 地图（null 表示使用随机地图）
    mapData: null,
    // 据点列表
    capturePoints: [],
    // 预设生成波次
    spawnWaves: [],
    // 卡关脚本触发器链
    triggers: [],
    // 胜利条件
    winCondition: { type: '', params: {} },
    // 失败条件
    loseCondition: { type: '', params: {} },
    // 通关奖励 RP
    rewardRp: 0,
};