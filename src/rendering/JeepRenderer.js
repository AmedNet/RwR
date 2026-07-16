// 将 willys-mb-jeep.html 中的俯视图移植到游戏世界坐标。

import { DayNightSystem } from '../core/DayNightSystem.js';
import { GameState } from '../core/GameState.js';

const COLORS = {
    shadow: 'rgba(47, 43, 29, 0.28)',
    tire: '#242722',
    tireDark: '#161815',
    tireLine: '#41443d',
    body: '#626b3e',
    bodyLight: '#76804b',
    bodyDark: '#41492c',
    edge: '#303722',
    cabin: '#343a27',
    floor: '#4c5235',
    seat: '#77734e',
    seatLight: '#918a60',
    metal: '#a9ad9e',
    glass: '#809b91',
    glassLight: '#b9cbc2',
    white: '#eee9d4',
    headlight: '#dfd39d',
    tailLight: '#a13f32'
};

function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
}

function polygon(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
}

function fillAndStroke(ctx, fill, stroke = COLORS.edge, lineWidth = 4) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function drawWheel(ctx, x, y, width = 55, height = 145, steeringAngle = 0, wheelRotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(steeringAngle);
    roundedRect(ctx, -width / 2, -height / 2, width, height, 18);
    fillAndStroke(ctx, COLORS.tire, COLORS.tireDark, 5);
    ctx.strokeStyle = COLORS.tireLine;
    ctx.lineWidth = 4;
    const treadSpacing = 22;
    const treadOffset = ((wheelRotation / (Math.PI * 2)) * treadSpacing) % treadSpacing;
    ctx.save();
    roundedRect(ctx, -width / 2, -height / 2, width, height, 18);
    ctx.clip();
    for (let yy = -height / 2 - treadSpacing + treadOffset; yy < height / 2; yy += treadSpacing) {
        ctx.beginPath();
        ctx.moveTo(-width / 2 + 5, yy);
        ctx.lineTo(width / 2 - 5, yy + 10);
        ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
}

function drawStar(ctx, cx, cy, outerRadius, innerRadius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const angle = Math.PI * 2 * i / 10;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.white;
    ctx.fill();
    ctx.restore();
}

function drawSeat(ctx, x, y, width, height) {
    roundedRect(ctx, x, y, width, height, 12);
    fillAndStroke(ctx, COLORS.seat, COLORS.edge, 4);
    ctx.strokeStyle = COLORS.seatLight;
    ctx.lineWidth = 3;
    roundedRect(ctx, x + 8, y + 8, width - 16, height - 16, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y + 9);
    ctx.lineTo(x + width / 2, y + height - 9);
    ctx.stroke();
}

function drawSpareWheel(ctx) {
    ctx.save();
    ctx.translate(0, 275);
    roundedRect(ctx, -64, -24, 128, 48, 17);
    fillAndStroke(ctx, COLORS.tire, COLORS.tireDark, 6);
    ctx.strokeStyle = COLORS.tireLine;
    ctx.lineWidth = 4;
    for (let x = -48; x <= 40; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, -18);
        ctx.lineTo(x + 10, 18);
        ctx.stroke();
    }
    roundedRect(ctx, -18, -8, 36, 16, 5);
    ctx.fillStyle = COLORS.bodyDark;
    ctx.fill();
    ctx.restore();
}

function drawSteeringWheel(ctx, steeringAngle = 0) {
    ctx.save();
    ctx.translate(-53, -4);
    ctx.rotate(steeringAngle * 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.tireDark;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.metal;
    ctx.fill();
    ctx.strokeStyle = COLORS.tireDark;
    ctx.lineWidth = 3;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI * 2 / 3) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
        ctx.lineTo(Math.cos(angle) * 22, Math.sin(angle) * 22);
        ctx.stroke();
    }
    ctx.restore();
}

function drawOccupant(ctx, entity, x, y, vehicleScale, vehicleAngle, seatIndex = 0) {
    if (!entity) return;
    const isPlayer = !entity.faction;
    ctx.save();
    ctx.translate(x, y);
    // 抵消车体缩放，让人物保持游戏中的 1:1 尺寸。
    ctx.scale(1 / vehicleScale, 1 / vehicleScale);
    // 座位跟随车体，但人物只做左右朝向，不随车身旋转。
    ctx.rotate(-(vehicleAngle + Math.PI / 2));
    const facingAngle = Math.cos(vehicleAngle) < 0 ? Math.PI : 0;

    if (!isPlayer && typeof entity.drawBody === 'function') {
        // AI 队友：身体 + 武器贴图
        entity.drawBody(ctx, facingAngle, false);
        if (typeof entity.drawWeapon === 'function') {
            entity.drawWeapon(ctx, facingAngle);
        }
    } else if (isPlayer) {
        // 玩家：身体始终绘制，驾驶员(seat 0)不画武器，乘客(seat>0)画武器+后坐力
        const radius = entity.radius || 18;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#4CAF50';
        ctx.fill();
        ctx.strokeStyle = '#1B5E20';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (seatIndex > 0) {
            const weapon = entity.getCurrentWeapon();
            if (weapon && weapon.id && !weapon.isLoot) {
                const weaponImage = entity.getWeaponImage
                    ? entity.getWeaponImage(weapon.id, weapon.isReloading)
                    : null;
                if (weaponImage) {
                    // 本地 +x 指向车头(世界角 vehicleAngle)，武器本地角 = 瞄准世界角 - vehicleAngle
                    const cam = GameState.camera;
                    const screenX = entity.x - cam.x;
                    const screenY = entity.y - cam.y;
                    const aimWorld = Math.atan2(GameState.mouse.y - screenY, GameState.mouse.x - screenX);
                    const localAngle = aimWorld - vehicleAngle;
                    const facingLeft = Math.cos(localAngle) < 0;
                    const targetHeight = 34;
                    const scale = targetHeight / weaponImage.naturalHeight;
                    const drawW = weaponImage.naturalWidth * scale;
                    const drawH = targetHeight;
                    ctx.save();
                    ctx.translate(facingLeft ? -2 : 2, 0);
                    if (facingLeft) {
                        ctx.scale(1, -1);
                        ctx.rotate(-localAngle);
                    } else {
                        ctx.rotate(localAngle);
                    }
                    // 后坐力视觉：武器后退 + 枪口逆时针上抬（与 Player.draw 一致）
                    const recoilBack = weapon.currentRecoil ? weapon.currentRecoil * 33 : 0;
                    const recoilRotate = weapon.currentRecoil ? weapon.currentRecoil * 0.3 : 0;
                    ctx.rotate(-recoilRotate);
                    ctx.drawImage(weaponImage, -drawW * 0.15 - recoilBack, -drawH / 2, drawW, drawH);
                    ctx.restore();
                }
            }
        }
        // 玩家军衔
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★'.repeat(Math.min(entity.rank + 1, 4)), 0, -28);
    }
    ctx.restore();
}

function drawWindshieldDamage(ctx, windshield) {
    if (!windshield) return;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-99, -81, 92, 17, 3);
    ctx.roundRect(7, -81, 92, 17, 3);
    ctx.clip();
    ctx.strokeStyle = windshield.broken ? 'rgba(225, 245, 240, 0.9)' : 'rgba(225, 245, 240, 0.72)';
    ctx.lineWidth = windshield.broken ? 2.5 : 1.8;
    for (const crack of windshield.cracks) {
        const branches = windshield.broken ? 8 : 6;
        for (let i = 0; i < branches; i++) {
            const branchAngle = crack.seed + i * Math.PI * 2 / branches;
            const length = crack.size * (0.55 + ((i * 37) % 5) * 0.11);
            const midX = crack.x + Math.cos(branchAngle) * length * 0.55;
            const midY = crack.y + Math.sin(branchAngle) * length * 0.28;
            const endX = crack.x + Math.cos(branchAngle + 0.12) * length;
            const endY = crack.y + Math.sin(branchAngle + 0.12) * length * 0.45;
            ctx.beginPath();
            ctx.moveTo(crack.x, crack.y);
            ctx.lineTo(midX, midY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(crack.x, crack.y, windshield.broken ? 3.5 : 2.2, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

export function drawJeep(ctx, angle = 0, scale = 0.48, occupants = [], steeringAngle = 0, wheelRotation = 0, windshield = null, motion = null) {
    const darkness = DayNightSystem.getAmbientDarkness();
    const headlightColor = darkness > 0.15 ? COLORS.headlight : COLORS.bodyDark;
    ctx.save();
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(scale, scale);
    const visualLean = motion?.lean || 0;
    ctx.translate(0, motion?.bob || 0);
    ctx.rotate(visualLean);

    ctx.save();
    ctx.translate(12, 18);
    roundedRect(ctx, -145, -290, 290, 560, 45);
    ctx.fillStyle = COLORS.shadow;
    ctx.fill();
    ctx.restore();

    drawWheel(ctx, -132, -177, 55, 145, steeringAngle, wheelRotation);
    drawWheel(ctx, 132, -177, 55, 145, steeringAngle, wheelRotation);
    drawWheel(ctx, -132, 180, 55, 145, 0, wheelRotation);
    drawWheel(ctx, 132, 180, 55, 145, 0, wheelRotation);

    polygon(ctx, [[-110, -285], [110, -285], [130, -245], [130, 250], [-130, 250], [-130, -245]]);
    fillAndStroke(ctx, COLORS.body, COLORS.edge, 6);

    ctx.fillStyle = COLORS.bodyDark;
    roundedRect(ctx, -142, -245, 30, 160, 12); ctx.fill();
    roundedRect(ctx, 112, -245, 30, 160, 12); ctx.fill();
    roundedRect(ctx, -142, 95, 30, 155, 12); ctx.fill();
    roundedRect(ctx, 112, 95, 30, 155, 12); ctx.fill();

    roundedRect(ctx, -125, -302, 250, 24, 6);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 5);

    polygon(ctx, [[-100, -266], [100, -266], [109, -92], [-109, -92]]);
    fillAndStroke(ctx, COLORS.bodyLight, COLORS.edge, 4);
    ctx.strokeStyle = COLORS.bodyDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -258); ctx.lineTo(0, -104); ctx.stroke();

    ctx.fillStyle = COLORS.metal;
    [-91, 91].forEach((x) => {
        roundedRect(ctx, x - 5, -178, 10, 30, 4);
        ctx.fill();
    });
    drawStar(ctx, 0, -179, 48, 20);

    roundedRect(ctx, -104, -278, 208, 26, 5);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 3);
    ctx.strokeStyle = COLORS.metal;
    ctx.lineWidth = 4;
    for (let x = -56; x <= 56; x += 19) {
        ctx.beginPath();
        ctx.moveTo(x, -274); ctx.lineTo(x, -256); ctx.stroke();
    }
    [-83, 83].forEach((x) => {
        ctx.beginPath();
        ctx.arc(x, -264, 11, 0, Math.PI * 2);
        ctx.fillStyle = headlightColor;
        ctx.fill();
        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 4;
        ctx.stroke();
    });

    roundedRect(ctx, -108, -67, 216, 248, 17);
    fillAndStroke(ctx, COLORS.cabin, COLORS.edge, 5);
    roundedRect(ctx, -89, -42, 178, 216, 10);
    ctx.fillStyle = COLORS.floor;
    ctx.fill();

    roundedRect(ctx, -116, -88, 232, 31, 7);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 4);
    roundedRect(ctx, -99, -81, 92, 17, 3);
    ctx.fillStyle = windshield?.broken ? 'rgba(38, 48, 39, 0.45)' : COLORS.glass; ctx.fill();
    roundedRect(ctx, 7, -81, 92, 17, 3);
    ctx.fill();
    ctx.strokeStyle = COLORS.glassLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-88, -77); ctx.lineTo(-25, -77);
    ctx.moveTo(18, -77); ctx.lineTo(81, -77);
    ctx.stroke();
    drawWindshieldDamage(ctx, windshield);

    roundedRect(ctx, -104, 185, 208, 54, 10);
    fillAndStroke(ctx, COLORS.bodyLight, COLORS.edge, 4);
    ctx.strokeStyle = COLORS.bodyDark;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-87, 207); ctx.lineTo(87, 207); ctx.stroke();
    drawStar(ctx, 0, 216, 18, 8);

    drawSeat(ctx, -87, 18, 73, 81);
    drawSeat(ctx, 14, 18, 73, 81);
    drawSeat(ctx, -88, 105, 176, 70);
    drawOccupant(ctx, occupants[0], -50, 55, scale, angle + visualLean, 0);
    drawOccupant(ctx, occupants[1], 50, 55, scale, angle + visualLean, 1);
    drawOccupant(ctx, occupants[2], 0, 138, scale, angle + visualLean, 2);
    drawSteeringWheel(ctx, steeringAngle);

    ctx.strokeStyle = COLORS.tireDark;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(4, 82); ctx.lineTo(13, 55); ctx.stroke();
    ctx.beginPath(); ctx.arc(13, 53, 6, 0, Math.PI * 2); ctx.fillStyle = COLORS.tireDark; ctx.fill();

    roundedRect(ctx, -136, 240, 272, 22, 5);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 5);
    [-99, 99].forEach((x) => {
        ctx.save();
        roundedRect(ctx, x - 10, 220, 20, 13, 3);
        ctx.fillStyle = motion?.braking ? '#ff3b30' : COLORS.tailLight;
        if (motion?.braking) {
            ctx.shadowColor = '#ff3b30';
            ctx.shadowBlur = 18;
        }
        ctx.fill();
        ctx.strokeStyle = COLORS.edge; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
    });
    if (motion?.reversing) {
        ctx.fillStyle = '#f2f0d8';
        [-66, 66].forEach((x) => {
            roundedRect(ctx, x - 7, 235, 14, 8, 2);
            ctx.fill();
        });
    }
    ctx.beginPath();
    ctx.arc(82, 245, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.tireDark;
    ctx.fill();
    drawSpareWheel(ctx);
    ctx.restore();
}
