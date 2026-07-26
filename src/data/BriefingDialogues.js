// src/data/BriefingDialogues.js
// 开局任务简报台词模板 + 随机组装。
// 指挥官根据当前天气/地形/据点随机说简报，Received 以不情愿或幽默的语气回应。
import { GameState } from '../core/GameState.js';
import { WeatherSystem } from '../core/WeatherSystem.js';
import { WEATHER_DEFS } from '../core/WeatherDefs.js';
import { Terrain } from '../core/Map.js';

// ─── 说话者定义（名字 + 名字牌颜色，供 DialogueUI 使用） ───
export const SPEAKERS = {
    commander: { name: '指挥官', color: '#4ade80' },
    received:  { name: 'Received', color: '#fbbf24' },
};

// ─── 指挥官台词模板 ───
// {weather}=天气中文名, {terrain}=主地形中文名, {points}=据点数量
const COMMANDER = {
    // 开场白（简报起头，抓注意力；恶劣天气用更凝重的 openerSevere）
    opener: [
        '各单位注意，简报开始，都给我听好了。',
        '都靠拢过来，长话短说，任务马上开始。',
        '检查装备，竖起耳朵——我只说一遍。',
        '行动前最后交代几句，都记进脑子里。',
        '时间不多，我直接说重点。',
        '诸位，今天的活儿不轻松，听我安排。',
        '都到齐了?好，废话不多说，进正题。',
        '都给我精神点，简报马上开始。',
        '站好，别交头接耳，听我讲两句。',
        '人到齐了就开工，先听我把情况交代清楚。',
        '把装备再检查一遍，然后都过来听我说。',
        '我用最直白最不绕弯子的话告诉你.',
        '我直接说结论,一句话总结.',
    ],
    openerSevere: [
        '都给我严肃点，今天这天气要人命。',
        '先把丑话说前头——今天这仗不好打。',
        '听好了，今天的条件恶劣到可能回不来。',
        '都打起十二分精神，今天不是寻常出勤。',
        '都把表情收一收，今天不是闹着玩的。',
        '我把话撂这儿——今天谁掉链子谁自己负责。',
        '都听好了，今天这任务，我是捏着汗下的令。',
    ],
    // 按天气分类（用 WEATHER_DEFS 中文名匹配，见 weatherCategory）
    weather: {
        clear: [
            '今天是{weather}，视野开阔，适合推进。',
            '{weather}，能见度不错。趁这天色把战线往前压。',
            '老天赏脸，{weather}。别浪费了好天气。',
            '{weather}万里无云，狙击手会很喜欢这天——包括对面的。',
            '难得的{weather}，抓紧窗口期，天黑前把据点吃下来。',
            '{weather}适合机动，别窝在原地，动起来才有主动权。',
            '{weather}天里远处动静看得清，先侦察再推进，别盲冲。',
            '好天气也意味着我们更显眼，注意利用地形阴影。',
            '{weather}下视野是把双刃剑，你看得远，对面也看得远。',
            '趁{weather}把观察哨往前推，情报就是命。',
            '{weather}里光影分明，背光的方位更容易藏人，多留神。',
        ],
        rain: [
            '外面下着{weather}，地面湿滑，注意脚下和枪声被雨声盖住。',
            '{weather}会压低视线和听觉，敌人可能摸得很近。保持警惕。',
            '这场{weather}既是麻烦也是掩护——利用好它。',
            '{weather}里光学瞄具会起雾，多留神近距离的突发接触。',
            '雨声能盖住你的脚步，也能盖住对面的——别太依赖耳朵。',
            '{weather}天里电子设备容易受潮，通讯断了就按预案走。',
            '{weather}里脚印留不久，追踪和反追踪都得靠脑子。',
            '雨天视野受限，拉近距离再开火，别浪费子弹。',
            '{weather}是天然的消音器，摸点和反摸点都趁现在。',
            '地面泥泞，撤退路线提前看好，别等被打崩了才找路。',
        ],
        snow: [
            '{weather}，气温骤降。动作放慢，别在雪地里留下太明显的踪迹。',
            '冰天雪地的{weather}，武器容易卡壳，勤检查你的枪。',
            '{weather}里白色是天然伪装，反过来说对面也一样。',
            '长时间待在{weather}里会失温，别在一个点蹲太久。',
            '{weather}地面打滑，爬坡和急转都要留余量。',
            '{weather}里枪声传得远，一开火就暴露位置，想好再打。',
            '雪地反光刺眼，备好护目，别被晃花了眼错过敌人。',
            '{weather}里补给线容易断，弹药省着用，别打空了才慌。',
            '低温会让手指僵硬，扣扳机前先活动，别关键时刻掉链子。',
        ],
        fog: [
            '{weather}，能见度极低。紧贴队友，别一个人冲进白茫茫里。',
            '这{weather}里敌我难辨，开火前先确认目标。',
            '{weather}是近距离遭遇战的高发区，手指别太松。',
            '浓{weather}里声音会骗人，方位判断多交叉验证。',
            '{weather}天适合摸点，也容易被摸——进出都要留后路。',
            '{weather}里别贪射程，贴脸遭遇拼的是反应和胆量。',
            '能见度这么低，队形收紧，走散了就是送人头。',
            '{weather}是烟幕的平替，借它转移、撤退都好用。',
            '浓{weather}里友军误伤风险高，开火前多看一眼识别。',
        ],
        storm: [
            '{weather}正在过境，场面会很混乱。稳住，别被天气带乱节奏。',
            '遇上{weather}了，雷声会盖过枪声——靠眼睛,别只靠耳朵。',
            '{weather}里能见度时好时坏，别被一时的空隙骗了。',
            '强{weather}可能掀翻临时掩体，别把命压在薄墙后面。',
            '{weather}天通讯不稳，掉线就按既定路线汇合。',
            '{weather}里落物和飞溅碎片也是威胁，别只盯着敌人。',
            '雷暴天别站高地和空旷处，避雷和避弹一样重要。',
            '{weather}过境时双方都难，谁稳得住谁就占上风。',
            '趁{weather}的噪音掩护推进，对面听不见你的脚步。',
        ],
        extreme: [
            '天象异常，{weather}……这可不是什么好兆头。速战速决。',
            '{weather}之下战场透着古怪，打起十二分精神。',
            '{weather}罕见得很，老侦察兵都没见过——别掉以轻心。',
            '这种{weather}里什么事都可能发生，预案多做一手。',
            '{weather}压境，士气容易崩，稳住自己再稳住队友。',
            '{weather}之下常规经验可能失灵，随机应变。',
            '遇上{weather}别慌，慌的是对面——我们训练有素。',
            '{weather}里仪器可能失灵，回归最原始的判断。',
            '这种{weather}百年一遇，打赢了够吹一辈子。',
        ],
    },
    // 按主地形分类
    terrain: {
        forest:  [
            '这片{terrain}密布，是伏击的温床，也是我们的掩体。',
            '据点周围是{terrain}，利用树线隐蔽接敌。',
            '{terrain}里视线被切割得支离破碎，多打短促突击。',
            '进了{terrain}就别走直线，绕着树走，别给对面架枪的机会。',
            '{terrain}里声音传不远也辨不准，靠眼睛和队友的手势。',
            '密{terrain}是狙击手的噩梦也是天堂，多换位置别被锁死。',
            '{terrain}里遭遇战拼的是先手，反应慢半拍就没了。',
        ],
        river:   [
            '有{terrain}横在中间，渡河点就是咽喉，盯紧了。',
            '{terrain}会拖慢移动，别在河里当活靶子。',
            '过{terrain}时最脆弱，先压制对岸再下水。',
            '{terrain}沿岸是天然杀伤区，渡河前把烟和掩护准备好。',
            '{terrain}里别扎堆过河，分批交替掩护，留人压阵。',
            '涉水时枪举高，别让它进了水——哑火的枪不如烧火棍。',
            '{terrain}两岸的桥和浅滩是必争点，提前派人盯住。',
        ],
        mountain:[
            '这里是{terrain}地带，高地就是优势，抢上去。',
            '{terrain}地形易守难攻，别硬冲仰角。',
            '{terrain}上谁占了棱线谁说了算，别在山腰恋战。',
            '在{terrain}里仰攻最吃亏，能绕侧就别正面爬。',
            '{terrain}上居高临下火力占尽便宜，抢高点是第一要务。',
            '爬{terrain}体力消耗大，留足气力，别到顶了没劲打仗。',
            '{terrain}里回声乱，枪声方位别全信，多看弹着点。',
        ],
        sand:    [
            '开阔的{terrain}，没有掩体，冲的时候注意火力掩护。',
            '{terrain}上跑不快，规划好路线再动。',
            '{terrain}一览无余，暴露就是挨打，善用烟雾。',
            '穿越{terrain}要快、要分散，别挤成一团给人扫。',
            '{terrain}上找低洼和起伏当掩体，别傻站着对射。',
            '开阔{terrain}里载具和远程火力是主角，注意反制。',
            '{terrain}扬尘大，移动会暴露，能趴着就别跑。',
        ],
        house:   [
            '这一带有{terrain}建筑，巷战随时可能打响，清房要仔细。',
            '{terrain}区适合打防守，把窗口利用起来。',
            '{terrain}里每个拐角都可能藏人，进门先清死角。',
            '在{terrain}打的是耐心，别急着露头，先听再动。',
            '{terrain}里别走门窗正中央，那是预瞄点，贴墙切角。',
            '巷战{terrain}里手雷比枪好使，清房前先扔一个。',
            '{terrain}里楼上楼下都要防，别只盯着一个平面。',
        ],
        grass:   [
            '平坦的{terrain}，没什么遮挡，交火会很直接。',
            '开阔{terrain}，谁先占住据点谁占优。',
            '{terrain}上没处躲，火力压制和机动要配合好。',
            '这片{terrain}打的是反应速度，先手很重要。',
            '{terrain}上交火距离拉得开，注意压枪和点射节奏。',
            '平坦{terrain}里侧翼最容易被打穿，留人看住两翼。',
            '{terrain}没什么花活，拼的就是基本功和配合。',
        ],
    },
    // 据点战术（{points}=据点数）
    points: [
        '本区域共有 {points} 个据点，逐个拿下，别贪多冒进。',
        '地图上标了 {points} 个据点，优先抢离我们最近的。',
        '目标是控制全部 {points} 个据点，稳扎稳打。',
        '{points} 个据点要合理分配兵力，别全压一处。',
        '这 {points} 个据点互为犄角，拿下其中一个就能牵动全局。',
        '别小看任何一个据点，{points} 个点一个都别漏。',
        '{points} 个据点里先挑软柿子捏，打出势头再啃硬骨头。',
        '占住{points} 个据点只是开始，守得住才算数，留人看场。',
        '{points} 个据点分散，别被各个击破，互相能支援才稳。',
        '夺{points} 个据点讲究节奏，一口气吃不成胖子，步步为营。',
        '这 {points} 个据点丢一个都可能翻盘，得手之后立刻巩固。',
    ],
    // 据点少（≤2）：集中兵力速决
    pointsFew: [
        '就 {points} 个据点，集中兵力一口气端掉。',
        '据点不多，{points} 个而已，攥成拳头打，别分散。',
        '{points} 个据点，目标明确，速战速决。',
        '只有 {points} 个据点，拿下就走，别恋战。',
    ],
    // 据点多（≥5）：战线长，分兵有章法
    pointsMany: [
        '{points} 个据点战线拉得长，分兵要分得有章法。',
        '据点多达 {points} 个，别想一口吃下，逐个蚕食。',
        '{points} 个据点铺这么开，通讯和支援是命脉。',
        '{points} 个据点，顾此失彼是大忌，排好优先级。',
        '这么多据点（{points} 个），守比攻难，留足预备队。',
    ],
    // 通用收尾战术
    tactical: [
        '有情况随时呼叫支援，别硬扛。',
        '记住，活着回来比逞英雄重要。',
        '保持队形，互相掩护。出发。',
        '弹药和血量随时留意，别等见底了才想起来补给。',
        '遇到硬茬先撤再想办法，命比面子值钱。',
        '通讯保持畅通，报点要及时。祝好运。',
        '相信你的队友，也相信你的枪。行动。',
        '战场上信息就是命，看到什么报什么，别藏着掖着。',
        '别恋战，目标达成就收，贪刀最容易翻车。',
        '留得青山在，不怕没柴烧——血量见底果断撤。',
        '掩体是第二条命，能贴墙就别站桩，能趴下就别蹲着。',
        '换弹和投雷的时机自己拿捏，别在最危险的时候空仓。',
        '听指挥，别单干，一个人再猛也扛不住一个班。',
        '稳住心态，顺风别浪，逆风别慌，打到底。出发！',
    ],
    // 恶劣局面专用收尾（凝重）
    tacticalSevere: [
        '记住，今天能活着回来就是头等功。出发。',
        '我不需要英雄，我需要你们都回来。行动。',
        '保重，等你们的好消息——也要等你们的人。',
        '稳住，活着把旗插上。出发！',
        '今天这趟，平安比战果重要。都给我回来。',
    ],
    // 恶劣天气通用警告（无专属地形×天气组合时用）
    warning: [
        '这种条件下，活着把任务做完就是胜利。',
        '别逞能，情况不对立刻撤，我不收尸体。',
        '今天的伤亡可能比往常高，都给我当心。',
        '宁可慢三分，不要抢一秒——这天气容错率极低。',
        '把退路先想好，再谈怎么打。',
        '任何异常立刻上报，别自己扛。',
    ],
    // 安抚（Received 表达害怕后，指挥官接话稳住军心）
    reassure: [
        '怕就对了，怕才会小心。跟上。',
        '别怂，我把你们带出来，就负责带回去。',
        '紧张是好事，说明你还没麻木。',
        '有我在，天塌不下来。行动。',
        '害怕说明你清楚状况，比莽撞强多了。',
        '都别慌，该慌的是对面。',
        '放心，最难的部分我陪你们一起扛。',
    ],
};

// ─── Received 回应台词（不情愿 / 幽默） ───
const RECEIVED = {
    reluctant: [
        '又是这种天气，真会挑时候。',
        '说真的，我宁愿在后勤',
        '啥?',
        'Yes',
        '……行吧，反对也没用',
        '每次都挑最烂的天，想整我直说',
        '我上辈子到底造了什么孽，要在这种地方打仗',
        '唉，又是打工的一天',
        '你先别急',
        '我已知晓以上内容',
        '这活真不是人干的……',
        '过',
        '(auto mode on)',
    ],
    humorous: [
        '稍等.',
        'ber?所以赢了发不发工资',
        '你说的对',
        '收到，长官,做这种事你先上吧!',
        '放心，我跑得很快——撤退的时候',
        '据点我收下了，功劳记得写我名字',
        '敌人多不多?不多的话我考虑一下单挑',
        '等我先喝完这口水，战争也得讲基本法',
        '收到！不过先说好，挨打的时候你掩护',
        '这天气适合睡觉，不太适合打仗啊长官!!!!',
    ],
    // 对危险/恶劣局面的即时反应（指挥官说完警告后插嘴，让简报成为来回对话）
    reactDanger: [
        '听你这么一说，我突然有点想家',
        '长官，现在逃还来得及吗',
        '啊?',
        '会赢吗',
        '?不是?',
        '行吧，遗书我昨晚就写好了',
        '这种局，赢了能记三等功吧?得加钱!',
    ],
};

// ─── 工具：从数组随机取一条 ───
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ─── 天气分类：用 WEATHER_DEFS 中文名匹配关键词 ───
function weatherCategory(name) {
    if (!name) return 'clear';
    if (name.includes('血月') || name.includes('日食')) return 'extreme';
    if (name.includes('暴风雪')) return 'snow'; // 暴风雪语义属雪天（但 severity 仍按 severe，见 weatherSeverity）
    if (name.includes('龙卷风') || name.includes('沙尘暴') || name.includes('暴风')) return 'storm';
    if (name.includes('雾')) return 'fog';
    if (name.includes('雪') || name.includes('冰雹')) return 'snow';
    if (name.includes('雨')) return 'rain';
    return 'clear';
}

// ─── 地形采样：统计地图网格，返回占比最高的非草地地形 ───
function dominantTerrain() {
    const map = GameState.map;
    if (!map || !map.data) return { key: 'grass', name: '草地' };
    const counts = {};
    const step = Math.max(1, Math.floor(Math.min(map.cols, map.rows) / 40)); // 抽样避免全量遍历
    for (let r = 0; r < map.rows; r += step) {
        for (let c = 0; c < map.cols; c += step) {
            const t = map.getTile(c, r);
            if (t === Terrain.GRASS || t === Terrain.CAPTURE || t < 0) continue;
            counts[t] = (counts[t] || 0) + 1;
        }
    }
    let best = null, bestN = 0;
    for (const t in counts) {
        if (counts[t] > bestN) { bestN = counts[t]; best = Number(t); }
    }
    const NAMES = {
        [Terrain.FOREST]:   { key: 'forest',   name: '森林' },
        [Terrain.RIVER]:    { key: 'river',    name: '河流' },
        [Terrain.MOUNTAIN]: { key: 'mountain', name: '山地' },
        [Terrain.SAND]:     { key: 'sand',     name: '沙地' },
        [Terrain.HOUSE]:    { key: 'house',    name: '城镇' },
        [Terrain.ROAD]:     { key: 'grass',    name: '草地' },
    };
    return (best != null && NAMES[best]) ? NAMES[best] : { key: 'grass', name: '草地' };
}

// ─── 天气恶劣度分级：决定简报的语气与篇幅 ───
function weatherSeverity(cat, name) {
    if (cat === 'storm' || cat === 'extreme') return 'severe';
    if (name && name.includes('暴风雪')) return 'severe'; // 暴风雪归 snow 但仍是恶劣局面，保留凝重语气
    if (cat === 'rain' || cat === 'snow' || cat === 'fog') return 'moderate';
    return 'clear';
}

// ─── 地形×天气危险组合：命中返回一句专属警告模板，否则 null ───
function comboWarning(cat, terrainKey) {
    const COMBOS = {
        'fog|forest':     '浓雾钻{terrain}，是最容易被伏击的组合——眼睛放亮，步步为营。',
        'fog|house':      '雾天{terrain}巷战，转角遭遇的概率翻倍，慢一点。',
        'rain|river':     '{weather}加{terrain}，水位说涨就涨，渡河务必抢时间。',
        'snow|river':     '{weather}让{terrain}结了冰，踩之前先试承重。',
        'snow|mountain':  '{weather}里的{terrain}随时可能雪崩，别在坡下扎堆。',
        'storm|mountain': '{weather}天站{terrain}高地等于当活靶子，先找低处避一避。',
        'storm|river':    '{weather}里的{terrain}又急又浑，能不过就不过。',
        'extreme|forest': '{weather}压着{terrain}，林子随时可能起火倒塌，别钻太深。',
    };
    return COMBOS[cat + '|' + terrainKey] || null;
}

// ─── 占位符替换 ───
function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

// ─── 组装开局简报：按局面动态组装（恶劣天气更长更凝重，平时精简） ───
// 返回 [{ speaker:'commander'|'received', name, color, text }]
export function generateBriefing() {
    const weatherType = WeatherSystem.current;
    const weatherName = (WEATHER_DEFS[weatherType] && WEATHER_DEFS[weatherType].name) || '晴天';
    const cat = weatherCategory(weatherName);
    const severity = weatherSeverity(cat, weatherName);
    const terrain = dominantTerrain();
    const points = (GameState.capturePoints && GameState.capturePoints.length) || 3;

    const vars = { weather: weatherName, terrain: terrain.name, points };

    const lines = [];
    const cmd = (text) => lines.push({ speaker: 'commander', ...SPEAKERS.commander, text: fill(text, vars) });
    const rec = (text) => lines.push({ speaker: 'received', ...SPEAKERS.received, text: fill(text, vars) });

    // ── 指挥官简报 ──
    // 1) 开场白：恶劣天气必说（凝重版），平时八成概率来一句（常规版）
    if (severity === 'severe') cmd(pick(COMMANDER.openerSevere));
    else if (Math.random() < 0.8) cmd(pick(COMMANDER.opener));

    // 2) 天气（必说）
    cmd(pick(COMMANDER.weather[cat] || COMMANDER.weather.clear));

    // 3) 地形（必说）
    cmd(pick(COMMANDER.terrain[terrain.key] || COMMANDER.terrain.grass));

    // 4) 警告：命中地形×天气危险组合必说；否则恶劣天气六成概率补一句通用警告
    const combo = comboWarning(cat, terrain.key);
    let dangerSaid = false; // 是否说了危险警告 → 触发 Received 即时反应 + 指挥官安抚
    if (combo) { cmd(combo); dangerSaid = true; }
    else if (severity === 'severe' && Math.random() < 0.6) { cmd(pick(COMMANDER.warning)); dangerSaid = true; }

    // 4b) 危险局面的来回对话：Received 插嘴害怕 → 指挥官接话安抚（让简报成为对话而非独白）
    if (dangerSaid) {
        rec(pick(RECEIVED.reactDanger));
        cmd(pick(COMMANDER.reassure));
    }

    // 5) 据点（按数量选语气：少→集中速决，多→分兵蚕食，~65%）
    if (Math.random() < 0.65) {
        const pointPool = points <= 2 ? COMMANDER.pointsFew
                        : points >= 5 ? COMMANDER.pointsMany
                        : COMMANDER.points;
        cmd(pick(pointPool));
    }

    // 6) 收尾：恶劣局面用凝重版，否则通用
    cmd(pick(severity === 'severe' ? COMMANDER.tacticalSevere : COMMANDER.tactical));

    // ── Received：1-2 句回应（不情愿或幽默） ──
    const pool = Math.random() < 0.5 ? RECEIVED.reluctant : RECEIVED.humorous;
    rec(pick(pool));
    if (Math.random() < 0.35) rec(pick(pool));

    return lines;
}
