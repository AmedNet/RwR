// src/main.js
import { GameState } from './core/GameState.js';
import { EventBus } from './core/EventBus.js';
import { Player } from './entities/Player.js';
import { Obstacle } from './entities/Obstacle.js';
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
    },
    // 障碍物随机生成参数
    obstacleGen: {
        clusterCount: 8,          // 簇数量
        clusterRadius: 120,       // 每个簇的散布半径
        minSize: 20,
        maxSize: 60,
        heightRatio: 0.6,         // 高/宽比例
        colors: ['#A67B5B', '#8D6E63', '#795548', '#6D4C41', '#BCAAA4']
    }
};

// ---------- 生成障碍物（噪声式随机分布） ----------
function generateObstacles(config) {
    const world = config.world;
    const gen = config.obstacleGen;
    const obstacles = [];
    const margin = 80; // 避免生成在边界太靠外

    // 生成簇中心（避开玩家出生点附近）
    const centers = [];
    for (let i = 0; i < gen.clusterCount; i++) {
        let attempts = 0;
        let cx, cy;
        do {
            cx = margin + Math.random() * (world.width - 2 * margin);
            cy = margin + Math.random() * (world.height - 2 * margin);
            attempts++;
        } while (attempts < 30 && 
                Math.hypot(cx - world.width/2, cy - world.height/2) < 200); // 避开中心
        centers.push({x: cx, y: cy});
    }

    // 在每个簇中心周围随机生成障碍物
    for (const center of centers) {
        const count = 3 + Math.floor(Math.random() * 5); // 每个簇3~7个
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * gen.clusterRadius;
            const x = center.x + Math.cos(angle) * dist;
            const y = center.y + Math.sin(angle) * dist;
            // 确保在边界内
            if (x < margin || x > world.width - margin || y < margin || y > world.height - margin) continue;
            // 随机尺寸
            const w = gen.minSize + Math.random() * (gen.maxSize - gen.minSize);
            const h = w * (0.4 + Math.random() * 0.6); // 高度随机
            const color = gen.colors[Math.floor(Math.random() * gen.colors.length)];
            // 检查是否与已有障碍物重叠（简单避免重叠）
            let overlap = false;
            for (const obs of obstacles) {
                if (Math.abs(obs.x - x) < (obs.width + w) / 2 + 10 &&
                    Math.abs(obs.y - y) < (obs.height + h) / 2 + 10) {
                    overlap = true;
                    break;
                }
            }
            if (!overlap) {
                obstacles.push(new Obstacle(x - w/2, y - h/2, w, h, color));
            }
        }
    }
    return obstacles;
}

// ---------- 游戏循环 ----------
function gameLoop() {
    // 更新摄像机
    if (GameState.player && !GameState.gameOver) {
        const player = GameState.player;
        const world = GameState.config.world;
        const canvasWidth = Renderer.width;
        const canvasHeight = Renderer.height;
        let targetX = player.x - canvasWidth / 2;
        let targetY = player.y - canvasHeight / 2;
        targetX = Math.max(0, Math.min(world.width - canvasWidth, targetX));
        targetY = Math.max(0, Math.min(world.height - canvasHeight, targetY));
        GameState.camera.x = targetX;
        GameState.camera.y = targetY;
    }

    // 更新逻辑
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
    GameState.player = new Player(config.world.width / 2, config.world.height / 2, config.player);
    
    // 生成障碍物
    GameState.obstacles = generateObstacles(config);

    // 初始敌人
    for (let i = 0; i < 3; i++) {
        GameState.enemies.push(SpawnSystem.spawnEnemy());
    }
    GameState.gameOver = false;
    UIManager.updateAll(GameState);
}

// ---------- 初始化 ----------
function init() {
    GameState.config = CONFIG;
    Renderer.resize();
    InputManager.setup();
    resetGame();

    EventBus.on('player_kill', () => UIManager.updateAll(GameState));
    EventBus.on('player_rank_up', () => UIManager.updateAll(GameState));
    EventBus.on('game_over', () => UIManager.updateAll(GameState));
    window.addEventListener('restartGame', resetGame);
    window.addEventListener('resize', () => Renderer.resize());

    gameLoop();
}

init();