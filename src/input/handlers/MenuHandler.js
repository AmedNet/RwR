// src/input/handlers/MenuHandler.js
// 背包 + 军械库界面的按键/点击/右键/滚轮处理
import { GameState } from '../../core/GameState.js';
import { Weapon } from '../../core/Weapon.js';
import { WeaponRegistry } from '../../core/WeaponRegistry.js';
import { UIManager } from '../../rendering/UIManager.js';
import { WeaponPickup } from '../../entities/WeaponPickup.js';
import { LootPickup } from '../../entities/LootPickup.js';
import { LootItem } from '../../core/LootItem.js';
import { playUISound } from '../../utils/SoundManager.js';

// ─── 军械库辅助函数（原 InputManager._getCategoryItems / _scrollToSelected） ───

function getCategoryItems() {
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
}

function scrollToSelected(itemH, rowGap, listTop, viewportHeight) {
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

// ─── 丢弃选中物品（背包 D 键 / 右键共用） ───

function dropSelectedInventoryItem() {
    const selSlot = GameState.inventorySelectedSlot;
    if (selSlot < 0 || selSlot >= 7 || !GameState.inventory[selSlot]) return;
    const item = GameState.inventory[selSlot];
    const player = GameState.player;
    if (!player || !player.alive) return;
    if (item.isLoot) {
        const offsetX = (Math.random() - 0.5) * 30;
        const offsetY = (Math.random() - 0.5) * 30;
        GameState.lootPickups.push(new LootPickup(player.x + offsetX, player.y + offsetY, item.lootId));
        console.log(`🗑️ 丢弃战利品 ${item.config.name}`);
    } else {
        const droppedPickup = new WeaponPickup(player.x, player.y, item);
        GameState.weaponPickups.push(droppedPickup);
        console.log(`🗑️ 丢弃武器 ${item.config.name}`);
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

// ─── keydown 处理（菜单打开时） ───

export function handleMenuKeydown(e, key) {
    // 关闭菜单（支持中途可反向打断）
    if (key === 'e') {
        if (GameState.arsenalOpen) {
            GameState.toggleArsenal();
            playUISound('click');
        }
        e.preventDefault();
        return true;
    }
    if (key === 'q') {
        if (GameState.inventoryOpen) {
            GameState.toggleInventory();
            playUISound('click');
        }
        e.preventDefault();
        return true;
    }

    // === 背包界面专属按键 ===
    if (GameState.inventoryOpen && GameState.inventoryAnimDirection === null) {
        if (key === 'd') {
            dropSelectedInventoryItem();
            e.preventDefault();
            return true;
        }
    }

    // === 军械库专属按键 ===
    if (GameState.arsenalOpen && GameState.arsenalAnimDirection === null) {
        if (key === 'arrowup') {
            GameState.arsenalCategory = (GameState.arsenalCategory + 6) % 7;
            GameState.arsenalSelectedIndex = 0;
            GameState.arsenalScrollOffset = 0;
            e.preventDefault();
            return true;
        }
        if (key === 'arrowdown') {
            GameState.arsenalCategory = (GameState.arsenalCategory + 1) % 7;
            GameState.arsenalSelectedIndex = 0;
            GameState.arsenalScrollOffset = 0;
            e.preventDefault();
            return true;
        }
        if (key === 'w') {
            const items = getCategoryItems();
            if (items.length > 0) {
                GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex - 1 + items.length) % items.length;
                scrollToSelected(68, 6, 8, 320);
            }
            e.preventDefault();
            return true;
        }
        if (key === 's') {
            const items = getCategoryItems();
            if (items.length > 0) {
                GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex + 1) % items.length;
                scrollToSelected(68, 6, 8, 320);
            }
            e.preventDefault();
            return true;
        }
        if (key === 'b') {
            const items = getCategoryItems();
            if (items.length === 0) { e.preventDefault(); return true; }
            const [selectedId, config] = items[GameState.arsenalSelectedIndex];
            const slot = GameState.arsenalSelectedSlot;
            if (GameState.rp >= config.buyPrice) {
                if (!GameState.inventory[slot]) {
                    GameState.inventory[slot] = new Weapon(selectedId);
                    GameState.rp -= config.buyPrice;
                    console.log(`💰 购买 ${config.name}！`);
                } else if (GameState.inventory[slot].id === selectedId) {
                    const weapon = GameState.inventory[slot];
                    if (config.maxStack && config.maxStack > 1) {
                        if (weapon.stackCount < config.maxStack) {
                            weapon.addStack(1);
                            GameState.rp -= config.buyPrice;
                            console.log(`💰 补充 ${config.name} 弹药（${weapon.stackCount}/${config.maxStack}）！`);
                        }
                    } else {
                        const maxAmmo = config.magSize;
                        if (weapon.ammo < maxAmmo) {
                            weapon.ammo = maxAmmo;
                            GameState.rp -= config.buyPrice;
                            console.log(`💰 补充 ${config.name} 弹药！`);
                        }
                    }
                }
                UIManager.updateAll(GameState);
            }
            e.preventDefault();
            return true;
        }
        if (key === 'x') {
            const slot = GameState.arsenalSelectedSlot;
            const item = GameState.inventory[slot];
            if (item && item.isLoot) {
                GameState.rp += item.config.value;
                GameState.inventory[slot] = null;
                if (GameState.activeWeaponSlot === slot) {
                    for (let i = 0; i < 7; i++) {
                        if (GameState.inventory[i]) { GameState.activeWeaponSlot = i; break; }
                    }
                }
                console.log(`💰 出售战利品 ${item.config.name}，+$${item.config.value}`);
                UIManager.updateAll(GameState);
            } else if (item && item.config.sellPrice > 0) {
                GameState.rp += item.config.sellPrice;
                GameState.inventory[slot] = null;
                if (GameState.activeWeaponSlot === slot) {
                    for (let i = 0; i < 7; i++) {
                        if (GameState.inventory[i]) { GameState.activeWeaponSlot = i; break; }
                    }
                }
                console.log('💰 出售武器！');
                UIManager.updateAll(GameState);
            }
            e.preventDefault();
            return true;
        }
        const num = parseInt(e.key);
        if (num >= 1 && num <= 7) {
            GameState.arsenalSelectedSlot = num - 1;
            e.preventDefault();
            return true;
        }
    }

    // F键不拦截，让它穿透到拾取逻辑
    if (key === 'f') {
        GameState.inventoryOpen = false;
        GameState.arsenalOpen = false;
        GameState.arsenalAnimDirection = null;
        GameState.arsenalAnimProgress = 0;
        return false; // 不拦截，继续到 GameplayHandler
    }

    return true; // 其他按键在菜单打开时被吞噬
}

// ─── mousedown 处理（背包格子点击选中） ───

export function handleMenuMousedown(e, canvas) {
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
                return true;
            }
        }
    }
    return false;
}

// ─── contextmenu 处理（右键丢弃） ───

export function handleMenuContextmenu(e) {
    if (GameState.inventoryOpen && GameState.inventoryAnimDirection === null) {
        dropSelectedInventoryItem();
    }
}

// ─── wheel 处理（军械库滚轮） ───

export function handleMenuWheel(e) {
    if (GameState.arsenalOpen) {
        const scrollStep = 40;
        GameState.arsenalScrollOffset = (GameState.arsenalScrollOffset || 0) + (e.deltaY > 0 ? scrollStep : -scrollStep);
        e.preventDefault();
    }
}