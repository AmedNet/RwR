// src/core/LootRegistry.js
// 战利品定义表 - 所有可搜刮物品的配置
// 新增物品只需在此处添加一条记录即可

export const Rarity = {
    COMMON: 'common',       // 普通（灰色）
    UNCOMMON: 'uncommon',   // 优良（绿色）
    RARE: 'rare',           // 稀有（蓝色）
    LEGENDARY: 'legendary'  // 传说（橙色）
};

export const RARITY_COLORS = {
    [Rarity.COMMON]: '#9E9E9E',
    [Rarity.UNCOMMON]: '#4CAF50',
    [Rarity.RARE]: '#2196F3',
    [Rarity.LEGENDARY]: '#FF9800'
};

export const RARITY_NAMES = {
    [Rarity.COMMON]: '普通',
    [Rarity.UNCOMMON]: '优良',
    [Rarity.RARE]: '稀有',
    [Rarity.LEGENDARY]: '传说'
};

// 战利品定义表
// minRank: 最低掉落军衔 (0=列兵, 1=军士, 2=军官, 3=指挥官)
// weight: 相对掉落权重（同稀有度内）
export const LootRegistry = {
    // ═══════════════════════════════════════
    // 普通物品 (COMMON) - 列兵起掉
    // ═══════════════════════════════════════
    shell_casing: {
        id: 'shell_casing',
        name: '弹壳',
        emoji: '🔩',
        description: '一枚磨损的子弹壳，上面刻着奇怪的标记。',
        rarity: Rarity.COMMON,
        value: 5 * 5,
        minRank: 0,
        weight: 30
    },
    bandage: {
        id: 'bandage',
        name: '绷带',
        emoji: '🩹',
        description: '用过的绷带...还是别卖了。',
        value: 8 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 25
    },
    ration: {
        id: 'ration',
        name: '口粮',
        emoji: '🥫',
        description: '压缩口粮，保质期到明年。',
        value: 10 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 20
    },
    cigarette: {
        id: 'cigarette',
        name: '烟蒂',
        emoji: '🚬',
        description: '半截没抽完的烟，还带着余温。',
        value: 5 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 30
    },
    lighter: {
        id: 'lighter',
        name: '打火机',
        emoji: '🔥',
        description: 'Zippo 打火机，盖子已经松了。',
        value: 12 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 15
    },
    shoelace: {
        id: 'shoelace',
        name: '鞋带',
        emoji: '🪢',
        description: '一段结实的伞绳，说不定能派上用场。',
        value: 5 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 25
    },
    empty_mag: {
        id: 'empty_mag',
        name: '空弹匣',
        emoji: '📎',
        description: '打空的弹匣，可以回收。',
        value: 8 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 20
    },
    dog_tag_blank: {
        id: 'dog_tag_blank',
        name: '空白狗牌',
        emoji: '🏷️',
        description: '还没刻字的狗牌，不知道是谁的。',
        value: 10 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 15
    },
    torn_photo: {
        id: 'torn_photo',
        name: '撕碎的全家福',
        emoji: '🖼️',
        description: '拼不回去了。照片背面写着"等爸爸回来"。',
        value: 3 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 20
    },
    child_toy: {
        id: 'child_toy',
        name: '小熊玩偶',
        emoji: '🧸',
        description: '沾满泥土和血迹的小熊玩偶。战场上不该有这种东西。',
        value: 2 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 12
    },
    wedding_ring: {
        id: 'wedding_ring',
        name: '结婚戒指',
        emoji: '💍',
        description: '内侧刻着日期和名字。希望那个人永远不知道。',
        value: 15 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 10
    },
    diary_page: {
        id: 'diary_page',
        name: '日记残页',
        emoji: '📄',
        description: '最后一页写着："再撑一天，明天就能回家了。"',
        value: 4 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 18
    },
    last_cigarette: {
        id: 'last_cigarette',
        name: '最后一支烟',
        emoji: '🚬',
        description: '烟盒里只剩一支，上面用记号笔写着"For Dad"。他没来得及抽。',
        value: 6 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 15
    },
    bloodied_watch: {
        id: 'bloodied_watch',
        name: '染血的手表',
        emoji: '⌚',
        description: '指针停在3:47。表盖内侧刻着"生日快乐，爸爸"。',
        value: 8 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 12
    },
    half_eaten_apple: {
        id: 'half_eaten_apple',
        name: '咬了一半的苹果',
        emoji: '🍎',
        description: '已经氧化变黑了。有人吃到一半就死了。',
        value: 2 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 18
    },
    prayer_book: {
        id: 'prayer_book',
        name: '祈祷书',
        emoji: '📖',
        description: '书页被血浸透粘在一起。某一页被折了角，反复翻过很多次。',
        value: 6 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 10
    },
    child_shoe: {
        id: 'child_shoe',
        name: '儿童鞋',
        emoji: '👟',
        description: '很小的鞋子，大概三四岁孩子穿的。鞋底磨得很厉害，说明孩子经常跑。',
        value: 3 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 8
    },
    broken_glasses: {
        id: 'broken_glasses',
        name: '碎眼镜',
        emoji: '👓',
        description: '镜片碎了一片，镜腿歪了。没有眼镜的人看不清这个世界最后的模样。',
        value: 4 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 14
    },

    child_homework: {
        id: 'child_homework',
        name: '儿童作业本',
        emoji: '📚',
        description: '作业本沾着血，最后一道数学题没做完。答案栏是空的。',
        value: 2 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 15
    },
    mother_letter: {
        id: 'mother_letter',
        name: '母亲的信',
        emoji: '💌',
        description: '"家里一切都好，别担心。早点回来。"信纸被水浸湿过。',
        value: 5 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 12
    },
    worn_wallet: {
        id: 'worn_wallet',
        name: '破旧的钱包',
        emoji: '👛',
        description: '里面装着家人的照片和几张皱巴巴的钞票。照片上的人在笑。',
        value: 8 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 10
    },
    broken_necklace: {
        id: 'broken_necklace',
        name: '断掉的项链',
        emoji: '📿',
        description: '女式项链，吊坠是心形的。链子断了一半，像是被扯断的。',
        value: 6 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 11
    },
    literacy_card: {
        id: 'literacy_card',
        name: '儿童识字卡',
        emoji: '🔤',
        description: '教小孩认字的卡片。背面用铅笔写着"爸爸是英雄"。',
        value: 3 * 5,
        rarity: Rarity.COMMON,
        minRank: 0,
        weight: 14
    },

    // ═══════════════════════════════════════
    // 优良物品 (UNCOMMON) - 军士起掉
    // ═══════════════════════════════════════
    dog_tag: {
        id: 'dog_tag',
        name: '狗牌',
        emoji: '🪖',
        description: '刻着名字的军用身份牌。"R. Martinez, 3rd Squad"。',
        value: 25 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 20
    },
    ammo_pouch: {
        id: 'ammo_pouch',
        name: '弹药包',
        emoji: '🎒',
        description: '装满子弹的弹匣袋，沉甸甸的。',
        value: 30 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 15
    },
    first_aid: {
        id: 'first_aid',
        name: '急救包',
        emoji: '🧰',
        description: '标准军用急救包，纱布和碘酒齐全。',
        value: 25 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 18
    },
    military_map: {
        id: 'military_map',
        name: '军用地图',
        emoji: '🗺️',
        description: '标注了阵地的地形图，有些区域被涂黑了。',
        value: 35 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 12
    },
    compass: {
        id: 'compass',
        name: '指南针',
        emoji: '🧭',
        description: '黄铜指南针，指针还在微微颤动。',
        value: 20 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 15
    },
    water_bottle: {
        id: 'water_bottle',
        name: '水壶',
        emoji: '🫗',
        description: '军用水壶，里面还有半壶水。',
        value: 20 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 18
    },
    binocular_lens: {
        id: 'binocular_lens',
        name: '望远镜镜片',
        emoji: '🔍',
        description: '从望远镜上拆下来的高倍镜片。',
        value: 30 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 10
    },
    radio_battery: {
        id: 'radio_battery',
        name: '电台电池',
        emoji: '🔋',
        description: '军用电台专用电池，还有电。',
        value: 25 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 14
    },
    melted_medal: {
        id: 'melted_medal',
        name: '熔毁的勋章',
        emoji: '🫠',
        description: '被高温融化变形的勋章，已经看不出原来的样子。它的主人也没能保持完整。',
        value: 18 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 10
    },
    bloody_helmet: {
        id: 'bloody_helmet',
        name: '带弹孔的头盔',
        emoji: '⛑️',
        description: '头盔侧面有一个完美的圆孔。它没能保住主人的命。',
        value: 22 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 12
    },
    child_drawing: {
        id: 'child_drawing',
        name: '儿童画',
        emoji: '🖍️',
        description: '蜡笔画：一个火柴人牵着小火柴人。旁边歪歪扭扭写着"我和爸爸在公园"。',
        value: 15 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 8
    },
    unmailed_letter: {
        id: 'unmailed_letter',
        name: '未寄出的信',
        emoji: '✉️',
        description: '信纸上有大片水渍。"亲爱的，这里的星星和你一样亮。"',
        value: 20 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 14
    },
    suicide_note: {
        id: 'suicide_note',
        name: '遗书',
        emoji: '💀',
        description: '"对不起，我撑不下去了。告诉妈妈我爱她。"字迹越来越潦草。',
        value: 12 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 6
    },
    trophy_tooth: {
        id: 'trophy_tooth',
        name: '金牙',
        emoji: '🦷',
        description: '从死人嘴里撬下来的金牙，还带着血丝。',
        value: 35 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 8
    },
    blood_stained_uniform: {
        id: 'blood_stained_uniform',
        name: '血染的军装',
        emoji: '👕',
        description: '胸前的弹孔周围是大片暗红色。口袋里还装着半块巧克力。',
        value: 18 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 10
    },
    field_recording: {
        id: 'field_recording',
        name: '战场录音带',
        emoji: '📼',
        description: '录音笔里存着最后的通讯："他们来了...上帝啊..."然后是枪声。',
        value: 28 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 7
    },
    propane_tank: {
        id: "propane_tank",
        name: "丙烷罐",
        emoji: "🪫",
        description: "装满丙烷的金属罐，野外生存必备。",
        value: 70 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 10
    },
    sugar: {
        id: "sugar",
        name: "方糖",
        emoji: "🍬",
        description: "洁白的小方块糖，加点甜甜的。",
        value: 60 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 1
    },
    severed_finger: {
        id: 'severed_finger',
        name: '断指',
        emoji: '👆',
        description: '用布包着的断指，无名指上还戴着戒指。戒指内侧刻着结婚日期。',
        value: 15 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 7
    },
    bloodied_shirt: {
        id: 'bloodied_shirt',
        name: '血衣',
        emoji: '👕',
        description: '被血浸透的衬衫，口袋里有一张全家福。照片上的人都已经不在了。',
        value: 20 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 9
    },
    final_recording: {
        id: 'final_recording',
        name: '最后的录音',
        emoji: '🎙️',
        description: '录音笔里存着最后一段话："妈妈，如果我回不来，告诉妹妹我爱她。"',
        value: 25 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 8
    },
    crushed_medal: {
        id: 'crushed_medal',
        name: '破碎的奖牌',
        emoji: '🏅',
        description: '被踩碎的体育奖牌，背面刻着"冠军"。碎片上还有血迹。',
        value: 18 * 5,
        rarity: Rarity.UNCOMMON,
        minRank: 1,
        weight: 10
    },
    // ═══════════════════════════════════════
    // 稀有物品 (RARE) - 军官起掉
    // ═══════════════════════════════════════
    military_docs: {
        id: 'military_docs',
        name: '军事文件',
        emoji: '📋',
        description: '盖着"机密"印章的文件，里面是部队调动记录。',
        value: 60 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 18
    },
    intel_disc: {
        id: 'intel_disc',
        name: '情报光盘',
        emoji: '💿',
        description: '加密光盘，不知道里面存着什么。',
        value: 75 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 12
    },
    medal: {
        id: 'medal',
        name: '勋章',
        emoji: '🎖️',
        description: '一枚铜制勋章，背面刻着"英勇作战"。',
        value: 80 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 10
    },
    encrypted_radio: {
        id: 'encrypted_radio',
        name: '加密电台',
        emoji: '📻',
        description: '跳频加密电台，频率已经锁死。',
        value: 70 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 14
    },
    officer_scope: {
        id: 'officer_scope',
        name: '军官望远镜',
        emoji: '🔭',
        description: '高级军官的蔡司望远镜，镜片上有金色镀膜。',
        value: 90 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 8
    },
    cipher_tube: {
        id: 'cipher_tube',
        name: '密码筒',
        emoji: '🔐',
        description: '转轮密码筒，上面的字母还在转动。',
        value: 85 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 10
    },
    night_vision: {
        id: 'night_vision',
        name: '夜视仪',
        emoji: '👁️',
        description: '单目夜视仪，绿色荧光屏还在亮着。',
        value: 100 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 6
    },
    tactical_vest: {
        id: 'tactical_vest',
        name: '战术背心',
        emoji: '🦺',
        description: '防弹战术背心，上面有弹痕。',
        value: 65 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 12
    },
    war_camera: {
        id: 'war_camera',
        name: '战地相机',
        emoji: '📷',
        description: '胶卷还没用完。冲洗出来会看到什么？有些照片不该被看见。',
        value: 70 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 8
    },
    tooth_collection: {
        id: 'tooth_collection',
        name: '牙齿收藏',
        emoji: '🦷',
        description: '一个小布袋，里面装着十几颗人类的牙齿。每颗都刻了记号。是从死人嘴里拔的。',
        value: 55 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 6
    },
    execution_order: {
        id: 'execution_order',
        name: '处决令',
        emoji: '☠️',
        description: '盖着红章的命令书。"就地正法，不必上报。"签名栏里的字迹很潦草。',
        value: 95 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 7
    },
    gas_mask: {
        id: 'gas_mask',
        name: '防毒面具',
        emoji: '😷',
        description: '滤毒罐已经过期了。镜片内侧有抓痕——从里面。',
        value: 80 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 9
    },
    human_remains: {
        id: 'human_remains',
        name: '人体残肢',
        emoji: '🦴',
        description: '用塑料袋包着的手臂，已经开始腐烂。不知道是谁的，也不知道为什么要留着。',
        value: 45 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 5
    },
    torture_tools: {
        id: 'torture_tools',
        name: '刑讯工具',
        emoji: '🔧',
        description: '一套专业的刑讯工具，每一件都擦得很干净。有些缝隙里的血迹洗不掉。',
        value: 85 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 6
    },
    mass_grave_map: {
        id: 'mass_grave_map',
        name: '乱葬岗地图',
        emoji: '🗺️',
        description: '标注了十七个集体坟墓的位置。每个点旁边写着数字——遇难人数。',
        value: 110 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 4
    },
    child_soldier_rifle: {
        id: 'child_soldier_rifle',
        name: '童兵的步枪',
        emoji: '🔫',
        description: '枪托上刻着"为妈妈报仇"。枪身很短，是给小孩用的。',
        value: 75 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 7
    },
    flash_drive: {
        id: "flash_drive",
        name: "加密U盘",
        emoji: "💾",
        description: "军用的加密U盘，里面有未加密的文件片段。",
        value: 120 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 1
    },
    fp_100: {
        id: "fp_100",
        name: "滤嘴",
        emoji: "🔫",
        description: "军用防毒面具滤芯，还能过滤毒素。",
        value: 95 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 2
    },
    military_power_filter: {
        id: "military_power_filter",
        name: "军用电源滤波器",
        emoji: "🔋",
        description: "高规格的电源滤波器，用于修复高端电子设备。",
        value: 130 * 5,
        rarity: Rarity.RARE,
        minRank: 3,
        weight: 6
    },
    human_specimen: {
        id: 'human_specimen',
        name: '人体标本',
        emoji: '🫀',
        description: '泡在福尔马林里的人体器官。标签上写着实验编号和日期。',
        value: 90 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 5
    },
    torture_log: {
        id: 'torture_log',
        name: '刑讯记录',
        emoji: '📓',
        description: '详细记录酷刑过程的笔记本。每一页都写着不同的惨叫声。',
        value: 120 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 4
    },
    bio_weapon: {
        id: 'bio_weapon',
        name: '生化武器样本',
        emoji: '☣️',
        description: '标注着危险符号的试管。里面的液体在微微发光。',
        value: 150 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 3
    },
    death_list: {
        id: 'death_list',
        name: '死亡名单',
        emoji: '📋',
        description: '列着数百个名字的清单，大部分被划掉了。你的名字在最后一页。',
        value: 100 * 5,
        rarity: Rarity.RARE,
        minRank: 2,
        weight: 6
    },

    // ═══════════════════════════════════════
    // 传说物品 (LEGENDARY) - 指挥官起掉
    // ═══════════════════════════════════════
    gold_bar: {
        id: 'gold_bar',
        name: '金条',
        emoji: '🥇',
        description: '一根小型金条，上面印着军方编号。这东西从哪来的？',
        value: 200 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 15
    },
    codebook: {
        id: 'codebook',
        name: '密码本',
        emoji: '📕',
        description: '一次性密码本，每页只使用一次。价值连城。',
        value: 250 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 10
    },
    general_sword: {
        id: 'general_sword',
        name: '将官佩刀',
        emoji: '⚔️',
        description: '刻着将官名字的 ceremonial 佩刀，刀鞘镶嵌宝石。',
        value: 300 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 6
    },
    battle_plan: {
        id: 'battle_plan',
        name: '作战计划',
        emoji: '📜',
        description: '标注了完整进攻路线的作战计划。"绝密·阅后即焚"。',
        value: 280 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 8
    },
    mystery_key: {
        id: 'mystery_key',
        name: '神秘钥匙',
        emoji: '🗝️',
        description: '一把造型古怪的钥匙，上面刻着不知名的符号。',
        value: 180 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 12
    },
    enemy_letter: {
        id: 'enemy_letter',
        name: '敌方情书',
        emoji: '💌',
        description: '一封没寄出的家书，字迹已经被泪水模糊。',
        value: 150 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 14
    },
    ancient_compass: {
        id: 'ancient_compass',
        name: '古老罗盘',
        emoji: '🧿',
        description: '看起来年代久远的罗盘，指针指向不存在的方向。',
        value: 220 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 8
    },
    war_trophy: {
        id: 'war_trophy',
        name: '战争纪念品',
        emoji: '🏆',
        description: '一个精致的微型坦克模型，底座刻着战役日期。',
        value: 160 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 12
    },
    secret_orders: {
        id: 'secret_orders',
        name: '密令',
        emoji: '📝',
        description: '密封的作战密令，火漆封印还没拆。',
        value: 240 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 7
    },
    officer_pistol: {
        id: 'officer_pistol',
        name: '军官配枪',
        emoji: '🔫',
        description: '镀金手枪，握把上刻着军官的名字。收藏品。',
        value: 260 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 8
    },
    peace_medal: {
        id: 'peace_medal',
        name: '和平勋章',
        emoji: '🕊️',
        description: '颁发日期是屠杀前一天。背面刻着"为了人类的尊严"。讽刺得令人作呕。',
        value: 270 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 6
    },
    generals_collection: {
        id: 'generals_collection',
        name: '将军的收藏',
        emoji: '📦',
        description: '一个精致的木盒，里面整齐码放着几十枚不同颜色的狗牌。每一枚都代表一条命。他以此为荣。',
        value: 320 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 5
    },
    child_soldier_tag: {
        id: 'child_soldier_tag',
        name: '童军狗牌',
        emoji: '👶',
        description: '狗牌上的年龄被改过。"Age: 17"——用刀片刮掉的原数字是12。',
        value: 190 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 8
    },
    victory_wine: {
        id: 'victory_wine',
        name: '胜利红酒',
        emoji: '🍷',
        description: '1945年份的红酒，瓶身上有弹孔。酒液已经变成了暗红色。分不清是酒还是别的。',
        value: 210 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 7
    },
    final_broadcast: {
        id: 'final_broadcast',
        name: '最后广播',
        emoji: '📼',
        description: '一盘录音带，标签写着"最终广播"。按下播放，只有静电噪音和一声叹息。然后是什么都没有。',
        value: 290 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 5
    },
    war_crimes_evidence: {
        id: 'war_crimes_evidence',
        name: '战争罪证',
        emoji: '📸',
        description: '一叠照片，记录着系统性的是反人类罪,拍摄他的人已经死了.',
        value: 350 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 4
    },
    generals_trophy_room: {
        id: 'generals_trophy_room',
        name: '将军的战利品室钥匙',
        emoji: '🗝️',
        description: '...没人知道在哪,里面有什么.',
        value: 400 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    last_words_recorder: {
        id: 'last_words_recorder',
        name: '遗言录音机',
        emoji: '📼',
        description: '专门录制死刑犯最后遗言的设备。磁带还剩一半，录满了各种语言的"妈妈"。',
        value: 310 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 5
    },
    genocide_order: {
        id: 'genocide_order',
        name: '种族清洗令',
        emoji: '📜',
        description: '"彻底清除该区域所有平民，不留活口。"盖着最高统帅部的印章。',
        value: 380 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    orphanage_deed: {
        id: 'orphanage_deed',
        name: '孤儿院地契',
        emoji: '🏚️',
        description: '孤儿院被炸成废墟后，这块地皮被军方低价收购。现在要建军官俱乐部。',
        value: 280 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 6
    },
    severed_finger_legendary: {
         id: "severed_finger_legendary",
         name: "断指",
         emoji: "🖐️",
         description: "一根被整齐切下的无名指，还戴着一枚婚戒。",
         value: 380 * 5,
         rarity: Rarity.LEGENDARY,
         minRank: 3,
         weight: 1
    },
    human_teeth_necklace: {
        id: "human_teeth_necklace",
        name: "人牙项链",
        emoji: "🦷",
        description: "用几十颗成年人牙齿串成的项链，有些还带着血丝。",
        value: 420 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    doll_eye_jar: {
        id: "doll_eye_jar",
        name: "眼球标本罐",
        emoji: "👁️",
        description: "福尔马林里泡着七颗眼球，瞳孔全部朝向同一个方向。",
        value: 500 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 4
    },
    baby_monitor: {
        id: "baby_monitor",
        name: "改装婴儿监视器",
        emoji: "📡",
        description: "信号被篡改过的婴儿监视器，深夜会传来不属于这个房间的声音。",
        value: 350 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 5
    },
    hair_ball: {
        id: "hair_ball",
        name: "缠结发团",
        emoji: "💇",
        description: "一大团纠缠在一起的长发，里面还有几根头发仍在缓缓生长。",
        value: 400 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 2
    },
    skin_bookmark: {
        id: "skin_bookmark",
        name: "人皮书签",
        emoji: "📑",
        description: "一张经过鞣制处理的人皮，上面用暗红色墨水写着难以辨认的符文。",
        value: 550 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 1
    },
    recording_tape: {
        id: "recording_tape",
        name: "空白录音带",
        emoji: "📼",
        description: "一盘标记为空白的录音带，播放时却会听到自己的呼吸声。",
        value: 370 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 2
    },
    wedding_photo: {
        id: "wedding_photo",
        name: "褪色结婚照",
        emoji: "🖼️",
        description: "一张黑白结婚照，新娘的脸被挖掉了，背景里多了一个不属于两人的影子。",
        value: 480 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 1
    },
    bone_flute: {
        id: "bone_flute",
        name: "骨笛",
        emoji: "🦴",
        description: "用人类胫骨制成的笛子，吹奏时发出的不是笛声，而是低沉的呜咽。",
        value: 620 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 2
    },
    mirror_shard: {
        id: "mirror_shard",
        name: "镜中碎片",
        emoji: "🪞",
        description: "一面古镜的碎片，照出的倒影永远比你慢半秒眨眼。",
        value: 530 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 1
    },
    gas_analyzer: {
        id: "gas_analyzer",
        name: "气体分析仪",
        emoji: "🧪",
        description: "便携式气体检测仪，屏幕上还有读数闪烁。",
        value: 150 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    ledx: {
        id: "ledx",
        name: "LEDX皮肤透照仪",
        emoji: "💡",
        description: "医疗用的高精度透照仪，在黑市上极受欢迎。",
        value: 200 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 4
    },
    military_armor_plate: {
        id: "military_armor_plate",
        name: "军用防弹插板",
        emoji: "🛡️",
        description: "完好无损的陶瓷防弹插板，四级防护标准。",
        value: 180 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 15
    },
    military_circuit_board: {
        id: "military_circuit_board",
        name: "军用电路板",
        emoji: "🔌",
        description: "完好无损的军用级电路板，上面有多个集成芯片。",
        value: 160 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 4
    },
    bitcoin: {
        id: "bitcoin",
        name: "比特币",
        emoji: "🪙",
        description: "GPU挖出来的比特币，上面刻着数字签名。",
        value: 250 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 1
    },
    military_tech_manual: {
        id: "military_tech_manual",
        name: "军事技术手册",
        emoji: "📖",
        description: "标有机密字样的军事技术手册，包含了武器改造指南。",
        value: 190 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 2
    },
    vintage_wine: {
        id: "vintage_wine",
        name: "陈年红酒",
        emoji: "🍷",
        description: "一瓶保存完好的82年拉菲，价值不菲。",
        value: 240 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 6
    },
    wedding_field_dress: {
        id: "wedding_field_dress",
        name: "战地婚纱",
        emoji: "👰",
        description: "从废墟中翻出的染血婚纱。裙摆上绣着日期——婚礼本该在战争结束那天举行。",
        value: 195 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 6
    },
    trench_letters: {
        id: "trench_letters",
        name: "未寄出的信",
        emoji: "✉️",
        description: "一叠用血迹写成的家书，收件人栏始终是空白的。最后一张只写了五个字：妈，我回不",
        value: 250 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 2
    },
    medal_returned: {
        id: "medal_returned",
        name: "退回的勋章",
        emoji: "🎖️",
        description: "一枚追授的勇气勋章，原封不动装在快递盒里退回。收件人那一栏写着：阵亡将士家属收。",
        value: 200 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    half_playing_card: {
        id: "half_playing_card",
        name: "半张扑克牌",
        emoji: "🃏",
        description: "一张被子弹撕成两半的黑桃A。持牌人在最后一次牌局后就没再回过战壕。",
        value: 160 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 2,
        weight: 1
    },
    cessation_of_fire: {
        id: "cessation_of_fire",
        name: "停火协议草稿",
        emoji: "📜",
        description: "停战谈判的草稿文件，页脚用铅笔加了一行小字：但他们知道明天还是会打。",
        value: 270 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    dog_tags_pile: {
        id: "dog_tags_pile",
        name: "狗牌堆",
        emoji: "🔖",
        description: "用鞋带串起的一百多副狗牌。没有人记得它们属于谁，只知道每一副都对应一个回不来的名字。",
        value: 285 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 12
    },
    photograph_smile: {
        id: "photograph_smile",
        name: "最后的合影",
        emoji: "📸",
        description: "一张全排的合影。每个人都在笑。照片背面写着拍摄日期——次日拂晓发动总攻。该排无人生还。",
        value: 260 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 2
    },
    child_hand_doll: {
        id: "child_hand_doll",
        name: "防空洞布偶",
        emoji: "🧸",
        description: "一个破旧的布偶熊，棉絮从缝线里露出来。它的主人在地面轰炸声里学会了闭嘴。",
        value: 185 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 2,
        weight: 4
    },
    tank_tracks_scarf: {
        id: "tank_tracks_scarf",
        name: "履带围巾",
        emoji: "🧣",
        description: "用废弃坦克履带残片打磨成的围巾。每一片钢环都来自一辆被击毁的坦克，佩戴者走路的碰撞声像在敲丧钟。",
        value: 230 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 10
    },
    unknown_soldier_ashes: {
        id: "unknown_soldier_ashes",
        name: "无名骨灰罐",
        emoji: "⚱️",
        description: "一个锈蚀的金属罐，里面装着烧焦的骨骸碎片。罐身上只刻着一行字：第47号身份不明烈士。",
        value: 295 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 8
    },
    dictator_diary: {
        id: 'dictator_diary',
        name: '独裁者的日记',
        emoji: '📔',
        description: '记录着屠杀计划的私人日记。字迹工整，像是在写购物清单。',
        value: 400 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    camp_keys: {
        id: 'camp_keys',
        name: '集中营钥匙',
        emoji: '🗝️',
        description: '打开毒气室的钥匙串。每把钥匙上都贴着标签，写着容量人数。',
        value: 380 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 4
    },
    experiment_report: {
        id: 'experiment_report',
        name: '人体实验报告',
        emoji: '📊',
        description: '详细记录活体实验的医学报告。附录里是实验对象的遗言。',
        value: 420 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 3
    },
    extermination_order: {
        id: 'extermination_order',
        name: '灭绝令原件',
        emoji: '📜',
        description: '种族灭绝的正式命令文件。盖着最高统帅部的印章，签名很潦草。',
        value: 450 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 2
    },
    war_criminal_photo: {
        id: 'war_criminal_photo',
        name: '战犯合影',
        emoji: '📸',
        description: '军官们在尸体前的合影。所有人都在笑，比着胜利手势。',
        value: 360 * 5,
        rarity: Rarity.LEGENDARY,
        minRank: 3,
        weight: 4
    },

};

/**
 * 根据敌人军衔随机生成战利品列表
 * @param {number} enemyRank - 敌人军衔 (0~3)
 * @returns {string[]} 战利品 ID 数组
 */
export function rollLoot(enemyRank) {
    // 掉落率：列兵40%, 军士50%, 军官60%, 指挥官80%
    const dropChance = [0.40, 0.50, 0.60, 0.80][enemyRank] || 0.40;
    if (Math.random() > dropChance) return [];

    // 掉落数量
    const countRange = [
        [1, 1],   // 列兵: 1
        [1, 2],   // 军士: 1~2
        [2, 2],   // 军官: 2
        [2, 3]    // 指挥官: 2~3
    ][enemyRank] || [1, 1];
    const count = countRange[0] + Math.floor(Math.random() * (countRange[1] - countRange[0] + 1));

    // 按军衔筛选可用物品
    const available = Object.values(LootRegistry).filter(item => item.minRank <= enemyRank);
    if (available.length === 0) return [];

    // 按稀有度分组
    const byRarity = {};
    for (const item of available) {
        if (!byRarity[item.rarity]) byRarity[item.rarity] = [];
        byRarity[item.rarity].push(item);
    }

    // 确定每个掉落品的稀有度池
    // 高军衔保证至少掉一个高稀有度物品
    const results = [];
    for (let i = 0; i < count; i++) {
        let pool;
        if (enemyRank >= 3 && i === 0) {
            // 指挥官第一个保证是传说
            pool = byRarity[Rarity.LEGENDARY] || byRarity[Rarity.RARE] || available;
        } else if (enemyRank >= 2 && i === 0) {
            // 军官第一个保证是稀有
            pool = byRarity[Rarity.RARE] || byRarity[Rarity.UNCOMMON] || available;
        } else {
            // 其他情况：根据军衔加权选择稀有度
            pool = weightedRarityPool(enemyRank, byRarity, available);
        }
        if (pool.length > 0) {
            const chosen = weightedRandom(pool);
            results.push(chosen.id);
        }
    }

    return results;
}

/**
 * 根据军衔加权选择稀有度池
 */
function weightedRarityPool(enemyRank, byRarity, allAvailable) {
    const weights = {
        [Rarity.COMMON]: [60, 40, 10, 5],
        [Rarity.UNCOMMON]: [30, 40, 30, 15],
        [Rarity.RARE]: [10, 18, 45, 35],
        [Rarity.LEGENDARY]: [0, 2, 15, 45]
    };

    const rarityOrder = [Rarity.COMMON, Rarity.UNCOMMON, Rarity.RARE, Rarity.LEGENDARY];
    let totalWeight = 0;
    const candidates = [];

    for (const rarity of rarityOrder) {
        const items = byRarity[rarity];
        if (!items || items.length === 0) continue;
        const w = weights[rarity][enemyRank] || 0;
        if (w > 0) {
            candidates.push({ items, weight: w });
            totalWeight += w;
        }
    }

    if (totalWeight === 0) return allAvailable;

    let roll = Math.random() * totalWeight;
    for (const c of candidates) {
        roll -= c.weight;
        if (roll <= 0) return c.items;
    }
    return candidates[candidates.length - 1].items;
}

/**
 * 按 weight 字段从物品数组中随机选一个
 */
function weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    for (const item of items) {
        roll -= (item.weight || 1);
        if (roll <= 0) return item;
    }
    return items[items.length - 1];
}
