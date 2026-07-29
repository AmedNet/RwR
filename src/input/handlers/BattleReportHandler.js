// src/input/handlers/BattleReportHandler.js
// 战地模式胜利战报的输入处理：点击任意处 / 按任意键关闭，关闭后游戏继续。
// 只有一个动作（继续），关闭直接写 GameState，无需 main.js 回调（区别于 QuickResult 的多按钮分发）。
import { GameState } from '../../core/GameState.js';
import { playUISound } from '../../utils/SoundManager.js';

function close() {
    playUISound('click');
    GameState.battleReport = null;
}

// 弹出动画未放完不响应（吞掉事件，防穿透开火）；放完后点击任意处关闭。
export function handleBattleReportMousedown(e) {
    if (GameState.battleReportAppearAnim >= 1) close();
    e.preventDefault();
    return true;
}

// 弹出动画放完后按任意键关闭，吞噬其余键。
export function handleBattleReportKeydown(e) {
    if (GameState.battleReportAppearAnim >= 1) close();
    e.preventDefault();
    return true;
}
