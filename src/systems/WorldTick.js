// src/systems/WorldTick.js
// 世界 tick：玩家（可选）+ 刷敌 + 全体实体更新 + 碰撞 + 死亡过滤。
// gameLoop 的 playing 分支（tickWorld(true)）与菜单背景战斗 stepMenuSimulation（tickWorld(false)）共用，
// 消灭两处重复的「更新实体 → 过滤死亡」脚本。
import { GameState } from '../core/GameState.js';
import { CollisionSystem } from './CollisionSystem.js';
import { SpawnSystem } from './SpawnSystem.js';

export function tickWorld(includePlayer = true) {
    // 玩家在存活或死亡动画期间更新（菜单的 dummy 玩家 alive=false，由 includePlayer=false 跳过）
    if (includePlayer && GameState.player && (!GameState.gameOver || GameState.player.dying)) {
        GameState.player.update();
    }
    // 快速模式不持续刷敌（死斗：敌人固定，杀光即胜）；菜单阶段 mode==='battle' 照常刷
    if (GameState.mode !== 'quick') SpawnSystem.update();
    for (const enemy of GameState.enemies) enemy.update();
    for (const teammate of GameState.teammates) teammate.update();
    for (const bullet of GameState.bullets) bullet.update();
    for (const grenade of GameState.grenades) grenade.update();
    for (const pickup of GameState.weaponPickups) pickup.update();
    for (const loot of GameState.lootPickups) loot.update();
    CollisionSystem.checkAll();

    // ---- 过滤死亡实体 ----
    GameState.enemies = GameState.enemies.filter(e => e.alive);
    GameState.bullets = GameState.bullets.filter(b => b.alive);
    GameState.grenades = GameState.grenades.filter(g => g.alive);
    GameState.weaponPickups = GameState.weaponPickups.filter(p => p.alive);
    GameState.lootPickups = GameState.lootPickups.filter(p => p.alive);
    // 过滤死亡的队友（手雷炸死等场景），确保重生时 length 检查正确
    GameState.teammates = GameState.teammates.filter(t => t.alive);
}
