// src/input/InputManager.js
import { GameState } from '../core/GameState.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { UIManager } from '../rendering/UIManager.js';
import { Renderer } from '../rendering/Renderer.js';
import { WeaponPickup } from '../entities/WeaponPickup.js';
import { playPickup, playUISound } from '../utils/SoundManager.js';

export const InputManager = {
    setup() {
        const canvas = document.getElementById('gameCanvas');

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            // ====== 死亡状态处理 ======
            if (GameState.gameOver) {
                if (GameState.arsenalOpen) {
                    GameState.arsenalOpen = false;
                }
                if (GameState.permanentDefeat) {
                    e.preventDefault();
                    return;
                }
                // 数字键 1-6 选择据点复活
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
                    e.preventDefault();
                    return;
                }
                if (key === 'q') {
                    GameState.inventoryOpen = false;
                    e.preventDefault();
                    return;
                }
// 军械库：↑ 键切换上一个分类
if (GameState.arsenalOpen && key === 'arrowup') {
    GameState.arsenalCategory = (GameState.arsenalCategory + 6) % 7;
    GameState.arsenalSelectedIndex = 0;
    GameState.arsenalScrollOffset = 0;
    e.preventDefault();
    return;
}
// 军械库：↓ 键切换下一个分类
if (GameState.arsenalOpen && key === 'arrowdown') {
    GameState.arsenalCategory = (GameState.arsenalCategory + 1) % 7;
    GameState.arsenalSelectedIndex = 0;
    GameState.arsenalScrollOffset = 0;
    e.preventDefault();
    return;
}
// 军械库：W 键选择上一个商品（当前分类内）
if (GameState.arsenalOpen && key === 'w') {
    const items = InputManager._getCategoryItems();
    if (items.length > 0) {
        GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex - 1 + items.length) % items.length;
        InputManager._scrollToSelected(68, 6, 8, 320);
    }
    e.preventDefault();
    return;
}
// 军械库：S 键选择下一个商品（当前分类内）
if (GameState.arsenalOpen && key === 's') {
    const items = InputManager._getCategoryItems();
    if (items.length > 0) {
        GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex + 1) % items.length;
        InputManager._scrollToSelected(68, 6, 8, 320);
    }
    e.preventDefault();
    return;
}
        // 军械库购买：B 键购买选中商品
        if (GameState.arsenalOpen && key === 'b') {
            const items = InputManager._getCategoryItems();
            if (items.length === 0) { e.preventDefault(); return; }
            const [selectedId, config] = items[GameState.arsenalSelectedIndex];
            const slot = GameState.arsenalSelectedSlot;
            
            if (GameState.rp >= config.buyPrice) {
                if (!GameState.inventory[slot]) {
                    // 空格子：直接创建新武器
                    GameState.inventory[slot] = new Weapon(selectedId);
                    GameState.rp -= config.buyPrice;
                    console.log(`💰 购买 ${config.name}！`);
                } else if (GameState.inventory[slot].id === selectedId) {
                    const weapon = GameState.inventory[slot];
                    // 堆叠武器（如火箭筒）：增加堆叠数
                    if (config.maxStack && config.maxStack > 1) {
                        if (weapon.stackCount < config.maxStack) {
                            weapon.addStack(1);
                            GameState.rp -= config.buyPrice;
                            console.log(`💰 补充 ${config.name} 弹药（${weapon.stackCount}/${config.maxStack}）！`);
                        }
                    } else {
                        // 普通武器：补充弹药
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
            return;
        }
                // 军械库出售：X 键出售选中武器
                if (GameState.arsenalOpen && key === 'x') {
                    const slot = GameState.arsenalSelectedSlot;
                    const weapon = GameState.inventory[slot];
                    if (weapon && weapon.config.sellPrice > 0) {
                        GameState.rp += weapon.config.sellPrice;
                        GameState.inventory[slot] = null;
                        // 如果出售的是当前武器，切换到其他武器
                        if (GameState.activeWeaponSlot === slot) {
                            for (let i = 0; i < 7; i++) {
                                if (GameState.inventory[i]) {
                                    GameState.activeWeaponSlot = i;
                                    break;
                                }
                            }
                        }
                        console.log('💰 出售武器！');
                        UIManager.updateAll(GameState);
                    }
                    e.preventDefault();
                    return;
                }
                // 数字键 1-7 选择背包位置（军械库中）
                if (GameState.arsenalOpen) {
                    const num = parseInt(e.key);
                    if (num >= 1 && num <= 7) {
                        GameState.arsenalSelectedSlot = num - 1;
                        e.preventDefault();
                        return;
                    }
                }
                return;
            }

            // ====== Debug面板打开时的处理 ======
            if (GameState.debugOpen) {
                // ESC 关闭Debug面板
                if (key === 'escape') {
                    GameState.debugOpen = false;
                    e.preventDefault();
                    return;
                }
                // 9键按下时按1键关闭
                if (key === '1' && GameState.debugKey9Pressed) {
                    GameState.debugOpen = false;
                    GameState.debugKey9Pressed = false;
                    e.preventDefault();
                    return;
                }
                return;
            }

            // ====== 正常游戏操作 ======
            
            // 9键追踪（用于组合键）
            if (key === '9') {
                GameState.debugKey9Pressed = true;
            }
            
            // 9+1 组合键打开Debug面板
            if (key === '1' && GameState.debugKey9Pressed) {
                GameState.debugOpen = true;
                GameState.debugKey9Pressed = false;
                console.log('🐛 打开Debug面板');
                e.preventDefault();
                return;
            }
            
            // K键自杀
            if (key === 'k') {
                if (GameState.player && GameState.player.alive) {
                    GameState.suicideDeath = true; // 标记为自杀
                    GameState.player.alive = false;
                    GameState.player.health = 0;
                    GameState.gameOver = true;
                    console.log('💀 玩家自杀');
                }
                e.preventDefault();
                return;
            }
            
            // 数字键 1-7：切换武器
            const num = parseInt(e.key);
            if (num >= 1 && num <= 7) {
                if (GameState.player && GameState.inventory[num - 1]) {
                    GameState.player.switchWeapon(num - 1);
                }
                e.preventDefault();
                return;
            }

            // G 键：投掷手雷
            if (key === 'g') {
                if (GameState.player) {
                    GameState.player.throwGrenade();
                }
                e.preventDefault();
                return;
            }

            // R 键：换弹
            if (key === 'r') {
                if (GameState.player) {
                    GameState.player.reload();
                }
                e.preventDefault();
                return;
            }

            // F 键：拾取地面武器
            if (key === 'f') {
                if (GameState.player && GameState.player.alive) {
                    const player = GameState.player;
                    let nearestPickup = null;
                    let nearestDist = Infinity;

                    for (const pickup of GameState.weaponPickups) {
                        if (!pickup.alive) continue;
                        if (pickup.canPickup(player)) {
                            const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
                            if (dist < nearestDist) {
                                nearestDist = dist;
                                nearestPickup = pickup;
                            }
                        }
                    }

                    if (nearestPickup) {
                        // 找到空背包槽位
                        let targetSlot = -1;
                        for (let i = 0; i < GameState.inventory.length; i++) {
                            if (!GameState.inventory[i]) {
                                targetSlot = i;
                                break;
                            }
                        }

                        if (targetSlot >= 0) {
                            // 放入空槽位
                            GameState.inventory[targetSlot] = nearestPickup.weapon;
                            console.log(`🔫 拾取 ${nearestPickup.weapon.config.name} 到槽位 ${targetSlot + 1}`);
                        } else {
                            // 背包满了，替换当前武器
                            const currentSlot = GameState.activeWeaponSlot;
                            const oldWeapon = GameState.inventory[currentSlot];

                            // 丢弃当前武器到地面
                            if (oldWeapon) {
                                const droppedPickup = new WeaponPickup(player.x, player.y, oldWeapon);
                                GameState.weaponPickups.push(droppedPickup);
                                console.log(`🔄 丢弃 ${oldWeapon.config.name}`);
                            }

                            GameState.inventory[currentSlot] = nearestPickup.weapon;
                            console.log(`🔫 拾取 ${nearestPickup.weapon.config.name} 替换当前武器`);
                        }

                        nearestPickup.alive = false;
                        playPickup(player);
                        UIManager.updateAll(GameState);
                    }
                }
                e.preventDefault();
                return;
            }

            // E 键：打开/关闭军械库
            if (key === 'e') {
                const arsenal = GameState.arsenal;
                const player = GameState.player;
                if (arsenal && player && arsenal.contains(player)) {
                    GameState.arsenalOpen = !GameState.arsenalOpen;
                    playUISound(GameState.arsenalOpen ? 'click' : 'hover');
                    console.log(GameState.arsenalOpen ? '🔫 打开军械库' : '🔫 关闭军械库');
                }
                e.preventDefault();
                return;
            }

            // Q 键：打开/关闭背包
            if (key === 'q') {
                GameState.inventoryOpen = !GameState.inventoryOpen;
                playUISound(GameState.inventoryOpen ? 'click' : 'hover');
                console.log(GameState.inventoryOpen ? '🎒 打开背包' : '🎒 关闭背包');
                e.preventDefault();
                return;
            }

            // WASD 移动
            if (key in GameState.keys) {
                GameState.keys[key] = true;
                e.preventDefault();
            }

            // 空格/鼠标点击射击
            if (key === ' ' || key === 'space') {
                if (GameState.player) GameState.player.shoot();
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in GameState.keys) {
                GameState.keys[key] = false;
                e.preventDefault();
            }
        });

        // 鼠标移动
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const logicalWidth = canvas.clientWidth;
            const logicalHeight = canvas.clientHeight;
            const scaleX = logicalWidth / rect.width;
            const scaleY = logicalHeight / rect.height;
            GameState.mouse.x = (e.clientX - rect.left) * scaleX;
            GameState.mouse.y = (e.clientY - rect.top) * scaleY;
        });

// 鼠标点击射击/投掷
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        GameState.mouse.down = true;

        // 死亡界面：点击据点复活
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

        // Debug面板点击处理
        if (GameState.debugOpen) {
            const rect = canvas.getBoundingClientRect();
            const logicalWidth = canvas.clientWidth;
            const logicalHeight = canvas.clientHeight;
            const scaleX = logicalWidth / rect.width;
            const scaleY = logicalHeight / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;

            if (Renderer.debugButtons) {
                for (const btn of Renderer.debugButtons) {
                    if (clickX >= btn.x && clickX <= btn.x + btn.w &&
                        clickY >= btn.y && clickY <= btn.y + btn.h) {
                        if (btn.value) {
                            GameState.rp += btn.value;
                            console.log(`🐛 增加 ${btn.value} RP`);
                            UIManager.updateAll(GameState);
                        } else if (btn.action === 'heal') {
                            if (GameState.player) {
                                GameState.player.health = GameState.player.maxHealth;
                                console.log('🐛 满血');
                            }
                        }
                        break;
                    }
                }
            }
            e.preventDefault();
            return;
        }

        // 正常射击
        if (GameState.player) {
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

        // 鼠标释放
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                GameState.mouse.down = false;
            }
        });

        // 窗口失焦时重置鼠标状态
        window.addEventListener('blur', () => {
            GameState.mouse.down = false;
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // 军械库鼠标滚轮滚动
        canvas.addEventListener('wheel', (e) => {
            if (GameState.arsenalOpen) {
                const scrollStep = 40;
                GameState.arsenalScrollOffset = (GameState.arsenalScrollOffset || 0) + (e.deltaY > 0 ? scrollStep : -scrollStep);
                e.preventDefault();
            }
        }, { passive: false });
    },

    // 军械库：获取当前分类的商品列表（7个细分分类）
    _getCategoryItems() {
        const categories = [
            { types: ['pistol'] },                          // 手枪
            { types: ['rifle'] },                           // 步枪
            { types: ['smg'] },                             // 冲锋枪
            { types: ['shotgun'] },                         // 霰弹枪
            { types: ['sniper'] },                          // 狙击枪
            { types: ['launcher'] },                        // 重武器
            { types: ['melee', 'grenade', 'medical'] }      // 其他
        ];
        const cat = categories[GameState.arsenalCategory] || categories[0];
        return Object.entries(WeaponRegistry).filter(([, config]) =>
            config.buyPrice >= 0 && cat.types.includes(config.type)
        );
    },

    // 军械库自动滚动到选中项
    _scrollToSelected(itemH, rowGap, listTop, viewportHeight) {
        const index = GameState.arsenalSelectedIndex;
        const itemTop = index * (itemH + rowGap);
        const itemBottom = itemTop + itemH;
        const scroll = GameState.arsenalScrollOffset || 0;

        if (itemTop < scroll) {
            // 选中项在视口上方，向上滚动
            GameState.arsenalScrollOffset = itemTop;
        } else if (itemBottom > scroll + viewportHeight) {
            // 选中项在视口下方，向下滚动
            GameState.arsenalScrollOffset = itemBottom - viewportHeight;
        }
    }
};
