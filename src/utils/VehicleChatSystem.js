// src/utils/VehicleChatSystem.js
// 载具 AI 闲聊系统 — 对话链模式，连贯播放
import { GameState } from '../core/GameState.js';
import { VEHICLE_DIALOGUES } from '../data/VehicleDialogues.js';

// 动态时长计算：根据文字长度 + 随机波动
const BASE_LINE_DURATION = 150;   // 基础显示帧数（2.5秒）
const PER_CHAR_FRAMES = 4;        // 每个字符额外帧数
const DURATION_JITTER = 40;       // 时长随机波动范围（±帧）
const BASE_GAP = 20;              // 基础行间间隔帧数
const GAP_JITTER = 25;            // 间隔随机波动范围（±帧）
const COOLDOWN_MIN = 600;         // 链间最短冷却（10秒）
const COOLDOWN_MAX = 1200;        // 链间最长冷却（20秒）

// 根据文字内容计算该行应显示的帧数
function calcLineDuration(text) {
  const charBased = BASE_LINE_DURATION + text.length * PER_CHAR_FRAMES;
  const jitter = Math.floor(Math.random() * DURATION_JITTER * 2) - DURATION_JITTER;
  return Math.max(90, charBased + jitter); // 最短 1.5 秒
}

// 计算行间间隔（带随机波动）
function calcGap() {
  const jitter = Math.floor(Math.random() * GAP_JITTER * 2) - GAP_JITTER;
  return Math.max(8, BASE_GAP + jitter); // 最短 8 帧
}

// 每辆载具的聊天状态
const chatStates = new Map();

function getOrCreateState(vehicle) {
  if (!chatStates.has(vehicle)) {
    chatStates.set(vehicle, {
      // 当前对话链
      currentChain: null,
      lineIndex: 0,
      lineTimer: 0,
      gapTimer: 0,
      resolvedSpeakerSeat: -1,
      currentLineMaxTimer: 0,
      // 冷却
      cooldown: Math.floor(Math.random() * 300) + 300,
      // 上次播放的链索引，避免连续重复
      lastChainIndex: -1
    });
  }
  return chatStates.get(vehicle);
}

// 获取 AI 乘客的座位索引列表
function getAISeatIndices(vehicle) {
  const indices = [];
  for (let i = 0; i < vehicle.occupants.length; i++) {
    const occ = vehicle.occupants[i];
    if (occ && occ !== GameState.player && occ.alive) indices.push(i);
  }
  return indices;
}

// 判断当前是否处于交火状态（附近500px内有敌人）
function isCombatNearby(vehicle) {
  if (!GameState.player) return false;
  const range = 500;
  for (const enemy of GameState.enemies) {
    if (!enemy.alive) continue;
    if (Math.hypot(enemy.x - vehicle.x, enemy.y - vehicle.y) < range) return true;
  }
  return false;
}

// 选择一条对话链，根据战况加权，避免连续重复
function pickChain(state, inCombat) {
  let pool = VEHICLE_DIALOGUES;
  if (inCombat) {
    const combatChains = pool.filter(d => d.category === 'combat');
    if (combatChains.length > 0 && Math.random() < 0.55) {
      pool = combatChains;
    }
  }
  // 避免连续重复同一条链
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && idx === state.lastChainIndex) {
    idx = (idx + 1) % pool.length;
  }
  state.lastChainIndex = idx;
  return pool[idx];
}

// 确定说话者座位索引
function resolveSpeaker(speakerTag, aiSeats) {
  if (speakerTag === 'random') {
    return aiSeats[Math.floor(Math.random() * aiSeats.length)];
  } else if (speakerTag === 'A') {
    return aiSeats[0];
  } else {
    // 'B'
    return aiSeats.length > 1 ? aiSeats[1] : aiSeats[0];
  }
}

export const VehicleChatSystem = {
  update(vehicle) {
    if (!vehicle || !vehicle.alive) return;
    const state = getOrCreateState(vehicle);

    // 正在播放对话链
    if (state.currentChain) {
      // 行间间隔中
      if (state.gapTimer > 0) {
        state.gapTimer--;
        if (state.gapTimer <= 0) {
          // 进入下一行
          state.lineIndex++;
          if (state.lineIndex >= state.currentChain.lines.length) {
            // 链播放完毕，进入冷却
            state.currentChain = null;
            state.lineIndex = 0;
            state.lineTimer = 0;
            state.resolvedSpeakerSeat = -1;
            state.cooldown = COOLDOWN_MIN + Math.floor(Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN));
            return;
          }
          const nextLine = state.currentChain.lines[state.lineIndex];
          const nextDuration = calcLineDuration(nextLine ? nextLine.text : '');
          state.lineTimer = nextDuration;
          state.currentLineMaxTimer = nextDuration;
          // 预解析下一行的说话者座位
          const nextAiSeats = getAISeatIndices(vehicle);
          state.resolvedSpeakerSeat = resolveSpeaker(nextLine.speaker, nextAiSeats);
        }
        return;
      }

      // 当前行显示中
      if (state.lineTimer > 0) {
        state.lineTimer--;
        if (state.lineTimer <= 0) {
          // 当前行结束，进入间隔（随机波动）
          state.gapTimer = calcGap();
        }
        return;
      }
      return;
    }

    // 冷却中
    if (state.cooldown > 0) {
      state.cooldown--;
      return;
    }

    // 触发条件：>=2 名 AI 乘客
    const aiSeats = getAISeatIndices(vehicle);
    if (aiSeats.length < 2) return;

    const inCombat = isCombatNearby(vehicle);
    const chain = pickChain(state, inCombat);

    // 启动对话链
    state.currentChain = chain;
    state.lineIndex = 0;
    const firstDuration = calcLineDuration(chain.lines[0].text);
    state.lineTimer = firstDuration;
    state.currentLineMaxTimer = firstDuration;
    state.gapTimer = 0;
    // 预解析当前行的说话者座位（避免每帧随机）
    state.resolvedSpeakerSeat = resolveSpeaker(chain.lines[0].speaker, aiSeats);
  },

  /**
   * 获取指定座位当前应显示的气泡数据
   * @returns {{ text: string, timer: number, maxTimer: number, lineIndex: number, totalLines: number } | null}
   */
  getBubble(vehicle, seatIndex) {
    if (!vehicle) return null;
    const state = chatStates.get(vehicle);
    if (!state || !state.currentChain) return null;

    // 只在当前行显示期间返回气泡（间隔期不显示）
    if (state.gapTimer > 0) return null;
    if (state.lineTimer <= 0) return null;

    const line = state.currentChain.lines[state.lineIndex];
    if (!line) return null;

    if (state.resolvedSpeakerSeat !== seatIndex) return null;

    return {
      text: line.text,
      timer: state.lineTimer,
      maxTimer: state.currentLineMaxTimer || state.lineTimer,
      lineIndex: state.lineIndex,
      totalLines: state.currentChain.lines.length
    };
  },

  clear(vehicle) {
    chatStates.delete(vehicle);
  },

  // 清理已销毁载具的状态
  cleanup() {
    for (const [vehicle] of chatStates) {
      if (!vehicle.alive) chatStates.delete(vehicle);
    }
  }
};
