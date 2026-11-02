/* وحدة v4 للعملية الرئيسية: جسر الـAPI، الجلسة، شاشة البدء، التثبيت من المكتبة، التشخيص */
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("./lib/core");

module.exports = function initV4(ctx) {
    const { app, ipcMain, dialog, send, getMain, BACKEND_URL, readSession, writeSession, clearSession, readFivemPath,
        isValidFiveMPath, detectFiveMPath, savePath, doDownload, doInstall, dlState, presetsDir, safePresetName, validateIni,
        callHandler, autoUpdater, loadPage } = ctx;
    const APP_VERSION = app.getVersion();
    let hwidCache = null;
    const getHwid = () => { if (!hwidCache) { try { hwidCache = require("node-machine-id").machineIdSync(); } catch { hwidCache = "unknown"; } } return hwidCache; };
    let sessionInfo = null;      // نتيجة /me
    let libraryCache = null;     // آخر /library
    let busy = false;

    /* ───────── جسر الطلبات ───────── */
    async function request(method, p, body, opts = {}) {
        if (!core.v4PathOk(p)) return { success: false, message: "مسار غير صالح" };
        const m = String(method || "GET").toUpperCase();
        if (!["GET", "POST", "PUT", "DELETE"].includes(m)) return { success: false, message: "طريقة غير صالحة" };
        const ses = readSession();
        const headers = { "Content-Type": "application/json", "x-app-version": APP_VERSION, "x-hwid": getHwid() };
        if (ses && ses.token && !opts.anon) headers.Authorization = "Bearer " + ses.token;
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), opts.timeout || 20000);
        try {
            const r = await fetch(BACKEND_URL + p, { method: m, headers, body: (m === "GET" || body == null) ? undefined : JSON.stringify(body), signal: ctl.signal });
            let j; try { j = await r.json(); } catch { j = { success: false, message: "رد غير صالح من الخادم" }; }
            if (j && typeof j === "object") {
                j.httpStatus = r.status;
                if (r.status === 401 || (r.status === 403 && j.code === "BANNED") || j.code === "BANNED") {
                    if (ses && !opts.anon) { clearSession(); sessionInfo = null; send("session:ended", { code: j.code || "UNAUTHORIZED", message: j.message || "" }); }
                }
            }
            if (p === "/api/v4/library" && j && j.success) libraryCache = j;
            return j;
        } catch {
            return { success: false, offline: true, message: "تعذّر الاتصال بالخادم" };
        } finally { clearTimeout(to); }
    }
    ipcMain.handle("v4:request", (e, a) => {
        a = a || {};
        return request(a.method, a.path, a.body);
    });
    ipcMain.handle("v4:session", () => sessionInfo ? { ...sessionInfo, appVersion: APP_VERSION } : null);
    ipcMain.handle("app:version", () => APP_VERSION);

    /* ───────── شاشة البدء ───────── */
    const ev = (o) => send("splash:event", o);
    const step = (id, state, detail) => ev({ type: "step", id, state, detail });
    const cmpVer = (a, b) => { const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return 1; if ((x[i] || 0) < (y[i] || 0)) return -1; } return 0; };
    let starting = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const TIPS = ["يمكنك فتح لوحة الأوامر في أي وقت بالضغط على Ctrl+K", "أضف المودات المفضلة بالنجمة لتجدها بسرعة", "التشخيص يفحص جاهزية جهازك لأي مشكلة تثبيت", "احتفظ بنسخة احتياطية قبل تغيير الجرافيكس — تتم تلقائياً"];

    async function checkUpdate() {
        step("update", "active");
        if (!app.isPackaged) { step("update", "done", "وضع التطوير"); return { forced: false }; }
        return new Promise((resolve) => {
            let done = false;
            const fin = (v) => { if (!done) { done = true; resolve(v); } };
            const t = setTimeout(() => { step("update", "done", "تعذّر التحقق، سنكمل"); fin({ forced: false }); }, 10000);
            autoUpdater.once("update-not-available", () => { clearTimeout(t); step("update", "done", "أحدث إصدار"); fin({ forced: false }); });
            autoUpdater.once("error", () => { clearTimeout(t); step("update", "done", "تعذّر التحقق، سنكمل"); fin({ forced: false }); });
            autoUpdater.once("update-available", (info) => { clearTimeout(t); ev({ type: "update", version: info.version, percent: 0 }); step("update", "active", "تنزيل الإصدار " + info.version); });
            autoUpdater.on("download-progress", (p) => ev({ type: "update", percent: Math.floor(p.percent) }));
            autoUpdater.checkForUpdates().catch(() => {});
        });
    }

    async function startup() {
        if (starting) return; starting = true;
        try {
            ["update", "server", "auth", "fivem", "library"].forEach((id) => step(id, "pending"));
            ev({ type: "tip", text: TIPS[Math.floor(Math.random() * TIPS.length)] });
            ev({ type: "progress", percent: 5 });
            await checkUpdate();                       // إن وُجد تحديث يُنزَّل ويعيد التشغيل تلقائياً
            ev({ type: "progress", percent: 25 });

            step("server", "active");
            const cfg = await request("GET", "/api/v4/config", null, { anon: true, timeout: 12000 });
            if (!cfg || !cfg.success) { step("server", "error", "تعذّر الاتصال"); ev({ type: "state", kind: "offline", message: "تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة." }); return; }
            step("server", "done", "متصل");
            ev({ type: "progress", percent: 45 });
            if (cfg.minVersion && cmpVer(APP_VERSION, cfg.minVersion) < 0) {
                ev({ type: "state", kind: "forceUpdate", message: "يتوفر إصدار أحدث إلزامي (" + cfg.minVersion + "). حدّث البرنامج للمتابعة." });
                if (app.isPackaged) { try { autoUpdater.checkForUpdates(); } catch {} }
                return;
            }

            step("auth", "active");
            let target = "login.html";
            const ses = readSession();
            if (ses && ses.token) {
                const me = await request("GET", "/api/v4/me");
                if (me && me.success) { sessionInfo = { discordId: me.discordId, username: ses.username || "", plans: me.plans || [], isOwner: !!me.isOwner, isAdmin: !!me.isAdmin, perms: me.perms || [], role: me.role }; step("auth", "done", "مرحباً " + (ses.username || "")); target = "index.html"; }
                else if (me && me.code === "MAINTENANCE") { ev({ type: "state", kind: "maintenance", message: me.message || (cfg.maintenance && cfg.maintenance.message) || "البرنامج تحت الصيانة حالياً" }); step("auth", "error", "صيانة"); return; }
                else if (me && me.offline) { step("auth", "error", "غير متصل"); ev({ type: "state", kind: "offline", message: "تعذّر الاتصال بالخادم." }); return; }
                else if (me && me.code === "BANNED") { clearSession(); step("auth", "error", "محظور"); ev({ type: "state", kind: "maintenance", message: me.message || "تم حظر هذا الحساب." }); return; }
                else { clearSession(); step("auth", "done", "يلزم تسجيل الدخول"); }
            } else step("auth", "done", "يلزم تسجيل الدخول");
            ev({ type: "progress", percent: 65 });

            step("fivem", "active");
            let fp = readFivemPath();
            if (!fp || !isValidFiveMPath(fp)) { const d = detectFiveMPath(); if (d) { savePath(d); fp = d; } else fp = null; }
            step("fivem", "done", fp ? "تم العثور على FiveM" : "لم يُحدَّد المسار بعد");
            ev({ type: "progress", percent: 80 });

            if (sessionInfo) {
                step("library", "active");
                const lib = await request("GET", "/api/v4/library");
                if (lib && lib.success) step("library", "done", (lib.mods || []).length + " مود");
                else step("library", "error", "تعذّر تحميل المكتبة");
            } else step("library", "done", "—");
            ev({ type: "progress", percent: 100 });
            ev({ type: "state", kind: "ready" });
            await sleep(700);
            loadPage(target);
        } catch (err) {
            console.error("startup", err);
            ev({ type: "state", kind: "offline", message: "حدث خطأ أثناء التشغيل. أعد المحاولة." });
        } finally { starting = false; }
    }
    ipcMain.handle("splash:retry", () => { startup(); return { success: true }; });
    ipcMain.handle("splash:ready", () => { startup(); return { success: true }; });

    /* ───────── المكتبة: فحص مسبق / تثبيت / حذف ───────── */
    const findItem = (type, id) => {
        const L = libraryCache; if (!L) return null;
        const list = { mod: L.mods, pack: L.packs, preset: L.presets, custom: L.customizations, bundle: L.bundles, sound: L.sounds }[type] || [];
        return list.find((x) => String(x.id) === String(id)) || null;
    };
    const freeBytes = (p) => { try { const s = fs.statfsSync(p); return Number(s.bavail) * Number(s.bsize); } catch { return null; } };
    const modsDir = () => { const f = readFivemPath(); return f ? path.join(f, "mods") : null; };
    const listDir = (d, re) => { try { return fs.readdirSync(d).filter((f) => re.test(f)); } catch { return []; } };
    function installedNow() {
        const mods = listDir(modsDir() || "", /\.rpf$/i);
        const pd = presetsDir(); const presets = pd ? listDir(pd, /\.ini$/i) : [];
        const customizations = [];
        const fp = readFivemPath();
        for (const c of (libraryCache && libraryCache.customizations) || []) {
            const dest = customDest(fp, c.destination, c.file); if (dest && fs.existsSync(dest)) customizations.push(c.id);
        }
        return { mods, presets, customizations };
    }
    function customDest(fivem, destination, file) {
        if (!fivem) return null;
        const fn = core.safeFileName(file); if (!fn) return null;
        let d = String(destination || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^(FiveM\/)?FiveM\.app\//i, "").replace(/^FiveM\//i, "");
        if (d.split("/").includes("..") || /^[a-zA-Z]:/.test(d)) return null;
        const full = path.resolve(fivem, d, fn);
        const rel = path.relative(path.resolve(fivem), full);
        if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
        return full;
    }
    ipcMain.handle("lib:installed", () => ({ success: true, ...installedNow() }));

    ipcMain.handle("lib:preflight", (e, a) => {
        a = a || {};
        const fp = readFivemPath();
        if (!fp || !isValidFiveMPath(fp)) return { success: false, code: "NO_FIVEM", message: "حدّد مسار FiveM من الإعدادات أولاً", conflicts: [], warnings: [] };
        const item = findItem(a.type, a.id);
        const warnings = [], conflicts = [];
        let size = item && item.sizeBytes;
        if (a.type === "pack" && item) {
            const v = (item.versions || []).find((x) => x.version === a.version) || (item.versions || []).find((x) => x.latest);
            size = v && Number(v.sizeBytes) ? Number(v.sizeBytes) : null;
            warnings.push("سيتم أخذ نسخة احتياطية ثم استبدال الجرافيكس الحالية");
        }
        const need = core.needBytes(size);
        const free = freeBytes(fp);
        if (free != null && free < need) warnings.push("المساحة الحرة قد لا تكفي (المطلوب تقريباً " + core.sizeLabel(need) + ")");
        if (a.type === "mod" && item && Array.isArray(item.conflicts)) {
            const have = new Set(installedNow().mods.map((x) => x.toLowerCase()));
            for (const cid of item.conflicts) { const o = findItem("mod", cid); if (o && o.fileName && have.has(String(o.fileName).toLowerCase())) conflicts.push({ id: o.id, name: o.name }); }
        }
        return { success: !(free != null && free < need), freeBytes: free, needBytes: need, conflicts, warnings, code: (free != null && free < need) ? "NO_SPACE" : undefined, message: (free != null && free < need) ? "المساحة غير كافية" : undefined };
    });

    async function report(type, id, version, ok, error) {
        try { await request("POST", "/api/v4/report", { type, id, version, ok, error: error ? String(error).slice(0, 300) : undefined, appVersion: APP_VERSION }); } catch {}
    }
    async function syncInstalled(type, id, add) {
        if (type !== "mod") return;
        try {
            const p = await request("GET", "/api/v4/prefs"); if (!p || !p.success) return;
            const prefs = p.prefs || {}; prefs.installed = prefs.installed || {};
            const set = new Set((prefs.installed.mod || []).map(Number)); if (add) set.add(Number(id)); else set.delete(Number(id));
            prefs.installed.mod = [...set];
            await request("PUT", "/api/v4/prefs", { prefs });
        } catch {}
    }
    const setStage = (stage, msg) => { dlState.stage = stage; dlState.stageMsg = msg; send("install:status", { stage, msg }); };

    async function installItem(a) {
        a = a || {};
        if (a.type === "sound") return sounds.installLibrary(a);
        if (!["mod", "pack", "preset", "custom"].includes(a.type)) return { success: false, message: "نوع غير مدعوم" };
        if (busy || dlState.running) return { success: false, message: "هناك عملية جارية، انتظر حتى تنتهي", code: "BUSY" };
        const fp = readFivemPath();
        if (!fp || !isValidFiveMPath(fp)) return { success: false, message: "حدّد مسار FiveM من الإعدادات أولاً", code: "NO_FIVEM" };
        busy = true;
        const lib = findItem(a.type, a.id);
        let version = a.version;
        try {
            const l = await request("POST", "/api/v4/link", { type: a.type, id: a.id, version: a.version });
            if (!l || !l.success) { return { success: false, message: (l && l.message) || "تعذّر الحصول على رابط التحميل", code: l && l.code }; }
            if (!core.isHttpUrl(l.url)) return { success: false, message: "رابط غير صالح" };
            const name = String(l.name || (lib && lib.name) || a.id).slice(0, 120);
            version = l.version || version;
            const maxBytes = l.sizeBytes ? Math.max(l.sizeBytes * 1.2, l.sizeBytes + 50 * 1048576) : 8 * 1024 * 1024 * 1024;
            const pid = String(a.type + "_" + String(a.id).replace(/[^\w-]/g, "")).slice(0, 60);
            dlState.name = name;
            let res;
            if (a.type === "pack") {
                const dl = await doDownload({ url: l.url, product: pid, name, sha256: l.sha256 || null, maxBytes });
                if (!dl.success) { dlState.running = false; res = dl; }
                else {
                    try { await callHandler("graphics:backup"); await callHandler("graphics:delete"); } catch (e) { console.error(e); }
                    const r = await doInstall(dl.zipPath, a.id);
                    res = r && r.success ? { success: true, message: "تم تثبيت الجرافيكس" } : { success: false, message: (r && r.message) || "فشل التثبيت" };
                }
            } else {
                const fileName = core.safeFileName(l.fileName || (lib && lib.fileName || lib && lib.file));
                if (!fileName) { res = { success: false, message: "اسم ملف غير صالح" }; }
                else {
                    let dest;
                    if (a.type === "mod") { if (!/\.rpf$/i.test(fileName)) return { success: false, message: "صيغة مود غير مدعومة" }; dest = path.join(fp, "mods", fileName); }
                    else if (a.type === "preset") { const d = presetsDir(); const sn = safePresetName(fileName); dest = d && sn ? path.join(d, sn) : null; }
                    else dest = customDest(fp, l.destination || (lib && lib.destination), fileName);
                    if (!dest) res = { success: false, message: "مسار الوجهة غير صالح" };
                    else if (fs.existsSync(dest) && a.overwrite === false) res = { success: false, exists: true, message: "الملف موجود مسبقاً" };
                    else {
                        const dl = await doDownload({ url: l.url, product: pid, name, sha256: l.sha256 || null, maxBytes: a.type === "preset" ? 2 * 1048576 : maxBytes });
                        if (!dl.success) { dlState.running = false; res = dl; }
                        else {
                            try {
                                if (a.type === "preset") { const bad = validateIni(fs.readFileSync(dl.zipPath)); if (bad) throw new Error(bad); }
                                setStage("copying", "جاري نسخ الملفات...");
                                fs.mkdirSync(path.dirname(dest), { recursive: true });
                                fs.copyFileSync(dl.zipPath, dest);
                                setStage("done", "تم التثبيت بنجاح");
                                res = { success: true, message: "تم التثبيت" };
                            } catch (er) { res = { success: false, message: er.message || "فشل النسخ" }; setStage("error", res.message); }
                            finally { try { fs.unlinkSync(dl.zipPath); } catch {} }
                        }
                    }
                }
            }
            if (res.canceled) return res;
            report(a.type, a.id, version, !!res.success, res.success ? undefined : res.message);
            if (res.success) syncInstalled(a.type, a.id, true);
            return res;
        } catch (err) {
            console.error("lib install", err);
            report(a.type, a.id, version, false, err.message);
            return { success: false, message: "حدث خطأ أثناء التثبيت" };
        } finally { busy = false; dlState.running = false; }
    }
    const sounds = require("./sounds")({ app, ipcMain, dialog, getMain, request, report, doDownload, dlState, setStage, getBusy: () => busy, setBusy: (v) => { busy = v; }, findItem });
    ipcMain.handle("lib:install", (e, a) => installItem(a));

    ipcMain.handle("lib:installBundle", async (e, id) => {
        const b = findItem("bundle", id);
        if (!b) return { success: false, results: [], message: "الحزمة غير موجودة" };
        const results = [];
        for (const mid of b.modIds || []) {
            const m = findItem("mod", mid);
            if (!m || m.unlocked === false) { results.push({ id: mid, ok: false, message: "غير متاح" }); continue; }
            const r = await installItem({ type: "mod", id: mid, overwrite: true });
            results.push({ id: mid, ok: !!r.success, message: r.message });
            if (r.code === "NO_FIVEM" || r.canceled) break;
        }
        return { success: results.length > 0 && results.every((r) => r.ok), results };
    });

    ipcMain.handle("lib:remove", (e, a) => {
        a = a || {};
        try {
            const fp = readFivemPath(); if (!fp) return { success: false, message: "حدّد مسار FiveM" };
            let target = null;
            if (a.type === "mod") { const fn = core.safeFileName(a.fileName || (findItem("mod", a.id) || {}).fileName); if (fn && /\.rpf$/i.test(fn)) target = path.join(fp, "mods", fn); }
            else if (a.type === "preset") { const d = presetsDir(); const sn = safePresetName(a.fileName || (findItem("preset", a.id) || {}).file); if (d && sn) target = path.join(d, sn); }
            else if (a.type === "custom") { const c = findItem("custom", a.id); if (c) target = customDest(fp, c.destination, c.file); }
            if (!target) return { success: false, message: "عنصر غير صالح" };
            if (!fs.existsSync(target)) return { success: false, message: "العنصر غير مثبّت" };
            fs.unlinkSync(target);
            if (a.type === "mod" && a.id != null) syncInstalled("mod", a.id, false);
            return { success: true, message: "تم الحذف" };
        } catch (err) { console.error(err); return { success: false, message: "فشل الحذف" }; }
    });

    /* ───────── التشخيص ───────── */
    async function runDiag() {
        const checks = []; const add = (id, label, state, detail) => checks.push({ id, label, state, detail });
        const fp = readFivemPath(); const valid = !!fp && isValidFiveMPath(fp);
        const free = valid ? freeBytes(fp) : null;
        add("fivem", "مسار FiveM", valid ? "ok" : "error", valid ? "تم العثور عليه" : "غير محدد أو غير صالح");
        if (free != null) add("disk", "المساحة الحرة", free < 3 * 1073741824 ? "error" : free < 10 * 1073741824 ? "warn" : "ok", core.sizeLabel(free));
        if (valid) { const have = ["citizen", "plugins", "mods"].filter((f) => fs.existsSync(path.join(fp, f))); add("folders", "مجلدات الجرافيكس", have.length === 3 ? "ok" : "warn", have.length + " من 3"); }
        const t0 = Date.now(); const cfg = await request("GET", "/api/v4/config", null, { anon: true, timeout: 8000 }); const ms = Date.now() - t0;
        const backendOk = !!(cfg && cfg.success);
        add("backend", "الاتصال بالخادم", backendOk ? (ms > 1500 ? "warn" : "ok") : "error", backendOk ? ms + " ms" : "تعذّر الاتصال");
        let internet = backendOk;
        if (!backendOk) { try { const c = new AbortController(); setTimeout(() => c.abort(), 5000); await fetch("https://www.cloudflare.com/cdn-cgi/trace", { signal: c.signal }); internet = true; } catch { internet = false; } }
        add("internet", "الإنترنت", internet ? "ok" : "error", internet ? "متصل" : "لا يوجد اتصال");
        if (cfg && cfg.minVersion) add("version", "إصدار البرنامج", cmpVer(APP_VERSION, cfg.minVersion) >= 0 ? "ok" : "error", APP_VERSION);
        else add("version", "إصدار البرنامج", "ok", APP_VERSION);
        const ins = installedNow();
        add("installed", "العناصر المثبّتة", "ok", ins.mods.length + " مود · " + ins.presets.length + " فلتر");
        const ramGB = Math.round(os.totalmem() / 1073741824 * 10) / 10;
        add("ram", "الذاكرة", ramGB < 8 ? "warn" : "ok", ramGB + " GB");
        let gpu = null; try { const g = await Promise.race([app.getGPUInfo("basic"), sleep(2500).then(() => null)]); const d = g && g.gpuDevice && g.gpuDevice[0]; if (d) gpu = d.deviceString || null; } catch {}
        return { success: true, fivem: { found: valid, path: valid ? fp : null, freeBytes: free }, os: os.type() + " " + os.release() + " (" + os.arch() + ")", cpu: (os.cpus()[0] || {}).model || "", ramGB, gpu,
            ping: { backendMs: ms, ok: backendOk }, internet, appVersion: APP_VERSION, installed: { mods: ins.mods.length, presets: ins.presets.length }, checks };
    }
    ipcMain.handle("diag:run", () => runDiag());
    ipcMain.handle("diag:export", async () => {
        const d = await runDiag();
        const lines = ["CA Store — تقرير التشخيص", new Date().toISOString(), "الإصدار: " + d.appVersion, "النظام: " + d.os, "المعالج: " + d.cpu, "الذاكرة: " + d.ramGB + " GB", "كرت الشاشة: " + (d.gpu || "—"), ""];
        d.checks.forEach((c) => lines.push(`[${c.state.toUpperCase()}] ${c.label}: ${c.detail || ""}`));
        const r = await dialog.showSaveDialog(getMain(), { title: "حفظ تقرير التشخيص", defaultPath: "ca-diagnostics.txt", filters: [{ name: "Text", extensions: ["txt"] }] });
        if (r.canceled || !r.filePath) return { success: false };
        fs.writeFileSync(r.filePath, lines.join("\r\n"), "utf8");
        return { success: true, path: r.filePath };
    });
    ipcMain.handle("app:saveText", async (e, a) => {
        a = a || {};
        const name = String(a.name || "export.csv").replace(/[^\w.\-]/g, "_").slice(0, 60);
        const text = String(a.content || "");
        if (text.length > 8 * 1024 * 1024) return { success: false, message: "الملف كبير" };
        const r = await dialog.showSaveDialog(getMain(), { title: "حفظ الملف", defaultPath: name, filters: [{ name: "CSV", extensions: ["csv"] }] });
        if (r.canceled || !r.filePath) return { success: false };
        fs.writeFileSync(r.filePath, "\ufeff" + text, "utf8");
        return { success: true, path: r.filePath };
    });
    return { startup, request };
};
