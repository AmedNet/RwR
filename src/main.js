// src/main.js
import { GameState } from './core/GameState.js';
import { EventBus } from './core/EventBus.js';
import { Player } from './entities/Player.js';
import { Renderer } from './rendering/Renderer.js';
import { UIManager } from './rendering/UIManager.js';
import { InputManager } from './input/InputManager.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';

// ---------- 配置直接写在这里（无需外部 JSON） ----------
const CONFIG = {
    player: {
        health: 100,
        speed: 3.5,
        radius: 18,
        shootDelay: 12,
        bulletSpeed: 7,
        damage: 20
    },
    enemy: {
        health: 30,
        speedMin: 1.2,
        speedMax: 2.0,
        radius: 16,
        shootDelayMin: 40,
        shootDelayMax: 70,
        damage: 10,
        spawnBaseRate: 30,
        maxEnemies: 30
    },
    bullet: {
        radius: 5,
        life: 200
    },
    rankUpKills: 5,
    colors: {
        player: "#4CAF50",
        playerStroke: "#1B5E20",
        enemyHueMin: 340,
        enemyHueMax: 360
    }
};

// ---------- 游戏循环 ----------
function gameLoop() {
    if (!GameState.gameOver) {
        if (GameState.player) GameState.player.update();
        SpawnSystem.update();
        for (const enemy of GameState.enemies) enemy.update();
        for (const bullet of GameState.bullets) bullet.update();
        CollisionSystem.checkAll();
        // 清理死亡子弹
        GameState.bullets = GameState.bullets.filter(b => b.alive);
    }
    Renderer.render();
    requestAnimationFrame(gameLoop);
}

// ---------- 重置游戏 ----------
function resetGame() {
    GameState.reset();
    // 重新创建玩家（使用配置）
    const config = GameState.config;
    GameState.player = new Player(450, 300, config.player);
    // 初始生成几个敌人
    for (let i = 0; i < 3; i++) {
        GameState.enemies.push(SpawnSystem.spawnEnemy());
    }
    GameState.gameOver = false;
    UIManager.updateAll(GameState);
}

// ---------- 初始化（同步执行） ----------
function init() {
    // 直接使用内嵌配置
    GameState.config = CONFIG;

    // 设置输入
    InputManager.setup();

    // 重置游戏（创建玩家等）
    resetGame();

    // 监听事件更新UI
    EventBus.on('player_kill', () => UIManager.updateAll(GameState));
    EventBus.on('player_rank_up', () => UIManager.updateAll(GameState));
    EventBus.on('game_over', () => UIManager.updateAll(GameState));

    // 监听重启事件（自定义事件）
    window.addEventListener('restartGame', resetGame);

    // 启动循环
    gameLoop();
}

init();