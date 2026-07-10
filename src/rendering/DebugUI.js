// src/rendering/DebugUI.js
import { GameState } from '../core/GameState.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { AmbientSoundManager } from '../utils/AmbientSoundManager.js';

export function drawDebug(ctx, renderer) {
    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, renderer.width, renderer.height);

    // 标题
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐛 Debug 面板', renderer.width / 2, 80);

    // 当前RP
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`💰 当前 RP: ${GameState.rp}`, renderer.width / 2, 150);

    // 按钮配置
    const buttons = [
        { label: '+100 RP', value: 100, color: '#4CAF50' },
        { label: '+500 RP', value: 500, color: '#2196F3' },
        { label: '+1000 RP', value: 1000, color: '#9C27B0' }
    ];

    const btnW = 180;
    const btnH = 60;
    const btnGap = 20;
    const startX = renderer.width / 2 - (buttons.length * btnW + (buttons.length - 1) * btnGap) / 2;
    const btnY = 220;

    // 存储按钮位置供点击检测
    renderer.debugButtons = [];

    buttons.forEach((btn, i) => {
        const x = startX + i * (btnW + btnGap);

        // 按钮背景
        ctx.fillStyle = btn.color;
        ctx.beginPath();
        ctx.roundRect(x, btnY, btnW, btnH, 10);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 按钮文字
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, x + btnW / 2, btnY + btnH / 2);

        // 保存按钮位置
        renderer.debugButtons.push({ x, y: btnY, w: btnW, h: btnH, value: btn.value });
    });

    // 额外功能按钮
    const extraButtons = [
        { label: '满血', action: 'heal', color: '#f44336' }
    ];

    const extraBtnY = btnY + btnH + 30;
    const extraStartX = renderer.width / 2 - (extraButtons.length * btnW + (extraButtons.length - 1) * btnGap) / 2;

    extraButtons.forEach((btn, i) => {
        const x = extraStartX + i * (btnW + btnGap);

        ctx.fillStyle = btn.color;
        ctx.beginPath();
        ctx.roundRect(x, extraBtnY, btnW, btnH, 10);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, x + btnW / 2, extraBtnY + btnH / 2);

        renderer.debugButtons.push({ x, y: extraBtnY, w: btnW, h: btnH, action: btn.action });
    });

    // 天气控制区域
    const weatherTitleY = extraBtnY + btnH + 50;
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌤️ 天气控制', renderer.width / 2, weatherTitleY);

    // 当前天气显示
    const currentDef = WeatherSystem.getWeatherDef();
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`当前: ${currentDef.icon} ${currentDef.name}`, renderer.width / 2, weatherTitleY + 35);

    // 天气按钮网格 (6列 × 3行)
    const weatherTypes = WeatherSystem.getAllWeatherTypes();
    const wBtnW = 70;
    const wBtnH = 40;
    const wBtnGap = 8;
    const wCols = 6;
    const wGridW = wCols * wBtnW + (wCols - 1) * wBtnGap;
    const wStartX = renderer.width / 2 - wGridW / 2;
    const wStartY = weatherTitleY + 60;

    weatherTypes.forEach((wt, i) => {
        const col = i % wCols;
        const row = Math.floor(i / wCols);
        const x = wStartX + col * (wBtnW + wBtnGap);
        const y = wStartY + row * (wBtnH + wBtnGap);

        // 按钮背景
        const isActive = wt.key === WeatherSystem.current;
        ctx.fillStyle = isActive ? '#4CAF50' : '#555';
        ctx.beginPath();
        ctx.roundRect(x, y, wBtnW, wBtnH, 6);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = isActive ? '#81C784' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // 按钮文字（图标 + 简称）
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wt.icon, x + wBtnW / 2, y + wBtnH / 2 - 6);

        ctx.font = '10px sans-serif';
        ctx.fillText(wt.name, x + wBtnW / 2, y + wBtnH / 2 + 8);

        // 保存按钮位置
        renderer.debugButtons.push({ x, y, w: wBtnW, h: wBtnH, weather: wt.key });
    });


    // 昼夜控制区域
    const daynightTitleY = wStartY + Math.ceil(weatherTypes.length / wCols) * (wBtnH + wBtnGap) + 30;
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌅 昼夜控制', renderer.width / 2, daynightTitleY);

    // 当前时间显示
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`🕐 ${DayNightSystem.getTimeString()}`, renderer.width / 2, daynightTitleY + 35);

    // 时间滑块
    const sliderW = 400;
    const sliderH = 20;
    const sliderX = renderer.width / 2 - sliderW / 2;
    const sliderY = daynightTitleY + 60;

    // 滑块轨道背景
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(sliderX, sliderY, sliderW, sliderH, 10);
    ctx.fill();

    // 滑块轨道渐变（模拟昼夜）
    const gradient = ctx.createLinearGradient(sliderX, 0, sliderX + sliderW, 0);
    gradient.addColorStop(0, 'rgba(10,15,40,0.8)');    // 深夜
    gradient.addColorStop(0.25, 'rgba(60,30,10,0.6)'); // 黎明
    gradient.addColorStop(0.5, 'rgba(135,206,235,0.3)'); // 白天
    gradient.addColorStop(0.75, 'rgba(50,20,10,0.6)'); // 黄昏
    gradient.addColorStop(1, 'rgba(10,15,40,0.8)');    // 夜晚
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(sliderX, sliderY, sliderW, sliderH, 10);
    ctx.fill();

    // 滑块手柄
    const handleX = sliderX + DayNightSystem.timeOfDay * sliderW;
    const handleR = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(handleX, sliderY + sliderH / 2, handleR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00BCD4';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 保存滑块区域供点击检测
    renderer.debugSlider = {
        x: sliderX,
        y: sliderY,
        w: sliderW,
        h: sliderH,
        handleX: handleX,
        handleR: handleR
    };

    // 暂停/继续按钮
    const pauseBtnW = 120;
    const pauseBtnH = 40;
    const pauseBtnX = renderer.width / 2 - pauseBtnW / 2;
    const pauseBtnY = sliderY + sliderH + 20;

    ctx.fillStyle = DayNightSystem.paused ? '#f44336' : '#4CAF50';
    ctx.beginPath();
    ctx.roundRect(pauseBtnX, pauseBtnY, pauseBtnW, pauseBtnH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(DayNightSystem.paused ? '▶ 继续' : '⏸ 暂停', pauseBtnX + pauseBtnW / 2, pauseBtnY + pauseBtnH / 2);

    renderer.debugButtons.push({
        x: pauseBtnX,
        y: pauseBtnY,
        w: pauseBtnW,
        h: pauseBtnH,
        action: 'toggleDayNight'
    });

    // ─── 环境音效控制区域 ───
    const ambientTitleY = pauseBtnY + pauseBtnH + 40;
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔊 环境音效', renderer.width / 2, ambientTitleY);

    // 音量滑块
    const ambSliderW = 300;
    const ambSliderH = 16;
    const ambSliderX = renderer.width / 2 - ambSliderW / 2;
    const ambSliderY = ambientTitleY + 40;

    // 滑块轨道背景
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(ambSliderX, ambSliderY, ambSliderW, ambSliderH, 8);
    ctx.fill();

    // 已填充部分
    const ambFillW = ambSliderW * AmbientSoundManager.masterVolume;
    const ambGradient = ctx.createLinearGradient(ambSliderX, 0, ambSliderX + ambFillW, 0);
    ambGradient.addColorStop(0, '#4CAF50');
    ambGradient.addColorStop(1, '#81C784');
    ctx.fillStyle = ambGradient;
    ctx.beginPath();
    ctx.roundRect(ambSliderX, ambSliderY, ambFillW, ambSliderH, 8);
    ctx.fill();

    // 滑块手柄
    const ambHandleX = ambSliderX + ambFillW;
    const ambHandleR = 10;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ambHandleX, ambSliderY + ambSliderH / 2, ambHandleR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 音量百分比文字
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(AmbientSoundManager.masterVolume * 100)}%`, renderer.width / 2, ambSliderY + ambSliderH + 20);

    // 保存环境音效滑块区域
    renderer.ambientSlider = {
        x: ambSliderX,
        y: ambSliderY,
        w: ambSliderW,
        h: ambSliderH,
        handleX: ambHandleX,
        handleR: ambHandleR
    };

    // 底部提示
    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击按钮生效 | 按 ESC 或 9+1 关闭', renderer.width / 2, renderer.height - 20);

    ctx.restore();
}