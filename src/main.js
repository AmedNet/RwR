// src/main.js
import { GameState } from './core/GameState.js';
import { EventBus } from './core/EventBus.js';
import { Player } from './entities/Player.js';
import { Renderer } from './rendering/Renderer.js';
import { UIManager } from './rendering/UIManager.js';
import { InputManager } from './input/InputManager.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';

// ---------- 配置 ----------
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
    },
    world: {
        width: 2000,
        height: 2000
    }
};

// ---------- 游戏循环 ----------
function gameLoop() {
    // 更新摄像机（跟随玩家）
    if (GameState.player && !GameState.gameOver) {
        const player = GameState.player;
        const world = GameState.config.world;
        const canvas = document.getElementById('gameCanvas');
        let targetX = player.x - canvas.width / 2;
        let targetY = player.y - canvas.height / 2;
        targetX = Math.max(0, Math.min(world.width - canvas.width, targetX));
        targetY = Math.max(0, Math.min(world.height - canvas.height, targetY));
        GameState.camera.x = targetX;
        GameState.camera.y = targetY;
    }

    if (!GameState.gameOver) {
        if (GameState.player) GameState.player.update();
        SpawnSystem.update();
        for (const enemy of GameState.enemies) enemy.update();
        for (const bullet of GameState.bullets) bullet.update();
        CollisionSystem.checkAll();
        GameState.bullets = GameState.bullets.filter(b => b.alive);
    }
    Renderer.render();
    requestAnimationFrame(gameLoop);
}

// ---------- 重置游戏 ----------
function resetGame() {
    GameState.reset();
    const config = GameState.config;
    // 玩家出生在世界中心
    GameState.player = new Player(config.world.width / 2, config.world.height / 2, config.player);
    // 初始敌人
    for (let i = 0; i < 3; i++) {
        GameState.enemies.push(SpawnSystem.spawnEnemy());
    }
    GameState.gameOver = false;
    // 摄像机重置到玩家位置（在下一帧会跟随）
    GameState.camera.x = config.world.width / 2 - 450; // 假设画布宽900的一半
    GameState.camera.y = config.world.height / 2 - 300;
    UIManager.updateAll(GameState);
}

// ---------- 初始化 ----------
function init() {
    GameState.config = CONFIG;
    InputManager.setup();
    resetGame();

    EventBus.on('player_kill', () => UIManager.updateAll(GameState));
    EventBus.on('player_rank_up', () => UIManager.updateAll(GameState));
    EventBus.on('game_over', () => UIManager.updateAll(GameState));
    window.addEventListener('restartGame', resetGame);

    gameLoop();
}

init();