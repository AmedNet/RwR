// src/input/handlers/DebugHandler.js
// Debug面板的按键与点击处理
import { GameState } from '../../core/GameState.js';
import { Renderer } from '../../rendering/Renderer.js';
import { UIManager } from '../../rendering/UIManager.js';
import { LootRegistry, Rarity } from '../../core/LootRegistry.js';
import { LootPickup } from '../../entities/LootPickup.js';
import { playUISound } from '../../utils/SoundManager.js';
import { WeatherSystem } from '../../core/WeatherSystem.js';
import { DayNightSystem } from '../../core/DayNightSystem.js';
import { AmbientSoundManager } from '../../utils/AmbientSoundManager.js';

// ─── keydown 处理（Debug面板打开时） ───

export function handleDebugKeydown(e, key) {
    if (key === 'escape') {
        GameState.debugOpen = false;
        e.preventDefault();
        return true;
    }
    if (key === '1' && GameState.debugKey9Pressed) {
        GameState.debugOpen = false;
        GameState.debugKey9Pressed = false;
        e.preventDefault();
        return true;
    }
    return true; // Debug打开时吞噬所有按键
}

// ─── mousedown 处理（Debug面板点击） ───

export function handleDebugMousedown(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    const scaleX = logicalWidth / rect.width;
    const scaleY = logicalHeight / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Tab 切换
    if (Renderer.debugTabs) {
        for (const tab of Renderer.debugTabs) {
            if (clickX >= tab.x && clickX <= tab.x + tab.w &&
                clickY >= tab.y && clickY <= tab.y + tab.h) {
                GameState.debugTab = tab.id;
                playUISound('click');
                e.preventDefault();
                return true;
            }
        }
    }

    if (Renderer.ambientSlider) {
        const ambSlider = Renderer.ambientSlider;
        const ambHandleDist = Math.hypot(clickX - ambSlider.handleX, clickY - (ambSlider.y + ambSlider.h / 2));
        if (ambHandleDist < ambSlider.handleR + 5) {
            GameState.ambientSliderDragging = true;
            e.preventDefault();
            return true;
        }
        if (clickX >= ambSlider.x && clickX <= ambSlider.x + ambSlider.w &&
            clickY >= ambSlider.y - 10 && clickY <= ambSlider.y + ambSlider.h + 10) {
            const ratio = (clickX - ambSlider.x) / ambSlider.w;
            AmbientSoundManager.setMasterVolume(Math.max(0, Math.min(1, ratio)));
            e.preventDefault();
            return true;
        }
    }
    if (Renderer.debugSlider) {
        const slider = Renderer.debugSlider;
        const handleDist = Math.hypot(clickX - slider.handleX, clickY - (slider.y + slider.h / 2));
        if (handleDist < slider.handleR + 5) {
            GameState.debugSliderDragging = true;
            DayNightSystem.paused = true;
            e.preventDefault();
            return true;
        }
        if (clickX >= slider.x && clickX <= slider.x + slider.w &&
            clickY >= slider.y - 10 && clickY <= slider.y + slider.h + 10) {
            const ratio = (clickX - slider.x) / slider.w;
            DayNightSystem.setTime(Math.max(0, Math.min(1, ratio)));
            DayNightSystem.paused = true;
            e.preventDefault();
            return true;
        }
    }
    if (Renderer.debugButtons) {
        for (const btn of Renderer.debugButtons) {
            if (clickX >= btn.x && clickX <= btn.x + btn.w &&
                clickY >= btn.y && clickY <= btn.y + btn.h) {
                if (btn.value) {
                    GameState.rp += btn.value;
                    console.log(`🐛 增加 ${btn.value} RP`);
                    UIManager.updateAll(GameState);
                } else if (btn.action === 'heal') {
                    if (GameState.player) { GameState.player.health = GameState.player.maxHealth; console.log('🐛 满血'); }
                } else if (btn.action === 'rankUp') {
                    if (GameState.player) { GameState.player.addRank(); console.log(`🐛 军衔提升! ${GameState.player.getRankName()}`); }
                } else if (btn.weather) {
                    WeatherSystem.setWeather(btn.weather);
                } else if (btn.action === 'toggleDayNight') {
                    DayNightSystem.togglePause();
                    console.log(DayNightSystem.paused ? '⏸ 昼夜循环暂停' : '▶ 昼夜循环继续');
                } else if (btn.action === 'toggleTornadoRadar') {
                    GameState.debugShowTornado = !GameState.debugShowTornado;
                } else if (btn.action === 'toggleFPS') {
                    GameState.debugShowFPS = !GameState.debugShowFPS;
                    console.log(GameState.debugShowFPS ? '🐛 帧率显示开启' : '🐛 帧率显示关闭');
                    console.log(GameState.debugShowTornado ? '🐛 龙卷风雷达开启' : '🐛 龙卷风雷达关闭');
                } else if (btn.action === 'spawnLoot') {
                    const player = GameState.player;
                    if (player) {
                        const items = Object.values(LootRegistry).filter(i => i.rarity === btn.rarity);
                        if (items.length > 0) {
                            const item = items[Math.floor(Math.random() * items.length)];
                            const offsetX = (Math.random() - 0.5) * 80;
                            const offsetY = (Math.random() - 0.5) * 80;
                            GameState.lootPickups.push(new LootPickup(player.x + offsetX, player.y + offsetY, item.id));
                            console.log(`🎁 刷出 ${item.name}`);
                        }
                    }
                } else if (btn.action === 'spawnAllLoot') {
                    const player = GameState.player;
                    if (player) {
                        const rarities = [Rarity.COMMON, Rarity.UNCOMMON, Rarity.RARE, Rarity.LEGENDARY];
                        let count = 0;
                        for (const rarity of rarities) {
                            const items = Object.values(LootRegistry).filter(i => i.rarity === rarity);
                            if (items.length > 0) {
                                const item = items[Math.floor(Math.random() * items.length)];
                                const angle = (count / 4) * Math.PI * 2;
                                const dist = 60;
                                const offsetX = Math.cos(angle) * dist;
                                const offsetY = Math.sin(angle) * dist;
                                GameState.lootPickups.push(new LootPickup(player.x + offsetX, player.y + offsetY, item.id));
                                count++;
                            }
                        }
                        console.log('🌟 刷出 4 个战利品');
                    }
                }
                break;
            }
        }
    }
    e.preventDefault();
    return true;
}