// src/rendering/Minimap.js
import { GameState } from '../core/GameState.js';
import { Renderer } from './Renderer.js';

export const Minimap = {
    canvas: null,
    ctx: null,
    size: 160,
    padding: 15,
    initialized: false,
    offscreenCanvas: null,
    offscreenCtx: null,
    mapDirty: true,

    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        // 显式设置 CSS 尺寸，防止被意外拉伸
        this.canvas.style.width = this.size + 'px';
        this.canvas.style.height = this.size + 'px';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = this.padding + 'px';
        this.canvas.style.right = this.padding + 'px';
        this.canvas.style.borderRadius = '12px';
        this.canvas.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        this.canvas.style.border = '1px solid rgba(255,255,255,0.15)';
        this.canvas.style.backdropFilter = 'blur(8px)';
        this.canvas.style.backgroundColor = 'rgba(0,0,0,0.6)';
        this.canvas.style.zIndex = '20';
        this.canvas.style.pointerEvents = 'none'; // 允许点击穿透
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        // 创建离屏canvas缓存地形
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.size;
        this.offscreenCanvas.height = this.size;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        
        this.initialized = true;
        console.log('🗺️ 小地图初始化完成（带离屏缓存）');
    },

    render() {
        if (!this.initialized) return;
        const ctx = this.ctx;
        const size = this.size;
        ctx.clearRect(0, 0, size, size);

        const map = GameState.map;
        if (!map) return;
        const worldW = map.cols * map.tileSize;
        const worldH = map.rows * map.tileSize;
        const scaleX = size / worldW;
        const scaleY = size / worldH;

        // 如果地图数据变化，重绘地形到离屏canvas
        if (this.mapDirty) {
            this.offscreenCtx.clearRect(0, 0, size, size);
            const step = Math.max(1, Math.floor(Math.min(map.rows, map.cols) / 250));
            
            for (let r = 0; r < map.rows; r += step) {
                for (let c = 0; c < map.cols; c += step) {
                    const tile = map.getTile(c, r);
                    const x = c * map.tileSize * scaleX;
                    const y = r * map.tileSize * scaleY;
                    const w = map.tileSize * scaleX * step;
                    const h = map.tileSize * scaleY * step;

                    let color;
                    switch (tile) {
                        case 0: color = 'rgba(76, 175, 80, 0.3)'; break;
                        case 1: color = 'rgba(139, 69, 19, 0.7)'; break;
                        case 2: color = 'rgba(66, 165, 245, 0.5)'; break;
                        case 4: color = 'rgba(27, 94, 32, 0.5)'; break;
                        case 5: color = 'rgba(117, 117, 117, 0.6)'; break;
                        case 6: color = 'rgba(215, 204, 200, 0.4)'; break;
                        default: color = 'rgba(76, 175, 80, 0.3)';
                    }
                    this.offscreenCtx.fillStyle = color;
                    this.offscreenCtx.fillRect(x, y, w + 0.5, h + 0.5);
                }
            }
            this.mapDirty = false;
        }

        // 从离屏canvas复制地形到主canvas
        ctx.drawImage(this.offscreenCanvas, 0, 0);

        // 据点
        for (const point of GameState.capturePoints) {
            const x = point.x * scaleX;
            const y = point.y * scaleY;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = point.owner === 'player' ? '#4CAF50' :
                           (point.owner === 'enemy' ? '#f44336' : '#FFD740');
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 敌人（红点）
        for (const enemy of GameState.enemies) {
            if (!enemy.alive) continue;
            const x = enemy.x * scaleX;
            const y = enemy.y * scaleY;
            ctx.fillStyle = '#ff1744';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 队友（蓝点）
        for (const teammate of GameState.teammates) {
            if (!teammate.alive) continue;
            const x = teammate.x * scaleX;
            const y = teammate.y * scaleY;
            ctx.fillStyle = '#42A5F5';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 玩家（绿点 + 方向指示，无shadowBlur）
        if (GameState.player) {
            const p = GameState.player;
            const x = p.x * scaleX;
            const y = p.y * scaleY;
            ctx.fillStyle = '#4CAF50';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            // 方向线
            const angle = Math.atan2(GameState.mouse.y - (p.y - GameState.camera.y), GameState.mouse.x - (p.x - GameState.camera.x));
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * 10 * scaleX, y + Math.sin(angle) * 10 * scaleY);
            ctx.stroke();
        }

        // 军械库（金色星标，无shadowBlur）
        if (GameState.arsenal) {
            const ax = GameState.arsenal.x * scaleX;
            const ay = GameState.arsenal.y * scaleY;
            ctx.fillStyle = '#FFD740';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', ax, ay);
        }

        // 视野框
        const cam = GameState.camera;
        const camW = Renderer.width;
        const camH = Renderer.height;
        const vx = cam.x * scaleX;
        const vy = cam.y * scaleY;
        const vw = camW * scaleX;
        const vh = camH * scaleY;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(vx, vy, vw, vh);
        ctx.setLineDash([]);
    }
};
