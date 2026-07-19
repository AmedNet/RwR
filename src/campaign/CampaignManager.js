// src/campaign/CampaignManager.js
// 剧情模式状态机骨架。后续接入 Map.loadData / SpawnSystem.spawnCustomWave / TriggerSystem。

import { GameState } from '../core/GameState.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { EventBus } from '../core/EventBus.js';

export const CampaignManager = {
    active: false,
    currentMission: null,
    missionTimer: 0,          // 秒计数器
    objectives: [],           // 当前目标文本列表
    spawnedEnemyIds: new Set(),

    // 加载关卡数据
    loadMission(missionData) {
        this.currentMission = missionData;
        this.active = false;           // 尚未开始，等 startMission()
        this.missionTimer = 0;
        this.objectives = [];
        this.spawnedEnemyIds.clear();
    },

    // 开始关卡：加载地图/据点/禁用自动生成
    startMission() {
        if (!this.currentMission) return false;
        this.active = true;
        this.missionTimer = 0;

        const md = this.currentMission;

        // 加载预制地图
        if (md.mapData) {
            GameState.map.loadData(md.mapData);
        }

        // 预设据点
        if (md.capturePoints.length > 0) {
            GameState.capturePoints = md.capturePoints.map(p => {
                const CapturePoint = require('../entities/CapturePoint.js').default;
                return new CapturePoint(p.x, p.y, p.radius || 80, p.owner || null, p.id || 0);
            });
        }

        // 初始目标
        if (md.description) {
            this.objectives = [md.description];
        }

        // 禁用自由模式自动生成（关卡由 spawnWaves 和触发器手动控制）
        GameState.config.enemy.spawnEnabled = false;

        EventBus.emit('mission_started', md);
        return true;
    },

    // 每帧调用（从 main.js gameLoop 进来）
    checkTriggers() {
        if (!this.active || !this.currentMission) return;
        this.missionTimer += 1 / 60; // 近似 60fps

        const md = this.currentMission;
        const triggers = md.triggers || [];

        for (let i = triggers.length - 1; i >= 0; i--) {
            const t = triggers[i];
            if (t._fired) continue;

            let satisfied = false;
            switch (t.type) {
                case 'onTimerElapsed':
                    satisfied = this.missionTimer >= t.delaySec;
                    break;
                case 'onEnemyCountBelow':
                    satisfied = GameState.enemies.filter(e => e.alive).length < t.threshold;
                    break;
                case 'onPlayerKillCount':
                    satisfied = GameState.kills >= t.threshold;
                    break;
                case 'onAllWavesCleared':
                    // 由外部调用 markWaveCleared() 后判定
                    satisfied = t._wavesCleared || false;
                    break;
                default:
                    // 空间触发器/据点占领类由 EventBus 直接触发，不在此轮询
                    break;
            }

            if (satisfied) {
                t._fired = true;
                this._executeActions(t.actions);
            }
        }
    },

    // 外部调用：标记一波敌人已被消灭
    markWaveCleared() {
        const triggers = this.currentMission?.triggers || [];
        for (const t of triggers) {
            if (t.type === 'onAllWavesCleared') {
                t._wavesCleared = true;
            }
        }
    },

    // 执行动作列表
    _executeActions(actions) {
        for (const a of actions || []) {
            switch (a.type) {
                case 'spawnWave':
                    SpawnSystem.spawnCustomWave(a.config);
                    break;
                case 'setObjective':
                    this.objectives = [a.text];
                    EventBus.emit('objective_updated', a.text);
                    break;
                case 'completeMission':
                    this._endMission(true);
                    break;
                default:
                    break;
            }
        }
    },

    // 结束关卡
    _endMission(victory) {
        this.active = false;
        const md = this.currentMission;
        if (victory && md.rewardRp) {
            GameState.rp += md.rewardRp;
        }
        // 恢复自由模式自动生成
        GameState.config.enemy.spawnEnabled = true;
        EventBus.emit(victory ? 'mission_victory' : 'mission_defeat', md);
        this.currentMission = null;
        this.objectives = [];
    },

    // 玩家死亡时调用（剧情关卡中死亡可能需要特殊处理）
    onPlayerDeath() {
        if (!this.active) return;
        // 剧情关卡中玩家死亡默认失败（具体关卡可 override）
        this._endMission(false);
    }
};