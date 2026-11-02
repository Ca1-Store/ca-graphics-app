/* منطق نقي (بدون Electron) لتحديد مسار GTA V وتثبيت ساوندات الأسلحة — قابل للاختبار */
const fs = require("fs");
const path = require("path");

const SFX_REL = ["x64", "audio", "sfx"];
const SOUND_FILE = /^[\w\-. ()]{1,120}\.rpf$/i;
const GAME_DIRS = ["Grand Theft Auto V Legacy", "Grand Theft Auto V", "Grand Theft Auto V Enhanced", "GTAV", "GTA V"];

const sfxDir = (root) => path.join(root, ...SFX_REL);
function isGtaRoot(p, _fs = fs) {
    try {
        if (!p || typeof p !== "string") return false;
        if (!_fs.statSync(sfxDir(p)).isDirectory()) return false;
        return true;
    } catch { return false; }
}
/* يقبل جذر اللعبة أو أي مجلد داخله (sfx / audio / x64) ويرجع الجذر */
function normalizeRoot(p, _fs = fs) {
    if (!p || typeof p !== "string") return null;
    let cur = path.resolve(p);
    for (let i = 0; i < 4; i++) {
        if (isGtaRoot(cur, _fs)) return cur;
        const parent = path.dirname(cur);
        if (parent === cur) break;
        cur = parent;
    }
    return null;
}
/* قراءة مسارات مكتبات Steam من libraryfolders.vdf */
function parseSteamLibraries(text) {
    const out = [];
    const re = /"path"\s+"([^"]+)"/gi; let m;
    while ((m = re.exec(String(text || "")))) out.push(m[1].replace(/\\\\/g, "\\"));
    return out;
}
/* تجميع المسارات المرشّحة. env: متغيرات البيئة، extra: مسارات من السجل/Steam/Epic */
function candidatePaths({ env = {}, drives = ["C", "D", "E", "F", "G", "H"], extra = [] } = {}) {
    const pf = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.ProgramW6432].filter(Boolean);
    const list = [...extra];
    for (const base of pf) {
        for (const g of GAME_DIRS) list.push(path.join(base, "Rockstar Games", g));
        for (const g of GAME_DIRS) list.push(path.join(base, "Steam", "steamapps", "common", g));
        list.push(path.join(base, "Epic Games", "GTAV"));
    }
    for (const d of drives) {
        const r = d + ":\\";
        for (const g of GAME_DIRS) {
            list.push(path.join(r, "Program Files", "Rockstar Games", g), path.join(r, "Rockstar Games", g), path.join(r, "Games", "Rockstar Games", g),
                path.join(r, "Program Files (x86)", "Steam", "steamapps", "common", g), path.join(r, "Steam", "steamapps", "common", g), path.join(r, "SteamLibrary", "steamapps", "common", g), path.join(r, "Games", g));
        }
        list.push(path.join(r, "Epic Games", "GTAV"), path.join(r, "Program Files", "Epic Games", "GTAV"));
    }
    return [...new Set(list.filter(Boolean))];
}
function findGta(opts, _fs = fs) {
    const found = [];
    for (const c of candidatePaths(opts)) { if (isGtaRoot(c, _fs) && !found.includes(c)) found.push(c); }
    return found;
}
/* اسم الملف الهدف: يُطابق ملفاً موجوداً في sfx بغض النظر عن حالة الأحرف */
function matchTarget(sfx, name, _fs = fs) {
    if (!SOUND_FILE.test(String(name || ""))) return null;
    try {
        const hit = _fs.readdirSync(sfx).find((f) => f.toLowerCase() === String(name).toLowerCase());
        return hit || null;
    } catch { return null; }
}
const isRpf7 = (buf) => !!buf && buf.length >= 4 && buf.readUInt32LE(0) === 0x37465052; // "RPF7"
function errMessage(e) {
    const c = e && e.code;
    if (c === "EACCES" || c === "EPERM") return "ليس للبرنامج صلاحية الكتابة في مجلد اللعبة. أغلق البرنامج وشغّله بزر الفأرة الأيمن ← «تشغيل كمسؤول»";
    if (c === "EBUSY") return "الملف مستخدم حالياً. أغلق GTA V وFiveM ثم أعد المحاولة";
    if (c === "ENOSPC") return "لا توجد مساحة كافية على القرص";
    return (e && e.message) || "فشل العملية";
}
module.exports = { SFX_REL, SOUND_FILE, sfxDir, isGtaRoot, normalizeRoot, parseSteamLibraries, candidatePaths, findGta, matchTarget, isRpf7, errMessage };
