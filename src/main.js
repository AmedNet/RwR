// src/main.js
// 应用入口：系统引导（bootSystems）+ 主循环（gameLoop）+ 全局事件注册 +
// 战地模式开局（startMatch）/ 重置（resetGame）/ 重生（respawnPlayer）。
// 模式与世界构建逻辑已拆分到：
//   systems/WorldBuilder.js —— 地图/据点/军械库/载具/队友生成
//   systems/WorldTick.js    —— 实体更新 + 碰撞 + 死亡过滤（playing 与菜单共用）
//   modes/QuickMode.js      —— 快速模式（死斗）
//   modes/MenuBattle.js     —— 菜单背景战斗 + 漫游摄像机 + 预热
import { GameState } from './core/GameState.js';
import { Weapon } from './core/Weapon.js';
import { EventBus } from './core/EventBus.js';
import { Player } from './entities/Player.js';
import { Renderer } from './rendering/Renderer.js';
import { UIManager } from './rendering/UIManager.js';
import { InputManager, setFirstGestureHandler } from './input/InputManager.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { Minimap } from './rendering/Minimap.js';
import { EffectsManager } from './utils/EffectsManager.js';
import {
    setListenerProvider, playRadioOpen, playRadioClose,
    stopMenuMusic, setFocusMuted,
} from './utils/SoundManager.js';
import { BurnEffect, STATUS_EFFECT_CONFIG } from './utils/StatusEffects.js';
import { WeatherSystem } from './core/WeatherSystem.js';
import { DayNightSystem } from './core/DayNightSystem.js';
import { AmbientSoundManager } from './utils/AmbientSoundManager.js';
import { SupportSystem } from './core/SupportSystem.js';
import { DialogueSystem } from './utils/DialogueSystem.js';
import { generateBriefing } from './data/BriefingDialogues.js';
import { preloadAssets } from './core/AssetLoader.js';
import { setMenuActions } from './input/handlers/MainMenuHandler.js';
import { setQuickResultActions } from './input/handlers/QuickResultHandler.js';
import { setQuitToMenu } from './input/handlers/PauseHandler.js';
import { CONFIG, GAME_CONSTANTS } from './data/GameConfig.js';
import { Settings, applyGraphics, applyAudio } from './data/Settings.js';
// ---------- 拆分模块 ----------
import {
    initMap, initCapturePoints, initVehicles, updateVehicleSpawns,
    spawnTeammate, updateTeammateRespawns, getPlayerPoints,
} from './systems/WorldBuilder.js';
import { tickWorld } from './systems/WorldTick.js';
import { startQuickMatch, retryQuickMatch, checkQuickWinLoss } from './modes/QuickMode.js';
import { updateMenuBattle, updateMenuWarmup, onFirstGesture, quitToMenu } from './modes/MenuBattle.js';

// ---------- 战地模式：胜利战报（占领全部据点触发；可关闭，关闭后继续游玩） ----------
function triggerBattleReport() {
    GameState.battleReport = 'victory';
    GameState.battleReportShown = true;   // 一局只触发一次，关闭后不再弹
    GameState.appear.battleReport.progress = 0;
    GameState.appear.battleReport._lastTime = null;
    console.log('🏆 战地模式胜利：占领全部据点');
}

// ---------- 重置游戏 ----------
function resetGame() {
    GameState.reset();
    const config = GameState.config;

    // 寻找最近的己方据点，如果没有则回中心
    let spawnX = GameState.world.width / 2;
    let spawnY = GameState.world.height / 2;
    let minDist = Infinity;

    for (const point of GameState.capturePoints) {
        if (point.owner === 'player') {
            const d = Math.hypot(point.x - spawnX, point.y - spawnY);
            if (d < minDist) {
                minDist = d;
                spawnX = point.x;
                spawnY = point.y;
            }
        }
    }

    // 创建玩家
    GameState.player = new Player(spawnX, spawnY, config.player);

    // 初始队友（15人），分散到各个己方据点（至少250像素外）
    const playerPoints = getPlayerPoints();
    for (let i = 0; i < GAME_CONSTANTS.INITIAL_TEAMMATES; i++) {
        // 轮流在各个据点生成，保持最小距离
        const spawnPoint = playerPoints.length > 0 ? playerPoints[i % playerPoints.length] : null;
        const t = spawnTeammate(spawnPoint, GAME_CONSTANTS.TEAMMATE_SPAWN_MIN_DIST);
        if (t) {
            SpawnSystem.equipTeammate(t);
            GameState.teammates.push(t);
        }
    }

    // 初始敌人
    for (let i = 0; i < GAME_CONSTANTS.INITIAL_ENEMIES; i++) {
        GameState.enemies.push(SpawnSystem.spawnEnemy());
    }
    GameState.gameOver = false;
    // 清死亡弹出动画状态（与 respawnPlayer 同步，防止重置后死亡跳过动画）
    GameState.appear.gameOver.delay = 0;
    GameState.appear.gameOver.progress = 0;
    GameState.appear.gameOver._lastTime = null;
    UIManager.updateAll(GameState);
    console.log('🔄 游戏重置完成，重生在据点');
}

// ---------- 游戏循环 ----------
function gameLoop() {
    // FPS计算
    const now = performance.now();
    GameState._fpsFrames++;
    if (now - GameState._fpsLastTime >= 1000) {
        GameState.fps = GameState._fpsFrames;
        GameState._fpsFrames = 0;
        GameState._fpsLastTime = now;
    }

    // ─── 阶段门控（loading / presskey / warming / menu / playing） ───
    // loading / presskey：只渲染对应界面，绝不跑任何世界 update
    // （天气/昼夜/支援等系统虽已 boot init，但此阶段无地图/实体，渲染纯 2D 界面即可）
    if (GameState.phase === 'loading' || GameState.phase === 'presskey') {
        Renderer.render();
        requestAnimationFrame(gameLoop);
        return;
    }
    // warming：背景战斗分片预热（每帧跑一批 stepMenuSimulation，跑完进 menu）
    // 界面沿用 presskey 屏（底部显示「正在生成战场…」），把原同步 900 帧循环拆到多帧，消除进菜单卡顿
    if (GameState.phase === 'warming') {
        if (updateMenuWarmup()) {
            // 预热完成 → 进菜单（出现动画从头淡入；摄像机首帧由 updateMenuCamera 定位）
            GameState.appear.mainMenu.progress = 0;
            GameState.appear.mainMenu._lastTime = null;
            GameState.phase = 'menu';
        }
        Renderer.render();
        requestAnimationFrame(gameLoop);
        return;
    }
    // menu：背景 AI 战斗独立更新块（不含玩家逻辑）+ 渲染
    // （小地图仅游玩阶段显示，Minimap.render 内部 guard phase!=='playing'，此分支无需调用）
    if (GameState.phase === 'menu') {
        updateMenuBattle();
        Renderer.render();
        requestAnimationFrame(gameLoop);
        return;
    }

    // ─── playing 阶段 ───
    // 暂停/对话/战报冻结：跳过所有世界 update（特效/天气/昼夜/环境音/支援/摄像机/实体/碰撞），
    // 但仍 render —— 暂停菜单/设置面板/对话框/战报动画是渲染函数内自驱 deltaTime，照常推进
    if (GameState.panels.pause.open || GameState.panels.dialogue.open || GameState.battleReport) {
        Renderer.render();
        Minimap.render();
        requestAnimationFrame(gameLoop);
        return;
    }

    // 本局游玩计时（冻结期不计入；战报「用时」统计用）
    GameState.matchFrames++;

    // 环境系统：特效（粒子、伤害数字）/ 天气 / 昼夜 / 环境音 / 支援
    EffectsManager.update();
    WeatherSystem.update();
    DayNightSystem.update();
    AmbientSoundManager.update();
    SupportSystem.update();

    // G键长按检测（打开/关闭电台）—— 仅 playing 阶段（menu 阶段输入已被 InputManager 门控，此处显式守卫双保险）
    if (GameState.phase === 'playing' && GameState.radioGKeyPressed && !GameState.radioGKeyConsumed && !GameState.gameOver) {
        GameState.radioGKeyTimer++;
        if (GameState.radioGKeyTimer >= 18) {
            if (GameState.panels.radio.open) {
                GameState.toggleRadio();
                playRadioClose();
            } else {
                const player = GameState.player;
                if (player && (player.rank + 1) >= 2) {
                    GameState.toggleRadio();
                    playRadioOpen();
                    GameState.radioSelectedIndex = 0;
                    GameState.radioScrollOffset = 0;
                    const cam = GameState.camera;
                    const zoom = cam.zoom || 1;
                    const offsetX = cam.offsetX || 0;
                    const offsetY = cam.offsetY || 0;
                    const canvas = document.getElementById('gameCanvas');
                    const canvasW = canvas ? canvas.clientWidth : 800;
                    const canvasH = canvas ? canvas.clientHeight : 600;
                    const cx = canvasW / 2;
                    const cy = canvasH / 2;
                    GameState.radioTargetWorld = {
                        x: (GameState.mouse.x - cx * (1 - zoom) + offsetX) / zoom + cam.x,
                        y: (GameState.mouse.y - cy * (1 - zoom) + offsetY) / zoom + cam.y
                    };
                } else {
                    // 权限不足：左下角弹出 call_nohave.png 提示
                    // 已在显示则从头弹一遍（progress 归零），避免半路重弹造成的跳变
                    GameState.panels.radioNoPermit.open = true;
                    GameState.panels.radioNoPermit.direction = 'opening';
                    GameState.panels.radioNoPermit.progress = 0;
                    GameState.panels.radioNoPermit.showTimer = 0;
                    GameState.panels.radioNoPermit._lastTime = null;
                }
            }
            GameState.radioGKeyConsumed = true;
            GameState.radioGKeyTimer = 0;
        }
    }

    // 敌方AI支援决策（快速模式禁用：死斗不可召唤援军，否则"杀光=赢"无法达成）
    if (!GameState.gameOver && GameState.mode !== 'quick') {
        const aiDecision = SupportSystem.aiShouldCallSupport();
        if (aiDecision) {
            SupportSystem.enemyCallSupport(aiDecision.type, aiDecision.x, aiDecision.y);
        }
    }

    // 更新摄像机（跟随玩家，仅 playing 阶段；menu 阶段的漂移摄像机在 updateMenuBattle 内独立驱动）
    if (GameState.phase === 'playing' && GameState.player && !GameState.gameOver) {
        const player = GameState.player;
        const world = GameState.world;
        const canvasWidth = Renderer.width;
        const canvasHeight = Renderer.height;
        let targetX = player.x - canvasWidth / 2;
        let targetY = player.y - canvasHeight / 2;
        targetX = Math.max(0, Math.min(world.width - canvasWidth, targetX));
        targetY = Math.max(0, Math.min(world.height - canvasHeight, targetY));
        GameState.camera.x = targetX;
        GameState.camera.y = targetY;

        // 平滑归零 camera offset
        GameState.camera.offsetX *= 0.9;
        GameState.camera.offsetY *= 0.9;
    }

    // 更新据点（无论是否阵亡都继续）
    for (const point of GameState.capturePoints) {
        point.update();
    }
    // 据点刷新吉普（上限内、炸毁后自动补刷）
    updateVehicleSpawns();
    // 世界 tick：玩家 + 刷敌 + 全体实体更新 + 碰撞 + 死亡过滤
    tickWorld(true);

    // ---- 队友重生逻辑 ----
    updateTeammateRespawns();

    // ---- 快速模式胜负判定（死斗：杀光敌人=胜利；玩家死亡=失败；队友全灭不影响） ----
    checkQuickWinLoss();

    // ---- 战地模式胜利判定（占领全部据点=胜利；一局一次，关闭战报后继续游玩） ----
    if (GameState.mode === 'battle' && !GameState.battleReportShown && !GameState.battleReport) {
        const hasEnemyPoint = GameState.capturePoints.some(p => p.owner === 'enemy');
        if (GameState.capturePoints.length > 0 && !hasEnemyPoint) {
            triggerBattleReport();
        }
    }

    Renderer.render();
    Minimap.render();
    requestAnimationFrame(gameLoop);
}

// ---------- 启动：系统引导（只跑一次；gameLoop 启动前完成所有系统 init —— P0-1） ----------
let _booted = false;   // 幂等标记：防止 HMR/热重载重复引导
function bootSystems() {
    // 幂等防护：重复调用会让 EventBus 与 window/document 监听器叠加（一颗手雷双倍伤害、
    // 一次占领双倍加分、一次重生触发两次）。首次之后直接返回。
    if (_booted) return;
    _booted = true;
    console.log('🚀 引导系统...');
    GameState.config = CONFIG;
    setListenerProvider(() => GameState.player);

    // 显式初始化渲染器
    Renderer.init();
    Renderer.resize();

    InputManager.setup();

    // 注入主菜单/暂停菜单/首次手势的动作回调（避免 main↔handler 循环依赖）
    setMenuActions({ startMatch, startQuickMatch, quitGame });
    setQuickResultActions({ retry: retryQuickMatch, next: startQuickMatch, menu: quitToMenu });
    setQuitToMenu(quitToMenu);
    setFirstGestureHandler(onFirstGesture);

    // ---- 事件监听 ----
    EventBus.on('player_hurt', (data) => {
        UIManager.updateAll(GameState);
    });
    EventBus.on('player_rank_up', (data) => {
        const maxCount = CONFIG.teammate.maxCount;
        // 快速模式（死斗）不补员：兵力开局固定
        if (GameState.mode !== 'quick' && GameState.teammates.length < maxCount) {
            // 随机选择一个己方据点生成新队友
            const playerPoints = getPlayerPoints();
            const spawnPoint = playerPoints.length > 0
                ? playerPoints[Math.floor(Math.random() * playerPoints.length)]
                : null;
            const t = spawnTeammate(spawnPoint, GAME_CONSTANTS.RANK_UP_SPAWN_MIN_DIST);
            if (t) {
                SpawnSystem.equipTeammate(t);
                GameState.teammates.push(t);
                console.log(`🎖️ 军衔提升！新增一名队友在据点，当前 ${GameState.teammates.length} 人`);
            }
        }
        UIManager.updateAll(GameState);
    });
    EventBus.on('player_kill', () => UIManager.updateAll(GameState));
    EventBus.on('game_over', () => UIManager.updateAll(GameState));
    EventBus.on('point_captured', (data) => {
        if (data.owner === 'player') {
            GameState.score += GAME_CONSTANTS.SCORE_CAPTURE;
            console.log(`🎯 占领据点! +${GAME_CONSTANTS.SCORE_CAPTURE}分`);
        } else if (data.owner === 'enemy') {
            GameState.score += GAME_CONSTANTS.SCORE_LOST;
            console.log(`💔 据点被敌人占领 ${GAME_CONSTANTS.SCORE_LOST}分`);
        }
        UIManager.updateAll(GameState);
    });

    EventBus.on('respawn_player', (data) => {
        const pointIndex = data ? data.pointIndex : undefined;
        respawnPlayer(pointIndex);
    });
    window.addEventListener('resize', () => {
        Renderer.resize();
        // PostProcess.resize 已在 Renderer.resize() 内部调用
    });

    // ---- 手雷爆炸监听 ----
    EventBus.on('grenade_explode', (data) => {
        const { x, y, radius, damage, directHitTarget = null } = data;

        // 爆炸效果
        EffectsManager.spawnGrenadeExplosion(x, y, radius);

        // 破片伤害：对爆炸半径内所有实体造成距离衰减伤害
        const entities = [
            ...GameState.enemies.filter(e => e.alive),
            ...GameState.teammates.filter(t => t.alive),
            ...GameState.vehicles.filter(v => v.alive)
        ];
        if (GameState.player && GameState.player.alive) {
            entities.push(GameState.player);
        }

        for (const entity of entities) {
            if (entity.mountedVehicle) continue;
            // 火箭弹直接命中的载具按爆心完整伤害结算，不受车体半径导致的距离衰减影响。
            const d = entity === directHitTarget ? 0 : Math.hypot(entity.x - x, entity.y - y);
            if (d < radius) {
                // 距离衰减伤害
                const dmg = Math.floor(damage * (1 - d / radius));
                if (dmg > 0) {
                    const isVehicle = GameState.vehicles.includes(entity);
                    const actualDamage = isVehicle
                        ? Math.min(entity.health, dmg)
                        : dmg;
                    const wasAlive = entity.alive;
                    entity.takeDamage(dmg, x, y);
                    EffectsManager.addDamageNumber(
                        entity.x,
                        isVehicle ? entity.y - entity.radius : entity.y,
                        actualDamage,
                        entity === GameState.player
                    );
                    if (isVehicle) {
                        EffectsManager.spawnRicochetEffect(x, y, null, true);
                        EffectsManager.triggerShake(4, 6);
                        continue;
                    }
                    // 爆炸伤害产生血迹
                    EffectsManager.spawnBloodSplatter(entity.x, entity.y, 0, 0, dmg);
                    if (wasAlive && !entity.alive && GameState.teammates.includes(entity)) {
                        GameState.teammateRespawnQueue.push({
                            timer: GameState.config.teammate.respawnDelay
                        });
                    }
                    // 击退效果
                    const angle = Math.atan2(entity.y - y, entity.x - x);
                    const knockback = 60 * (1 - d / radius);
                    entity.x += Math.cos(angle) * knockback;
                    entity.y += Math.sin(angle) * knockback;
                }
                // 触发燃烧效果（使用配置常量）
                if (entity.alive && Math.random() < STATUS_EFFECT_CONFIG.BURN.TRIGGER_CHANCE) {
                    const { MIN_DURATION, MAX_DURATION } = STATUS_EFFECT_CONFIG.BURN;
                    const burnDuration = MIN_DURATION + Math.floor(Math.random() * (MAX_DURATION - MIN_DURATION + 1));
                    entity.addStatusEffect(new BurnEffect(burnDuration));
                }
            }
        }

        // 清除被炸死的敌人
        GameState.enemies = GameState.enemies.filter(e => e.alive);

        // 如果玩家被炸死（仅游玩阶段；菜单的假玩家 alive=false，否则第一次爆炸就误判阵亡弹出死亡界面）
        if (GameState.phase === 'playing' && GameState.player && !GameState.player.alive && !GameState.gameOver) {
            GameState.triggerDeath();
            EventBus.emit('game_over');
        }
    });

    // 初始化所有世界系统（必须在 gameLoop 启动前完成：天气/昼夜/支援的 update 在各自 init 前会崩 —— P0-1）
    WeatherSystem.init();
    DayNightSystem.init();
    AmbientSoundManager.init();
    Minimap.init();
    Minimap.canvas.style.display = 'none'; // 初始隐藏，仅游玩阶段由 Minimap.render 显示
    SupportSystem.init();

    // 应用设置（把默认图形/音频参数写入运行系统；音频总线在 SoundManager.initAudio 后已就绪）
    applyGraphics();
    applyAudio();

    // 失焦静音：切后台/最小化时静音全部音频（含菜单音乐），回前台恢复。由 Settings.audio.muteOnBlur 门控（默认开）。
    // 回前台无条件 setFocusMuted(false)：即使设置已关，总闸本就为 1，淡入到 1 是无害空操作。
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (Settings.audio.muteOnBlur) setFocusMuted(true);
        } else {
            setFocusMuted(false);
        }
    });

    // 进入 loading 阶段，启动主循环（此后由 gameLoop 按 phase 门控）
    GameState.phase = 'loading';
    console.log('🎮 系统引导完成，进入加载阶段');
    gameLoop();
}

// ---------- 加载阶段：预加载资源 → 生成背景地图 → presskey ----------
async function runLoading() {
    try {
        // 预加载资源（驱动进度条 + 预热浏览器缓存；单个失败不阻塞整体）
        await preloadAssets(p => { GameState.loadProgress = p; });

        // 生成背景战斗的地图 + 据点（同步耗时，进度条填满后执行）
        initMap();
        initCapturePoints();

        // 加载完毕 → 等待任意键
        GameState.phase = 'presskey';
        console.log('✅ 资源加载完成，等待按键开始');
    } catch (err) {
        // 加载失败：写入 loadError，drawLoadingScreen 显示错误并停止转圈（避免永久卡在加载界面）
        GameState.loadError = err && err.message ? err.message : String(err);
        console.error('❌ 资源加载失败:', err);
    }
}

// ---------- 战地模式：开一把干净的真游戏 ----------
function startMatch() {
    stopMenuMusic(); // 停菜单背景音乐
    applyAudio();    // 恢复战斗/环境音量（菜单里被静音的 sfx/ambient，依据 Settings）

    // 干净新图 + 据点（resetGame 不重置据点，需先重建）
    initMap();
    initCapturePoints();

    resetGame();   // 真玩家 + 双方初始兵力
    initVehicles();

    // 复位摄像机缩放（菜单用 zoom<1 放宽视野，开局恢复默认 1，避免首帧缩放残留）
    GameState.camera.zoom = 1;
    GameState.camera.targetZoom = 1;

    GameState.phase = 'playing';

    // 开局任务简报（世界冻结，逐句推进）—— 与原始 init 行为一致
    DialogueSystem.start(generateBriefing());
    console.log('🎮 战地模式开始');
}

// ---------- 退出游戏（主菜单按钮） ----------
function quitGame() {
    // 浏览器通常拦截非脚本打开的标签页关闭；兜底提示手动关闭
    window.close();
    setTimeout(() => { alert('请手动关闭此标签页'); }, 100);
}

// ---------- 重生逻辑 ----------
function respawnPlayer(pointIndex) {
    const config = GameState.config;
    // 寻找己方据点
    const playerPoints = getPlayerPoints();

    let spawnX = GameState.world.width / 2;
    let spawnY = GameState.world.height / 2;

    if (pointIndex !== undefined && playerPoints[pointIndex]) {
        // 选择指定据点
        const point = playerPoints[pointIndex];
        spawnX = point.x;
        spawnY = point.y;
        console.log(`📍 在据点 #${pointIndex + 1} (${Math.round(spawnX)}, ${Math.round(spawnY)}) 重生`);
    } else if (playerPoints.length > 0) {
        // 默认选第一个
        const point = playerPoints[0];
        spawnX = point.x;
        spawnY = point.y;
        console.log(`📍 在己方据点 (${Math.round(spawnX)}, ${Math.round(spawnY)}) 重生`);
    } else {
        console.log('⚠️ 无己方据点，在中心重生');
    }

    // 非自杀死亡：清空背包，只保留初始手枪
    if (!GameState.suicideDeath) {
        console.log('💔 阵亡损失：背包物品已清空');
        GameState.inventory = [new Weapon('beretta92'), null, null, null, null, null, null];
        GameState.activeWeaponSlot = 0;
    } else {
        console.log('✅ 自杀：保留背包物品');
    }

    // 保留当前军衔（阵亡不降级）
    const savedRank = GameState.player ? GameState.player.rank : 0;

    // 自杀死亡：保留防弹衣状态（与武器不掉落规则一致）
    const savedArmor = (GameState.suicideDeath && GameState.player) ? {
        armorDurability: GameState.player.armorDurability,
        armorMaxDurability: GameState.player.armorMaxDurability,
        armorHelmetImg: GameState.player.armorHelmetImg,
        armorHelmetImgLoaded: GameState.player.armorHelmetImgLoaded,
        armorHelmetRotation: GameState.player.armorHelmetRotation,
    } : null;

    // 重置自杀标记（必须在读取 suicideDeath 之后）
    GameState.suicideDeath = false;

    // 重置玩家状态（位置、血量等）
    GameState.player = new Player(spawnX, spawnY, config.player);
    GameState.player.rank = savedRank;
    // 恢复防弹衣状态（自杀死亡时）
    if (savedArmor) {
        Object.assign(GameState.player, savedArmor);
        console.log(`🛡️ 自杀保留防弹衣：耐久 ${savedArmor.armorDurability}/${savedArmor.armorMaxDurability}`);
    }
    GameState.gameOver = false;
    GameState.respawnSelection = false;
    // 清死亡弹出动画状态（否则下次死亡瞬间跳过动画直接弹出）
    GameState.appear.gameOver.delay = 0;
    GameState.appear.gameOver.progress = 0;
    GameState.appear.gameOver._lastTime = null;
    // 清据点焦点滑动（否则下次死亡焦点从上一次落点起跳，第一帧跳变）
    GameState.gameOverSelectedPoint = -1;
    GameState.respawnHitAreas = [];
    GameState.focus.gameOver.x = null; GameState.focus.gameOver.y = null;
    GameState.focus.gameOver.fromX = null; GameState.focus.gameOver.fromY = null;
    GameState.focus.gameOver.index = -1; GameState.focus.gameOver.anim = 0;
    GameState.focus.gameOver._lastTime = null;
    UIManager.updateAll(GameState);
}

// ---------- 启动游戏：引导系统 → 进入加载流程（唯一启动入口） ----------
bootSystems();
runLoading();
