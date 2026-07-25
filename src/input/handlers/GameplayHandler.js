// src/input/handlers/GameplayHandler.js
// 正常游戏状态下的按键处理（WASD/换弹/拾取/上下车/武器切换/手雷/喇叭/自杀/Debug快捷键）
import { GameState } from '../../core/GameState.js';
import { UIManager } from '../../rendering/UIManager.js';
import { WeaponPickup } from '../../entities/WeaponPickup.js';
import { LootPickup } from '../../entities/LootPickup.js';
import { LootItem } from '../../core/LootItem.js';
import { playPickup, playUISound, playVehicleHorn } from '../../utils/SoundManager.js';
import { Settings, semanticMoveKey } from '../../data/Settings.js';

let seatModifierPressed = false;

export function setSeatModifier(val) { seatModifierPressed = val; }
export function getSeatModifier() { return seatModifierPressed; }

// ─── keydown 处理（正常游戏状态） ───

export function handleGameplayKeydown(e, key) {
    // ESC：纯游戏态打开暂停菜单（仅此一处接管，radio/debug 的 ESC 关闭行为在各自分支不变）
    if (key === 'escape') {
        // 清除手雷/电台长按状态，防止暂停期间 keyup 触发 throwGrenade
        if (GameState.radioGKeyPressed) {
            GameState.radioGKeyPressed = false;
            GameState.radioGKeyConsumed = false;
            GameState.radioGKeyTimer = 0;
        }
        GameState.togglePause();
        playUISound('click');
        e.preventDefault();
        return true;
    }

    // C 键：座位修饰键
    if (key === 'c') {
        seatModifierPressed = true;
        e.preventDefault();
        return true;
    }

    // C+数字：换座位
    const seatNumber = parseInt(e.key);
    if (seatModifierPressed && Number.isInteger(seatNumber)) {
        if (seatNumber >= 1 && seatNumber <= 3) {
            const player = GameState.player;
            if (player && player.mountedVehicle) {
                const vehicle = player.mountedVehicle;
                vehicle.changeSeat(player, seatNumber - 1);
                if (player.vehicleSeat === 0) vehicle.boardNearbyTeammates();
            }
        }
        e.preventDefault();
        return true;
    }

    // Debug 快捷键 9+1
    if (key === '9') { GameState.debugKey9Pressed = true; }
    if (key === '1' && GameState.debugKey9Pressed) {
        GameState.debugOpen = true;
        GameState.debugKey9Pressed = false;
        console.log('🐛 打开Debug面板');
        e.preventDefault();
        return true;
    }

    // 自杀（键位可重绑）
    if (key === Settings.controls.suicide) {
        if (GameState.player && GameState.player.alive) {
            GameState.suicideDeath = true;
            if (GameState.player.mountedVehicle) {
                GameState.player.mountedVehicle.unmount(GameState.player);
            }
            GameState.player.alive = false;
            GameState.player.health = 0;
            GameState.triggerDeath();
            console.log('💀 玩家自杀');
        }
        e.preventDefault();
        return true;
    }

    // 数字键 1-N：切换武器（N=物品栏格数）/ BTR机炮切换
    const num = parseInt(e.key);
    if (num >= 1 && num <= GameState.inventory.length) {
        if (GameState.player && GameState.player.mountedVehicle && GameState.player.vehicleSeat === 0) {
            const vehicle = GameState.player.mountedVehicle;
            if (vehicle.id === 'btr80' && vehicle.weaponConfig) {
                if (num === 1) vehicle.switchVehicleWeapon('cannon');
                if (num === 2) vehicle.switchVehicleWeapon('coax');
                e.preventDefault();
                return true;
            }
        }
        if (GameState.player && GameState.inventory[num - 1]) {
            GameState.player.switchWeapon(num - 1);
        }
        e.preventDefault();
        return true;
    }

    // 手雷/电台长按（键位可重绑）
    if (key === Settings.controls.grenade) {
        if (!GameState.radioGKeyPressed) {
            GameState.radioGKeyPressed = true;
            GameState.radioGKeyTimer = 0;
            GameState.radioGKeyConsumed = false;
        }
        e.preventDefault();
        return true;
    }

    // 换弹（键位可重绑）
    if (key === Settings.controls.reload) {
        if (GameState.player) { GameState.player.reload(); }
        e.preventDefault();
        return true;
    }

    // 吉普车喇叭（键位可重绑）
    if (key === Settings.controls.horn) {
        if (GameState.player && GameState.player.mountedVehicle) {
            playVehicleHorn(GameState.player.mountedVehicle);
        }
        e.preventDefault();
        return true;
    }

    // 上下车 / 拾取地面物品（键位可重绑）
    if (key === Settings.controls.interact) {
        if (GameState.player && GameState.player.alive) {
            const player = GameState.player;

            // 已在车上 → 下车
            if (player.mountedVehicle) {
                player.mountedVehicle.unmount(player);
                console.log('🚙 下车');
                e.preventDefault();
                return true;
            }

            // 未上车 → 检测附近载具
            let nearestVehicle = null;
            let nearestVehDist = Infinity;
            for (const v of GameState.vehicles) {
                if (!v.alive) continue;
                if (v.isFull()) continue;
                if (v.occupied && !v.occupants[0]) continue;
                const dist = Math.hypot(v.x - player.x, v.y - player.y);
                if (dist < v.mountRange && dist < nearestVehDist) {
                    nearestVehDist = dist;
                    nearestVehicle = v;
                }
            }
            if (nearestVehicle) {
                if (!nearestVehicle.occupants[0]) {
                    nearestVehicle.mount(player, 0);
                    nearestVehicle.boardNearbyTeammates();
                    console.log('🚙 上车！驾驶 ' + nearestVehicle.name + '，乘客 ' + nearestVehicle.occupants.filter(Boolean).length + '/' + nearestVehicle.passengerCapacity);
                } else if (nearestVehicle.occupants[0] !== player) {
                    if (nearestVehicle.yieldDriverSeat(player)) {
                        console.log('🚙 AI让座！玩家接管驾驶 ' + nearestVehicle.name);
                    }
                }
                e.preventDefault();
                return true;
            }

            // 拾取物品
            let nearestPickup = null;
            let nearestDist = Infinity;
            let pickupType = null;

            for (const pickup of GameState.weaponPickups) {
                if (!pickup.alive) continue;
                if (pickup.canPickup(player)) {
                    const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestPickup = pickup;
                        pickupType = 'weapon';
                    }
                }
            }
            for (const loot of GameState.lootPickups) {
                if (!loot.alive) continue;
                if (loot.canPickup(player)) {
                    const dist = Math.hypot(loot.x - player.x, loot.y - player.y);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestPickup = loot;
                        pickupType = 'loot';
                    }
                }
            }

            if (nearestPickup) {
                let targetSlot = -1;
                for (let i = 0; i < GameState.inventory.length; i++) {
                    if (!GameState.inventory[i]) { targetSlot = i; break; }
                }

                if (pickupType === 'loot') {
                    const lootItem = new LootItem(nearestPickup.lootId);
                    if (targetSlot >= 0) {
                        GameState.inventory[targetSlot] = lootItem;
                        console.log('🎁 拾取战利品 ' + lootItem.config.name + ' 到槽位 ' + (targetSlot + 1));
                    } else {
                        const currentSlot = GameState.activeWeaponSlot;
                        const oldItem = GameState.inventory[currentSlot];
                        if (oldItem) {
                            if (oldItem.isLoot) {
                                GameState.lootPickups.push(new LootPickup(player.x, player.y, oldItem.lootId));
                            } else {
                                GameState.weaponPickups.push(new WeaponPickup(player.x, player.y, oldItem));
                            }
                            console.log('🔄 丢弃 ' + oldItem.config.name);
                        }
                        GameState.inventory[currentSlot] = lootItem;
                        console.log('🎁 拾取战利品 ' + lootItem.config.name + ' 替换当前物品');
                    }
                } else {
                    if (targetSlot >= 0) {
                        GameState.inventory[targetSlot] = nearestPickup.weapon;
                        console.log('🔫 拾取 ' + nearestPickup.weapon.config.name + ' 到槽位 ' + (targetSlot + 1));
                    } else {
                        const currentSlot = GameState.activeWeaponSlot;
                        const oldWeapon = GameState.inventory[currentSlot];
                        if (oldWeapon) {
                            if (oldWeapon.isLoot) {
                                GameState.lootPickups.push(new LootPickup(player.x, player.y, oldWeapon.lootId));
                            } else {
                                GameState.weaponPickups.push(new WeaponPickup(player.x, player.y, oldWeapon));
                            }
                            console.log('🔄 丢弃 ' + oldWeapon.config.name);
                        }
                        GameState.inventory[currentSlot] = nearestPickup.weapon;
                        console.log('🔫 拾取 ' + nearestPickup.weapon.config.name + ' 替换当前武器');
                    }
                }

                nearestPickup.alive = false;
                playPickup(player);
                UIManager.updateAll(GameState);
            }
        }
        e.preventDefault();
        return true;
    }

    // 打开/关闭军械库（键位可重绑）
    if (key === Settings.controls.arsenal) {
        const arsenal = GameState.arsenal;
        const player = GameState.player;
        if (arsenal && player && arsenal.contains(player)) {
            GameState.toggleArsenal();
            playUISound('click');
        }
        e.preventDefault();
        return true;
    }

    // 打开/关闭背包（键位可重绑）
    if (key === Settings.controls.inventory) {
        GameState.toggleInventory();
        playUISound('click');
        console.log(GameState.inventoryOpen ? '🎒 打开背包' : '🎒 关闭背包');
        e.preventDefault();
        return true;
    }

    // 移动（写入层翻译：物理键 → 语义键 w/a/s/d，Player 读者零改动）
    const moveKey = semanticMoveKey(key);
    if (moveKey) {
        GameState.keys[moveKey] = true;
        e.preventDefault();
    }
    if (key === Settings.controls.shoot) {
        if (GameState.player) GameState.player.shoot();
        e.preventDefault();
    }
    return false;
}

// ─── keyup 处理 ───

export function handleGameplayKeyup(e, key) {
    if (key === 'c') seatModifierPressed = false;
    // 9 键抬起即清除 debug 组合键标志，避免扩容后「按 9 切枪 → 按 1 切枪」误触发 debug 面板
    if (key === '9') GameState.debugKey9Pressed = false;
    // 移动键抬起（写入层翻译：物理键 → 语义键）
    const moveKey = semanticMoveKey(key);
    if (moveKey) {
        GameState.keys[moveKey] = false;
        e.preventDefault();
    }
    if (key === Settings.controls.grenade && GameState.radioGKeyPressed) {
        if (GameState.radioGKeyTimer < 18 && !GameState.radioOpen && !GameState.gameOver && !GameState.radioGKeyConsumed) {
            if (GameState.player) { GameState.player.throwGrenade(); }
        }
        GameState.radioGKeyPressed = false;
        GameState.radioGKeyConsumed = false;
        GameState.radioGKeyTimer = 0;
    }
}