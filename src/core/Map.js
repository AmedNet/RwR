// src/core/Map.js
import { GameState } from './GameState.js';

export const Terrain = {
    GRASS: 0,
    HOUSE: 1,
    RIVER: 2,
    CAPTURE: 3,
};

const TERRAIN_COLORS = {
    [Terrain.GRASS]: '#4CAF50',
    [Terrain.HOUSE]: '#8D6E63',
    [Terrain.RIVER]: '#42A5F5',
    [Terrain.CAPTURE]: '#FFD740',
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

    // 判断世界坐标是否可通行，考虑了半径
    isWalkable(wx, wy, radius = 0) {
        // 检查以 (wx, wy) 为中心，半径为 radius 的所有格子
        const half = radius / this.tileSize + 0.5; // 粗略，确保覆盖
        const centerCol = Math.floor(wx / this.tileSize);
        const centerRow = Math.floor(wy / this.tileSize);
        const startCol = Math.max(0, Math.floor(centerCol - half));
        const endCol = Math.min(this.cols - 1, Math.ceil(centerCol + half));
        const startRow = Math.max(0, Math.floor(centerRow - half));
        const endRow = Math.min(this.rows - 1, Math.ceil(centerRow + half));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const tile = this.getTile(c, r);
                if (tile === -1 || tile === Terrain.HOUSE) {
                    // 房屋完全不可通行
                    return false;
                }
            }
        }
        return true;
    }

    getSpeedFactor(wx, wy) {
        const { col, row } = this.worldToTile(wx, wy);
        const tile = this.getTile(col, row);
        if (tile === Terrain.RIVER) return 0.5;
        return 1.0;
    }

    draw(ctx, camera) {
        const { x: camX, y: camY } = camera;
        const startCol = Math.floor(camX / this.tileSize);
        const startRow = Math.floor(camY / this.tileSize);
        const endCol = Math.ceil((camX + ctx.canvas.width) / this.tileSize) + 1;
        const endRow = Math.ceil((camY + ctx.canvas.height) / this.tileSize) + 1;

        for (let r = startRow; r < endRow && r < this.rows; r++) {
            if (r < 0) continue;
            for (let c = startCol; c < endCol && c < this.cols; c++) {
                if (c < 0) continue;
                const tile = this.data[r][c];
                const x = c * this.tileSize - camX;
                const y = r * this.tileSize - camY;
                ctx.fillStyle = TERRAIN_COLORS[tile] || '#4CAF50';
                ctx.fillRect(x, y, this.tileSize, this.tileSize);
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, this.tileSize, this.tileSize);
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