/* ساوندات الأسلحة: تحديد مسار GTA V تلقائياً، استبدال ملفات x64\audio\sfx مع نسخة احتياطية واسترجاع */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const gta = require("./lib/gta");
const core = require("./lib/core");
let unzipper; try { unzipper = require("unzipper"); } catch { unzipper = null; }

module.exports = function initSounds(ctx) {
    const { app, ipcMain, dialog, getMain, request, report, doDownload, dlState, setStage, getBusy, setBusy, findItem } = ctx;
    const ud = app.getPath("userData");
    const PATH_FILE = path.join(ud, "gta_path.txt"), REC_FILE = path.join(ud, "gta_sounds.json"), BK_DIR = path.join(ud, "gta_sound_backup");
    const MAX_RPF = 1.5 * 1024 * 1024 * 1024;

    const readPath = () => { try { const p = fs.readFileSync(PATH_FILE, "utf8").trim(); return gta.isGtaRoot(p) ? p : null; } catch { return null; } };
    const savePath = (p) => { fs.writeFileSync(PATH_FILE, p, "utf8"); };
    const readRec = () => { try { return JSON.parse(fs.readFileSync(REC_FILE, "utf8")) || {}; } catch { return {}; } };
    const writeRec = (o) => { try { fs.writeFileSync(REC_FILE, JSON.stringify(o), "utf8"); } catch {} };

    /* ───── الاكتشاف التلقائي ───── */
    const reg = (key, name) => new Promise((res) => {
        if (process.platform !== "win32") return res(null);
        execFile("reg", ["query", key, "/v", name], { timeout: 4000, windowsHide: true }, (err, out) => {
            if (err) return res(null);
            const m = String(out).match(new RegExp(name + "\\s+REG_\\w+\\s+(.+)", "i")); res(m ? m[1].trim() : null);
        });
    });
    async function detectAll() {
        const extra = [];
        const rk = ["HKLM\\SOFTWARE\\WOW6432Node\\Rockstar Games\\Grand Theft Auto V", "HKLM\\SOFTWARE\\Rockstar Games\\Grand Theft Auto V", "HKLM\\SOFTWARE\\WOW6432Node\\Rockstar Games\\GTAV", "HKLM\\SOFTWARE\\WOW6432Node\\Rockstar Games\\Grand Theft Auto V Legacy"];
        for (const k of rk) { const v = await reg(k, "InstallFolder"); if (v) extra.push(v); }
        const steam = await reg("HKCU\\Software\\Valve\\Steam", "SteamPath");
        const libs = [];
        if (steam) {
            libs.push(steam.replace(/\//g, "\\"));
            try { libs.push(...gta.parseSteamLibraries(fs.readFileSync(path.join(steam, "steamapps", "libraryfolders.vdf"), "utf8"))); } catch {}
        }
        for (const l of libs) for (const g of ["Grand Theft Auto V", "Grand Theft Auto V Legacy", "Grand Theft Auto V Enhanced"]) extra.push(path.join(l, "steamapps", "common", g));
        try {
            const md = path.join(process.env.PROGRAMDATA || "C:\\ProgramData", "Epic", "EpicGamesLauncher", "Data", "Manifests");
            for (const f of fs.readdirSync(md)) { if (!/\.item$/i.test(f)) continue; try { const j = JSON.parse(fs.readFileSync(path.join(md, f), "utf8")); if (/GTAV|Grand Theft Auto V/i.test(j.DisplayName || j.AppName || "") && j.InstallLocation) extra.push(j.InstallLocation); } catch {} }
        } catch {}
        return gta.findGta({ env: process.env, extra });
    }
    async function detect(force) {
        const saved = !force && readPath();
        if (saved) return { success: true, path: saved, sfx: gta.sfxDir(saved), source: "saved", candidates: [saved] };
        const found = await detectAll();
        if (found.length) { savePath(found[0]); return { success: true, path: found[0], sfx: gta.sfxDir(found[0]), source: "auto", candidates: found }; }
        return { success: false, code: "NOT_FOUND", message: "لم نجد GTA V تلقائياً، حدّد مجلد اللعبة يدوياً", candidates: [] };
    }

    /* ───── التثبيت ───── */
    function needRoot() { const r = readPath(); return r ? { root: r, sfx: gta.sfxDir(r) } : null; }
    function readHead(file) { const fd = fs.openSync(file, "r"); try { const b = Buffer.alloc(8); fs.readSync(fd, b, 0, 8, 0); return b; } finally { fs.closeSync(fd); } }
    /* ينسخ ملفاً مصدرياً إلى sfx بعد النسخ الاحتياطي. يعيد {ok,message} */
    function placeFile(sfx, targetName, srcFile, meta) {
        let st; try { st = fs.statSync(srcFile); } catch { return { ok: false, message: "تعذّر قراءة الملف" }; }
        if (!st.isFile() || st.size < 16 || st.size > MAX_RPF) return { ok: false, message: "حجم الملف غير مقبول" };
        if (!gta.isRpf7(readHead(srcFile))) return { ok: false, message: "الملف ليس ملف صوت RPF صالحاً" };
        const dest = path.join(sfx, targetName), tmp = dest + ".canew";
        try {
            fs.mkdirSync(BK_DIR, { recursive: true });
            const bk = path.join(BK_DIR, targetName);
            if (!fs.existsSync(bk) && fs.existsSync(dest)) fs.copyFileSync(dest, bk);   // نحتفظ بالأصل الأول فقط
            fs.copyFileSync(srcFile, tmp);
            fs.renameSync(tmp, dest);
        } catch (e) { try { fs.unlinkSync(tmp); } catch {} return { ok: false, message: gta.errMessage(e) }; }
        const rec = readRec(); rec[targetName] = { name: (meta && meta.name) || targetName, id: (meta && meta.id) || "", source: (meta && meta.source) || "local", at: new Date().toISOString() }; writeRec(rec);
        return { ok: true };
    }
    /* يستخرج ملفات .rpf من zip إلى مجلد مؤقت */
    async function extractRpfs(zipPath, tmpDir) {
        if (!unzipper) throw new Error("وحدة الأرشيف غير متوفرة");
        const dir = await unzipper.Open.file(zipPath);
        const safe = core.zipEntriesSafe(dir.files.map((f) => f.path)); if (!safe.ok) throw new Error("الأرشيف يحتوي مسارات غير آمنة");
        const out = []; let total = 0;
        for (const f of dir.files) {
            if (f.type !== "File" || !/\.rpf$/i.test(f.path)) continue;
            const base = path.basename(f.path); if (!gta.SOUND_FILE.test(base)) continue;
            total += Number(f.uncompressedSize) || 0; if (total > 3 * 1024 * 1024 * 1024) throw new Error("الأرشيف كبير جداً");
            const p = path.join(tmpDir, base);
            await new Promise((res, rej) => f.stream().pipe(fs.createWriteStream(p)).on("finish", res).on("error", rej));
            out.push({ name: base, file: p });
        }
        return out;
    }
    const cleanup = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} };

    async function installPaths(srcs, meta) {
        const g = needRoot(); if (!g) return { success: false, code: "NO_GTA", message: "حدّد مسار GTA V أولاً" };
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "casnd-")); const items = [];
        try {
            for (const s of srcs) {
                if (/\.zip$/i.test(s)) items.push(...await extractRpfs(s, tmp));
                else if (/\.rpf$/i.test(s)) items.push({ name: path.basename(s), file: s });
            }
            if (!items.length) return { success: false, message: "لم نجد ملفات صوت (.rpf) في اختيارك" };
            const results = [], unmatched = [];
            for (const it of items) {
                const t = gta.matchTarget(g.sfx, it.name);
                if (!t) { unmatched.push(it); continue; }
                const r = placeFile(g.sfx, t, it.file, meta); results.push({ name: t, ok: r.ok, message: r.message });
            }
            if (unmatched.length && !results.length && items.length === 1) {
                const token = Math.random().toString(36).slice(2); pending.set(token, { file: unmatched[0].file, tmp, name: unmatched[0].name, meta }); setTimeout(() => { const p = pending.get(token); if (p) { pending.delete(token); cleanup(p.tmp); } }, 10 * 60 * 1000).unref?.();
                return { success: false, needTarget: true, token, fileName: unmatched[0].name, candidates: listSfx(g.sfx).map((x) => x.name), message: "اسم الملف لا يطابق أي ملف في sfx، اختر الملف الذي تريد استبداله" , keepTmp: true };
            }
            unmatched.forEach((u) => results.push({ name: u.name, ok: false, message: "لا يطابق أي ملف في مجلد sfx" }));
            const ok = results.filter((r) => r.ok).length;
            return { success: ok > 0, replaced: ok, results, message: ok ? `تم استبدال ${ok} ملف صوت` : (results[0] && results[0].message) || "فشل التثبيت" };
        } catch (e) { return { success: false, message: gta.errMessage(e) }; }
        finally { if (![...pending.values()].some((p) => p.tmp === tmp)) cleanup(tmp); }
    }
    const pending = new Map();

    function listSfx(sfx) {
        const rec = readRec();
        try {
            return fs.readdirSync(sfx).filter((f) => /\.rpf$/i.test(f)).map((f) => {
                let size = 0; try { size = fs.statSync(path.join(sfx, f)).size; } catch {}
                return { name: f, size, replaced: !!rec[f], info: rec[f] || null, hasBackup: fs.existsSync(path.join(BK_DIR, f)) };
            }).sort((a, b) => a.name.localeCompare(b.name));
        } catch { return []; }
    }

    /* ───── من المكتبة ───── */
    async function installLibrary(a) {
        if (getBusy() || dlState.running) return { success: false, message: "هناك عملية جارية، انتظر حتى تنتهي", code: "BUSY" };
        if (!needRoot()) return { success: false, code: "NO_GTA", message: "حدّد مسار GTA V أولاً من صفحة الساوندات" };
        setBusy(true);
        let dlFile = null;
        try {
            const l = await request("POST", "/api/v4/link", { type: "sound", id: a.id });
            if (!l || !l.success) return { success: false, message: (l && l.message) || "تعذّر الحصول على رابط التحميل", code: l && l.code };
            if (!core.isHttpUrl(l.url)) return { success: false, message: "رابط غير صالح" };
            const lib = findItem("sound", a.id), name = String(l.name || (lib && lib.name) || a.id).slice(0, 120);
            const maxBytes = l.sizeBytes ? Math.max(l.sizeBytes * 1.2, l.sizeBytes + 50 * 1048576) : 3 * 1024 * 1024 * 1024;
            dlState.name = name;
            const dl = await doDownload({ url: l.url, product: ("sound_" + String(a.id).replace(/[^\w-]/g, "")).slice(0, 60), name, sha256: l.sha256 || null, maxBytes });
            if (!dl.success) { dlState.running = false; return dl; }
            dlFile = dl.zipPath;
            setStage("copying", "جاري استبدال ملفات الصوت...");
            const fn = String(l.fileName || (lib && lib.file) || "");
            let src = dlFile, tmpRename = null;
            if (/\.rpf$/i.test(fn)) { tmpRename = path.join(os.tmpdir(), "casnd-" + Math.random().toString(36).slice(2) + "-" + path.basename(fn)); fs.copyFileSync(dlFile, tmpRename); src = tmpRename; }
            else if (!/\.zip$/i.test(fn)) return { success: false, message: "صيغة الساوند غير مدعومة" };
            const zipLike = /\.zip$/i.test(fn);
            // تثبيت من ملف مُسمّى: الـrpf يحمل اسم الهدف (fn) والـzip يُستخرج منه
            let r;
            if (zipLike) { const zp = path.join(os.tmpdir(), "casnd-" + Math.random().toString(36).slice(2) + ".zip"); fs.copyFileSync(dlFile, zp); try { r = await installPaths([zp], { id: a.id, name, source: "library" }); } finally { try { fs.unlinkSync(zp); } catch {} } }
            else { const g = needRoot(); const t = gta.matchTarget(g.sfx, fn); if (!t) r = { success: false, message: "الملف غير موجود في مجلد sfx لديك" }; else { const p = placeFile(g.sfx, t, src, { id: a.id, name, source: "library" }); r = p.ok ? { success: true, replaced: 1, message: "تم استبدال ملف الصوت" } : { success: false, message: p.message }; } }
            if (tmpRename) { try { fs.unlinkSync(tmpRename); } catch {} }
            setStage(r.success ? "done" : "error", r.success ? "تم تثبيت الساوند" : r.message);
            report("sound", a.id, "", !!r.success, r.success ? undefined : r.message);
            return r;
        } catch (e) { console.error("sound install", e); return { success: false, message: gta.errMessage(e) }; }
        finally { if (dlFile) { try { fs.unlinkSync(dlFile); } catch {} } setBusy(false); dlState.running = false; }
    }

    /* ───── IPC ───── */
    ipcMain.handle("gta:detect", (e, force) => detect(!!force));
    ipcMain.handle("gta:select", async () => {
        const r = await dialog.showOpenDialog(getMain(), { title: "اختر مجلد لعبة GTA V (الذي يحتوي x64)", properties: ["openDirectory"] });
        if (r.canceled || !r.filePaths[0]) return { success: false, canceled: true };
        const root = gta.normalizeRoot(r.filePaths[0]);
        if (!root) return { success: false, message: "هذا ليس مجلد GTA V (لم نجد x64\\audio\\sfx بداخله)" };
        savePath(root); return { success: true, path: root, sfx: gta.sfxDir(root), source: "manual" };
    });
    ipcMain.handle("gta:state", () => {
        const g = needRoot(); if (!g) return { success: false, code: "NO_GTA", message: "لم يُحدَّد مسار GTA V" };
        return { success: true, path: g.root, sfx: g.sfx, files: listSfx(g.sfx) };
    });
    ipcMain.handle("gta:installLocal", async () => {
        if (getBusy()) return { success: false, message: "هناك عملية جارية", code: "BUSY" };
        const r = await dialog.showOpenDialog(getMain(), { title: "اختر ملفات الساوند (.rpf أو .zip)", properties: ["openFile", "multiSelections"], filters: [{ name: "Sound", extensions: ["rpf", "zip"] }] });
        if (r.canceled || !r.filePaths.length) return { success: false, canceled: true };
        setBusy(true); try { return await installPaths(r.filePaths.slice(0, 20), { source: "local" }); } finally { setBusy(false); }
    });
    ipcMain.handle("gta:installLocalAs", (e, a) => {
        a = a || {}; const p = pending.get(String(a.token || "")); if (!p) return { success: false, message: "انتهت صلاحية الطلب، اختر الملف من جديد" };
        pending.delete(p && String(a.token));
        try {
            const g = needRoot(); if (!g) return { success: false, message: "حدّد مسار GTA V أولاً" };
            const t = gta.matchTarget(g.sfx, String(a.target || "")); if (!t) return { success: false, message: "الملف الهدف غير صالح" };
            const r = placeFile(g.sfx, t, p.file, p.meta); return r.ok ? { success: true, replaced: 1, message: "تم استبدال " + t } : { success: false, message: r.message };
        } finally { cleanup(p.tmp); }
    });
    ipcMain.handle("gta:restore", (e, a) => {
        a = a || {}; const g = needRoot(); if (!g) return { success: false, message: "حدّد مسار GTA V أولاً" };
        const rec = readRec(); const names = a.all ? Object.keys(rec) : [gta.matchTarget(g.sfx, String(a.name || ""))].filter(Boolean);
        if (!names.length) return { success: false, message: "لا يوجد ما يُسترجع" };
        let ok = 0; const errs = [];
        for (const n of names) {
            const bk = path.join(BK_DIR, n);
            if (!fs.existsSync(bk)) { errs.push(n + ": لا توجد نسخة احتياطية"); continue; }
            try { const dest = path.join(g.sfx, n), tmp = dest + ".canew"; fs.copyFileSync(bk, tmp); fs.renameSync(tmp, dest); delete rec[n]; ok++; } catch (er) { errs.push(n + ": " + gta.errMessage(er)); }
        }
        writeRec(rec);
        return { success: ok > 0, restored: ok, message: ok ? `تم استرجاع ${ok} ملف للأصل` : errs[0] || "فشل الاسترجاع", errors: errs };
    });
    return { installLibrary, readPath };
};
