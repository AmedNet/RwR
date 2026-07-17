// src/data/VehicleDialogues.js
// 载具 AI 闲聊对话内容库 — 对话链模式
// 每条对话链包含多行连贯对话，按顺序播放
// speaker: 'A' = 说话者1, 'B' = 说话者2, 'random' = 随机任一乘客
// category: idle | combat | joke | complaint | praise

export const VEHICLE_DIALOGUES = [
  // ─── idle: 日常闲聊 ───
  {
    category: 'idle',
    lines: [
      { speaker: 'A', text: '你说咱们打完这仗去哪吃火锅？' },
      { speaker: 'B', text: '我要点麻辣锅底，加两份毛肚' },
      { speaker: 'A', text: '你就知道吃，上次的罐头还没消化呢' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'A', text: '我昨天梦见回家了' },
      { speaker: 'B', text: '醒来发现抱着枪对吧？' },
      { speaker: 'A', text: '你怎么知道的...' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'B', text: '你睡觉打呼噜比炮声还响' },
      { speaker: 'A', text: '那是因为我在梦里唱歌' },
      { speaker: 'B', text: '唱歌？那更可怕了' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'random', text: '你带烟了没？给我来一根' },
      { speaker: 'random', text: '上次空投砸下来那箱子里全是罐头' },
      { speaker: 'random', text: '连烟都没有，这仗没法打了' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'A', text: '你说这吉普能跑多快？' },
      { speaker: 'B', text: '比你跑得快就行了' },
      { speaker: 'A', text: '那要是遇到龙卷风呢？' },
      { speaker: 'B', text: '那就看命了兄弟' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'A', text: '等打完仗我要去学做饭' },
      { speaker: 'B', text: '你做的饭比子弹还危险吧' },
      { speaker: 'A', text: '好歹比手雷安全' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'random', text: '谁有水？我渴得不行了' },
      { speaker: 'random', text: '水壶在后排座位底下' },
      { speaker: 'random', text: '谢了兄弟，救我一命' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'A', text: '你说咱们长官现在在干嘛' },
      { speaker: 'B', text: '大概在地图前面画圈圈吧' },
      { speaker: 'A', text: '他画的圈比我们跑的路还多' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'A', text: '我好像看到前面有只野兔' },
      { speaker: 'B', text: '别开枪！留着当晚餐' },
      { speaker: 'A', text: '你确定跑得过它？' }
    ]
  },
  {
    category: 'idle',
    lines: [
      { speaker: 'A', text: '这路也太颠了，我早饭都快吐出来了' },
      { speaker: 'B', text: '你早饭不是没吃吗？' },
      { speaker: 'A', text: '我吐的是胃酸...' }
    ]
  },

  // ─── combat: 战斗相关 ───
  {
    category: 'combat',
    lines: [
      { speaker: 'A', text: '我赌五毛那边房子里至少藏了三个' },
      { speaker: 'B', text: '左侧有动静，都检查一下射界' },
      { speaker: 'A', text: '准备好了，等他们露头' }
    ]
  },
  {
    category: 'combat',
    lines: [
      { speaker: 'random', text: '刚才那发差点打中我头盔' },
      { speaker: 'random', text: '头盔救了你一命' },
      { speaker: 'random', text: '下次就没这么好运了，低头！' }
    ]
  },
  {
    category: 'combat',
    lines: [
      { speaker: 'A', text: '弹药还够吗？省着点打' },
      { speaker: 'B', text: '还剩两个弹匣' },
      { speaker: 'A', text: '够了，等空投补给' }
    ]
  },
  {
    category: 'combat',
    lines: [
      { speaker: 'B', text: '看到狙击手了！在二楼窗户！' },
      { speaker: 'random', text: '别探头！外面有火力覆盖' },
      { speaker: 'A', text: '绕后！从右侧包过去' }
    ]
  },
  {
    category: 'combat',
    lines: [
      { speaker: 'A', text: '刚才那波炮击真猛，耳朵还在嗡' },
      { speaker: 'B', text: '跟紧点，别落单了' },
      { speaker: 'A', text: '放心，我不会当逃兵的' }
    ]
  },
  {
    category: 'combat',
    lines: [
      { speaker: 'random', text: '手雷准备好了，等我信号' },
      { speaker: 'random', text: '三、二、一——扔！' },
      { speaker: 'random', text: '漂亮！冲！' }
    ]
  },
  {
    category: 'combat',
    lines: [
      { speaker: 'A', text: '那挺机枪压制得我们抬不起头' },
      { speaker: 'B', text: '我来掩护，你绕后' },
      { speaker: 'A', text: '收到，十秒钟后动手' }
    ]
  },
  {
    category: 'combat',
    lines: [
      { speaker: 'random', text: '医疗兵！有人受伤了！' },
      { speaker: 'random', text: '撑住！我帮你包扎' },
      { speaker: 'random', text: '没事了兄弟，还能打吗？' }
    ]
  },

  // ─── joke: 互相调侃/冷笑话 ───
  {
    category: 'joke',
    lines: [
      { speaker: 'A', text: '你知道为什么子弹打不中我吗？' },
      { speaker: 'B', text: '为什么？' },
      { speaker: 'A', text: '因为我帅到它害羞' },
      { speaker: 'B', text: '那上次你被自己手雷炸飞呢？' }
    ]
  },
  {
    category: 'joke',
    lines: [
      { speaker: 'A', text: '我奶奶开枪都比你准' },
      { speaker: 'B', text: '你奶奶拿的可是拐杖不是步枪' },
      { speaker: 'A', text: '那她拄着拐杖都比你跑得快' }
    ]
  },
  {
    category: 'joke',
    lines: [
      { speaker: 'random', text: '我昨天看到一只猫在据点里巡逻' },
      { speaker: 'random', text: '那猫比你还会守据点' },
      { speaker: 'random', text: '至少它不会在岗位上打瞌睡' }
    ]
  },
  {
    category: 'joke',
    lines: [
      { speaker: 'B', text: '你说龙卷风来了咱们是跑还是躲？' },
      { speaker: 'random', text: '躲？你跑得过风吗哈哈哈' },
      { speaker: 'A', text: '我可以躲进吉普底下' },
      { speaker: 'B', text: '然后连车带人一起飞？' }
    ]
  },
  {
    category: 'joke',
    lines: [
      { speaker: 'A', text: '我听说新兵第一天都找不到北' },
      { speaker: 'B', text: '你到现在还分不清东南西北呢' },
      { speaker: 'A', text: '那是因为我一直在转圈' }
    ]
  },
  {
    category: 'joke',
    lines: [
      { speaker: 'random', text: '谁把袜子晾在枪管上了？' },
      { speaker: 'A', text: '那是我的！别碰！' },
      { speaker: 'B', text: '难怪开枪的时候有股味道' }
    ]
  },

  // ─── complaint: 吐槽抱怨 ───
  {
    category: 'complaint',
    lines: [
      { speaker: 'A', text: '这破吉普比我奶奶的拖拉机还颠' },
      { speaker: 'B', text: '后排的兄弟，你脚踩我座椅了' },
      { speaker: 'random', text: '别睡了！副驾驶的你给我盯着点！' }
    ]
  },
  {
    category: 'complaint',
    lines: [
      { speaker: 'A', text: '这鬼天气，雨下得跟泼水似的' },
      { speaker: 'B', text: '沙子进眼睛了，能不能停一下' },
      { speaker: 'A', text: '停？你当这是公交站呢？' }
    ]
  },
  {
    category: 'complaint',
    lines: [
      { speaker: 'random', text: '挡风玻璃都碎了，风直接灌进来' },
      { speaker: 'random', text: '谁去申请换一块新的' },
      { speaker: 'random', text: '后勤的人自己都在淋雨呢' }
    ]
  },
  {
    category: 'complaint',
    lines: [
      { speaker: 'A', text: '开了半天怎么还在原地？' },
      { speaker: 'B', text: '你倒是开快点啊，磨磨蹭蹭的' },
      { speaker: 'A', text: '你以为我不想快？这路全是坑！' }
    ]
  },
  {
    category: 'complaint',
    lines: [
      { speaker: 'random', text: '我屁股都坐麻了' },
      { speaker: 'random', text: '能不能别按喇叭了，耳朵要聋了' },
      { speaker: 'random', text: '油都快没了，谁负责加油的' }
    ]
  },
  {
    category: 'complaint',
    lines: [
      { speaker: 'A', text: '这路连个标记都没有，是不是走错了' },
      { speaker: 'B', text: '导航说前方五百米右转' },
      { speaker: 'A', text: '这破地方哪来的导航！' }
    ]
  },

  // ─── praise: 鼓励/称赞 ───
  {
    category: 'praise',
    lines: [
      { speaker: 'A', text: '刚才那枪打得漂亮！' },
      { speaker: 'B', text: '干得好兄弟，没白训练你' },
      { speaker: 'A', text: '跟你学的嘛' }
    ]
  },
  {
    category: 'praise',
    lines: [
      { speaker: 'random', text: '你这车技可以啊，老司机' },
      { speaker: 'random', text: '那当然，我可是拿过驾照的' },
      { speaker: 'random', text: '什么驾照？坦克驾照？' }
    ]
  },
  {
    category: 'praise',
    lines: [
      { speaker: 'A', text: '有你在旁边我安心多了' },
      { speaker: 'B', text: '这波配合打得漂亮，继续' },
      { speaker: 'A', text: '咱们小队是最强的，没人能比' }
    ]
  },
  {
    category: 'praise',
    lines: [
      { speaker: 'random', text: '你救了我一命，欠你个人情' },
      { speaker: 'random', text: '这局打完我请你喝啤酒' },
      { speaker: 'random', text: '说好了啊，要冰的' }
    ]
  },
  {
    category: 'praise',
    lines: [
      { speaker: 'A', text: '你换弹的速度越来越快了' },
      { speaker: 'B', text: '你的枪法什么时候练这么好的' },
      { speaker: 'A', text: '有你在，据点稳得很' }
    ]
  },
  {
    category: 'praise',
    lines: [
      { speaker: 'B', text: '稳住，我们能赢' },
      { speaker: 'A', text: '跟着你我有信心' },
      { speaker: 'B', text: '别拍马屁了，专心打' }
    ]
  }
];
