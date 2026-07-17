// BTR-80 top view adapted from btr80-top-view.html.

const COLORS = {
    shadow: 'rgba(44, 42, 29, 0.24)',
    tire: '#252822', tireDark: '#151713', tireLine: '#44483e', rubberLight: '#555a4d',
    body: '#596443', bodyLight: '#6d7950', bodyMid: '#4e583a', bodyDark: '#38412d',
    edge: '#293022', hatch: '#465036', metal: '#9a9c8d', glass: '#58706a',
    glassLight: '#9eb2a8', lamp: '#d8ce9a', red: '#9d4437'
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

function line(ctx, points, stroke = COLORS.edge, lineWidth = 3) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function drawWheel(ctx, x, y, steeringAngle = 0, wheelRotation = 0) {
    const width = 64;
    const height = 126;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(steeringAngle);
    roundedRect(ctx, -width / 2, -height / 2, width, height, 24);
    fillAndStroke(ctx, COLORS.tire, COLORS.tireDark, 6);
    roundedRect(ctx, -19, -height / 2 + 10, 38, height - 20, 14);
    ctx.strokeStyle = COLORS.rubberLight;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = COLORS.tireLine;
    ctx.lineWidth = 5;
    ctx.save();
    roundedRect(ctx, -width / 2, -height / 2, width, height, 24);
    ctx.clip();
    const treadSpacing = 22;
    const treadOffset = ((wheelRotation / (Math.PI * 2)) * treadSpacing) % treadSpacing;
    for (let yy = -height / 2 - treadSpacing + treadOffset; yy < height / 2; yy += treadSpacing) {
        ctx.beginPath();
        ctx.moveTo(-width / 2 + 5, yy + 7);
        ctx.lineTo(-5, yy - 3);
        ctx.lineTo(width / 2 - 5, yy + 7);
        ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
}

function drawRectHatch(ctx, x, y, width, height, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    roundedRect(ctx, -width / 2, -height / 2, width, height, 7);
    fillAndStroke(ctx, COLORS.hatch, COLORS.edge, 4);
    roundedRect(ctx, -width / 2 + 8, -height / 2 + 8, width - 16, height - 16, 4);
    ctx.strokeStyle = COLORS.bodyLight;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

function drawCircularHatch(ctx, x, y, radius, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    fillAndStroke(ctx, COLORS.hatch, COLORS.edge, 4);
    ctx.beginPath();
    ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.bodyLight;
    ctx.lineWidth = 3;
    ctx.stroke();
    line(ctx, [[-radius + 9, 0], [radius - 9, 0]], COLORS.edge, 3);
    ctx.restore();
}

function drawVisionBlock(ctx, x, y, width, height, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    roundedRect(ctx, -width / 2, -height / 2, width, height, 3);
    fillAndStroke(ctx, COLORS.glass, COLORS.edge, 3);
    line(ctx, [[-width / 2 + 5, -height / 2 + 4], [width / 2 - 5, -height / 2 + 4]], COLORS.glassLight, 2);
    ctx.restore();
}

function drawTurret(ctx, turretRotation, cannonRecoil, coaxRecoil) {
    ctx.save();
    ctx.translate(0, -68);
    ctx.rotate(turretRotation);

    ctx.save();
    ctx.translate(0, cannonRecoil);
    roundedRect(ctx, -7, -198, 14, 176, 6);
    ctx.fillStyle = COLORS.shadow;
    ctx.fill();
    roundedRect(ctx, -6, -204, 12, 182, 5);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 3);
    polygon(ctx, [[-6, -224], [6, -224], [9, -217], [8, -202], [-8, -202], [-9, -217]]);
    fillAndStroke(ctx, COLORS.edge, COLORS.tireDark, 3);
    ctx.beginPath();
    ctx.ellipse(0, -224, 6, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.tireDark;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(0, coaxRecoil);
    roundedRect(ctx, 15, -100, 7, 75, 3);
    fillAndStroke(ctx, COLORS.edge, COLORS.tireDark, 2);
    ctx.beginPath();
    ctx.ellipse(18.5, -100, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.tireDark;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 5);
    polygon(ctx, [
        [-28, -67], [28, -67], [47, -42], [57, -8], [54, 42],
        [35, 68], [-35, 68], [-54, 42], [-57, -8], [-47, -42]
    ]);
    fillAndStroke(ctx, COLORS.bodyMid, COLORS.edge, 5);
    roundedRect(ctx, -17, -65, 34, 75, 8);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 4);
    line(ctx, [[0, -58], [0, 2]], COLORS.bodyLight, 3);
    roundedRect(ctx, -29, 20, 58, 37, 13);
    fillAndStroke(ctx, COLORS.hatch, COLORS.edge, 4);
    line(ctx, [[-21, 38], [21, 38]], COLORS.bodyLight, 3);
    roundedRect(ctx, 31, -37, 17, 39, 4);
    fillAndStroke(ctx, COLORS.glass, COLORS.edge, 3);
    roundedRect(ctx, -48, -29, 14, 42, 4);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 3);
    ctx.restore();
}

function drawSideEquipment(ctx) {
    [-1, 1].forEach((side) => {
        const x = side * 137;
        roundedRect(ctx, x - 17, -274, 34, 543, 12);
        fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 4);
        roundedRect(ctx, x - 15, -45, 30, 94, 6);
        fillAndStroke(ctx, COLORS.bodyMid, COLORS.edge, 3);
        roundedRect(ctx, x - 15, 102, 30, 83, 6);
        fillAndStroke(ctx, COLORS.bodyMid, COLORS.edge, 3);
    });
}

function drawEngineDeck(ctx) {
    roundedRect(ctx, -105, 222, 210, 87, 10);
    fillAndStroke(ctx, COLORS.bodyMid, COLORS.edge, 4);
    roundedRect(ctx, -82, 234, 164, 42, 7);
    ctx.fillStyle = COLORS.bodyDark;
    ctx.fill();
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = COLORS.metal;
    ctx.lineWidth = 3;
    for (let y = 242; y <= 268; y += 7) {
        ctx.beginPath();
        ctx.moveTo(-72, y);
        ctx.lineTo(72, y);
        ctx.stroke();
    }
    drawRectHatch(ctx, -57, 293, 66, 25);
    drawRectHatch(ctx, 57, 293, 66, 25);
}

export function drawBTR80(ctx, angle, scale, turretAngle, cannonRecoil, coaxRecoil, motion = null) {
    ctx.save();
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.translate(0, motion?.bob || 0);
    ctx.rotate(motion?.lean || 0);

    ctx.save();
    ctx.translate(12, 18);
    polygon(ctx, [
        [-65, -370], [65, -370], [137, -311], [157, -222], [157, 316],
        [126, 342], [-126, 342], [-157, 316], [-157, -222], [-137, -311]
    ]);
    ctx.fillStyle = COLORS.shadow;
    ctx.fill();
    ctx.restore();

    [-247, -78, 102, 268].forEach((y, index) => {
        const wheelSteering = index === 0
            ? (motion?.steeringAngle || 0)
            : index === 1 ? (motion?.steeringAngle || 0) * 0.65 : 0;
        drawWheel(ctx, -146, y, wheelSteering, motion?.wheelRotation || 0);
        drawWheel(ctx, 146, y, wheelSteering, motion?.wheelRotation || 0);
    });

    polygon(ctx, [
        [-62, -374], [62, -374], [132, -315], [151, -223], [151, 316],
        [123, 338], [-123, 338], [-151, 316], [-151, -223], [-132, -315]
    ]);
    fillAndStroke(ctx, COLORS.body, COLORS.edge, 7);
    drawSideEquipment(ctx);

    polygon(ctx, [[-62, -357], [62, -357], [119, -304], [105, -206], [-105, -206], [-119, -304]]);
    fillAndStroke(ctx, COLORS.bodyLight, COLORS.edge, 4);
    line(ctx, [[-119, -304], [119, -304]], COLORS.bodyDark, 4);
    line(ctx, [[-105, -206], [105, -206]], COLORS.bodyDark, 4);
    line(ctx, [[0, -348], [0, -215]], COLORS.bodyMid, 3);

    drawRectHatch(ctx, -53, -255, 68, 66, -0.08);
    drawRectHatch(ctx, 53, -255, 68, 66, 0.08);
    drawVisionBlock(ctx, -53, -291, 44, 15, -0.08);
    drawVisionBlock(ctx, 53, -291, 44, 15, 0.08);
    drawVisionBlock(ctx, -106, -264, 36, 13, -0.55);
    drawVisionBlock(ctx, 106, -264, 36, 13, 0.55);

    [-101, 101].forEach((x) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, -328, 13, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.lamp;
        if (motion?.headlightsOn) {
            ctx.shadowColor = '#fff0ae';
            ctx.shadowBlur = 24;
        }
        ctx.fill();
        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, -328, 18, Math.PI * 0.15, Math.PI * 0.85);
        ctx.strokeStyle = COLORS.bodyDark;
        ctx.stroke();
        ctx.restore();
    });

    polygon(ctx, [[-108, -188], [108, -188], [122, 208], [-122, 208]]);
    fillAndStroke(ctx, COLORS.bodyLight, COLORS.edge, 4);
    line(ctx, [[-112, 20], [112, 20]], COLORS.bodyMid, 3);
    drawRectHatch(ctx, -72, 99, 66, 91, -0.04);
    drawRectHatch(ctx, 72, 99, 66, 91, 0.04);
    drawCircularHatch(ctx, -76, -137, 28, 0.1);
    drawCircularHatch(ctx, 76, -137, 28, -0.1);

    drawTurret(ctx, turretAngle - angle, cannonRecoil, coaxRecoil);
    drawEngineDeck(ctx);

    roundedRect(ctx, -127, 312, 254, 25, 6);
    fillAndStroke(ctx, COLORS.bodyDark, COLORS.edge, 4);
    [-103, 103].forEach((x) => {
        ctx.save();
        roundedRect(ctx, x - 10, 301, 20, 15, 4);
        ctx.fillStyle = motion?.braking ? '#ff3b30' : COLORS.red;
        if (motion?.braking) {
            ctx.shadowColor = '#ff3b30';
            ctx.shadowBlur = 18;
        }
        ctx.fill();
        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    });
    if (motion?.reversing) {
        ctx.fillStyle = '#f2f0d8';
        [-70, 70].forEach((x) => ctx.fillRect(x - 7, 318, 14, 8));
    }
    ctx.beginPath();
    ctx.arc(0, 343, 13, Math.PI, 0);
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
}
