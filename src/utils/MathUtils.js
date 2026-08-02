// src/utils/MathUtils.js
// 高性能数学工具函数

/**
 * 距离平方计算（避免开方运算）
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number} 距离的平方
 */
export function distSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
}

/**
 * 带缓存的距离计算（用于频繁查询同一目标的场景）
 * @param {Object} cache 缓存对象 {x, y, dist, frame}
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @param {number} currentFrame 当前帧
 * @returns {number} 距离
 */
export function cachedDist(cache, x1, y1, x2, y2, currentFrame) {
    if (cache.frame === currentFrame && 
        cache.x === x2 && cache.y === y2) {
        return cache.dist;
    }
    const dist = Math.hypot(x2 - x1, y2 - y1);
    cache.x = x2;
    cache.y = y2;
    cache.dist = dist;
    cache.frame = currentFrame;
    return dist;
}

/**
 * 快速距离比较（无需精确距离值时）
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @param {number} threshold 阈值
 * @returns {boolean} 是否小于阈值
 */
export function isWithinDist(x1, y1, x2, y2, threshold) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return (dx * dx + dy * dy) < (threshold * threshold);
}

/**
 * 快速最近目标查找（使用距离平方）
 * @param {Array} targets 目标数组
 * @param {number} x 源 X 坐标
 * @param {number} y 源 Y 坐标
 * @param {Function} getPos 获取位置的函数 (target) => {x, y}
 * @returns {Object|null} 最近的目标及其距离
 */
export function findNearest(targets, x, y, getPos) {
    let nearest = null;
    let minDistSq = Infinity;
    
    for (let i = 0, len = targets.length; i < len; i++) {
        const target = targets[i];
        const pos = getPos ? getPos(target) : target;
        const dx = pos.x - x;
        const dy = pos.y - y;
        const dSq = dx * dx + dy * dy;
        
        if (dSq < minDistSq) {
            minDistSq = dSq;
            nearest = target;
        }
    }
    
    return nearest ? { target: nearest, distSq: minDistSq, dist: Math.sqrt(minDistSq) } : null;
}
