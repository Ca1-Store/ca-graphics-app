/* CA Studio — النواة: قراءة/تعديل ملفات timecycle_mods.xml بالنص مباشرة (بدون إعادة كتابة الملف)
   كل تعديل يمس القيمة فقط، فتبقى التعليقات والمسافات والترتيب كما هي. */
(function () {
    "use strict";

    /* ---------- أدوات ---------- */
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    function fmt(n) {
        if (!Number.isFinite(n)) n = 0;
        let s = n.toFixed(6);
        s = s.replace(/(\.\d{3}\d*?)0+$/, "$1");
        return s === "-0.000" ? "0.000" : s;
    }
    function toHex(r, g, b) {
        const h = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
        return "#" + h(r) + h(g) + h(b);
    }
    function fromHex(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    /* ---------- قراءة الملف ---------- */
    const mask = (t) => t.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));
    function parse(text) {
        const m = mask(text);
        const mods = [];
        const re = /<modifier\b([^>]*?)(\/?)>/g;
        let x;
        while ((x = re.exec(m))) {
            const attrs = x[1];
            const nameM = /\bname\s*=\s*"([^"]*)"/.exec(attrs);
            const mod = { name: nameM ? nameM[1] : "", start: x.index, openEnd: x.index + x[0].length, selfClose: x[2] === "/", end: x.index + x[0].length, tags: [], numMods: num((/numMods\s*=\s*"([^"]*)"/.exec(attrs) || [])[1]) };
            if (!mod.selfClose) {
                const close = m.indexOf("</modifier>", mod.openEnd);
                if (close < 0) return { error: "وسم modifier بلا إغلاق: " + mod.name };
                mod.end = close + 11;
                const body = m.slice(mod.openEnd, close);
                const tre = /<([A-Za-z_][\w]*)>([^<]*)<\/\1>/g;
                let t;
                while ((t = tre.exec(body))) {
                    const parts = t[2].trim().split(/\s+/).filter(Boolean);
                    if (!parts.length || parts.some((p) => !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(p))) continue;
                    const vs = mod.openEnd + t.index + t[1].length + 2;
                    mod.tags.push({ tag: t[1], a: num(parts[0]), b: parts.length > 1 ? num(parts[1]) : 0, hasB: parts.length > 1, oa: num(parts[0]), ob: parts.length > 1 ? num(parts[1]) : 0, vs, ve: vs + t[2].length, raw: t[2] });
                }
            }
            mods.push(mod);
            if (!mod.selfClose) re.lastIndex = mod.end;
        }
        if (!mods.length) return { error: "لا توجد وسوم modifier — هذا ليس ملف timecycle_mods" };
        return { mods };
    }

    /* ---------- كتابة القيم المعدّلة داخل النص ---------- */
    function apply(text, model) {
        const reps = [];
        for (const mod of model.mods) for (const t of mod.tags) {
            if (t.a !== t.oa || t.b !== t.ob) reps.push({ s: t.vs, e: t.ve, v: t.hasB ? fmt(t.a) + " " + fmt(t.b) : fmt(t.a) });
        }
        reps.sort((p, q) => q.s - p.s);
        let out = text;
        for (const r of reps) out = out.slice(0, r.s) + r.v + out.slice(r.e);
        return out;
    }
    const changedCount = (model) => { let n = 0; for (const m of model.mods) for (const t of m.tags) if (t.a !== t.oa || t.b !== t.ob) n++; return n; };

    /* ---------- عمليات بنيوية (تعمل على النص ثم نعيد القراءة) ---------- */
    const attrEsc = (s) => String(s).replace(/[^\w\-. ()]/g, "");
    const eolOf = (t) => (t.indexOf("\r\n") >= 0 ? "\r\n" : "\n");
    function setNumMods(text, idx) {
        const p = parse(text); if (p.error) return text;
        const mod = p.mods[idx]; if (!mod) return text;
        const head = text.slice(mod.start, mod.openEnd).replace(/numMods\s*=\s*"[^"]*"/, `numMods="${mod.tags.length}"`);
        return text.slice(0, mod.start) + head + text.slice(mod.openEnd);
    }
    function addTag(text, idx, tag, a, b) {
        if (!/^[A-Za-z_]\w*$/.test(tag)) throw new Error("اسم وسم غير صالح");
        const p = parse(text); if (p.error) throw new Error(p.error);
        const mod = p.mods[idx]; if (!mod) throw new Error("المعدّل غير موجود");
        if (mod.tags.some((t) => t.tag === tag)) throw new Error("الوسم موجود مسبقاً");
        const E = eolOf(text);
        const line = `\t\t<${tag}>${fmt(a)} ${fmt(b || 0)}</${tag}>${E}`;
        let out;
        if (mod.selfClose) {
            const head = text.slice(mod.start, mod.openEnd).replace(/\s*\/>$/, ">");
            out = text.slice(0, mod.start) + head + E + line + "\t</modifier>" + text.slice(mod.openEnd);
        } else {
            const close = mod.end - 11;
            const ls = text.lastIndexOf("\n", close - 1) + 1;
            const insertAt = /^[ \t]*$/.test(text.slice(ls, close)) ? ls : close;
            out = text.slice(0, insertAt) + (insertAt === close ? E : "") + line + text.slice(insertAt);
        }
        return setNumMods(out, idx);
    }
    function removeTag(text, idx, tag) {
        const p = parse(text); if (p.error) throw new Error(p.error);
        const mod = p.mods[idx]; if (!mod) throw new Error("المعدّل غير موجود");
        const t = mod.tags.find((x) => x.tag === tag); if (!t) return text;
        let s = text.lastIndexOf("<" + tag + ">", t.vs), e = text.indexOf("</" + tag + ">", t.ve) + tag.length + 3;
        const ls = text.lastIndexOf("\n", s - 1) + 1;
        if (/^[ \t]*$/.test(text.slice(ls, s))) s = ls;
        if (text[e] === "\r") e++;
        if (text[e] === "\n") e++;
        return setNumMods(text.slice(0, s) + text.slice(e), idx);
    }
    function modText(text, mod) { return text.slice(mod.start, mod.end); }
    function cloneModifier(text, idx, newName) {
        newName = attrEsc(newName).trim();
        if (!newName) throw new Error("اسم غير صالح");
        const p = parse(text); if (p.error) throw new Error(p.error);
        if (p.mods.some((m) => m.name.toLowerCase() === newName.toLowerCase())) throw new Error("الاسم مستخدم");
        const mod = p.mods[idx]; if (!mod) throw new Error("المعدّل غير موجود");
        const copy = modText(text, mod).replace(/name\s*=\s*"[^"]*"/, `name="${newName}"`);
        return text.slice(0, mod.end) + eolOf(text) + "\t" + copy + text.slice(mod.end);
    }
    function deleteModifier(text, idx) {
        const p = parse(text); if (p.error) throw new Error(p.error);
        const mod = p.mods[idx]; if (!mod) return text;
        let s = mod.start, e = mod.end;
        const ls = text.lastIndexOf("\n", s - 1) + 1;
        if (/^[ \t]*$/.test(text.slice(ls, s))) s = ls;
        if (text[e] === "\r") e++;
        if (text[e] === "\n") e++;
        return text.slice(0, s) + text.slice(e);
    }
    function newModifier(text, name) {
        name = attrEsc(name).trim(); if (!name) throw new Error("اسم غير صالح");
        const p = parse(text); if (p.error) throw new Error(p.error);
        if (p.mods.some((m) => m.name.toLowerCase() === name.toLowerCase())) throw new Error("الاسم مستخدم");
        const at = text.lastIndexOf("</timecycle_modifier_data>");
        if (at < 0) throw new Error("ملف غير قياسي");
        return text.slice(0, at) + `\t<modifier name="${name}" numMods="0" userFlags="0" />${eolOf(text)}` + text.slice(at);
    }
    /* استيراد معدّلات من ملف آخر (يتجاوز الأسماء الموجودة) */
    function importMods(text, otherText, names) {
        const a = parse(text), b = parse(otherText);
        if (a.error) throw new Error(a.error); if (b.error) throw new Error(b.error);
        const have = new Set(a.mods.map((m) => m.name.toLowerCase()));
        const take = b.mods.filter((m) => names.includes(m.name) && !have.has(m.name.toLowerCase()));
        if (!take.length) return { text, added: 0 };
        const at = text.lastIndexOf("</timecycle_modifier_data>"); if (at < 0) throw new Error("ملف غير قياسي");
        const block = take.map((m) => "\t" + modText(otherText, m).trim()).join(eolOf(text)) + eolOf(text);
        return { text: text.slice(0, at) + block + text.slice(at), added: take.length };
    }

    /* ---------- التحقق قبل الحفظ ---------- */
    function verify(finalText, model) {
        if (typeof DOMParser !== "undefined") {
            const d = new DOMParser().parseFromString(finalText, "application/xml");
            if (d.getElementsByTagName("parsererror").length) return { ok: false, why: "الناتج ليس XML سليماً" };
            if (d.documentElement.nodeName !== "timecycle_modifier_data") return { ok: false, why: "الجذر غير متوقع" };
        }
        const p = parse(finalText);
        if (p.error) return { ok: false, why: p.error };
        if (p.mods.length !== model.mods.length) return { ok: false, why: "تغيّر عدد المعدّلات" };
        for (let i = 0; i < model.mods.length; i++) {
            const mm = model.mods[i], pm = p.mods[i];
            if (pm.name !== mm.name || pm.tags.length !== mm.tags.length) return { ok: false, why: "اختلاف في المعدّل " + mm.name };
            for (let k = 0; k < mm.tags.length; k++) {
                const t = mm.tags[k], pt = pm.tags[k];
                if (pt.tag !== t.tag || Math.abs(pt.a - t.a) > 0.0006 || (t.hasB && Math.abs(pt.b - t.b) > 0.0006)) return { ok: false, why: `قيمة مختلفة في ${mm.name}/${t.tag}` };
            }
        }
        return { ok: true };
    }

    /* ---------- تصنيف الوسوم ---------- */
    const GROUPS = [
        ["grade", "تدرّج الألوان", /^postfx_(correct|shift|desaturation|grad)/],
        ["expo", "التعريض والتوهّج", /^postfx_(exposure|intensity_bloom|bright_pass|tonemap)/],
        ["lens", "العدسة والعمق والضبابية", /^(postfx_(vignetting|motionblur)|blur_vignetting|screen_blur|bokeh|dof|lens|chrom|Lensflare|environmental_blur)/i],
        ["noise", "الضوضاء والخطوط", /^postfx_(noise|scanline)/],
        ["fog", "الضباب", /^(fog|fogray)/],
        ["light", "الإضاءة", /^(light_|ped_light|sun_|moon_|natural_|artificial_|particle_light|lodlight|reflection_)/],
        ["shadow", "الظلال و SSAO", /^(dir_shadow|shadow_|ssao)/],
        ["sky", "السماء", /^sky_/],
        ["water", "الماء والحرارة", /^(water_|hh_|temperature)/],
        ["nv", "الرؤية الليلية", /^nv_/],
        ["lod", "المسافات (LOD)", /^(lod|far_clip|entity_reject|portal)/],
    ];
    const groupOf = (tag) => { for (const g of GROUPS) if (g[2].test(tag)) return g[0]; return "misc"; };
    const groupLabel = (id) => (GROUPS.find((g) => g[0] === id) || [0, "أخرى"])[1];
    const GROUP_ORDER = GROUPS.map((g) => g[0]).concat("misc");

    /* يجمع _r/_g/_b(/_a) في لون واحد */
    function items(mod) {
        const used = new Set(), out = [];
        const by = new Map(mod.tags.map((t) => [t.tag, t]));
        for (const t of mod.tags) {
            if (used.has(t.tag)) continue;
            const m = /^(.*)_([rgb])$/.exec(t.tag);
            if (m) {
                const r = by.get(m[1] + "_r"), g = by.get(m[1] + "_g"), b = by.get(m[1] + "_b");
                if (r && g && b) {
                    const al = by.get(m[1] + "_a");
                    [r, g, b].forEach((x) => used.add(x.tag)); if (al) used.add(al.tag);
                    out.push({ kind: "color", key: m[1], rgb: [r, g, b], alpha: al || null, group: groupOf(t.tag) });
                    continue;
                }
            }
            if (/_a$/.test(t.tag) && by.has(t.tag.replace(/_a$/, "_r")) && by.has(t.tag.replace(/_a$/, "_g")) && by.has(t.tag.replace(/_a$/, "_b"))) continue;
            used.add(t.tag);
            out.push({ kind: "num", key: t.tag, t, group: groupOf(t.tag) });
        }
        return out;
    }

    /* ---------- أدوات الألوان ---------- */
    function colorOf(it) { return it.rgb.map((t) => t.a); }
    function setColor(it, c) { it.rgb.forEach((t, i) => { t.a = c[i]; }); }
    function adjustColor(c, { bri = 1, sat = 1, con = 1, temp = 0 }) {
        let [r, g, b] = c;
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
        r = (r - 0.5) * con + 0.5; g = (g - 0.5) * con + 0.5; b = (b - 0.5) * con + 0.5;
        r *= bri * (1 + temp * 0.25); g *= bri; b *= bri * (1 - temp * 0.25);
        return [Math.max(0, r), Math.max(0, g), Math.max(0, b)];
    }

    /* ---------- مكتبة الوسوم الشائعة (للإضافة) ---------- */
    const KNOWN_TAGS = ["postfx_correct_col_r", "postfx_correct_col_g", "postfx_correct_col_b", "postfx_shift_col_r", "postfx_shift_col_g", "postfx_shift_col_b", "postfx_shift_cutoff", "postfx_desaturation", "postfx_exposure", "postfx_intensity_bloom", "postfx_bright_pass_thresh", "postfx_vignetting_intensity", "postfx_vignetting_radius", "postfx_vignetting_contrast", "postfx_vignetting_col_r", "postfx_vignetting_col_g", "postfx_vignetting_col_b", "postfx_motionblurlength", "postfx_noise", "postfx_scanlineintensity", "lens_artefacts_intensity", "chrom_aberration_coeff", "lens_dist_coeff", "dof_far", "dof_blur_far", "dof_blur_mid", "screen_blur_intensity", "fog_density", "fog_start", "fog_falloff", "fog_haze_density", "fog_col_r", "fog_col_g", "fog_col_b", "light_dir_mult", "light_dir_col_r", "light_dir_col_g", "light_dir_col_b", "light_ray_mult", "natural_ambient_multiplier", "artificial_int_ambient_multiplier", "sky_hdr", "ssao_inten", "dir_shadow_softness", "shadow_distance_mult", "lod_mult", "temperature", "water_reflection", "wind_speed_mult"];

    /* ---------- قوالب جاهزة (قيم تُضبط على المعدّل المختار) ---------- */
    const LOOKS = [
        { id: "cine", name: "سينمائي دافئ", sub: "ظلال زرقاء وإضاءات دافئة", set: { postfx_correct_col_r: 1.0, postfx_correct_col_g: 0.93, postfx_correct_col_b: 0.84, postfx_shift_col_r: 0.05, postfx_shift_col_g: 0.14, postfx_shift_col_b: 0.26, postfx_desaturation: 0.88, postfx_vignetting_intensity: 0.45, postfx_vignetting_radius: 6 }, sw: ["#ffb15e", "#1f3a5f"] },
        { id: "cold", name: "بارد ليلي", sub: "أزرق باهت مع تشبّع أقل", set: { postfx_correct_col_r: 0.82, postfx_correct_col_g: 0.92, postfx_correct_col_b: 1.0, postfx_shift_col_r: 0.02, postfx_shift_col_g: 0.1, postfx_shift_col_b: 0.3, postfx_desaturation: 0.8, postfx_vignetting_intensity: 0.5, postfx_vignetting_radius: 5 }, sw: ["#7fb4ff", "#101a33"] },
        { id: "vivid", name: "حيّ ومشبّع", sub: "ألوان قوية وتوهّج خفيف", set: { postfx_desaturation: 1.25, postfx_intensity_bloom: 0.35, postfx_correct_col_r: 1.0, postfx_correct_col_g: 1.0, postfx_correct_col_b: 1.0 }, sw: ["#ff4d6d", "#22d3a5"] },
        { id: "noir", name: "أبيض وأسود", sub: "إزالة الألوان بالكامل", set: { postfx_desaturation: 0.0, postfx_vignetting_intensity: 0.55, postfx_vignetting_radius: 5, postfx_correct_col_r: 1.0, postfx_correct_col_g: 1.0, postfx_correct_col_b: 1.0 }, sw: ["#f2f2f2", "#222"] },
        { id: "real", name: "واقعي نظيف", sub: "تعديل خفيف بلا مبالغة", set: { postfx_desaturation: 0.95, postfx_intensity_bloom: 0.12, postfx_vignetting_intensity: 0.2 }, sw: ["#d9d4c7", "#6e7a68"] },
    ];

    /* ---------- أدوات عامة (على كل المعدّلات) ---------- */
    const GLOBAL_TOOLS = [
        { id: "mblur", name: "إيقاف Motion Blur", test: /^postfx_motionblur(length|size)$/, to: 0 },
        { id: "lens", name: "إزالة تأثيرات العدسة", test: /^(lens_artefacts_intensity|lens_dist_coeff|lens_dist_cube_coeff|chrom_aberration_coeff2?)$/, to: 0 },
        { id: "noise", name: "إزالة الضوضاء والخطوط", test: /^(postfx_noise|postfx_scanlineintensity)$/, to: 0 },
        { id: "vign", name: "إزالة الفينييت", test: /^(postfx_vignetting_intensity|blur_vignetting_intensity)$/, to: 0 },
        { id: "dof", name: "إيقاف العمق (DOF)", test: /^(dof_blur_far|dof_blur_mid)$/, to: 0 },
    ];

    window.TC = { parse, apply, changedCount, addTag, removeTag, cloneModifier, deleteModifier, newModifier, importMods, verify, items, groupLabel, GROUP_ORDER, groupOf, colorOf, setColor, adjustColor, toHex, fromHex, fmt, clamp, KNOWN_TAGS, LOOKS, GLOBAL_TOOLS, setNumMods };
})();
