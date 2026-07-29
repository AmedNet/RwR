// src/modes/MenuBattle.js
// 菜单背景战斗：两军 AI 对战 + Lissajous 旁观漫游摄像机 + 分片预热。
// 从 main.js 抽出。首次进菜单（onFirstGesture）与游戏内退出到主菜单（quitToMenu）共用。
import { GameState } from '../core/GameState.js';
import { Player } from '../entities/Player.js';
import { Renderer } from '../rendering/Renderer.js';
import { Minimap } from '../rendering/Minimap.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { tickWorld } from '../systems/WorldTick.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { AmbientSoundManager } from '../utils/AmbientSoundManager.js';
import { SupportSystem } from '../core/SupportSystem.js';
import { GAME_CONSTANTS } from '../data/GameConfig.js';
import { startMenuMusic, stopVehicleEngine, muteBattleSfx } from '../utils/SoundManager.js';
import { getMenuMusicArrayBuffer } from '../core/AssetLoader.js';
import { initMap, initCapturePoints, spawnTeammate, updateTeammateRespawns } from '../systems/WorldBuilder.js';

// ─── 主菜单背景战斗调参 ───
const MENU_CAMERA_ZOOM = 0.7;    // 菜单摄像机缩放（<1 放宽视野，看到更大战场）
const MENU_WARMUP_FRAMES = 480;  // 进菜单预热模拟总帧数（~8s；两军贴脸接火，预热积累血迹/伤亡/战线，呈现「打了一阵」）
const MENU_WARMUP_BATCH = 30;    // warming 阶段每帧跑的预热步数（分片到多帧，480/30≈16 帧≈0.27s，不冻主线程）
const MENU_ENEMY_COUNT = 15;     // 背景战斗红队初始数量（匹配蓝队，打出像样的拉锯）
// 旁观漫游镜头：纯 Lissajous 正弦漫游，中心锚定在战场（setupBackgroundBattle 记录的交火点）。
// 位置是「时间」的纯函数 → 数学上连续可导：绝对平滑（不抖动/不乱动）、速度均匀、永不停留；
// X/Y 频率不可公度 → 轨迹永不重复，看起来像随机漫游。不读任何逐帧游戏状态，杜绝抖动源。
const MENU_CAM_FREQ_X = 0.050;   // X 正弦频率（弧度/秒，周期~126s）——缓慢横扫
const MENU_CAM_FREQ_Y = 0.037;   // Y 正弦频率（弧度/秒，周期~170s，与 X 不可公度→不重复）
const MENU_CAM_PHASE_Y = 1.7;    // Y 初相位（与 X 错开，轨迹不塌成直线）
const MENU_CAM_DRIFT = 0.35;     // 漫游振幅（单位：可视宽度倍数）——极值时交火点恰在屏缘，战场始终大部分在画面内
let menuBattleCenter = null;     // 背景战斗交火中心（setupBackgroundBattle 写入；摄像机漫游锚点）
let menuWarmupRemaining = 0;     // warming 阶段剩余预热帧数（beginMenuWarmup 设置，updateMenuWarmup 分帧消费）

// ---------- 世界模拟一步（不含摄像机；预热与每帧共用） ----------
// 关键差异（对比 gameLoop 的 playing 分支）：
//  - 不调 player.update()（dummy 玩家 alive=false，tickWorld(false) 跳过）
//  - 必含 capturePoints[i].update()（驱动 AI 攻防角色，player-null-safe）
//    与 updateTeammateRespawns()（蓝队阵亡后重生，否则战斗会熄火成纯红队）
export function stepMenuSimulation() {
    // 环境系统（boot 阶段已 init，此处运行安全）
    EffectsManager.update();
    WeatherSystem.update();
    DayNightSystem.update();
    AmbientSoundManager.update();
    SupportSystem.update();

    // 据点推进（驱动 AI 攻防角色切换）
    for (const point of GameState.capturePoints) {
        point.update();
    }

    // 敌方补员：红队被全歼且已无红方据点（spawnEnemy 会返回 null）时，
    // 在蓝队重心附近补一波，避免背景战斗彻底熄火（用户未要求循环，此为低强度维持）
    if (GameState.enemies.length === 0) {
        const hasEnemyPoint = GameState.capturePoints.some(p => p.owner === 'enemy');
        if (!hasEnemyPoint && GameState.teammates.length > 0) {
            let cx = 0, cy = 0;
            for (const t of GameState.teammates) { cx += t.x; cy += t.y; }
            cx /= GameState.teammates.length;
            cy /= GameState.teammates.length;
            SpawnSystem.spawnCustomWave({ count: 6, x: cx, y: cy, radius: 320 });
        }
    }

    // 实体更新 + 碰撞 + 死亡过滤（不含玩家）
    tickWorld(false);

    // 蓝队重生（防熄火）
    updateTeammateRespawns();
}

// ---------- 菜单摄像机：纯 Lissajous 平滑漫游（锚定战场，连续不停、绝不抖动） ----------
// 位置 = 战场中心 + 两组不同频率正弦偏移，是时间的纯函数：平滑、匀速、不停、轨迹永不重复。
// 不追逐任何逐帧变化的目标（旧版追「重心」会因单位阵亡/重生而跳 → 抖动），从根上消除乱动。
// 几何：camera.x/y 是镜头左上角世界坐标 = 镜头中心 - 可视半宽；夹取边距按 zoom<1 推导。
function updateMenuCamera() {
    const world = GameState.world;
    const vw = Renderer.width;
    const vh = Renderer.height;
    const zoom = MENU_CAMERA_ZOOM;
    GameState.camera.zoom = zoom;
    GameState.camera.targetZoom = zoom;

    // zoom<1 的安全夹取边距（缩放绕屏幕中心）：保证缩小后边缘不露地图外空白
    const marginLeft = vw * (1 - zoom) / (2 * zoom);
    const marginRight = vw * (1 + zoom) / (2 * zoom);
    const marginTop = vh * (1 - zoom) / (2 * zoom);
    const marginBottom = vh * (1 + zoom) / (2 * zoom);
    const minX = marginLeft, maxX = Math.max(marginLeft, world.width - marginRight);
    const minY = marginTop, maxY = Math.max(marginTop, world.height - marginBottom);

    // 漫游锚点：背景战斗的交火中心（无则回落地图中心）
    const anchorX = menuBattleCenter ? menuBattleCenter.x : world.width / 2;
    const anchorY = menuBattleCenter ? menuBattleCenter.y : world.height / 2;

    // 振幅按可视尺寸自适应（zoom 越小可视越宽，漫游范围随之放大）
    const ampX = (vw / zoom) * MENU_CAM_DRIFT;
    const ampY = (vh / zoom) * MENU_CAM_DRIFT;

    // 纯时间驱动正弦漫游：平滑、匀速、不停、永不重复
    const t = performance.now() / 1000;
    const centerX = anchorX + ampX * Math.sin(t * MENU_CAM_FREQ_X);
    const centerY = anchorY + ampY * Math.sin(t * MENU_CAM_FREQ_Y + MENU_CAM_PHASE_Y);

    // 镜头左上角 = 中心 - 可视半宽，夹取到地图内（安全兜底）
    GameState.camera.x = Math.max(minX, Math.min(maxX, centerX - vw / 2));
    GameState.camera.y = Math.max(minY, Math.min(maxY, centerY - vh / 2));
    GameState.camera.offsetX = 0;
    GameState.camera.offsetY = 0;
}

// ---------- 菜单阶段每帧：模拟一步 + 摄像机漂移 ----------
export function updateMenuBattle() {
    stepMenuSimulation();
    updateMenuCamera();
}

// ---------- 预热：跑一帧分片预热，返回是否已全部跑完 ----------
// gameLoop 的 warming 分支每帧调用；跑完后由调用方切 phase='menu' 并归零出现动画。
export function updateMenuWarmup() {
    for (let i = 0; i < MENU_WARMUP_BATCH && menuWarmupRemaining > 0; i++) {
        stepMenuSimulation();
        menuWarmupRemaining--;
    }
    return menuWarmupRemaining <= 0;
}

// ---------- 主菜单音频：静音战斗/环境音，仅保留主总线上的菜单音乐 ----------
// sfx 子总线（枪械/爆炸/载具）置 0、环境音主音量置 0；进入游玩时由 applyAudio() 依据 Settings 恢复。
// 须在 warming 阶段的预热模拟之前调用，否则预热产生的枪声会漏出来。
function enterMenuAudio() {
    muteBattleSfx();
    AmbientSoundManager.setMasterVolume(0);
}

// ---------- 搭建背景 AI 战斗（首次进菜单 与 游戏内退出到主菜单 共用） ----------
function setupBackgroundBattle() {
    GameState.reset(); // 清实体/UI 状态（不重置 map/capturePoints/weather/camera/phase）

    const config = GameState.config;
    const world = GameState.world;

    // 假玩家：alive=false → CollisionSystem.checkAll 不 bail（非空），但全代码库对其惰性，
    // 敌人索敌/敌方子弹/载具撞击/医疗光环全跳过它，因此菜单里 gameOver 不可达（P1-5）。
    const dummy = new Player(world.width / 2, world.height / 2, config.player);
    dummy.alive = false;
    GameState.player = dummy;

    // 两军贴着「离地图中心最近的据点」分列两侧出生 → 开局即接火。
    // 真实对局蓝队左半/红队右半相隔上万像素，预热帧数不够它们相遇，全程在赶路 → 看着像刚开局。
    // 菜单只需「打了一阵」的观感：选一个居中据点当争夺焦点，两军贴脸出生，预热即打出交火/血迹/伤亡。
    let anchor = null, bestD = Infinity;
    for (const p of GameState.capturePoints) {
        const d = Math.hypot(p.x - world.width / 2, p.y - world.height / 2);
        if (d < bestD) { bestD = d; anchor = p; }
    }
    const ax = anchor ? anchor.x : world.width / 2;
    const ay = anchor ? anchor.y : world.height / 2;
    menuBattleCenter = { x: ax, y: ay }; // 记录交火中心，供菜单摄像机锚定漫游

    // 蓝队（己方）：据点左侧出生，minDist 收小让队形贴紧、确保进感知范围即交火
    const bluePoint = { x: ax - 220, y: ay };
    for (let i = 0; i < GAME_CONSTANTS.INITIAL_TEAMMATES; i++) {
        const t = spawnTeammate(bluePoint, 60);
        if (t) {
            SpawnSystem.equipTeammate(t);
            GameState.teammates.push(t);
        }
    }

    // 红队（敌方）：据点右侧出生。spawnCustomWave 不依赖敌方据点、自带 push，数量匹配蓝队
    SpawnSystem.spawnCustomWave({ count: MENU_ENEMY_COUNT, x: ax + 220, y: ay, radius: 260 });

    // 小地图 canvas 直接挂在 document.body 上（不在 #hud 内），Renderer 隐藏 #hud 不会连带隐藏它；
    // playing→menu 经此函数，须显式隐藏，否则退出到主菜单后小地图残留（Minimap.render 仅 playing 调用）
    Minimap.canvas.style.display = 'none';

    // 预热模拟改由 warming 阶段分片执行（beginMenuWarmup + updateMenuWarmup），不在此同步跑，避免冻主线程
}

// ---------- 进入预热阶段：把背景战斗预热分片到多帧（消除进菜单卡顿） ----------
// 仅设置余量 + 切 phase；实际模拟步由 gameLoop 的 warming 分支每帧调 updateMenuWarmup，跑完进 menu。
function beginMenuWarmup() {
    menuWarmupRemaining = MENU_WARMUP_FRAMES;
    GameState.phase = 'warming';
}

// ---------- 首次手势：presskey → menu（按键顺带解锁浏览器音频锁） ----------
export function onFirstGesture() {
    if (GameState.phase !== 'presskey') return;
    enterMenuAudio();                          // 先静音战斗/环境音（预热模拟也在静音下进行）
    setupBackgroundBattle();                   // 搭建两军（不含预热循环）
    startMenuMusic(getMenuMusicArrayBuffer()); // 菜单背景音乐起
    beginMenuWarmup();                         // 分片预热 → warming 阶段（跑完自动进 menu）
    console.log('🎮 进入主菜单');
}

// ---------- 游戏内暂停菜单「退出到主菜单」 ----------
export function quitToMenu() {
    // 停掉所有载具引擎音（engine voice 以 vehicle 引用为 key，reset() 只清数组不停音，
    // 否则 mounted 状态下退出会让引擎声在菜单里无限循环）—— 须在 reset 清空 vehicles 前执行
    for (const v of GameState.vehicles) stopVehicleEngine(v);

    // 来自快速模式：当前是小地图且无据点，菜单背景战斗需要标准大地图+据点，退出时重建
    if (GameState.mode === 'quick') {
        initMap();
        initCapturePoints();
    }
    GameState.mode = 'battle';

    // setupBackgroundBattle 内的 reset() 已清 paused/settingsOpen/dialogueOpen，
    // 避免冻结门把菜单背景战斗冻住（P1-7）
    enterMenuAudio();                          // 静音战斗/环境音（预热模拟也在静音下进行）
    setupBackgroundBattle();
    startMenuMusic(getMenuMusicArrayBuffer());
    beginMenuWarmup();                         // 分片预热 → warming 阶段（跑完自动进 menu）
    console.log('🚪 退出到主菜单');
}
