// src/input/InputManager.js
import { GameState } from '../core/GameState.js';
import { Weapon } from '../core/Weapon.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';
import { UIManager } from '../rendering/UIManager.js';

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
        // 军械库：↑/W 键选择上一个商品
        if (GameState.arsenalOpen && (key === 'arrowup' || key === 'w')) {
            const items = Object.entries(WeaponRegistry).filter(([,c]) => c.buyPrice > 0);
            GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex - 1 + items.length) % items.length;
            e.preventDefault();
            return;
        }
        // 军械库：↓ 键选择下一个商品
        if (GameState.arsenalOpen && key === 'arrowdown') {
            const items = Object.entries(WeaponRegistry).filter(([,c]) => c.buyPrice > 0);
            GameState.arsenalSelectedIndex = (GameState.arsenalSelectedIndex + 1) % items.length;
            e.preventDefault();
            return;
        }
        // 军械库购买：B 键购买选中商品
        if (GameState.arsenalOpen && key === 'b') {
            const items = Object.entries(WeaponRegistry).filter(([,c]) => c.buyPrice > 0);
            const [selectedId, config] = items[GameState.arsenalSelectedIndex];
            const slot = GameState.arsenalSelectedSlot;
            
            if (GameState.rp >= config.buyPrice) {
                if (!GameState.inventory[slot]) {
                    // 空格子：直接创建新武器
                    GameState.inventory[slot] = new Weapon(selectedId);
                    GameState.rp -= config.buyPrice;
                    console.log(`💰 购买 ${config.name}！`);
                } else if (GameState.inventory[slot].id === selectedId) {
                    // 已有同类武器：补充弹药
                    const maxAmmo = config.magSize;
                    if (GameState.inventory[slot].ammo < maxAmmo) {
                        GameState.inventory[slot].ammo = maxAmmo;
                        GameState.rp -= config.buyPrice;
                        console.log(`💰 补充 ${config.name} 弹药！`);
                    }
                }
                // 刷新HUD的RP显示
                UIManager.updateAll(GameState);
            }
            e.preventDefault();
            return;
        }
                // 军械库出售：S 键出售选中武器
                if (GameState.arsenalOpen && key === 's') {
                    const slot = GameState.arsenalSelectedSlot;
                    const weapon = GameState.inventory[slot];
                    if (weapon && weapon.config.sellPrice > 0) {
                        GameState.rp += weapon.config.sellPrice;
                        GameState.inventory[slot] = null;
                        // 如果出售的是当前武器，切换到其他武器
                        if (GameState.activeWeaponSlot === slot) {
                            for (let i = 0; i < 4; i++) {
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
                // 数字键 1-4 选择背包位置（军械库中）
                if (GameState.arsenalOpen) {
                    const num = parseInt(e.key);
                    if (num >= 1 && num <= 4) {
                        GameState.arsenalSelectedSlot = num - 1;
                        e.preventDefault();
                        return;
                    }
                }
                return;
            }

            // ====== 正常游戏操作 ======
            
            // 数字键 1-4：切换武器
            const num = parseInt(e.key);
            if (num >= 1 && num <= 4) {
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

            // E 键：打开/关闭军械库
            if (key === 'e') {
                const arsenal = GameState.arsenal;
                const player = GameState.player;
                if (arsenal && player && arsenal.contains(player)) {
                    GameState.arsenalOpen = !GameState.arsenalOpen;
                    console.log(GameState.arsenalOpen ? '🔫 打开军械库' : '🔫 关闭军械库');
                }
                e.preventDefault();
                return;
            }

            // Q 键：打开/关闭背包
            if (key === 'q') {
                GameState.inventoryOpen = !GameState.inventoryOpen;
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
            if (e.button === 0 && GameState.player) {
                const weapon = GameState.getActiveWeapon();
                if (weapon && weapon.config.type === 'grenade') {
                    GameState.player.throwGrenade();
                } else {
                    GameState.player.shoot();
                }
                e.preventDefault();
            }
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
};
