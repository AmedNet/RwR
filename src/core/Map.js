// src/core/Map.js
import { GameState } from './GameState.js';

export const Terrain = {
    GRASS: 0,
    HOUSE: 1,
    RIVER: 2,
    CAPTURE: 3,
    FOREST: 4,
    MOUNTAIN: 5,
    ROAD: 6,
};

const TERRAIN_COLORS = {
    [Terrain.GRASS]: '#4CAF50',
    [Terrain.HOUSE]: '#8D6E63',
    [Terrain.RIVER]: '#42A5F5',
    [Terrain.CAPTURE]: '#FFD740',
    [Terrain.FOREST]: '#2E7D32',
    [Terrain.MOUNTAIN]: '#757575',
    [Terrain.ROAD]: '#D7CCC8',
};

export class Map {
    constructor(config) {
        this.cols = config.cols;
        this.rows = config.rows;
        this.tileSize = config.tileSize;
        this.data = [];
        for (let r = 0; r < this.rows; r++) {
            this.data[r] = new Array(this.cols).fill(Terrain.GRASS);
        }
    }

    loadData(data) {
        if (data.length !== this.rows || data[0].length !== this.cols) {
            console.warn('地图尺寸不匹配，重新调整');
            this.rows = data.length;
            this.cols = data[0].length;
        }
        this.data = data;
    }

    getTile(col, row) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return -1;
        return this.data[row][col];
    }

    worldToTile(wx, wy) {
        const col = Math.floor(wx / this.tileSize);
        const row = Math.floor(wy / this.tileSize);
        return { col, row };
    }

    // 判断世界坐标是否可通行，使用精确的圆-矩形碰撞检测
    isWalkable(wx, wy, radius = 0) {
        const tileSize = this.tileSize;
        
        // 计算圆形边界覆盖的格子范围
        const minCol = Math.floor((wx - radius) / tileSize);
        const maxCol = Math.floor((wx + radius) / tileSize);
        const minRow = Math.floor((wy - radius) / tileSize);
        const maxRow = Math.floor((wy + radius) / tileSize);
        
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const tile = this.getTile(col, row);
                if (tile === -1 || tile === Terrain.HOUSE || tile === Terrain.MOUNTAIN) {
                    // 计算格子矩形上离圆心最近的点
                    const tileLeft = col * tileSize;
                    const tileRight = tileLeft + tileSize;
                    const tileTop = row * tileSize;
                    const tileBottom = tileTop + tileSize;
                    
                    const closestX = Math.max(tileLeft, Math.min(wx, tileRight));
                    const closestY = Math.max(tileTop, Math.min(wy, tileBottom));
                    
                    const dx = wx - closestX;
                    const dy = wy - closestY;
                    const distSq = dx * dx + dy * dy;
                    
                    // 如果距离小于半径，说明碰撞
                    if (distSq < radius * radius) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    getSpeedFactor(wx, wy) {
        const { col, row } = this.worldToTile(wx, wy);
        const tile = this.getTile(col, row);
        if (tile === Terrain.RIVER) return 0.5;
        if (tile === Terrain.FOREST) return 0.7;
        if (tile === Terrain.ROAD) return 1.3;
        return 1.0;
    }

    draw(ctx, camera) {
        const zoom = camera.zoom || 1;
        const offsetX = camera.offsetX || 0;
        const offsetY = camera.offsetY || 0;
        const camX = camera.x;
        const camY = camera.y;
        const logicalW = ctx.canvas.clientWidth || ctx.canvas.width;
        const logicalH = ctx.canvas.clientHeight || ctx.canvas.height;
        const cx = logicalW / 2;
        const cy = logicalH / 2;

        // 计算可见区域的世界坐标范围（反向推导 toScreen 公式）
        const worldLeft = (0 - cx * (1 - zoom) + offsetX) / zoom + camX;
        const worldTop = (0 - cy * (1 - zoom) + offsetY) / zoom + camY;
        const worldRight = (logicalW - cx * (1 - zoom) + offsetX) / zoom + camX;
        const worldBottom = (logicalH - cy * (1 - zoom) + offsetY) / zoom + camY;

        const startCol = Math.max(0, Math.floor(worldLeft / this.tileSize) - 1);
        const startRow = Math.max(0, Math.floor(worldTop / this.tileSize) - 1);
        const endCol = Math.min(this.cols - 1, Math.ceil(worldRight / this.tileSize) + 1);
        const endRow = Math.min(this.rows - 1, Math.ceil(worldBottom / this.tileSize) + 1);

        const scaledTile = this.tileSize * zoom;

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const tile = this.data[r][c];
                // 使用与 Renderer.toScreen() 相同的变换
                const worldX = c * this.tileSize;
                const worldY = r * this.tileSize;
                const screenX = (worldX - camX) * zoom + cx * (1 - zoom) - offsetX;
                const screenY = (worldY - camY) * zoom + cy * (1 - zoom) - offsetY;
                ctx.fillStyle = TERRAIN_COLORS[tile] || '#4CAF50';
                ctx.fillRect(screenX, screenY, scaledTile, scaledTile);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(screenX, screenY, scaledTile, scaledTile);
            }
        }
    }

    setTile(col, row, type) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
        this.data[row][col] = type;
    }

    toJSON() {
        return {
            cols: this.cols,
            rows: this.rows,
            tileSize: this.tileSize,
            data: this.data
        };
    }

    static fromJSON(json) {
        const map = new Map({ cols: json.cols, rows: json.rows, tileSize: json.tileSize });
        map.loadData(json.data);
        return map;
    }
}