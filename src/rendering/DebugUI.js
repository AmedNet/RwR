// src/rendering/DebugUI.js
import { GameState } from '../core/GameState.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { DayNightSystem } from '../core/DayNightSystem.js';
import { AmbientSoundManager } from '../utils/AmbientSoundManager.js';
import { LootRegistry, Rarity, RARITY_COLORS, RARITY_NAMES } from '../core/LootRegistry.js';
import { LootPickup } from '../entities/LootPickup.js';

// 标签页定义
const DEBUG_TABS = [
    { id: 0, label: '\u{1F464} \u73A9\u5BB6', color: '#4CAF50' },
    { id: 1, label: '\u{1F324}\uFE0F \u5929\u6C14', color: '#00BCD4' },
    { id: 2, label: '\u{1F305} \u663C\u591C', color: '#FF9800' },
    { id: 3, label: '\u{1F381} \u6218\u5229\u54C1', color: '#E91E63' },
    { id: 4, label: '\u{1F50A} \u97F3\u6548', color: '#9C27B0' }
];

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
    renderer.debugTabs = [];
    renderer.debugSlider = null;
    renderer.ambientSlider = null;

    let y = 30;

    // === 标题 ===
    ctx.fillStyle = '#00BCD4';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F41B} Debug Panel', cx, y);
    y += 40;

    // === 标签页 ===
    const tabW = 100;
    const tabH = 36;
    const tabGap = 8;
    const totalTabW = DEBUG_TABS.length * tabW + (DEBUG_TABS.length - 1) * tabGap;
    let tabX = cx - totalTabW / 2;
    const currentTab = GameState.debugTab || 0;

    DEBUG_TABS.forEach((tab) => {
        const isActive = tab.id === currentTab;

        // Tab 背景
        ctx.fillStyle = isActive ? tab.color : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(tabX, y, tabW, tabH, 6);
        ctx.fill();

        // Tab 边框
        ctx.strokeStyle = isActive ? tab.color : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // Tab 文字
        ctx.fillStyle = isActive ? '#fff' : 'rgba(255,255,255,0.6)';
        ctx.font = `${isActive ? 'bold ' : ''}13px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tab.label, tabX + tabW / 2, y + tabH / 2);

        renderer.debugTabs.push({ x: tabX, y, w: tabW, h: tabH, id: tab.id });
        tabX += tabW + tabGap;
    });
    y += tabH + 20;

    // === 分隔线 ===
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(W - 60, y);
    ctx.stroke();
    y += 20;

    // === 根据当前标签页渲染内容 ===
    const sectionX = 80;

    if (currentTab === 0) {
        // === 玩家页 ===
        const player = GameState.player;
        const stars = player ? '\u2605'.repeat(player.rank + 1) : '';
        const rankName = player && player.getRankName ? player.getRankName() : '';

        // 状态信息
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`\u{1F4B0} RP: ${GameState.rp}`, cx, y);
        y += 30;
        ctx.fillStyle = '#fff';
        ctx.font = '18px sans-serif';
        ctx.fillText(`${stars} ${rankName}`, cx, y);
        y += 40;

        // RP 按钮
        const btnW = 140;
        const btnH = 44;
        const btnGap = 16;
        const rpButtons = [
            { label: '+100 RP', value: 100, color: '#4CAF50' },
            { label: '+500 RP', value: 500, color: '#2196F3' },
            { label: '+1000 RP', value: 1000, color: '#9C27B0' }
        ];
        const rowW = rpButtons.length * btnW + (rpButtons.length - 1) * btnGap;
        let rowX = cx - rowW / 2;

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
        y += btnH + 20;

        // 行动按钮
        const actionButtons = [
            { label: '\u2B06 \u63D0\u5347\u519B\u8854', action: 'rankUp', color: '#FF6F00' },
            { label: '\u2764 \u6EE1\u8840', action: 'heal', color: '#f44336' }
        ];
        const actRowW = actionButtons.length * btnW + (actionButtons.length - 1) * btnGap;
        rowX = cx - actRowW / 2;

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
        y += btnH + 20;

        // FPS显示开关
        const fpsBtnW = 200;
        const fpsBtnH = 40;
        const fpsBtnX = cx - fpsBtnW / 2;
        const fpsOn = GameState.debugShowFPS;
        ctx.fillStyle = fpsOn ? '#4CAF50' : '#3a3a3a';
        ctx.beginPath();
        ctx.roundRect(fpsBtnX, y, fpsBtnW, fpsBtnH, 6);
        ctx.fill();
        ctx.strokeStyle = fpsOn ? '#81C784' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = fpsOn ? 2 : 1;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fpsText = fpsOn ? `\u{1F4CA} \u5E27\u7387\u663E\u793A: \u5F00 (${GameState.fps} FPS)` : '\u{1F4CA} \u5E27\u7387\u663E\u793A: \u5173';
        ctx.fillText(fpsText, fpsBtnX + fpsBtnW / 2, y + fpsBtnH / 2);
        renderer.debugButtons.push({ x: fpsBtnX, y, w: fpsBtnW, h: fpsBtnH, action: 'toggleFPS' });

    } else if (currentTab === 1) {
        // === 天气页 ===
        ctx.fillStyle = '#00BCD4';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1F324}\uFE0F \u5929\u6C14\u63A7\u5236', sectionX, y);

        const currentDef = WeatherSystem.getWeatherDef();
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.fillText(`\u5F53\u524D: ${currentDef.icon} ${currentDef.name}`, sectionX + 120, y);
        y += 40;

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

        y += Math.ceil(weatherTypes.length / wCols) * (wBtnH + wGap) + 20;

        // 龙卷风雷达开关
        const toggleBtnW = 200;
        const toggleBtnH = 40;
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
        ctx.fillText(isOn ? '\u{1F32A}\uFE0F \u9F99\u5377\u98CE\u96F7\u8FBE: \u5F00' : '\u{1F32A}\uFE0F \u9F99\u5377\u98CE\u96F7\u8FBE: \u5173', toggleBtnX + toggleBtnW / 2, y + toggleBtnH / 2);
        renderer.debugButtons.push({ x: toggleBtnX, y, w: toggleBtnW, h: toggleBtnH, action: 'toggleTornadoRadar' });

    } else if (currentTab === 2) {
        // === 昼夜页 ===
        ctx.fillStyle = '#FF9800';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1F305} \u663C\u591C\u63A7\u5236', sectionX, y);

        ctx.fillStyle = '#FFD700';
        ctx.font = '16px sans-serif';
        ctx.fillText(`\u{1F550} ${DayNightSystem.getTimeString()}`, sectionX + 120, y);
        y += 40;

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
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 3;
        ctx.stroke();

        renderer.debugSlider = { x: sliderX, y: sliderY, w: sliderW, h: sliderH, handleX, handleR: 12 };

        // 暂停/继续按钮
        y += sliderH + 30;
        const pauseBtnW = 140;
        const pauseBtnH = 44;
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
        ctx.fillText(DayNightSystem.paused ? '\u25B6 \u7EE7\u7EED' : '\u23F8 \u6682\u505C', pauseBtnX + pauseBtnW / 2, y + pauseBtnH / 2);
        renderer.debugButtons.push({ x: pauseBtnX, y, w: pauseBtnW, h: pauseBtnH, action: 'toggleDayNight' });

    } else if (currentTab === 3) {
        // === 战利品页 ===
        ctx.fillStyle = '#E91E63';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1F381} \u6218\u5229\u54C1\u5237\u51FA', sectionX, y);
        y += 40;

        // 按稀有度刷出按钮
        const lootRarities = [
            { key: Rarity.COMMON, label: '\u666E\u901A', color: '#9E9E9E' },
            { key: Rarity.UNCOMMON, label: '\u4F18\u826F', color: '#4CAF50' },
            { key: Rarity.RARE, label: '\u7A00\u6709', color: '#2196F3' },
            { key: Rarity.LEGENDARY, label: '\u4F20\u8BF4', color: '#FF9800' }
        ];
        const lootBtnW = 120;
        const lootBtnH = 44;
        const lootGap = 12;
        const lootRowW = lootRarities.length * lootBtnW + (lootRarities.length - 1) * lootGap;
        let lootX = cx - lootRowW / 2;

        lootRarities.forEach((lr) => {
            ctx.fillStyle = lr.color;
            ctx.beginPath();
            ctx.roundRect(lootX, y, lootBtnW, lootBtnH, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`\u5237 ${lr.label}`, lootX + lootBtnW / 2, y + lootBtnH / 2);
            renderer.debugButtons.push({ x: lootX, y, w: lootBtnW, h: lootBtnH, action: 'spawnLoot', rarity: lr.key });
            lootX += lootBtnW + lootGap;
        });
        y += lootBtnH + 20;

        // 全部刷出按钮
        const allBtnW = 220;
        const allBtnH = 44;
        const allBtnX = cx - allBtnW / 2;
        ctx.fillStyle = '#E91E63';
        ctx.beginPath();
        ctx.roundRect(allBtnX, y, allBtnW, allBtnH, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1F31F} \u5237\u51FA\u6240\u6709\u6218\u5229\u54C1 (\u54041\u4E2A)', allBtnX + allBtnW / 2, y + allBtnH / 2);
        renderer.debugButtons.push({ x: allBtnX, y, w: allBtnW, h: allBtnH, action: 'spawnAllLoot' });

    } else if (currentTab === 4) {
        // === 音效页 ===
        ctx.fillStyle = '#9C27B0';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u{1F50A} \u73AF\u5883\u97F3\u6548', sectionX, y);

        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.fillText(`${Math.round(AmbientSoundManager.masterVolume * 100)}%`, sectionX + 120, y);
        y += 40;

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
        ctx.strokeStyle = '#9C27B0';
        ctx.lineWidth = 2;
        ctx.stroke();

        renderer.ambientSlider = { x: ambSliderX, y: ambSliderY, w: ambSliderW, h: ambSliderH, handleX: ambHandleX, handleR: 11 };
    }

    // 底部提示
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u6309 ESC \u6216 9+1 \u5173\u95ED', cx, H - 20);

    ctx.restore();
}
