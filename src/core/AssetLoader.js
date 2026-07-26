// src/core/AssetLoader.js
// 集中预加载器：驱动加载进度条 + 预热浏览器 HTTP 缓存。
//
// 设计原则（见计划 P2-12/13，避免过度设计）：
//  - 图片走 new Image() + decode()，仅用于「进度统计」与「缓存预热」。各模块自己的懒加载
//    标志（...Loaded）不回填——它们懒加载时会命中这里预热的 HTTP 缓存，自然不再 pop-in。
//  - 例外：主菜单 3 张模式预览图由本模块持有解码后的 Image 对象，MainMenuUI 经
//    getModePreviewImage() 直接复用，不再各自 new Image（避免重复请求/解码）。
//  - 音效绝大多数是代码合成的（SoundManager 振荡器/噪声），无文件。唯一需要在菜单就绪的
//    是菜单音乐 mp3：这里只 fetch 成 ArrayBuffer 存着，首次按键（用户手势）时才 decode+播放，
//    以满足浏览器 autoplay 策略。环境/天气音不预 decode（懒加载且可缺省）。

// 全部图片资源（src/pkg 下 36 张通用 png，路径相对 index.html 根目录）
// 主菜单 3 张模式预览图不在此列，由 MODE_PREVIEW_URLS 单独持有（见下，供 MainMenuUI 复用）
const IMAGE_URLS = [
    // 背包 / 角色 / 头盔
    'src/pkg/backpack/qthink.png',
    'src/pkg/character/blue/a/01.png',
    'src/pkg/character/blue/a/02.png',
    'src/pkg/character/blue/a/03.png',
    'src/pkg/character/blue/a/e1.png',
    'src/pkg/character/blue/a/e2.png',
    'src/pkg/character/blue/a/e3.png',
    'src/pkg/character/blue/a/e_hurt.png',
    'src/pkg/character/blue/a/Received.png',
    'src/pkg/character/blue/Commander/Commander.png',
    'src/pkg/gear/m35_blue.png',
    'src/pkg/gear/m35_green.png',
    'src/pkg/gear/m35_grey.png',
    'src/pkg/gear/m35b_brown.png',
    // 电台 / 支援图标
    'src/pkg/radio/a10/a10.png',
    'src/pkg/radio/mq9/mq9.png',
    'src/pkg/radio/call/call.png',
    'src/pkg/radio/call/call_nohave.png',
    // 载具
    'src/pkg/vehicle/jeep/jeep_uhd.png',
    'src/pkg/vehicle/btr80/apc_autocannon.png',
    'src/pkg/vehicle/btr80/apc_mg.png',
    'src/pkg/vehicle/btr80/btr80_drop.png',
    // 武器
    'src/pkg/weapon/919/919.png',
    'src/pkg/weapon/ak47/ak47.png',
    'src/pkg/weapon/ak47/ak47_Reload.png',
    'src/pkg/weapon/at4/at4.png',
    'src/pkg/weapon/AWP/AWP.png',
    'src/pkg/weapon/AWP/AWP_Reload.png',
    'src/pkg/weapon/Beretta92/Beretta92.png',
    'src/pkg/weapon/CAT/CAT.png',
    'src/pkg/weapon/hkmp5/hkmp5.png',
    'src/pkg/weapon/hkmp5/hkmp5_Reload.png',
    'src/pkg/weapon/m4a1/m4a1.png',
    'src/pkg/weapon/m4a1/m4a1_Reload.png',
    'src/pkg/weapon/M67/M67.png',
    'src/pkg/weapon/M82/M82.png',
    'src/pkg/weapon/M82/M82_Reload.png',
    'src/pkg/weapon/SA28/SA28.png',
    'src/pkg/weapon/xm320/xm320.png',
];

// 菜单音乐（注意文件名有四个点：loading....mp3）
const MENU_MUSIC_URL = 'src/pkg/sounds/menu/loading....mp3';

// 主菜单模式预览图（悬停某模式时右侧弹出）。由本模块统一持有解码后的 Image 对象，
// MainMenuUI 经 getModePreviewImage() 复用，不再各自 new Image（避免重复请求/解码）。
const MODE_PREVIEW_URLS = {
    battle:   'src/pkg/sounds/menu/Realtime_mode.png',
    quick:    'src/pkg/sounds/menu/Fast_mode.png',
    campaign: 'src/pkg/sounds/menu/Level_mode.png',
};
const modePreviewImages = {};
for (const [id, url] of Object.entries(MODE_PREVIEW_URLS)) {
    const img = new Image();
    img.src = url;
    modePreviewImages[id] = img;
}

/** 取回某模式的预览图 Image 对象（可能尚未解码完成，调用方用 img.complete 判断）。未知 id 返回 null。 */
export function getModePreviewImage(id) {
    return modePreviewImages[id] || null;
}

// 预加载得到的菜单音乐 ArrayBuffer，供 SoundManager 在首次按键时 decode
let menuMusicArrayBuffer = null;

/** 取回预加载的菜单音乐原始数据（ArrayBuffer，未 decode；可能为 null 表示加载失败） */
export function getMenuMusicArrayBuffer() {
    return menuMusicArrayBuffer;
}

/**
 * 预加载所有资源。
 * @param {(progress:number)=>void} [onProgress] 每完成一个资源回调一次，progress 从 0→1。
 * @returns {Promise<void>} 全部资源「尝试」完毕后 resolve（单个失败不阻塞，仅 console.warn）。
 */
export async function preloadAssets(onProgress) {
    const total = IMAGE_URLS.length + Object.keys(MODE_PREVIEW_URLS).length + 1; // +预览图 +菜单音乐
    let done = 0;
    const bump = () => {
        done++;
        if (onProgress) onProgress(done / total);
    };

    // 图片：new Image() + decode()。decode 失败（如 404）走 catch，不阻塞整体。
    const imageJobs = IMAGE_URLS.map(url => {
        const img = new Image();
        img.src = url;
        return img.decode()
            .catch(err => console.warn('⚠️ 图片预加载失败:', url, err))
            .finally(bump);
    });

    // 主菜单预览图：复用上方已创建的 Image 对象，decode 仅为进度统计（MainMenuUI 用 img.complete 判断可用性）
    const previewJobs = Object.values(modePreviewImages).map(img =>
        img.decode()
            .catch(err => console.warn('⚠️ 预览图预加载失败:', img.src, err))
            .finally(bump)
    );

    // 菜单音乐：fetch 成 ArrayBuffer 存着，首次按键时才 decode（autoplay 策略要求手势）。
    const musicJob = fetch(MENU_MUSIC_URL)
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.arrayBuffer();
        })
        .then(buf => { menuMusicArrayBuffer = buf; })
        .catch(err => console.warn('⚠️ 菜单音乐预加载失败:', MENU_MUSIC_URL, err))
        .finally(bump);

    await Promise.all([...imageJobs, ...previewJobs, musicJob]);
    if (onProgress) onProgress(1);
}
