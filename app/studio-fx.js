/* CA Studio — BloodFX: محرّر عام لملفات .dat النصية (يحفظ التنسيق ويغيّر الأرقام المختارة فقط) */
(function () {
    "use strict";
    const NUM = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
    function decimals(s) { const m = /\.(\d+)/.exec(s); return m ? m[1].length : 0; }
    function fmtLike(n, orig) {
        const d = Math.max(3, decimals(orig));
        let s = n.toFixed(Math.min(d, 8));
        s = s.replace(/(\.\d{3}\d*?)0+$/, "$1");
        return s === "-0.000" ? "0.000" : s;
    }
    function parse(text) {
        const raw = text.split("\n");
        const lines = []; let sec = "";
        for (let i = 0; i < raw.length; i++) {
            const ln = raw[i].replace(/\r$/, "");
            const t = ln.trim();
            const L = { i, text: ln, kind: "c", name: "", tokens: [], sec: "" };
            { const mk = /^\s*(BLOODFX_[A-Z_]+?)_(START|END)\b/.exec(ln); if (mk) sec = mk[2] === "START" ? mk[1] : ""; }
            L.sec = sec;
            if (t && !t.startsWith("#") && !t.startsWith("//") && !t.startsWith(";")) {
                L.kind = "d";
                const re = /\S+/g; let m;
                while ((m = re.exec(ln))) {
                    const isNum = NUM.test(m[0]);
                    L.tokens.push({ s: m.index, e: m.index + m[0].length, txt: m[0], num: isNum, isF: isNum && /[.eE]/.test(m[0]), v: isNum ? parseFloat(m[0]) : 0, o: isNum ? parseFloat(m[0]) : 0, set: null });
                }
                if (L.tokens.length && !L.tokens[0].num) L.name = L.tokens[0].txt;
            }
            lines.push(L);
        }
        return { lines, eol: text.includes("\r\n") ? "\r\n" : "\n" };
    }
    function build(model) {
        return model.lines.map((L) => {
            if (L.kind !== "d") return L.text;
            let out = "", pos = 0;
            for (const t of L.tokens) {
                if (t.num && t.v !== t.o) { out += L.text.slice(pos, t.s) + (t.isF ? fmtLike(t.v, t.txt) : String(Math.round(t.v))); pos = t.e; }
                else if (!t.num && t.nt != null && t.nt !== t.txt) { out += L.text.slice(pos, t.s) + t.nt; pos = t.e; }
            }
            return out + L.text.slice(pos);
        }).join(model.eol);
    }
    const changed = (model) => model.lines.reduce((n, L) => n + (L.kind === "d" ? L.tokens.filter((t) => (t.num && t.v !== t.o) || (!t.num && t.nt != null && t.nt !== t.txt)).length : 0), 0);
    /* مضاعفة الأرقام العشرية (أو الكل) في الأسطر المختارة، نسبةً إلى القيمة الأصلية */
    function scale(model, factor, sel, ints) {
        let n = 0;
        for (const L of model.lines) {
            if (L.kind !== "d" || !sel.has(L.i)) continue;
            for (const t of L.tokens) { if (t.num && (t.isF || ints)) { t.v = t.o * factor; n++; } }
        }
        return n;
    }
    function reset(model) { for (const L of model.lines) if (L.kind === "d") for (const t of L.tokens) { if (t.num) t.v = t.o; else t.nt = t.txt; } }
    /* ---- ملف BloodFX الحقيقي: جداول ENTRY/EXIT ---- */
    const isBlood = (model) => model.lines.some((L) => /^\s*BLOODFX_(ENTRY|EXIT)_INFO_START/.test(L.text));
    const isInfoRow = (L) => L.kind === "d" && (L.sec === "BLOODFX_ENTRY_INFO" || L.sec === "BLOODFX_EXIT_INFO") && L.tokens.length > 11 && L.tokens[0].num && L.tokens[8].num && L.tokens[9].num && L.tokens[10].num;
    const rowsInfo = (model) => model.lines.filter(isInfoRow);
    const HEX = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
    function commonTint(model) {
        const c = new Map(); for (const L of rowsInfo(model)) { const k = [8, 9, 10].map((i) => L.tokens[i].o).join(","); if (k !== "0,0,0") c.set(k, (c.get(k) || 0) + 1); }
        let best = null, n = 0; c.forEach((v, k) => { if (v > n) { n = v; best = k; } }); const a = (best || "50,0,0").split(",").map(Number); return HEX(a[0], a[1], a[2]);
    }
    /* يغيّر لون الدم (R G B) في الصفوف التي لها لون؛ الكائنات الفضائية/المهرّج (900/950) تُستثنى ما لم يُطلب غير ذلك */
    function setTint(model, rgb, opts) {
        let n = 0; opts = opts || {};
        for (const L of rowsInfo(model)) {
            const id = L.tokens[0].o; if (!opts.alien && (id === 900 || id === 950)) continue;
            const zero = [8, 9, 10].every((i) => L.tokens[i].o === 0); if (zero && !opts.zero) continue;
            [8, 9, 10].forEach((i, k) => { L.tokens[i].v = rgb[k]; }); n++;
        }
        return n;
    }
    /* أسماء المؤثرات (ptfx / أضرار) داخل الجداول: عدّها وأعد تسميتها */
    function names(model) {
        const m = new Map(); for (const L of model.lines) if (L.kind === "d" && (L.sec === "BLOODFX_ENTRY_INFO" || L.sec === "BLOODFX_EXIT_INFO") && L.tokens.length > 11 && L.tokens[0].num) for (const t of L.tokens) if (!t.num && t.txt !== "-") { const k = t.nt != null ? t.nt : t.txt; m.set(k, (m.get(k) || 0) + 1); }
        return m;
    }
    function rename(model, from, to) {
        let n = 0; to = String(to || "").trim(); if (!/^[\w\-.]{1,64}$/.test(to)) return -1;
        for (const L of model.lines) if (L.kind === "d" && (L.sec === "BLOODFX_ENTRY_INFO" || L.sec === "BLOODFX_EXIT_INFO") && L.tokens.length > 11 && L.tokens[0].num) for (const t of L.tokens) if (!t.num && (t.nt != null ? t.nt : t.txt) === from) { t.nt = to; n++; }
        return n;
    }
    window.FX = { parse, build, changed, scale, reset, fmtLike, isBlood, isInfoRow, rowsInfo, commonTint, setTint, names, rename };
})();
