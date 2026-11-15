/* استوديو CA — فتح/حفظ ملفات XML (Timecycle وغيرها) بأمان: المسار لا يأتي من الواجهة أبداً */
const fs = require("fs");
const path = require("path");
const MAX = 8 * 1024 * 1024;

module.exports = function initStudio(ctx) {
    const { ipcMain, dialog, getMain, readFivemPath, app } = ctx;
    let current = null;                 // { path } الملف المفتوح حالياً
    const tokens = new Map();           // token -> path (نتائج الكشف)

    const readFile = (p) => {
        const st = fs.statSync(p);
        if (!st.isFile() || st.size > MAX) throw new Error("الملف غير صالح أو كبير جداً");
        return fs.readFileSync(p, "utf8");
    };
    const ok = (p) => { current = { path: p }; return { success: true, path: p, name: path.basename(p), text: readFile(p) }; };

    function walk(dir, depth, out) {
        if (depth < 0 || out.length >= 60) return;
        let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of ents) {
            if (out.length >= 60) return;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { if (!/^(cache|logs|crashes|dunno)$/i.test(e.name)) walk(full, depth - 1, out); }
            else if (/timecycle.*\.xml$/i.test(e.name) || /^w_.*\.xml$/i.test(e.name)) out.push(full);
        }
    }

    ipcMain.handle("studio:open", async () => {
        const fp = readFivemPath();
        const r = await dialog.showOpenDialog(getMain(), { title: "اختر ملف XML", defaultPath: fp || undefined, properties: ["openFile"], filters: [{ name: "XML", extensions: ["xml"] }] });
        if (r.canceled || !r.filePaths[0]) return { success: false, canceled: true };
        try { return ok(r.filePaths[0]); } catch (e) { return { success: false, message: e.message }; }
    });
    ipcMain.handle("studio:detect", () => {
        const fp = readFivemPath(); if (!fp) return { success: false, message: "حدّد مسار FiveM من الإعدادات أولاً" };
        const found = []; walk(fp, 5, found); tokens.clear();
        const files = found.map((f) => { const t = Math.random().toString(36).slice(2); tokens.set(t, f); return { token: t, name: path.basename(f), rel: path.relative(fp, f) }; });
        return { success: true, files };
    });
    ipcMain.handle("studio:openToken", (e, token) => {
        const p = tokens.get(String(token || "")); if (!p) return { success: false, message: "انتهت صلاحية الطلب، أعد الكشف" };
        try { return ok(p); } catch (er) { return { success: false, message: er.message }; }
    });
    ipcMain.handle("studio:save", (e, text) => {
        if (!current) return { success: false, message: "لا يوجد ملف مفتوح" };
        text = String(text || "");
        if (text.length < 10 || text.length > MAX) return { success: false, message: "محتوى غير صالح" };
        try {
            const bk = current.path + ".ca-backup";
            if (!fs.existsSync(bk)) fs.copyFileSync(current.path, bk);     // نسخة من الأصل مرة واحدة فقط
            const tmp = current.path + ".canew";
            fs.writeFileSync(tmp, text, "utf8"); fs.renameSync(tmp, current.path);
            return { success: true, path: current.path, backup: bk };
        } catch (er) { return { success: false, message: er.code === "EACCES" || er.code === "EPERM" ? "ليس لدى البرنامج صلاحية الكتابة هنا" : (er.message || "فشل الحفظ") }; }
    });
    ipcMain.handle("studio:saveAs", async (e, text) => {
        text = String(text || ""); if (text.length < 10 || text.length > MAX) return { success: false, message: "محتوى غير صالح" };
        const r = await dialog.showSaveDialog(getMain(), { title: "حفظ نسخة XML", defaultPath: current ? path.basename(current.path) : "timecycle.xml", filters: [{ name: "XML", extensions: ["xml"] }] });
        if (r.canceled || !r.filePath) return { success: false, canceled: true };
        try { fs.writeFileSync(r.filePath, text, "utf8"); return { success: true, path: r.filePath }; } catch (er) { return { success: false, message: er.message }; }
    });
    ipcMain.handle("studio:restore", () => {
        if (!current) return { success: false, message: "لا يوجد ملف مفتوح" };
        const bk = current.path + ".ca-backup"; if (!fs.existsSync(bk)) return { success: false, message: "لا توجد نسخة احتياطية" };
        try { fs.copyFileSync(bk, current.path); return ok(current.path); } catch (er) { return { success: false, message: er.message }; }
    });

    /* ---- استيراد معدّلات من ملف XML آخر (لا يغيّر الملف المفتوح) ---- */
    ipcMain.handle("studio:pick", async () => {
        const fp = readFivemPath();
        const r = await dialog.showOpenDialog(getMain(), { title: "اختر ملف XML للاستيراد منه", defaultPath: fp || undefined, properties: ["openFile"], filters: [{ name: "XML", extensions: ["xml"] }] });
        if (r.canceled || !r.filePaths[0]) return { success: false, canceled: true };
        try { return { success: true, name: path.basename(r.filePaths[0]), text: readFile(r.filePaths[0]) }; } catch (e) { return { success: false, message: e.message }; }
    });

    /* ============ BloodFX: citizen/common/data/effects/*.dat ============ */
    const MAXDAT = 4 * 1024 * 1024;
    const safeName = (n) => { n = path.basename(String(n || "")); return /^[\w\-. ()]{1,60}\.dat$/i.test(n) ? n : null; };
    const bkRoot = () => path.join(app.getPath("userData"), "studio_backup");
    function dataDirs() {
        const fp = readFivemPath();
        const bases = [];
        if (fp) { bases.push(path.join(fp, "FiveM.app"), fp, path.join(fp, "..", "FiveM.app")); }
        if (process.env.LOCALAPPDATA) bases.push(path.join(process.env.LOCALAPPDATA, "FiveM", "FiveM.app"));
        const seen = new Set(), out = [];
        for (const b of bases) { const r = path.resolve(b); if (!seen.has(r)) { seen.add(r); out.push(r); } }
        return out;
    }
    function effectsInfo() {
        for (const b of dataDirs()) {
            const data = path.join(b, "citizen", "common", "data");
            try { if (fs.statSync(data).isDirectory()) return { data, dir: path.join(data, "effects") }; } catch {}
        }
        return null;
    }
    function listDat(dir) {
        try {
            return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && /\.dat$/i.test(e.name)).map((e) => {
                const st = fs.statSync(path.join(dir, e.name)); return { name: e.name, size: st.size, mtime: st.mtimeMs };
            });
        } catch { return []; }
    }
    ipcMain.handle("studio:fx:detect", () => {
        const info = effectsInfo();
        if (!info) return { success: false, message: "لم نجد مجلد citizen/common/data داخل FiveM. حدّد مسار FiveM من الإعدادات." };
        let exists = false; try { exists = fs.statSync(info.dir).isDirectory(); } catch {}
        const files = exists ? listDat(info.dir) : [];
        return { success: true, dir: info.dir, exists, files: files.map((f) => ({ ...f, backup: fs.existsSync(path.join(bkRoot(), "fx", f.name)) })) };
    });
    ipcMain.handle("studio:fx:open", (e, name) => {
        const info = effectsInfo(), n = safeName(name); if (!info || !n) return { success: false, message: "اسم غير صالح" };
        try {
            const p = path.join(info.dir, n), st = fs.statSync(p);
            if (!st.isFile() || st.size > MAXDAT) return { success: false, message: "الملف كبير جداً" };
            return { success: true, name: n, text: fs.readFileSync(p, "utf8") };
        } catch { return { success: false, message: "تعذّر فتح الملف" }; }
    });
    ipcMain.handle("studio:fx:import", async () => {
        const r = await dialog.showOpenDialog(getMain(), { title: "اختر ملف BloodFX (.dat)", properties: ["openFile"], filters: [{ name: "DAT", extensions: ["dat", "txt"] }] });
        if (r.canceled || !r.filePaths[0]) return { success: false, canceled: true };
        try {
            const st = fs.statSync(r.filePaths[0]); if (!st.isFile() || st.size > MAXDAT) return { success: false, message: "الملف غير صالح أو كبير جداً" };
            const buf = fs.readFileSync(r.filePaths[0]);
            if (buf.includes(0)) return { success: false, message: "هذا ملف ثنائي وليس نصياً" };
            let name = path.basename(r.filePaths[0]).replace(/\.txt$/i, ".dat"); if (!safeName(name)) name = "bloodfx.dat";
            return { success: true, name, text: buf.toString("utf8") };
        } catch (er) { return { success: false, message: er.message }; }
    });
    ipcMain.handle("studio:fx:install", (e, name, text) => {
        const info = effectsInfo(), n = safeName(name); if (!info || !n) return { success: false, message: "تعذّر تحديد مجلد effects" };
        text = String(text == null ? "" : text); if (text.length < 1 || text.length > MAXDAT || text.includes("\0")) return { success: false, message: "محتوى غير صالح" };
        try {
            fs.mkdirSync(info.dir, { recursive: true });
            const target = path.join(info.dir, n);
            const bk = path.join(bkRoot(), "fx"); fs.mkdirSync(bk, { recursive: true });
            const bf = path.join(bk, n), none = bf + ".none";
            if (!fs.existsSync(bf) && !fs.existsSync(none)) {
                if (fs.existsSync(target)) fs.copyFileSync(target, bf); else fs.writeFileSync(none, "");
            }
            const tmp = target + ".canew"; fs.writeFileSync(tmp, text, "utf8"); fs.renameSync(tmp, target);
            return { success: true, path: target };
        } catch (er) { return { success: false, message: er.code === "EACCES" || er.code === "EPERM" ? "ليس لدى البرنامج صلاحية الكتابة هنا" : (er.message || "فشل التثبيت") }; }
    });
    ipcMain.handle("studio:fx:restore", (e, name) => {
        const info = effectsInfo(), n = safeName(name); if (!info || !n) return { success: false, message: "اسم غير صالح" };
        const bf = path.join(bkRoot(), "fx", n);
        try {
            const target = path.join(info.dir, n);
            if (fs.existsSync(bf)) { fs.copyFileSync(bf, target); return { success: true, restored: true }; }
            if (fs.existsSync(bf + ".none")) { try { fs.unlinkSync(target); } catch {} return { success: true, removed: true }; }
            return { success: false, message: "لا توجد نسخة احتياطية لهذا الملف" };
        } catch (er) { return { success: false, message: er.message || "فشل الاسترجاع" }; }
    });
    ipcMain.handle("studio:fx:reveal", () => { const i = effectsInfo(); return { success: !!i, dir: i ? i.dir : "" }; });
};
