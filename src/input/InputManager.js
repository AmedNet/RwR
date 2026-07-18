// src/input/InputManager.js
import { GameState } from '../core/GameState.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { UIManager } from '../rendering/UIManager.js';
import { Renderer } from '../rendering/Renderer.js';
import { WeaponPickup } from '../entities/WeaponPickup.js';
import { LootPickup } from '../entities/LootPickup.js';
import { LootRegistry, Rarity } from '../core/LootRegistry.js';
import { LootItem } from '../core/LootItem.js';
import { playPickup, playUISound, playRadioClose, playVehicleHorn } from '../utils/SoundManager.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { AmbientSoundManager } from '../utils/AmbientSoundManager.js';
import { SupportSystem } from '../core/SupportSystem.js';

export const InputManager = {
    seatModifierPressed: false,

    setup() {
        const canvas = document.getElementById('gameCanvas');

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            // ====== 死亡状态处理 ======
            if (GameState.gameOver) {
                if (GameState.arsenalOpen) {
                    GameState.arsenalOpen = false;
                }
                if (GameState.radioOpen) {
                    GameState.radioOpen = false;
                    GameState.radioAnimating = false;
                    GameState.radioClosing = false;
                    GameState.radioTargetWorld = null;
                }
                if (GameState.permanentDefeat) {
                    e.preventDefault();
                    return;
                }
                const num = parseInt(e.key);
                if (num >= 1 && num <= 6) {
                    const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
                    if (playerPoints[num - 1]) {
                        window.dispatchEvent(new CustomEvent('respawnPlayer', { detail: { pointIndex: num - 1 } }));
                        e.preventDefault();
                        return;
                    }
                }
                if (key === 'r') {
                    window.dispatchEvent(new CustomEvent('respawnPlayer'));
                    e.preventDefault();
                    return;
                }
                return;
            }

            // ====== 菜单打开时的处理 ======
            if (GameState.inventoryOpen || GameState.arsenalOpen) {
                // 关闭菜单
                if (key === 'e') {
                    GameState.arsenalOpen = false;
                    playUISound('click');
                    e.preventDefault();
                    return;
                }
                if (key === 'q') {
                    if (GameState.inventoryAnimDirection === null) {
                        GameState.inventoryAnimDirection = 'closing';
                        GameState._inventoryAnimLastTime = null;
                    }
                    playUISound('click');
                    e.preventDefault();
                    return;
                }
                // === 背包界面专属按键 ===
                // 关闭折叠期间不响应背包专属按键（与点击/右键守卫一致）
                if (GameState.inventoryOpen && GameState.inventoryAnimDirection === null) {
                    // D 键：丢弃选中物品到脚下
                    if (key === 'd') {
                        const selSlot = GameState.inventorySelectedSlot;
                        if (selSlot >= 0 && selSlot < 7 && GameState.inventory[selSlot]) {
                            const item = GameState.inventory[selSlot];
                            const player = GameState.player;
                            if (player && player.alive) {
                                if (item.isLoot) {
                                    const offsetX = (Math.random() - 0.5) * 30;
                                    const offsetY = (Math.random() - 0.5) * 30;
                                    GameState.lootPickups.push(new LootPickup(player.x + offsetX, player.y + offsetY, item.lootId));
                                    console.log(`\u{1F5D1}\uFE0F \u4E22\u5F03\u6218\u5229\u54C1 ${item.config.name}`);
                                } else {
                                    const droppedPickup = new WeaponPickup(player.x, player.y, item);
                                    GameState.weaponPickups.push(droppedPickup);
                                    console.log(`\u{1F5D1}\uFE0F \u4E22\u5F03\u6B66\u5668 ${item.config.name}`);
                                }
                                GameState.inventory[selSlot] = null;
                                GameState.inventorySelectedSlot = -1;
                                if (GameState.activeWeaponSlot === selSlot) {
                                    for (let j = 0; j < 7; j++) {
                                        if (GameState.inventory[j]) {
                                            GameState.activeWeaponSlot = j;
                                            break;
                                        }
                                    }
                                }
                                playUISound('click');
                                UIManager.updateAll(GameState);
                            }
                        }
                        e.preventDefault();
                        return;
                    }
                }

                // === 军械库专属按键 ===
                if (GameState.arsenalOpen) {
                    // \u2191 \u952E\u5207\u6362\u5206\u7C7B
                    if (key === 'arrowup') {
                        GameState.arsenalCategory = (GameState.arsenalCategory + 6) % 7;
                        GameState.arsenalSelectedIndex = 0;
                        GameState.arsenalScrollOffset = 0;
                        e.preventDefault();
                        return;
                    }
                    // \u2193 \u952E\u5207\u6362\u5206\u7C7B
                    if (key === 'arrowdown') {
                        GameState.arsenalCategory = (GameState.arsenalCategory + 1) % 7;
                        GameState.arsenalSelectedIndex = 0;
                        GameState.arsenalScrollOffset = 0;
                        e.preventDefault();
                        return;
                    }
                    // W \u952E\u9009\u62E9\u4E0A\u4E00\u4E2A\u5546\u54C1
                    if (key === 'w') {
                        const items = InputManager._getCategoryItems();
                        if (items.length > 0) {
                            GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex - 1 + items.length) % items.length;
                            InputManager._scrollToSelected(68, 6, 8, 320);
                        }
                        e.preventDefault();
                        return;
                    }
                    // S \u952E\u9009\u62E9\u4E0B\u4E00\u4E2A\u5546\u54C1
                    if (key === 's') {
                        const items = InputManager._getCategoryItems();
                        if (items.length > 0) {
                            GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex + 1) % items.length;
                            InputManager._scrollToSelected(68, 6, 8, 320);
                        }
                        e.preventDefault();
                        return;
                    }
                    // B \u952E\u8D2D\u4E70
                    if (key === 'b') {
                        const items = InputManager._getCategoryItems();
                        if (items.length === 0) { e.preventDefault(); return; }
                        const [selectedId, config] = items[GameState.arsenalSelectedIndex];
                        const slot = GameState.arsenalSelectedSlot;
                        if (GameState.rp >= config.buyPrice) {
                            if (!GameState.inventory[slot]) {
                                GameState.inventory[slot] = new Weapon(selectedId);
                                GameState.rp -= config.buyPrice;
                                console.log(`\u{1F4B0} \u8D2D\u4E70 ${config.name}\uFF01`);
                            } else if (GameState.inventory[slot].id === selectedId) {
                                const weapon = GameState.inventory[slot];
                                if (config.maxStack && config.maxStack > 1) {
                                    if (weapon.stackCount < config.maxStack) {
                                        weapon.addStack(1);
                                        GameState.rp -= config.buyPrice;
                                        console.log(`\u{1F4B0} \u8865\u5145 ${config.name} \u5F39\u836F\uFF08${weapon.stackCount}/${config.maxStack}\uFF09\uFF01`);
                                    }
                                } else {
                                    const maxAmmo = config.magSize;
                                    if (weapon.ammo < maxAmmo) {
                                        weapon.ammo = maxAmmo;
                                        GameState.rp -= config.buyPrice;
                                        console.log(`\u{1F4B0} \u8865\u5145 ${config.name} \u5F39\u836F\uFF01`);
                                    }
                                }
                            }
                            UIManager.updateAll(GameState);
                        }
                        e.preventDefault();
                        return;
                    }
                    // X \u952E\u51FA\u552E\uFF08\u6B66\u5668 + \u6218\u5229\u54C1\uFF09
                    if (key === 'x') {
                        const slot = GameState.arsenalSelectedSlot;
                        const item = GameState.inventory[slot];
                        if (item && item.isLoot) {
                            // \u51FA\u552E\u6218\u5229\u54C1
                            GameState.rp += item.config.value;
                            GameState.inventory[slot] = null;
                            if (GameState.activeWeaponSlot === slot) {
                                for (let i = 0; i < 7; i++) {
                                    if (GameState.inventory[i]) { GameState.activeWeaponSlot = i; break; }
                                }
                            }
                            console.log(`\u{1F4B0} \u51FA\u552E\u6218\u5229\u54C1 ${item.config.name}\uFF0C+$${item.config.value}`);
                            UIManager.updateAll(GameState);
                        } else if (item && item.config.sellPrice > 0) {
                            // \u51FA\u552E\u6B66\u5668
                            GameState.rp += item.config.sellPrice;
                            GameState.inventory[slot] = null;
                            if (GameState.activeWeaponSlot === slot) {
                                for (let i = 0; i < 7; i++) {
                                    if (GameState.inventory[i]) { GameState.activeWeaponSlot = i; break; }
                                }
                            }
                            console.log('\u{1F4B0} \u51FA\u552E\u6B66\u5668\uFF01');
                            UIManager.updateAll(GameState);
                        }
                        e.preventDefault();
                        return;
                    }
                    // \u6570\u5B57\u952E 1-7 \u9009\u62E9\u80CC\u5305\u4F4D\u7F6E
                    const num = parseInt(e.key);
                    if (num >= 1 && num <= 7) {
                        GameState.arsenalSelectedSlot = num - 1;
                        e.preventDefault();
                        return;
                    }
                }
                // F键不拦截，让它穿透到下面的拾取逻辑
                if (key === 'f') {
                    // 关闭菜单后拾取
                    GameState.inventoryOpen = false;
                    GameState.arsenalOpen = false;
                    // 不 return，让 F 键继续向下执行到拾取逻辑
                } else {
                    return;
                }
            }

            // ====== \u7535\u53F0\u754C\u9762 ======
            if (GameState.radioOpen) {
                if (key === 'escape') {
                    GameState.radioClosing = true;
                    GameState.radioAnimating = true;
                    playRadioClose();
                    e.preventDefault();
                    return;
                }
                if (key === 'arrowup') {
                    const available = SupportSystem.getPlayerAvailableSupport();
                    if (available.length > 0) {
                        GameState.radioSelectedIndex = (GameState.radioSelectedIndex - 1 + available.length) % available.length;
                    }
                    e.preventDefault();
                    return;
                }
                if (key === 'arrowdown') {
                    const available = SupportSystem.getPlayerAvailableSupport();
                    if (available.length > 0) {
                        GameState.radioSelectedIndex = (GameState.radioSelectedIndex + 1) % available.length;
                    }
                    e.preventDefault();
                    return;
                }
                if (key === 'enter') {
                    const available = SupportSystem.getPlayerAvailableSupport();
                    const sel = available[GameState.radioSelectedIndex];
                    if (sel && sel.canCall && GameState.radioTargetWorld) {
                        SupportSystem.callSupport(sel.type, GameState.radioTargetWorld.x, GameState.radioTargetWorld.y);
                        GameState.radioClosing = true;
                        GameState.radioAnimating = true;
                        playRadioClose();
                    }
                    e.preventDefault();
                    return;
                }
                if (key === 'g') {
                    if (!GameState.radioGKeyPressed) {
                        GameState.radioGKeyPressed = true;
                        GameState.radioGKeyTimer = 0;
                        GameState.radioGKeyConsumed = false;
                    }
                    e.preventDefault();
                    return;
                }
                return;
            }

            // ====== Debug\u9762\u677F ======
            if (GameState.debugOpen) {
                if (key === 'escape') {
                    GameState.debugOpen = false;
                    e.preventDefault();
                    return;
                }
                if (key === '1' && GameState.debugKey9Pressed) {
                    GameState.debugOpen = false;
                    GameState.debugKey9Pressed = false;
                    e.preventDefault();
                    return;
                }
                return;
            }

            // ====== \u6B63\u5E38\u6E38\u620F\u64CD\u4F5C ======
            if (key === 'c') {
                InputManager.seatModifierPressed = true;
                e.preventDefault();
                return;
            }

            const seatNumber = parseInt(e.key);
            if (InputManager.seatModifierPressed && Number.isInteger(seatNumber)) {
                if (seatNumber >= 1 && seatNumber <= 3) {
                    const player = GameState.player;
                    if (player && player.mountedVehicle) {
                        const vehicle = player.mountedVehicle;
                        vehicle.changeSeat(player, seatNumber - 1);
                        if (player.vehicleSeat === 0) vehicle.boardNearbyTeammates();
                    }
                }
                e.preventDefault();
                return;
            }

            if (key === '9') { GameState.debugKey9Pressed = true; }
            if (key === '1' && GameState.debugKey9Pressed) {
                GameState.debugOpen = true;
                GameState.debugKey9Pressed = false;
                console.log('\u{1F41B} \u6253\u5F00Debug\u9762\u677F');
                e.preventDefault();
                return;
            }
            if (key === 'k') {
                if (GameState.player && GameState.player.alive) {
                    GameState.suicideDeath = true;
                    if (GameState.player.mountedVehicle) {
                        GameState.player.mountedVehicle.unmount(GameState.player);
                    }
                    GameState.player.alive = false;
                    GameState.player.health = 0;
                    GameState.gameOver = true;
                    console.log('\u{1F480} \u73A9\u5BB6\u81EA\u6740');
                }
                e.preventDefault();
                return;
            }

            // \u6570\u5B57\u952E 1-7\uFF1A\u5207\u6362\u6B66\u5668
            const num = parseInt(e.key);
            if (num >= 1 && num <= 7) {
                if (GameState.player && GameState.player.mountedVehicle && GameState.player.vehicleSeat === 0) {
                    const vehicle = GameState.player.mountedVehicle;
                    if (vehicle.id === 'btr80' && vehicle.weaponConfig) {
                        if (num === 1) vehicle.switchVehicleWeapon('cannon');
                        if (num === 2) vehicle.switchVehicleWeapon('coax');
                        e.preventDefault();
                        return;
                    }
                }
                if (GameState.player && GameState.inventory[num - 1]) {
                    GameState.player.switchWeapon(num - 1);
                }
                e.preventDefault();
                return;
            }

            if (key === 'g') {
                if (!GameState.radioGKeyPressed) {
                    GameState.radioGKeyPressed = true;
                    GameState.radioGKeyTimer = 0;
                    GameState.radioGKeyConsumed = false;
                }
                e.preventDefault();
                return;
            }
            if (key === 'r') {
                if (GameState.player) { GameState.player.reload(); }
                e.preventDefault();
                return;
            }

            // H 键：吉普车喇叭
            if (key === 'h') {
                if (GameState.player && GameState.player.mountedVehicle) {
                    playVehicleHorn(GameState.player.mountedVehicle);
                }
                e.preventDefault();
                return;
            }

            // F 键：上下车 / 拾取地面物品
            if (key === 'f') {
                if (GameState.player && GameState.player.alive) {
                    const player = GameState.player;

                    // 已在车上 → 下车
                    if (player.mountedVehicle) {
                        player.mountedVehicle.unmount(player);
                        console.log('🚙 下车');
                        e.preventDefault();
                        return;
                    }

                    // 未上车 → 检测附近载具
                    let nearestVehicle = null;
                    let nearestVehDist = Infinity;
                    for (const v of GameState.vehicles) {
                        if (!v.alive) continue;
                        // 跳过已满的车
                        if (v.isFull()) continue;
                        // 跳过没有驾驶员且驾驶座被占的车（异常情况）
                        if (v.occupied && !v.occupants[0]) continue;
                        const dist = Math.hypot(v.x - player.x, v.y - player.y);
                        if (dist < v.mountRange && dist < nearestVehDist) {
                            nearestVehDist = dist;
                            nearestVehicle = v;
                        }
                    }
                    if (nearestVehicle) {
                        // 情况1：车完全空 → 直接上驾驶座
                        if (!nearestVehicle.occupants[0]) {
                            nearestVehicle.mount(player, 0);
                            nearestVehicle.boardNearbyTeammates();
                            console.log('🚙 上车！驾驶 ' + nearestVehicle.name + '，乘客 ' + nearestVehicle.occupants.filter(Boolean).length + '/' + nearestVehicle.passengerCapacity);
                        }
                        // 情况2：车有AI驾驶员 → AI让座，玩家上驾驶座
                        else if (nearestVehicle.occupants[0] !== player) {
                            if (nearestVehicle.yieldDriverSeat(player)) {
                                console.log('🚙 AI让座！玩家接管驾驶 ' + nearestVehicle.name);
                            }
                        }
                        e.preventDefault();
                        return;
                    }

                    let nearestPickup = null;
                    let nearestDist = Infinity;
                    let pickupType = null; // 'weapon' or 'loot'

                    // 搜索武器掉落物
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
                    // 搜索战利品掉落物
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
                        // 找到空背包槽位
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
                                // 背包满了，替换当前物品
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
                            // 拾取武器
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
                return;
            }


            // E \u952E\uFF1A\u6253\u5F00/\u5173\u95ED\u519B\u69B0\u5E93
            if (key === 'e') {
                const arsenal = GameState.arsenal;
                const player = GameState.player;
                if (arsenal && player && arsenal.contains(player)) {
                    GameState.arsenalOpen = !GameState.arsenalOpen;
                    playUISound('click');
                    console.log(GameState.arsenalOpen ? '\u{1F52B} \u6253\u5F00\u519B\u69B0\u5E93' : '\u{1F52B} \u5173\u95ED\u519B\u69B0\u5E93');
                }
                e.preventDefault();
                return;
            }

            // Q \u952E\uFF1A\u6253\u5F00/\u5173\u95ED\u80CC\u5305
            if (key === 'q') {
                if (!GameState.inventoryOpen && GameState.inventoryAnimDirection !== 'closing') {
                    GameState.inventoryOpen = true;
                    GameState.inventoryAnimDirection = 'opening';
                    GameState.inventoryAnimProgress = 0;
                    GameState._inventoryAnimLastTime = null;
                } else if (GameState.inventoryOpen && GameState.inventoryAnimDirection === null) {
                    GameState.inventoryAnimDirection = 'closing';
                    GameState._inventoryAnimLastTime = null;
                }
                playUISound('click');
                console.log(GameState.inventoryOpen ? '\u{1F392} \u6253\u5F00\u80CC\u5305' : '\u{1F392} \u5173\u95ED\u80CC\u5305');
                e.preventDefault();
                return;
            }

            // WASD \u79FB\u52A8
            if (key in GameState.keys) {
                GameState.keys[key] = true;
                e.preventDefault();
            }
            if (key === ' ' || key === 'space') {
                if (GameState.player) GameState.player.shoot();
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'c') InputManager.seatModifierPressed = false;
            if (key in GameState.keys) {
                GameState.keys[key] = false;
                e.preventDefault();
            }
            if (key === 'g' && GameState.radioGKeyPressed) {
                if (GameState.radioGKeyTimer < 18 && !GameState.radioOpen && !GameState.gameOver && !GameState.radioGKeyConsumed) {
                    if (GameState.player) { GameState.player.throwGrenade(); }
                }
                GameState.radioGKeyPressed = false;
                GameState.radioGKeyConsumed = false;
                GameState.radioGKeyTimer = 0;
            }
        });

        // \u9F20\u6807\u79FB\u52A8
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.clientWidth / rect.width;
            const scaleY = canvas.clientHeight / rect.height;
            GameState.mouse.x = (e.clientX - rect.left) * scaleX;
            GameState.mouse.y = (e.clientY - rect.top) * scaleY;

            if (GameState.ambientSliderDragging && Renderer.ambientSlider) {
                const ambSlider = Renderer.ambientSlider;
                const clickX = (e.clientX - rect.left) * scaleX;
                const ratio = (clickX - ambSlider.x) / ambSlider.w;
                AmbientSoundManager.setMasterVolume(Math.max(0, Math.min(1, ratio)));
            }
            if (GameState.debugSliderDragging && Renderer.debugSlider) {
                const slider = Renderer.debugSlider;
                const clickX2 = (e.clientX - rect.left) * scaleX;
                const ratio2 = (clickX2 - slider.x) / slider.w;
                DayNightSystem.setTime(Math.max(0, Math.min(1, ratio2)));
            }
        });

        // \u9F20\u6807\u70B9\u51FB
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                GameState.mouse.rightDown = true;
                e.preventDefault();
            }
            if (e.button === 0) {
                GameState.mouse.down = true;

                // \u7535\u53F0\u754C\u9762\u70B9\u51FB
                if (GameState.radioOpen) {
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
                                return;
                            }
                        }
                    }

                    const cam = GameState.camera;
                    const zoom = cam.zoom || 1;
                    const offsetX = cam.offsetX || 0;
                    const offsetY = cam.offsetY || 0;
                    const canvasW = canvas.clientWidth || 800;
                    const canvasH = canvas.clientHeight || 600;
                    const cx = canvasW / 2;
                    const cy = canvasH / 2;
                    const worldX = (clickX - cx * (1 - zoom) + offsetX) / zoom + cam.x;
                    const worldY = (clickY - cy * (1 - zoom) + offsetY) / zoom + cam.y;
                    const panelW = 260;
                    const panelX = 20;
                    const panelTop = 60;
                    const headerH = 48;
                    const itemH = 56;
                    const itemGap = 4;
                    const listTop = panelTop + headerH + 8;
                    const available = SupportSystem.getPlayerAvailableSupport();
                    let hitCard = false;
                    for (let i = 0; i < available.length; i++) {
                        const scrollOffset = GameState.radioScrollOffset || 0;
                        const iy = listTop + i * (itemH + itemGap) - scrollOffset;
                        if (clickX >= panelX + 6 && clickX <= panelX + panelW - 6 &&
                            clickY >= iy && clickY <= iy + itemH) {
                            hitCard = true;
                            GameState.radioSelectedIndex = i;
                            if (available[i].canCall && GameState.radioTargetWorld) {
                                SupportSystem.callSupport(available[i].type, GameState.radioTargetWorld.x, GameState.radioTargetWorld.y);
                                GameState.radioClosing = true;
                                GameState.radioAnimating = true;
                                playRadioClose();
                            }
                            break;
                        }
                    }
                    if (!hitCard) {
                        GameState.radioTargetWorld = { x: worldX, y: worldY };
                    }
                    e.preventDefault();
                    return;
                }

                // \u6B7B\u4EA1\u754C\u9762\u70B9\u51FB\u636E\u70B9
                if (GameState.gameOver && !GameState.permanentDefeat && GameState.respawnHitAreas) {
                    const rect = canvas.getBoundingClientRect();
                    const scaleX2 = canvas.clientWidth / rect.width;
                    const scaleY2 = canvas.clientHeight / rect.height;
                    const clickX = (e.clientX - rect.left) * scaleX2;
                    const clickY = (e.clientY - rect.top) * scaleY2;
                    for (const area of GameState.respawnHitAreas) {
                        if (Math.hypot(clickX - area.x, clickY - area.y) < area.r) {
                            window.dispatchEvent(new CustomEvent('respawnPlayer', { detail: { pointIndex: area.index } }));
                            e.preventDefault();
                            return;
                        }
                    }
                }

                // Debug\u9762\u677F\u70B9\u51FB
                if (GameState.debugOpen) {
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
                                return;
                            }
                        }
                    }

                    if (Renderer.ambientSlider) {
                        const ambSlider = Renderer.ambientSlider;
                        const ambHandleDist = Math.hypot(clickX - ambSlider.handleX, clickY - (ambSlider.y + ambSlider.h / 2));
                        if (ambHandleDist < ambSlider.handleR + 5) {
                            GameState.ambientSliderDragging = true;
                            e.preventDefault();
                            return;
                        }
                        if (clickX >= ambSlider.x && clickX <= ambSlider.x + ambSlider.w &&
                            clickY >= ambSlider.y - 10 && clickY <= ambSlider.y + ambSlider.h + 10) {
                            const ratio = (clickX - ambSlider.x) / ambSlider.w;
                            AmbientSoundManager.setMasterVolume(Math.max(0, Math.min(1, ratio)));
                            e.preventDefault();
                            return;
                        }
                    }
                    if (Renderer.debugSlider) {
                        const slider = Renderer.debugSlider;
                        const handleDist = Math.hypot(clickX - slider.handleX, clickY - (slider.y + slider.h / 2));
                        if (handleDist < slider.handleR + 5) {
                            GameState.debugSliderDragging = true;
                            DayNightSystem.paused = true;
                            e.preventDefault();
                            return;
                        }
                        if (clickX >= slider.x && clickX <= slider.x + slider.w &&
                            clickY >= slider.y - 10 && clickY <= slider.y + slider.h + 10) {
                            const ratio = (clickX - slider.x) / slider.w;
                            DayNightSystem.setTime(Math.max(0, Math.min(1, ratio)));
                            DayNightSystem.paused = true;
                            e.preventDefault();
                            return;
                        }
                    }
                    if (Renderer.debugButtons) {
                        for (const btn of Renderer.debugButtons) {
                            if (clickX >= btn.x && clickX <= btn.x + btn.w &&
                                clickY >= btn.y && clickY <= btn.y + btn.h) {
                                if (btn.value) {
                                    GameState.rp += btn.value;
                                    console.log(`\u{1F41B} \u589E\u52A0 ${btn.value} RP`);
                                    UIManager.updateAll(GameState);
                                } else if (btn.action === 'heal') {
                                    if (GameState.player) { GameState.player.health = GameState.player.maxHealth; console.log('\u{1F41B} \u6EE1\u8840'); }
                                } else if (btn.action === 'rankUp') {
                                    if (GameState.player) { GameState.player.addRank(); console.log(`\u{1F41B} \u519B\u8854\u63D0\u5347! ${GameState.player.getRankName()}`); }
                                } else if (btn.weather) {
                                    WeatherSystem.setWeather(btn.weather);
                                } else if (btn.action === 'toggleDayNight') {
                                    DayNightSystem.togglePause();
                                    console.log(DayNightSystem.paused ? '\u23F8 \u663C\u591C\u5FAA\u73AF\u6682\u505C' : '\u25B6 \u663C\u591C\u5FAA\u73AF\u7EE7\u7EED');
                                } else if (btn.action === 'toggleTornadoRadar') {
                                    GameState.debugShowTornado = !GameState.debugShowTornado;
                                } else if (btn.action === 'toggleFPS') {
                                    GameState.debugShowFPS = !GameState.debugShowFPS;
                                    console.log(GameState.debugShowFPS ? '\u{1F41B} \u5E27\u7387\u663E\u793A\u5F00\u542F' : '\u{1F41B} \u5E27\u7387\u663E\u793A\u5173\u95ED');
                                    console.log(GameState.debugShowTornado ? '\u{1F41B} \u9F99\u5377\u98CE\u96F7\u8FBE\u5F00\u542F' : '\u{1F41B} \u9F99\u5377\u98CE\u96F7\u8FBE\u5173\u95ED');
                                } else if (btn.action === 'spawnLoot') {
                                    // 刷出指定稀有度的随机战利品
                                    const player = GameState.player;
                                    if (player) {
                                        const items = Object.values(LootRegistry).filter(i => i.rarity === btn.rarity);
                                        if (items.length > 0) {
                                            const item = items[Math.floor(Math.random() * items.length)];
                                            const offsetX = (Math.random() - 0.5) * 80;
                                            const offsetY = (Math.random() - 0.5) * 80;
                                            GameState.lootPickups.push(new LootPickup(player.x + offsetX, player.y + offsetY, item.id));
                                            console.log(`\u{1F381} \u5237\u51FA ${item.name}`);
                                        }
                                    }
                                } else if (btn.action === 'spawnAllLoot') {
                                    // 刷出所有稀有度各一个
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
                                        console.log(`\u{1F31F} \u5237\u51FA 4 \u4E2A\u6218\u5229\u54C1`);
                                    }
                                }
                                break;
                            }
                        }
                    }
                    e.preventDefault();
                    return;
                }

                // === \u80CC\u5305\u754C\u9762\u70B9\u51FB\u9009\u4E2D\u683C\u5B50 ===
                // \u4EC5\u5728\u52A8\u753B\u843D\u5B9A\u540E\u5141\u8BB8\u9009\u4E2D\uFF0C\u5173\u95ED\u6298\u53E0\u671F\u95F4\u70B9\u51FB\u65E0\u6548\uFF08\u907F\u514D\u672B\u5E27\u53C8\u88AB\u91CD\u7F6E\u4E3A -1\uFF09
                if (GameState.inventoryOpen && GameState.inventoryAnimDirection === null && GameState.inventoryHitAreas) {
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.clientWidth / rect.width;
                    const scaleY = canvas.clientHeight / rect.height;
                    const clickX = (e.clientX - rect.left) * scaleX;
                    const clickY = (e.clientY - rect.top) * scaleY;

                    for (const area of GameState.inventoryHitAreas) {
                        if (clickX >= area.x && clickX <= area.x + area.w &&
                            clickY >= area.y && clickY <= area.y + area.h) {
                            GameState.inventorySelectedSlot = area.index;
                            playUISound('click');
                            e.preventDefault();
                            return;
                        }
                    }
                }

                // \u6B63\u5E38\u5C04\u51FB
                if (GameState.player && !GameState.player.mountedVehicle) {
                    const weapon = GameState.getActiveWeapon();
                    if (weapon && weapon.config.type === 'grenade') {
                        GameState.player.throwGrenade();
                    } else {
                        GameState.player.shoot();
                    }
                }
                e.preventDefault();
            }
        });

        // \u9F20\u6807\u91CA\u653E
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                GameState.mouse.down = false;
                GameState.ambientSliderDragging = false;
                GameState.debugSliderDragging = false;
            }
            if (e.button === 2) GameState.mouse.rightDown = false;
        });

        window.addEventListener('blur', () => {
            GameState.mouse.down = false;
            GameState.mouse.rightDown = false;
            InputManager.seatModifierPressed = false;
        });

        // \u53F3\u952E\u83DC\u5355
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (GameState.radioOpen) {
                GameState.radioClosing = true;
                GameState.radioAnimating = true;
                playRadioClose();
                return;
            }
            // 背包界面：右键丢弃选中物品到脚下
            // 关闭折叠期间不允许操作（与点击选中守卫一致）
            if (GameState.inventoryOpen && GameState.inventoryAnimDirection === null) {
                const selSlot = GameState.inventorySelectedSlot;
                if (selSlot >= 0 && selSlot < 7 && GameState.inventory[selSlot]) {
                    const item = GameState.inventory[selSlot];
                    const player = GameState.player;
                    if (player && player.alive) {
                        if (item.isLoot) {
                            const offsetX = (Math.random() - 0.5) * 30;
                            const offsetY = (Math.random() - 0.5) * 30;
                            GameState.lootPickups.push(new LootPickup(player.x + offsetX, player.y + offsetY, item.lootId));
                            console.log(`\u{1F5D1}\uFE0F \u4E22\u5F03\u6218\u5229\u54C1 ${item.config.name}`);
                        } else {
                            const droppedPickup = new WeaponPickup(player.x, player.y, item);
                            GameState.weaponPickups.push(droppedPickup);
                            console.log(`\u{1F5D1}\uFE0F \u4E22\u5F03\u6B66\u5668 ${item.config.name}`);
                        }
                        GameState.inventory[selSlot] = null;
                        GameState.inventorySelectedSlot = -1;
                        if (GameState.activeWeaponSlot === selSlot) {
                            for (let j = 0; j < 7; j++) {
                                if (GameState.inventory[j]) { GameState.activeWeaponSlot = j; break; }
                            }
                        }
                        playUISound('click');
                        UIManager.updateAll(GameState);
                    }
                }
            }
        });

        // \u519B\u69B0\u5E93\u9F20\u6807\u6EDA\u8F6E
        canvas.addEventListener('wheel', (e) => {
            if (GameState.arsenalOpen) {
                const scrollStep = 40;
                GameState.arsenalScrollOffset = (GameState.arsenalScrollOffset || 0) + (e.deltaY > 0 ? scrollStep : -scrollStep);
                e.preventDefault();
            }
        }, { passive: false });
    },

    _getCategoryItems() {
        const categories = [
            { types: ['pistol'] },
            { types: ['rifle'] },
            { types: ['smg'] },
            { types: ['shotgun'] },
            { types: ['sniper'] },
            { types: ['launcher'] },
            { types: ['melee', 'grenade', 'medical'] }
        ];
        const cat = categories[GameState.arsenalCategory] || categories[0];
        return Object.entries(WeaponRegistry).filter(([, config]) =>
            config.buyPrice >= 0 && cat.types.includes(config.type)
        );
    },

    _scrollToSelected(itemH, rowGap, listTop, viewportHeight) {
        const index = GameState.arsenalSelectedIndex;
        const itemTop = index * (itemH + rowGap);
        const itemBottom = itemTop + itemH;
        const scroll = GameState.arsenalScrollOffset || 0;
        if (itemTop < scroll) {
            GameState.arsenalScrollOffset = itemTop;
        } else if (itemBottom > scroll + viewportHeight) {
            GameState.arsenalScrollOffset = itemBottom - viewportHeight;
        }
    }
};
