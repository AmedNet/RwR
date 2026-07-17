// src/utils/AIMonologueSystem.js
// AI 战场自言自语系统 — 管理单个AI的自言自语气泡
import { AI_MONOLOGUES } from '../data/AIMonologues.js';

const MONOLOGUE_DURATION = 180;  // 自言自语显示帧数（3秒）
const MONOLOGUE_COOLDOWN = 1800; // 冷却帧数（30秒）
const MONOLOGUE_CHANCE = 0.0001; // 每帧触发概率（0.01%）

// 每个AI的自言自语状态
const monologueStates = new WeakMap();

function getState(ai) {
  if (!monologueStates.has(ai)) {
    monologueStates.set(ai, {
      activeBubble: null,
      cooldown: 0
    });
  }
  return monologueStates.get(ai);
}

// 根据AI状态选择对话类别
function pickCategory(ai) {
  const healthRatio = ai.health / ai.maxHealth;
  
  // 低血量优先
  if (healthRatio < 0.3) return 'lowHealth';
  
  // 换弹中
  const weapon = ai.getActiveWeapon();
  if (weapon && weapon.isReloading) return 'reloading';
  
  // 看到敌人
  if (ai.getClosestTarget && ai.getClosestTarget().target) return 'combat';
  
  // 在据点附近
  if (ai.guardPoint) return 'atPoint';
  
  // 独自一人
  const allies = ai.getAllies ? ai.getAllies().filter(a => a.alive && a !== ai) : [];
  if (allies.length === 0) return 'alone';
  
  // 移动中
  if (ai.stuckState && ai.stuckState.timer > 0) return 'moving';
  
  // 随机
  return 'random';
}

export const AIMonologueSystem = {
  update(ai) {
    if (!ai || !ai.alive) return;
    
    const state = getState(ai);
    
    // 递减活跃气泡
    if (state.activeBubble) {
      state.activeBubble.timer--;
      if (state.activeBubble.timer <= 0) {
        state.activeBubble = null;
        state.cooldown = MONOLOGUE_COOLDOWN;
      }
      return;
    }
    
    // 冷却中
    if (state.cooldown > 0) {
      state.cooldown--;
      return;
    }
    
    // 极小概率触发
    if (Math.random() > MONOLOGUE_CHANCE) return;
    
    // 选择类别和对话
    const category = pickCategory(ai);
    const pool = AI_MONOLOGUES[category] || AI_MONOLOGUES.random;
    const text = pool[Math.floor(Math.random() * pool.length)];
    
    state.activeBubble = {
      text,
      timer: MONOLOGUE_DURATION,
      maxTimer: MONOLOGUE_DURATION
    };
  },
  
  getBubble(ai) {
    if (!ai) return null;
    const state = monologueStates.get(ai);
    if (!state || !state.activeBubble) return null;
    return state.activeBubble;
  },
  
  clear(ai) {
    monologueStates.delete(ai);
  }
};
