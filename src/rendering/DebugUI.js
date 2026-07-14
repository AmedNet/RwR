// src/rendering/DebugUI.js
import { GameState } from '../core/GameState.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { AmbientSoundManager } from '../utils/AmbientSoundManager.js';

export function drawDebug(ctx, renderer) {
    ctx.save();
    const W = renderer.width;
    const H = renderer.height;
    const cx = W / 2;

    // 全屏深色背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, W, H);

    // 存储按钮位置
    renderer.debugButtons = [];

    let y = 40;

    // === 标题 ===
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐛 Debug Panel', cx, y);
    y += 50;

    // === 状态信息 ===
    const player = GameState.player;
    const stars = player ? '★'.repeat(player.rank + 1) : '';
    const rankName = player && player.getRankName ? player.getRankName() : '';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`💰 RP: ${GameState.rp}   ${stars} ${rankName}`, cx, y);
    y += 40;

    // === 按钮配置 ===
    const btnW = 140;
    const btnH = 44;
    const btnGap = 16;

    // === Row 1: RP 按钮（居中）===
    const rpButtons = [
        { label: '+100 RP', value: 100, color: '#4CAF50' },
        { label: '+500 RP', value: 500, color: '#2196F3' },
        { label: '+1000 RP', value: 1000, color: '#9C27B0' }
    ];
    const row1W = rpButtons.length * btnW + (rpButtons.length - 1) * btnGap;
    let rowX = cx - row1W / 2;

    rpButtons.forEach((btn) => {
        ctx.fillStyle = btn.color;
        ctx.beginPath();
        ctx.roundRect(rowX, y, btnW, btnH, 8);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, rowX + btnW / 2, y + btnH / 2);
        
        renderer.debugButtons.push({ x: rowX, y, w: btnW, h: btnH, value: btn.value });
        rowX += btnW + btnGap;
    });
    y += btnH + 16;

    // === Row 2: 提升军衔 + 满血（居中，独立一行）===
    const actionButtons = [
        { label: '⬆ 提升军衔', action: 'rankUp', color: '#FF6F00' },
        { label: '❤ 满血', action: 'heal', color: '#f44336' }
    ];
    const row2W = actionButtons.length * btnW + (actionButtons.length - 1) * btnGap;
    rowX = cx - row2W / 2;

    actionButtons.forEach((btn) => {
        ctx.fillStyle = btn.color;
        ctx.beginPath();
        ctx.roundRect(rowX, y, btnW, btnH, 8);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, rowX + btnW / 2, y + btnH / 2);
        
        renderer.debugButtons.push({ x: rowX, y, w: btnW, h: btnH, action: btn.action });
        rowX += btnW + btnGap;
    });
    y += btnH + 30;

    // === 分隔线 ===
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(W - 60, y);
    ctx.stroke();
    y += 24;

    // === 天气控制 ===
    const sectionX = 80;
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌤️ 天气控制', sectionX, y);

    const currentDef = WeatherSystem.getWeatherDef();
    ctx.fillStyle = '#FFD700';
    ctx.font = '16px sans-serif';
    ctx.fillText(`当前: ${currentDef.icon} ${currentDef.name}`, sectionX + 120, y);
    y += 32;

    // 天气按钮网格 (6列)
    const weatherTypes = WeatherSystem.getAllWeatherTypes();
    const wBtnW = 80;
    const wBtnH = 44;
    const wGap = 10;
    const wCols = 6;
    const wGridW = wCols * wBtnW + (wCols - 1) * wGap;
    const wStartX = cx - wGridW / 2;

    weatherTypes.forEach((wt, i) => {
        const col = i % wCols;
        const row = Math.floor(i / wCols);
        const x = wStartX + col * (wBtnW + wGap);
        const wy = y + row * (wBtnH + wGap);

        const isActive = wt.key === WeatherSystem.current;
        ctx.fillStyle = isActive ? '#4CAF50' : '#3a3a3a';
        ctx.beginPath();
        ctx.roundRect(x, wy, wBtnW, wBtnH, 6);
        ctx.fill();

        ctx.strokeStyle = isActive ? '#81C784' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wt.icon, x + wBtnW / 2, wy + wBtnH / 2 - 8);
        ctx.font = '11px sans-serif';
        ctx.fillText(wt.name, x + wBtnW / 2, wy + wBtnH / 2 + 10);

        renderer.debugButtons.push({ x, y: wy, w: wBtnW, h: wBtnH, weather: wt.key });
    });

    y += Math.ceil(weatherTypes.length / wCols) * (wBtnH + wGap) + 24;

    // 龙卷风雷达开关
    const toggleBtnW = 180;
    const toggleBtnH = 36;
    const toggleBtnX = cx - toggleBtnW / 2;
    const isOn = GameState.debugShowTornado;
    ctx.fillStyle = isOn ? '#4CAF50' : '#3a3a3a';
    ctx.beginPath();
    ctx.roundRect(toggleBtnX, y, toggleBtnW, toggleBtnH, 6);
    ctx.fill();
    ctx.strokeStyle = isOn ? '#81C784' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = isOn ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isOn ? '🌪️ 龙卷风雷达: 开' : '🌪️ 龙卷风雷达: 关', toggleBtnX + toggleBtnW / 2, y + toggleBtnH / 2);
    renderer.debugButtons.push({ x: toggleBtnX, y, w: toggleBtnW, h: toggleBtnH, action: 'toggleTornadoRadar' });
    y += toggleBtnH + 16;

    // === 分隔线 ===
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(W - 60, y);
    ctx.stroke();
    y += 24;

    // === 昼夜控制 ===
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🌅 昼夜控制', sectionX, y);

    ctx.fillStyle = '#FFD700';
    ctx.font = '16px sans-serif';
    ctx.fillText(`🕐 ${DayNightSystem.getTimeString()}`, sectionX + 120, y);
    y += 32;

    // 时间滑块
    const sliderW = Math.min(W - 160, 600);
    const sliderH = 20;
    const sliderX = cx - sliderW / 2;
    const sliderY = y;

    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(sliderX, sliderY, sliderW, sliderH, 10);
    ctx.fill();

    const gradient = ctx.createLinearGradient(sliderX, 0, sliderX + sliderW, 0);
    gradient.addColorStop(0, 'rgba(10,15,40,0.9)');
    gradient.addColorStop(0.25, 'rgba(60,30,10,0.7)');
    gradient.addColorStop(0.5, 'rgba(135,206,235,0.4)');
    gradient.addColorStop(0.75, 'rgba(50,20,10,0.7)');
    gradient.addColorStop(1, 'rgba(10,15,40,0.9)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(sliderX, sliderY, sliderW, sliderH, 10);
    ctx.fill();

    const handleX = sliderX + DayNightSystem.timeOfDay * sliderW;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(handleX, sliderY + sliderH / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00BCD4';
    ctx.lineWidth = 3;
    ctx.stroke();

    renderer.debugSlider = { x: sliderX, y: sliderY, w: sliderW, h: sliderH, handleX, handleR: 12 };

    // 暂停/继续按钮
    y += sliderH + 20;
    const pauseBtnW = 120;
    const pauseBtnH = 40;
    const pauseBtnX = cx - pauseBtnW / 2;
    ctx.fillStyle = DayNightSystem.paused ? '#f44336' : '#4CAF50';
    ctx.beginPath();
    ctx.roundRect(pauseBtnX, y, pauseBtnW, pauseBtnH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(DayNightSystem.paused ? '▶ 继续' : '⏸ 暂停', pauseBtnX + pauseBtnW / 2, y + pauseBtnH / 2);
    renderer.debugButtons.push({ x: pauseBtnX, y, w: pauseBtnW, h: pauseBtnH, action: 'toggleDayNight' });

    y += pauseBtnH + 28;

    // === 分隔线 ===
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(W - 60, y);
    ctx.stroke();
    y += 24;

    // === 环境音效 ===
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🔊 环境音效', sectionX, y);

    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`${Math.round(AmbientSoundManager.masterVolume * 100)}%`, sectionX + 120, y);
    y += 32;

    const ambSliderW = Math.min(W - 160, 500);
    const ambSliderH = 18;
    const ambSliderX = cx - ambSliderW / 2;
    const ambSliderY = y;

    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(ambSliderX, ambSliderY, ambSliderW, ambSliderH, 9);
    ctx.fill();

    const ambFillW = ambSliderW * AmbientSoundManager.masterVolume;
    const ambGradient = ctx.createLinearGradient(ambSliderX, 0, ambSliderX + ambFillW, 0);
    ambGradient.addColorStop(0, '#4CAF50');
    ambGradient.addColorStop(1, '#81C784');
    ctx.fillStyle = ambGradient;
    ctx.beginPath();
    ctx.roundRect(ambSliderX, ambSliderY, ambFillW, ambSliderH, 9);
    ctx.fill();

    const ambHandleX = ambSliderX + ambFillW;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ambHandleX, ambSliderY + ambSliderH / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.stroke();

    renderer.ambientSlider = { x: ambSliderX, y: ambSliderY, w: ambSliderW, h: ambSliderH, handleX: ambHandleX, handleR: 11 };

    // 底部提示
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按 ESC 或 9+1 关闭', cx, H - 20);

    ctx.restore();
}
