// src/utils/PathFinder.js
import { Terrain } from '../core/Map.js';

export const PathFinder = {
    // 地形代价
    getTerrainCost(tile) {
        if (tile === Terrain.HOUSE || tile === Terrain.MOUNTAIN) return 100; // 不可通行
        if (tile === Terrain.RIVER) return 8;
        if (tile === Terrain.FOREST) return 4;
        if (tile === Terrain.ROAD) return 0.5;
        return 1; // 草地
    },

    // A* 寻路，返回路径点数组或 null（优化版）
    findPath(map, startX, startY, endX, endY, maxIterations = 1500) {
        const { cols, rows, tileSize } = map;
        
        // 转换为格子坐标
        const startCol = Math.floor(startX / tileSize);
        const startRow = Math.floor(startY / tileSize);
        const endCol = Math.floor(endX / tileSize);
        const endRow = Math.floor(endY / tileSize);

        // 起点或终点不可通行
        if (!map.isWalkable(startX, startY, 5) || !map.isWalkable(endX, endY, 5)) {
            return null;
        }

        const key = (r, c) => r * cols + c;
        const heuristic = (r, c) => Math.abs(r - endRow) + Math.abs(c - endCol);

        // 用 Map 替代数组，提升查找性能
        const openSet = new Map(); // key -> {r, c, f}
        const closedSet = new Set();
        const cameFrom = {};
        const gScore = {};
        const fScore = {};

        const startKey = key(startRow, startCol);
        const startNode = { r: startRow, c: startCol, f: heuristic(startRow, startCol) };
        openSet.set(startKey, startNode);
        gScore[startKey] = 0;
        fScore[startKey] = heuristic(startRow, startCol);

        let iterations = 0;

        while (openSet.size > 0 && iterations < maxIterations) {
            iterations++;

            // 找最低 fScore（手动遍历，避免排序）
            let current = null;
            let currentKey = null;
            for (const [k, node] of openSet) {
                if (!current || node.f < current.f) {
                    current = node;
                    currentKey = k;
                }
            }

            if (current.r === endRow && current.c === endCol) {
                // 重建路径
                const path = [];
                let k = currentKey;
                while (k !== undefined) {
                    const r = Math.floor(k / cols);
                    const c = k % cols;
                    path.unshift({ 
                        x: c * tileSize + tileSize / 2, 
                        y: r * tileSize + tileSize / 2 
                    });
                    k = cameFrom[k];
                }
                return path;
            }

            openSet.delete(currentKey);
            closedSet.add(currentKey);

            // 8方向移动
            const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
            for (const [dr, dc] of dirs) {
                const nr = current.r + dr;
                const nc = current.c + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                const nk = key(nr, nc);
                if (closedSet.has(nk)) continue;

                const tile = map.getTile(nc, nr);
                const terrainCost = this.getTerrainCost(tile);
                if (terrainCost >= 100) continue; // 跳过不可通行

                const moveCost = (dr !== 0 && dc !== 0) ? 1.4 : 1;
                const tentativeG = gScore[currentKey] + moveCost * terrainCost;

                if (tentativeG < (gScore[nk] || Infinity)) {
                    cameFrom[nk] = currentKey;
                    gScore[nk] = tentativeG;
                    fScore[nk] = tentativeG + heuristic(nr, nc);
                    openSet.set(nk, { r: nr, c: nc, f: fScore[nk] });
                }
            }
        }

        return null; // 无路可走
    }
};