// src/utils/AmbientSoundManager.js
// 环境音效管理器 - 三层混音：天气 + 昼夜 + 地形
// 使用 Web Audio API 实现无缝循环播放
import { WeatherSystem } from '../core/WeatherSystem.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { GameState } from '../core/GameState.js';
import { Terrain } from '../core/Map.js';
import { getAudioContext, getMasterBus } from './SoundManager.js';

const BASE = 'src/pkg/sounds/';

// 天气→循环音效映射（id + 目标音量）
const WEATHER_CHANNELS = {
    sunny:        [],
    cloudy:       [],
    overcast:     [{ id: 'heavy-rain', vol: 0.12 }],
    lightRain:    [{ id: 'light-rain', vol: 0.45 }],
    rain:         [{ id: 'heavy-rain', vol: 0.3 }],
    heavyRain:    [{ id: 'heavy-rain', vol: 0.55 }],
    fog:          [],
    mistyRain:    [{ id: 'light-rain', vol: 0.3 }],
    snow:         [{ id: 'wind', vol: 0.18 }],
    blizzard:     [{ id: 'howling-wind', vol: 0.45 }],
    windStorm:    [{ id: 'howling-wind', vol: 0.4 }],
    sandstorm:    [{ id: 'wind', vol: 0.35 }, { id: 'white-noise', vol: 0.18 }],
    thunderstorm: [{ id: 'heavy-rain', vol: 0.5 }],
    hail:         [{ id: 'heavy-rain', vol: 0.35 }, { id: 'white-noise', vol: 0.12 }],
    acidRain:     [{ id: 'heavy-rain', vol: 0.45 }],
    bloodMoon:    [],
    eclipse:      [],
    tornado:      [{ id: 'howling-wind', vol: 0.55 }, { id: 'brown-noise', vol: 0.25 }]
};

// 天气→随机雷声配置（间隔秒数, 音量）
const WEATHER_THUNDER = {
    thunderstorm: { minSec: 15, maxSec: 40, vol: 0.5 },
    hail:         { minSec: 25, maxSec: 60, vol: 0.3 }
};

// 所有音效文件路径
const SOUND_FILES = {
    'light-rain':    BASE + 'weather/light-rain.mp3',
    'heavy-rain':    BASE + 'weather/heavy-rain.mp3',
    'thunder':       BASE + 'weather/thunder.mp3',
    'howling-wind':  BASE + 'weather/howling-wind.mp3',
    'wind':          BASE + 'weather/wind.mp3',
    'white-noise':   BASE + 'weather/white-noise.wav',
    'brown-noise':   BASE + 'weather/brown-noise.wav',
    'birds':         BASE + 'ambient/birds.mp3',
    'crickets':      BASE + 'ambient/crickets.mp3',
    'owl':           BASE + 'ambient/owl.mp3',
    'river':         BASE + 'ambient/river.mp3',
    'waves':         BASE + 'ambient/waves.mp3',
    'wind-in-trees': BASE + 'ambient/wind-in-trees.mp3'
};



// ─── 循环通道（Web Audio API 无缝循环） ───
class Channel {
    constructor(id) {
        this.id = id;
        this.url = SOUND_FILES[id];
        this.buffer = null;
        this.source = null;
        this.gainNode = null;
        this.loaded = false;
        this.playing = false;
        this.targetVol = 0;
        this.currentVol = 0;
        this.baseVol = 1.0;
        this._load();
    }

    async _load() {
        const ctx = getAudioContext();
        if (!ctx) return;
        try {
            const response = await fetch(this.url);
            const arrayBuffer = await response.arrayBuffer();
            this.buffer = await ctx.decodeAudioData(arrayBuffer);
            this.loaded = true;
        } catch (e) {
            console.warn('Failed to load ambient sound: ' + this.url, e);
        }
    }

    setTarget(vol) {
        this.targetVol = Math.max(0, Math.min(1, vol));
    }

    update(masterVol) {
        const ctx = getAudioContext();
        if (!ctx || !this.loaded) return;

        const target = Math.min(1, Math.max(0, this.targetVol * this.baseVol * masterVol));
        // 平滑过渡
        this.currentVol += (target - this.currentVol) * 0.04;

        if (this.targetVol > 0 && !this.playing) {
            this._start(ctx);
        }

        if (this.gainNode) {
            this.gainNode.gain.value = this.currentVol;
        }

        if (this.currentVol < 0.003 && this.targetVol <= 0 && this.playing) {
            this._stop();
        }
    }

    _start(ctx) {
        if (this.playing) return;
        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = 0;
        this.gainNode.connect(getMasterBus());

        this.source = ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true;
        this.source.connect(this.gainNode);
        this.source.start(0);
        this.playing = true;
    }

    _stop() {
        if (this.source) {
            try { this.source.stop(); this.source.disconnect(); } catch (e) {}
            this.source = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        this.playing = false;
    }
}

// ─── 一次性播放（雷声、猫头鹰、鸟叫） ───
function playOneShot(id, vol, maxDuration, fadeOut) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const channel = AmbientSoundManager.channels[id];
    if (!channel || !channel.loaded) return;

    const source = ctx.createBufferSource();
    source.buffer = channel.buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1, vol);
    source.connect(gain);
    gain.connect(getMasterBus());

    // Random start offset within the buffer for variety
    const bufLen = channel.buffer.duration;
    const dur = maxDuration ? Math.min(maxDuration, bufLen) : bufLen;
    const offset = bufLen > dur ? Math.random() * (bufLen - dur) : 0;
    source.start(0, offset, dur);

    // Smooth fade-out to avoid abrupt cutoff
    if (fadeOut && dur > 0.5) {
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(Math.min(1, vol), now);
        gain.gain.linearRampToValueAtTime(0, now + dur - 0.1);
    }
}

// ─── 收集所有天气相关通道 ID ───
const ALL_WEATHER_IDS = new Set();
for (const arr of Object.values(WEATHER_CHANNELS)) {
    for (const ch of arr) ALL_WEATHER_IDS.add(ch.id);
}

// ─── 管理器 ───
export const AmbientSoundManager = {
    masterVolume: 0.3,
    channels: {},
    initialized: false,
    _lastWeather: '',
    _owlTimer: 0,
    _owlInterval: 0,
    _birdTimer: 0,
    _birdInterval: 0,
    _thunderTimer: 0,
    _thunderInterval: 0,

    init() {
        for (const id of Object.keys(SOUND_FILES)) {
            this.channels[id] = new Channel(id);
        }
        this._resetOwlTimer();
        this._resetThunderTimer();
        this._resetBirdTimer();
        this.initialized = true;
        console.log('🔊 环境音效管理器初始化完成（Web Audio API 无缝循环）');
    },

    _resetOwlTimer() {
        this._owlInterval = 1800 + Math.floor(Math.random() * 3600);
        this._owlTimer = 0;
    },
    _resetBirdTimer() {
        this._birdInterval = 1800 + Math.floor(Math.random() * 3800);
        this._birdTimer = 0;
    },
    _resetThunderTimer() {
        this._thunderInterval = 900 + Math.floor(Math.random() * 1500);
        this._thunderTimer = 0;
    },

    setMasterVolume(v) {
        this.masterVolume = Math.max(0, Math.min(1, v));
    },

    update() {
        if (!this.initialized) return;
        this._updateWeather();
        this._updateDayNight();
        this._updateTerrain();
        this._updateThunder();
        this._updateBirds();
        this._updateOwl();
        for (const ch of Object.values(this.channels)) {
            ch.update(this.masterVolume);
        }
    },

    _updateWeather() {
        const weather = WeatherSystem.current;
        if (weather === this._lastWeather) return;
        this._lastWeather = weather;
        const targets = {};
        const channels = WEATHER_CHANNELS[weather] || [];
        for (const ch of channels) {
            targets[ch.id] = ch.vol;
        }
        for (const id of ALL_WEATHER_IDS) {
            this.channels[id].setTarget(targets[id] || 0);
        }
    },

    _updateDayNight() {
        const t = DayNightSystem.timeOfDay;
        let cricketsVol = 0;
        if (t >= 0.2 && t < 0.25) {
            const p = (t - 0.2) / 0.05;
            cricketsVol = 0.25 * (1 - p);
        } else if (t >= 0.7 && t < 0.8) {
            const p = (t - 0.7) / 0.1;
            cricketsVol = 0.25 * p;
        } else if (t < 0.2 || t >= 0.8) {
            cricketsVol = 0.25;
        }
        this.channels['birds'].setTarget(0);
        this.channels['crickets'].setTarget(cricketsVol);
    },

    _updateTerrain() {
        const player = GameState.player;
        const map = GameState.map;
        if (!player || !player.alive || !map) return;
        const { col, row } = map.worldToTile(player.x, player.y);
        const radius = 3;
        let riverCount = 0;
        let forestCount = 0;
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const tile = map.getTile(col + dc, row + dr);
                if (tile === Terrain.RIVER) riverCount++;
                if (tile === Terrain.FOREST) forestCount++;
            }
        }
        let riverVol = 0;
        let wavesVol = 0;
        let forestVol = 0;
        if (riverCount > 0) {
            riverVol = Math.min(0.4, riverCount * 0.08);
            if (riverCount > 5) wavesVol = Math.min(0.2, (riverCount - 5) * 0.04);
        }
        if (forestCount > 0) {
            forestVol = Math.min(0.3, forestCount * 0.06);
        }
        this.channels['river'].setTarget(riverVol);
        this.channels['waves'].setTarget(wavesVol);
        this.channels['wind-in-trees'].setTarget(forestVol);
    },

    _updateThunder() {
        const weather = WeatherSystem.current;
        const def = WEATHER_THUNDER[weather];
        if (!def) { this._thunderTimer = 0; return; }
        this._thunderTimer++;
        if (this._thunderTimer >= this._thunderInterval) {
            playOneShot('thunder', def.vol * this.masterVolume);
            this._thunderInterval = (def.minSec + Math.random() * (def.maxSec - def.minSec)) * 60;
            this._thunderTimer = 0;
        }
    },

    _updateBirds() {
        const t = DayNightSystem.timeOfDay;
        const isDaytime = t >= 0.25 && t < 0.7;
        if (!isDaytime) { this._birdTimer = 0; return; }
        this._birdTimer++;
        if (this._birdTimer >= this._birdInterval) {
            playOneShot('birds', 0.1 * this.masterVolume, 3 + Math.random() * 2, true);
            this._resetBirdTimer();
        }
    },

    _updateOwl() {
        const t = DayNightSystem.timeOfDay;
        const isDeepNight = t < 0.2 || t > 0.85;
        if (!isDeepNight) { this._owlTimer = 0; return; }
        this._owlTimer++;
        if (this._owlTimer >= this._owlInterval) {
            playOneShot('owl', 0.25 * this.masterVolume, 4 + Math.random() * 2, true);
            this._resetOwlTimer();
        }
    }
};
