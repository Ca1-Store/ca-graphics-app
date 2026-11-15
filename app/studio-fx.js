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
        const lines = [];
        for (let i = 0; i < raw.length; i++) {
            const ln = raw[i].replace(/\r$/, "");
            const t = ln.trim();
            const L = { i, text: ln, kind: "c", name: "", tokens: [] };
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
                if (t.num && t.v !== t.o) { out += L.text.slice(pos, t.s) + fmtLike(t.v, t.txt); pos = t.e; }
            }
            return out + L.text.slice(pos);
        }).join(model.eol);
    }
    const changed = (model) => model.lines.reduce((n, L) => n + (L.kind === "d" ? L.tokens.filter((t) => t.num && t.v !== t.o).length : 0), 0);
    /* مضاعفة الأرقام العشرية (أو الكل) في الأسطر المختارة، نسبةً إلى القيمة الأصلية */
    function scale(model, factor, sel, ints) {
        let n = 0;
        for (const L of model.lines) {
            if (L.kind !== "d" || !sel.has(L.i)) continue;
            for (const t of L.tokens) { if (t.num && (t.isF || ints)) { t.v = t.o * factor; n++; } }
        }
        return n;
    }
    function reset(model) { for (const L of model.lines) if (L.kind === "d") for (const t of L.tokens) if (t.num) t.v = t.o; }
    window.FX = { parse, build, changed, scale, reset, fmtLike };
})();
