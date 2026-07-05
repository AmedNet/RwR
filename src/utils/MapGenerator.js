// src/utils/MapGenerator.js
import { Terrain } from '../core/Map.js';

// 简化版 Perlin 噪声（值噪声）
function generateNoise(width, height, scale = 10, octaves = 3) {
    const noise = [];
    // 预生成随机梯度
    const gradients = [];
    for (let i = 0; i < width * height; i++) {
        gradients.push(Math.random());
    }

    function smoothNoise(x, y, s) {
        const sx = x / s;
        const sy = y / s;
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        const fx = sx - ix;
        const fy = sy - iy;

        // 双线性插值
        const wrapX = (ix + width) % width;
        const wrapY = (iy + height) % height;
        const wrapX1 = (ix + 1 + width) % width;
        const wrapY1 = (iy + 1 + height) % height;

        const v00 = gradients[wrapY * width + wrapX];
        const v10 = gradients[wrapY * width + wrapX1];
        const v01 = gradients[wrapY1 * width + wrapX];
        const v11 = gradients[wrapY1 * width + wrapX1];

        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);

        const v0 = v00 + (v10 - v00) * ux;
        const v1 = v01 + (v11 - v01) * ux;
        return v0 + (v1 - v0) * uy;
    }

    for (let y = 0; y < height; y++) {
        noise[y] = [];
        for (let x = 0; x < width; x++) {
            let value = 0;
            let amplitude = 1;
            let maxValue = 0;
            let s = scale;
            for (let o = 0; o < octaves; o++) {
                value += smoothNoise(x, y, s) * amplitude;
                maxValue += amplitude;
                amplitude *= 0.5;
                s *= 0.5;
            }
            noise[y][x] = value / maxValue;
        }
    }
    return noise;
}

export const MapGenerator = {
    generateRandomMap(map) {
        const startTime = performance.now();
        console.log('🗺️ 开始生成复杂地形...');

        // 1. 先铺设草地
        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                map.setTile(c, r, Terrain.GRASS);
            }
        }

        // 2. 使用噪声生成地形
        const noise = generateNoise(map.cols, map.rows, 12, 4);

        // 3. 生成山地（基于噪声）
        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                const n = noise[r][c];
                // 高噪声值 -> 山地
                if (n > 0.75) {
                    map.setTile(c, r, Terrain.MOUNTAIN);
                }
            }
        }

        // 4. 生成森林（基于噪声，中等偏高的区域）
        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                const n = noise[r][c];
                const currentTile = map.getTile(c, r);
                if (currentTile === Terrain.GRASS && n > 0.55 && n <= 0.75) {
                    // 随机化，让森林更自然
                    if (Math.random() < 0.7) {
                        map.setTile(c, r, Terrain.FOREST);
                    }
                }
            }
        }

        // 5. 生成蜿蜒河流
        generateRivers(map, noise);

        // 6. 生成村庄（房屋集群）
        generateVillages(map);

        // 7. 生成道路连接村庄和据点范围
        generateRoads(map);

        const elapsed = Math.round(performance.now() - startTime);
        console.log(`✅ 地形生成完成! (${elapsed}ms)`);
    }
};

// 角度累积法生成蜿蜒河流
function generateRivers(map, noise) {
    const numRivers = 3 + Math.floor(Math.random() * 2); // 3-4条河流
    console.log(`🏞️ 生成 ${numRivers} 条河流...`);

    for (let i = 0; i < numRivers; i++) {
        // 随机起点（从地图边缘开始）
        const startEdge = Math.floor(Math.random() * 4); // 0=上, 1=右, 2=下, 3=左
        let curC, curR, baseAngle;

        switch (startEdge) {
            case 0: // 上边缘
                curC = 30 + Math.floor(Math.random() * (map.cols - 60));
                curR = 3;
                baseAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.5; // 主要向下
                break;
            case 1: // 右边缘
                curC = map.cols - 4;
                curR = 30 + Math.floor(Math.random() * (map.rows - 60));
                baseAngle = Math.PI + (Math.random() - 0.5) * 0.5; // 主要向左
                break;
            case 2: // 下边缘
                curC = 30 + Math.floor(Math.random() * (map.cols - 60));
                curR = map.rows - 4;
                baseAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5; // 主要向上
                break;
            case 3: // 左边缘
                curC = 3;
                curR = 30 + Math.floor(Math.random() * (map.rows - 60));
                baseAngle = (Math.random() - 0.5) * 0.5; // 主要向右
                break;
        }

        const riverWidth = 2 + Math.floor(Math.random() * 1); // 2格宽
        const length = 100 + Math.floor(Math.random() * 80); // 河流长度
        let angle = baseAngle;
        const visited = new Set();

        for (let step = 0; step < length; step++) {
            const key = `${curR},${curC}`;
            if (visited.has(key)) break;
            visited.add(key);

            // 绘制河流
            for (let dw = 0; dw < riverWidth; dw++) {
                const wc = curC + (dw - Math.floor(riverWidth / 2));
                if (wc >= 0 && wc < map.cols && curR >= 0 && curR < map.rows) {
                    const tile = map.getTile(wc, curR);
                    if (tile !== Terrain.MOUNTAIN && tile !== Terrain.HOUSE) {
                        map.setTile(wc, curR, Terrain.RIVER);
                    }
                }
            }

            // 到达地图边缘则停止
            if (curC <= 2 || curC >= map.cols - 3 || curR <= 2 || curR >= map.rows - 3) break;

            // 使用噪声值微调角度，产生自然蜿蜒
            const noiseVal = noise[Math.min(curR, map.rows - 1)][Math.min(curC, map.cols - 1)];
            const angleDelta = (noiseVal - 0.5) * 0.8; // -0.4 到 0.4 弧度
            angle += angleDelta;

            // 保持主要方向
            const dirPull = (baseAngle - angle) * 0.02; // 轻微拉回主方向
            angle += dirPull;

            // 根据角度移动
            curC += Math.round(Math.cos(angle));
            curR += Math.round(Math.sin(angle));

            // 确保在范围内
            curC = Math.max(3, Math.min(map.cols - 4, curC));
            curR = Math.max(3, Math.min(map.rows - 4, curR));
        }
    }

    // 沿河流生成河滩沙地（河流附近2格内）
    for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
            if (map.getTile(c, r) === Terrain.RIVER) {
                // 在河流附近随机生成沙地
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nc = c + dc;
                        const nr = r + dr;
                        if (nc >= 0 && nc < map.cols && nr >= 0 && nr < map.rows) {
                            const tile = map.getTile(nc, nr);
                            if (tile === Terrain.GRASS) {
                                // 距离河流越近，概率越高
                                const dist = Math.hypot(dc, dr);
                                const prob = dist <= 1 ? 0.3 : 0.1;
                                if (Math.random() < prob) {
                                    map.setTile(nc, nr, Terrain.SAND);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// 生成村庄
function generateVillages(map) {
    const numVillages = 5 + Math.floor(Math.random() * 5); // 5-9个村庄

    for (let i = 0; i < numVillages; i++) {
        // 随机村庄中心
        const centerCol = Math.floor(Math.random() * map.cols);
        const centerRow = Math.floor(Math.random() * map.rows);

        // 检查是否在山地上（跳过）
        if (map.getTile(centerCol, centerRow) === Terrain.MOUNTAIN) continue;

        const houseCount = 4 + Math.floor(Math.random() * 8); // 4-11个房子
        const villageRadius = 8 + Math.floor(Math.random() * 6); // 村庄半径

        for (let j = 0; j < houseCount; j++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * villageRadius;
            const hc = Math.floor(centerCol + Math.cos(angle) * dist);
            const hr = Math.floor(centerRow + Math.sin(angle) * dist);

            if (hc >= 0 && hc < map.cols && hr >= 0 && hr < map.rows) {
                const tile = map.getTile(hc, hr);
                if (tile === Terrain.GRASS || tile === Terrain.FOREST) {
                    map.setTile(hc, hr, Terrain.HOUSE);
                }
            }
        }
    }
}

// A* 寻路：绕过山地、河流、森林
function aStarPath(map, startR, startC, endR, endC) {
    const rows = map.rows;
    const cols = map.cols;

    // 地形权重
    function getCost(r, c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return 100;
        const tile = map.getTile(c, r);
        if (tile === Terrain.MOUNTAIN || tile === Terrain.HOUSE) return 100; // 不可通行
        if (tile === Terrain.RIVER) return 8;    // 河流权重高
        if (tile === Terrain.FOREST) return 4;   // 森林权重中
        if (tile === Terrain.ROAD) return 0.5;   // 已有道路权重低
        return 1; // 草地正常
    }

    const openSet = [];
    const closedSet = new Set();
    const cameFrom = {};
    const gScore = {};
    const fScore = {};

    const key = (r, c) => r * cols + c;
    const heuristic = (r, c) => Math.abs(r - endR) + Math.abs(c - endC);

    openSet.push({ r: startR, c: startC, f: heuristic(startR, startC) });
    gScore[key(startR, startC)] = 0;
    fScore[key(startR, startC)] = heuristic(startR, startC);

    while (openSet.length > 0) {
        // 找最低 fScore
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        const ck = key(current.r, current.c);

        if (current.r === endR && current.c === endC) {
            // 重建路径
            const path = [];
            let k = ck;
            while (k !== undefined) {
                const r = Math.floor(k / cols);
                const c = k % cols;
                path.unshift({ r, c });
                k = cameFrom[k];
            }
            return path;
        }

        closedSet.add(ck);

        // 8方向移动
        const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
        for (const [dr, dc] of dirs) {
            const nr = current.r + dr;
            const nc = current.c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const nk = key(nr, nc);
            if (closedSet.has(nk)) continue;

            const moveCost = (dr !== 0 && dc !== 0) ? 1.4 : 1; // 对角线略贵
            const terrainCost = getCost(nr, nc);
            if (terrainCost >= 100) continue; // 跳过不可通行

            const tentativeG = gScore[ck] + moveCost * terrainCost;
            if (tentativeG < (gScore[nk] || Infinity)) {
                cameFrom[nk] = ck;
                gScore[nk] = tentativeG;
                fScore[nk] = tentativeG + heuristic(nr, nc);
                if (!openSet.some(n => n.r === nr && n.c === nc)) {
                    openSet.push({ r: nr, c: nc, f: fScore[nk] });
                }
            }
        }
    }
    return null; // 无路
}

// 生成道路（A*寻路连接村庄，绕过障碍）
function generateRoads(map) {
    // 收集村庄中心
    const villageMap = {};
    for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
            if (map.getTile(c, r) === Terrain.HOUSE) {
                let hasNeighbor = false;
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nc = c + dc, nr = r + dr;
                        if (nc >= 0 && nc < map.cols && nr >= 0 && nr < map.rows) {
                            if (map.getTile(nc, nr) === Terrain.HOUSE) {
                                hasNeighbor = true; break;
                            }
                        }
                    }
                    if (hasNeighbor) break;
                }
                if (hasNeighbor) {
                    // 计算村庄中心
                    let sumC = 0, sumR = 0, count = 0;
                    for (let dr = -3; dr <= 3; dr++) {
                        for (let dc = -3; dc <= 3; dc++) {
                            const nc = c + dc, nr = r + dr;
                            if (nc >= 0 && nc < map.cols && nr >= 0 && nr < map.rows) {
                                if (map.getTile(nc, nr) === Terrain.HOUSE) {
                                    sumC += nc; sumR += nr; count++;
                                }
                            }
                        }
                    }
                    if (count > 0) {
                        const centerKey = `${Math.round(sumR/count)},${Math.round(sumC/count)}`;
                        if (!villageMap[centerKey]) {
                            villageMap[centerKey] = { r: Math.round(sumR/count), c: Math.round(sumC/count) };
                        }
                    }
                }
            }
        }
    }

    const villages = Object.values(villageMap);
    console.log(`🏘️ 找到 ${villages.length} 个村庄，连接道路...`);

    // 使用最小生成树思想连接村庄
    const connected = new Set();
    if (villages.length === 0) return;

    connected.add(0);
    while (connected.size < villages.length) {
        let bestDist = Infinity;
        let bestI = -1, bestJ = -1;

        for (const i of connected) {
            for (let j = 0; j < villages.length; j++) {
                if (connected.has(j)) continue;
                const dist = Math.hypot(villages[j].r - villages[i].r, villages[j].c - villages[i].c);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestI = i;
                    bestJ = j;
                }
            }
        }

        if (bestJ === -1) break;

        // 用A*找路径
        const path = aStarPath(map, villages[bestI].r, villages[bestI].c, villages[bestJ].r, villages[bestJ].c);
        if (path) {
            for (let pi = 0; pi < path.length; pi++) {
                const p = path[pi];
                // 铺设中心点
                const tile = map.getTile(p.c, p.r);
                if (tile !== Terrain.RIVER && tile !== Terrain.HOUSE) {
                    map.setTile(p.c, p.r, Terrain.ROAD);
                }
                // 向一侧扩展1格（2格宽道路）
                // 使用固定方向扩展，保持道路一致性
                let expandC = 0, expandR = 1; // 默认向下扩展
                if (pi < path.length - 1) {
                    const next = path[pi + 1];
                    const dc = next.c - p.c;
                    const dr = next.r - p.r;
                    // 根据主要移动方向决定扩展方向（固定向一侧）
                    if (Math.abs(dc) >= Math.abs(dr)) {
                        // 主要水平移动 -> 向下方扩展
                        expandC = 0;
                        expandR = 1;
                    } else {
                        // 主要垂直移动 -> 向右方扩展
                        expandC = 1;
                        expandR = 0;
                    }
                }
                const nc = p.c + expandC;
                const nr = p.r + expandR;
                if (nc >= 0 && nc < map.cols && nr >= 0 && nr < map.rows) {
                    const ntile = map.getTile(nc, nr);
                    if (ntile !== Terrain.RIVER && ntile !== Terrain.HOUSE && ntile !== Terrain.MOUNTAIN) {
                        map.setTile(nc, nr, Terrain.ROAD);
                    }
                }
            }
        }
        connected.add(bestJ);
    }
}
