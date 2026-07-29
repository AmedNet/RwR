// src/input/handlers/BattleReportHandler.js
// 战地模式胜利战报的输入处理：点击任意处 / 按任意键关闭，关闭后游戏继续。
// 只有一个动作（继续），关闭直接写 GameState，无需 main.js 回调（区别于 QuickResult 的多按钮分发）。
import { GameState } from '../../core/GameState.js';
import { playUISound } from '../../utils/SoundManager.js';

function close() {
    playUISound('click');
    GameState.battleReport = null;
}

// 弹出动画未放完则不响应（不调用 preventDefault，让事件穿透回下层，避免卡住）
// 放完后点击任意处关闭。
export function handleBattleReportMousedown(e) {
    if (GameState.appear.battleReport.progress >= 1) {
        e.preventDefault();
        close();
        return true;
    }
    return false;
}

// 弹出动画放完后按任意键关闭，其余情况不阻止事件（让下层正常处理）。
export function handleBattleReportKeydown(e) {
    if (GameState.appear.battleReport.progress >= 1) {
        e.preventDefault();
        close();
        return true;
    }
    return false;
}
