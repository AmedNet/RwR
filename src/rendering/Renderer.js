// src/rendering/Renderer.js
import { GameState } from '../core/GameState.js';
import { EffectsManager } from '../utils/EffectsManager.js';
import { WeaponRegistry } from '../core/WeaponRegistry.js';

export const Renderer = {
    canvas: null,
    ctx: null,
    logicalWidth: 0,
    logicalHeight: 0,
    weaponImages: {}, // 武器贴图缓存 { weaponId: HTMLImageElement }
    weaponImagesLoaded: {},

    // 预加载武器贴图
    loadWeaponImages() {
        for (const [id, config] of Object.entries(WeaponRegistry)) {
            if (!config.imagePath) continue;
            const img = new Image();
            img.src = config.imagePath;
            this.weaponImages[id] = img;
            this.weaponImagesLoaded[id] = false;
            img.onload = () => { this.weaponImagesLoaded[id] = true; };
        }
    },

    // 获取武器贴图，如果未加载返回 null
    getWeaponImage(weaponId) {
        if (this.weaponImagesLoaded[weaponId]) {
            return this.weaponImages[weaponId];
        }
        return null;
    },

    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('❌ 找不到 gameCanvas!');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        console.log('✅ Renderer 初始化成功');
    },

    resize() {
        if (!this.canvas) this.init();
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        const width = rect.width;
        const height = rect.height;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.logicalWidth = width;
        this.logicalHeight = height;
        console.log(`📐 画布尺寸: ${width}x${height}`);
    },

    get width() {
        return this.logicalWidth || (this.canvas ? this.canvas.clientWidth : 0);
    },
    get height() {
        return this.logicalHeight || (this.canvas ? this.canvas.clientHeight : 0);
    },

    clear() {
        if (!this.ctx) {
            console.warn('Renderer: ctx 未初始化');
            return;
        }
        this.ctx.clearRect(0, 0, this.width, this.height);
    },

    toScreen(wx, wy) {
        return { x: wx - GameState.camera.x, y: wy - GameState.camera.y };
    },

    render() {
        if (!this.ctx) {
            console.warn('⚠️ Renderer: ctx 未初始化，无法渲染');
            return;
        }
        this.clear();

        // 确保武器贴图已加载
        if (Object.keys(this.weaponImages).length === 0) {
            this.loadWeaponImages();
        }

        // 控制HUD显示
        const menuOpen = GameState.inventoryOpen || GameState.arsenalOpen;
        const hud = document.getElementById('hud');
        if (hud) {
            hud.style.display = menuOpen ? 'none' : 'flex';
        }

        // Game Over 优先级最高
        if (GameState.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.drawGameOver();
            return;
        }

        // 如果菜单打开，跳过游戏世界渲染
        if (menuOpen) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            if (GameState.arsenalOpen) {
                this.drawArsenalShop();
            } else if (GameState.inventoryOpen) {
                this.drawInventory();
            }
            return;
        }

        // 绘制地图
        if (GameState.map) {
            GameState.map.draw(this.ctx, GameState.camera);
        } else {
            // 如果没有地图，绘制一个简单的提示
            this.ctx.fillStyle = '#2d4a22';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('地图加载中...', this.width/2, this.height/2);
        }

        // 绘制据点
        for (const point of GameState.capturePoints) {
            point.draw(this.ctx);
        }

        // 绘制军械库
        if (GameState.arsenal) {
            GameState.arsenal.draw(this.ctx);
        }

        // 绘制手雷
        for (const g of GameState.grenades) {
            g.draw(this.ctx);
        }

        // 绘制实体（优化：减少save/restore）
        const { player, enemies, teammates, bullets } = GameState;
        
// 子弹
for (const b of bullets) {
    if (!b.alive) continue;
    const pos = this.toScreen(b.x, b.y);
    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    b.draw(this.ctx);
    this.ctx.restore();
}
        
        // 敌人（优化：批量渲染）
        for (const e of enemies) {
            if (!e.alive) continue;
            const pos = this.toScreen(e.x, e.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            e.draw(this.ctx);
            this.ctx.restore();
        }
        
        // 队友（优化：批量渲染）
        for (const t of teammates) {
            if (!t.alive) continue;
            const pos = this.toScreen(t.x, t.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            t.draw(this.ctx);
            this.ctx.restore();
        }
        
        // 玩家
        if (player && player.alive) {
            const pos = this.toScreen(player.x, player.y);
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            player.draw(this.ctx);
            this.ctx.restore();
        }

        // 绘制特效（粒子、伤害数字）
        EffectsManager.draw(this.ctx, GameState.camera);

        // 绘制武器 HUD（不再菜单或 GameOver 时显示）
        this.drawWeaponHUD();
    },

    drawWeaponHUD() {
        const ctx = this.ctx;
        ctx.save();

        // 右下角当前武器详情（毛玻璃背景）
        const weapon = GameState.getActiveWeapon();
        if (weapon) {
            const panelW = 200;
            const panelH = 80;
            const panelX = this.width - panelW - 15;
            const panelY = this.height - panelH - 80;

            // 毛玻璃背景
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.beginPath();
            ctx.roundRect(panelX, panelY, panelW, panelH, 10);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 武器贴图缩略图
            const wImg = this.getWeaponImage(weapon.id);
            if (wImg) {
                const thumbH = 50;
                const scale = thumbH / wImg.naturalHeight;
                const thumbW = wImg.naturalWidth * scale;
                ctx.drawImage(wImg, panelX + 15, panelY + panelH / 2 - thumbH / 2, thumbW, thumbH);
            }

            // 武器名
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapon.config.name, panelX + 75, panelY + 28);

            // 弹药信息
            if (weapon.config.type !== 'melee') {
                if (weapon.isReloading) {
                    const progress = weapon.getReloadProgress();
                    ctx.fillStyle = '#FFC107';
                    ctx.font = '12px sans-serif';
                    ctx.fillText(`换弹中 ${Math.floor(progress * 100)}%`, panelX + 75, panelY + 52);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(panelX + 75, panelY + 58, 110, 8);
                    ctx.fillStyle = '#FFC107';
                    ctx.fillRect(panelX + 75, panelY + 58, 110 * progress, 8);
                } else {
                    const ammoColor = weapon.ammo <= 5 ? '#ff5252' : (weapon.ammo <= 10 ? '#FFC107' : '#4CAF50');
                    ctx.fillStyle = ammoColor;
                    ctx.font = 'bold 16px sans-serif';
                    ctx.fillText(`弹药 ${weapon.ammo}/${weapon.config.magSize}`, panelX + 75, panelY + 52);
                }
            }
        }

        // 底部武器槽位（毛玻璃风格）
        const slotCount = 4;
        const slotSize = 52;
        const gap = 8;
        const totalW = slotCount * slotSize + (slotCount - 1) * gap;
        const startX = (this.width - totalW) / 2;
        const startY = this.height - slotSize - 20;

        // 整体背景（毛玻璃）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.roundRect(startX - 10, startY - 8, totalW + 20, slotSize + 16, 12);
        ctx.fill();

        for (let i = 0; i < slotCount; i++) {
            const x = startX + i * (slotSize + gap);
            const isActive = i === GameState.activeWeaponSlot;
            
            // 槽位背景
            ctx.fillStyle = isActive ? 'rgba(76, 175, 80, 0.7)' : 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.roundRect(x, startY, slotSize, slotSize, 6);
            ctx.fill();
            if (isActive) {
                ctx.strokeStyle = '#4CAF50';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            const slotWeapon = GameState.inventory[i];
            if (slotWeapon) {
                // 武器缩略图
                const sImg = this.getWeaponImage(slotWeapon.id);
                if (sImg) {
                    const sH = 35;
                    const sScale = sH / sImg.naturalHeight;
                    const sW = sImg.naturalWidth * sScale;
                    ctx.drawImage(sImg, x + slotSize / 2 - sW / 2, startY + 6, sW, sH);
                }
                // 弹药数
                if (slotWeapon.config.type !== 'melee') {
                    ctx.fillStyle = slotWeapon.ammo === 0 ? '#ff5252' : 'rgba(255,255,255,0.7)';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(`${slotWeapon.ammo}`, x + slotSize / 2, startY + slotSize - 4);
                }
                // 快捷键
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(`${i + 1}`, x + 4, startY + 4);
            } else {
                // 空槽位
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${i + 1}`, x + slotSize / 2, startY + slotSize / 2);
            }
        }

        ctx.restore();
    },

    drawInventory() {
        const ctx = this.ctx;
        ctx.save();

        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 标题
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎒 背包', this.width / 2, 80);

        // 玩家信息
        const player = GameState.player;
        if (player) {
            ctx.fillStyle = '#fff';
            ctx.font = '24px sans-serif';
            ctx.fillText(`军衔: ${player.getRankName()}`, this.width / 2, 140);

            // 血量条
            const barWidth = 300;
            const barHeight = 30;
            const barX = this.width / 2 - barWidth / 2;
            const barY = 170;

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const hpPercent = player.health / player.maxHealth;
            ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : (hpPercent > 0.3 ? '#FFC107' : '#f44336');
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`${Math.floor(player.health)} / ${player.maxHealth}`, this.width / 2, barY + barHeight / 2);
        }

        // RP值
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`💰 RP: ${GameState.rp}`, this.width / 2, 240);

        // 背包格子
        const slotSize = 80;
        const slotGap = 20;
        const slotsPerRow = 4;
        const startX = this.width / 2 - (slotsPerRow * slotSize + (slotsPerRow - 1) * slotGap) / 2;
        const startY = 300;

        for (let i = 0; i < 4; i++) {
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            const x = startX + col * (slotSize + slotGap);
            const y = startY + row * (slotSize + slotGap);

            // 格子背景
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(x, y, slotSize, slotSize);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, slotSize, slotSize);

            // 物品
            const item = GameState.inventory[i];
            if (item) {
                // 武器缩略图
                const invImg = this.getWeaponImage(item.id);
                if (invImg) {
                    const invH = 50;
                    const invScale = invH / invImg.naturalHeight;
                    const invW = invImg.naturalWidth * invScale;
                    ctx.drawImage(invImg, x + slotSize / 2 - invW / 2, y + slotSize / 2 - invH / 2 - 5, invW, invH);
                } else {
                    ctx.font = '36px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(item.config.type === 'grenade' ? '💣' : '🔫', x + slotSize / 2, y + slotSize / 2);
                }
                // 武器名称
                ctx.fillStyle = '#aaa';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(item.config.name, x + slotSize / 2, y + slotSize - 4);
                // 弹药数
                if (item.config.type !== 'melee') {
                    ctx.fillStyle = item.ammo === 0 ? '#ff5252' : 'rgba(255,255,255,0.7)';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                    ctx.fillText(`${item.ammo}`, x + slotSize - 4, y + 4);
                }
            } else {
                // 空槽位编号
                ctx.fillStyle = '#666';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`[${i + 1}]`, x + slotSize / 2, y + slotSize / 2);
            }
        }

        // 底部提示
        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('按 Q 关闭背包', this.width / 2, startY + 120);

        ctx.restore();
    },

    drawArsenalShop() {
        const ctx = this.ctx;
        ctx.save();

        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 标题
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔫 军械库', this.width / 2, 60);

        // RP 显示
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`💰 RP: ${GameState.rp}`, this.width / 2, 110);

        // --- 购买区 ---
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('━━━ 购买 ━━━', this.width / 2, 155);

        // 获取所有可购买商品
        const shopItems = Object.entries(WeaponRegistry).filter(([, config]) => config.buyPrice > 0);
        const itemX = this.width / 2;
        const itemW = 400;
        const itemH = 80;
        const rowGap = 15;

        shopItems.forEach(([id, config], index) => {
            const itemY = 190 + index * (itemH + rowGap);
            const isSelected = index === GameState.arsenalSelectedIndex;

            // 选中高亮边框
            if (isSelected) {
                ctx.strokeStyle = '#4CAF50';
                ctx.lineWidth = 3;
                ctx.strokeRect(itemX - itemW / 2, itemY, itemW, itemH);
            }

            // 商品背景
            ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(itemX - itemW / 2, itemY, itemW, itemH);
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(itemX - itemW / 2, itemY, itemW, itemH);

            // 武器贴图
            const shopImg = this.getWeaponImage(id);
            if (shopImg) {
                const shopH = 50;
                const shopScale = shopH / shopImg.naturalHeight;
                const shopW = shopImg.naturalWidth * shopScale;
                ctx.drawImage(shopImg, itemX - 170 - shopW / 2, itemY + itemH / 2 - shopH / 2, shopW, shopH);
            } else {
                ctx.font = '36px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(config.type === 'grenade' ? '💣' : '🔫', itemX - 170, itemY + itemH / 2);
            }

            // 名称
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(config.name, itemX - 120, itemY + 32);
            ctx.fillStyle = '#aaa';
            ctx.font = '14px sans-serif';
            const typeText = config.type === 'grenade' ? `装填 ${config.magSize} 发 | 手雷` : `弹容量 ${config.magSize} | ${config.type === 'pistol' ? '手枪' : '步枪'}`;
            ctx.fillText(typeText, itemX - 120, itemY + 58);

            // 价格
            ctx.fillStyle = GameState.rp >= config.buyPrice ? '#FFD700' : '#ff5252';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`💰 ${config.buyPrice}`, itemX + 170, itemY + 30);

            // 选中指示器
            if (isSelected) {
                ctx.fillStyle = '#4CAF50';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText('▶', itemX - itemW / 2 + 10, itemY + itemH / 2);
            }
        });

        // --- 出售区 ---
        const sellSectionY = 190 + shopItems.length * (itemH + rowGap) + 20;
        ctx.fillStyle = '#ff5252';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('━━━ 出售 ━━━', this.width / 2, sellSectionY);

        // 选择背包位置的提示
        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.fillText('当前选中: 背包第 ' + (GameState.arsenalSelectedSlot + 1) + ' 格', itemX, sellSectionY + 35);

        // 背包4格显示
        const slotSize = 90;
        const slotGap = 15;
        const slotStartX = itemX - (4 * slotSize + 3 * slotGap) / 2;
        const slotStartY = sellSectionY + 60;

        for (let i = 0; i < 4; i++) {
            const sx = slotStartX + i * (slotSize + slotGap);
            const isSelected = i === GameState.arsenalSelectedSlot;

            ctx.fillStyle = isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(sx, slotStartY, slotSize, slotSize);
            ctx.strokeStyle = isSelected ? '#4CAF50' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeRect(sx, slotStartY, slotSize, slotSize);

            const weapon = GameState.inventory[i];
            if (weapon) {
                // 武器缩略图
                const sImg = this.getWeaponImage(weapon.id);
                if (sImg) {
                    const sH = 50;
                    const sScale = sH / sImg.naturalHeight;
                    const sW = sImg.naturalWidth * sScale;
                    ctx.drawImage(sImg, sx + slotSize / 2 - sW / 2, slotStartY + 8, sW, sH);
                } else {
                    ctx.font = '24px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(weapon.config.type === 'grenade' ? '💣' : '🔫', sx + slotSize / 2, slotStartY + slotSize / 2 - 10);
                }
                ctx.fillStyle = '#aaa';
                ctx.font = '12px sans-serif';
                ctx.fillText(weapon.config.name, sx + slotSize / 2, slotStartY + slotSize - 15);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = '14px sans-serif';
                ctx.fillText('空', sx + slotSize / 2, slotStartY + slotSize / 2);
            }

            // 快捷键
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '10px sans-serif';
            ctx.fillText(`[${i + 1}]`, sx + 10, slotStartY + 15);
        }

        // 出售按钮
        const selectedWeapon = GameState.inventory[GameState.arsenalSelectedSlot];
        if (selectedWeapon && selectedWeapon.config.sellPrice > 0) {
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`[S] 出售 ${selectedWeapon.config.name} 获得 💰${selectedWeapon.config.sellPrice}`, itemX, slotStartY + slotSize + 35);
        } else {
            ctx.fillStyle = '#666';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('选中空槽或无出售价值', itemX, slotStartY + slotSize + 35);
        }

        // 底部提示
        ctx.fillStyle = '#aaa';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↑↓ 选择商品 | 1-4 选择背包格 | B 购买 | S 出售 | E 关闭', this.width / 2, this.height - 30);

        ctx.restore();
    },

    drawGameOver() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 永久战败（无据点可复活）
        if (GameState.permanentDefeat) {
            ctx.fillStyle = '#ff1744';
            ctx.font = 'bold 56px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💀 战败', this.width/2, this.height/2 - 60);
            ctx.fillStyle = '#fff';
            ctx.font = '24px sans-serif';
            ctx.fillText(`所有据点已失守，游戏结束`, this.width/2, this.height/2);
            ctx.fillStyle = '#ff9800';
            ctx.font = '20px sans-serif';
            const rank = GameState.player ? GameState.player.getRankName() : '列兵';
            ctx.fillText(`最终军衔: ${rank}  |  击杀: ${GameState.kills}  |  得分: ${GameState.score}`, this.width/2, this.height/2 + 50);
            ctx.restore();
            return;
        }

        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('阵亡', this.width/2, this.height/2 - 120);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        const rank = GameState.player ? GameState.player.getRankName() : '列兵';
        ctx.fillText(`军衔: ${rank}  |  击杀: ${GameState.kills}  |  得分: ${GameState.score}`, this.width/2, this.height/2 - 60);

        // 列出己方据点供选择
        const playerPoints = GameState.capturePoints.filter(p => p.owner === 'player');
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('选择复活据点:', this.width/2, this.height/2 - 10);

        if (playerPoints.length > 0) {
            ctx.font = '20px sans-serif';
            for (let i = 0; i < playerPoints.length; i++) {
                const p = playerPoints[i];
                const y = this.height/2 + 30 + i * 40;
                ctx.fillStyle = '#4CAF50';
                ctx.fillText(`[${i + 1}]`, this.width/2 - 120, y);
                ctx.fillStyle = '#fff';
                ctx.fillText(`据点 #${i + 1}  (${Math.round(p.x)}, ${Math.round(p.y)})`, this.width/2 - 60, y);
            }
        } else {
            ctx.fillStyle = '#ff9800';
            ctx.font = '20px sans-serif';
            ctx.fillText('⚠️ 无己方据点！失守即败！', this.width/2, this.height/2 + 30);
        }

        ctx.fillStyle = '#aaa';
        ctx.font = '16px sans-serif';
        ctx.fillText('按数字键 1-6 选择据点复活', this.width/2, this.height/2 + 30 + Math.max(playerPoints.length, 1) * 40 + 20);
        ctx.restore();
    }
};