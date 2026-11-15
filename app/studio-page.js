/* استوديو CA — الواجهة: Timecycle + BloodFX + أدوات عامة */
(function () {
    "use strict";
    const { ic, esc, toast, confirm: askConfirm, dialog } = window.CA;
    const TC = window.TC, FX = window.FX;
    const root = document.getElementById("st");
    const api = window.api.studio;
    const $q = (s, el) => (el || root).querySelector(s);

    const AR = {
        postfx_desaturation: "التشبع العام (1 = عادي، 0 = أبيض وأسود)", postfx_exposure: "التعريض", postfx_intensity_bloom: "قوة التوهّج (Bloom)", postfx_bright_pass_thresh: "عتبة التوهّج",
        postfx_correct_col: "لون التصحيح (يضرب الصورة)", postfx_shift_col: "لون الإزاحة (تلوين الظلال)", postfx_shift_cutoff: "حدّ الإزاحة", postfx_vignetting_intensity: "قوة الفينييت (تغميق الأطراف)",
        postfx_vignetting_radius: "نصف قطر الفينييت", postfx_vignetting_contrast: "تباين الفينييت", postfx_vignetting_col: "لون الفينييت", postfx_motionblurlength: "طول Motion Blur", postfx_noise: "الضوضاء (Grain)",
        postfx_scanlineintensity: "خطوط المسح", lens_artefacts_intensity: "تأثيرات العدسة", chrom_aberration_coeff: "الزيغ اللوني", lens_dist_coeff: "تشوّه العدسة", dof_far: "عمق الميدان — البعيد",
        dof_blur_far: "ضبابية البعيد", dof_blur_mid: "ضبابية المتوسط", screen_blur_intensity: "ضبابية الشاشة", fog_density: "كثافة الضباب", fog_start: "بداية الضباب", fog_falloff: "تلاشي الضباب",
        fog_col: "لون الضباب", fog_haze_density: "كثافة الغبش", light_dir_mult: "قوة الشمس/الضوء الموجّه", light_dir_col: "لون الضوء الموجّه", light_ray_mult: "قوة أشعة الضوء",
        natural_ambient_multiplier: "الإضاءة المحيطة الطبيعية", artificial_int_ambient_multiplier: "الإضاءة الاصطناعية الداخلية", sky_hdr: "سطوع السماء", ssao_inten: "قوة SSAO",
        dir_shadow_softness: "نعومة الظلال", shadow_distance_mult: "مسافة الظلال", lod_mult: "مسافة الرسم (LOD)", temperature: "درجة الحرارة", water_reflection: "انعكاس الماء", wind_speed_mult: "سرعة الرياح",
    };
    const arOf = (k) => AR[k] || "";

    const S = { mod: "tc", text: "", base: "", name: "", model: null, baseModel: null, sel: -1, q: "", filter: "all", items: [], hist: [], lastPush: 0, struct: 0, split: 52, tune: { bri: 100, sat: 100, con: 100, temp: 0 },
        fx: { info: null, name: "", text: "", model: null, sel: new Set(), mult: 1, ints: false, raw: false, installed: "" } };

    /* ============================ أدوات ============================ */
    const nice = (v) => { const m = Math.max(1, Math.abs(v) * 2); return [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000].find((x) => x >= m) || m; };
    const canNeg = (k, v) => v < 0 || /exposure|offset|bias|height|direction|dist_coeff|shift|override/i.test(k);
    const dirty = () => !!S.model && (S.text !== S.base || TC.changedCount(S.model) > 0);
    const curMod = () => (S.model && S.sel >= 0 ? S.model.mods[S.sel] : null);
    const rafOnce = (fn) => { let q = false; return () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(); }); }; };

    /* ---- سجلّ التراجع ---- */
    function snap() { const vals = []; for (const m of S.model.mods) for (const t of m.tags) vals.push(t.a, t.b); return { text: S.text, vals, sel: S.sel }; }
    function push(force) { if (!S.model) return; const n = Date.now(); if (!force && n - S.lastPush < 700) return; S.lastPush = n; S.hist.push(snap()); if (S.hist.length > 40) S.hist.shift(); updHead(); }
    function restore(sn) {
        S.text = sn.text; const p = TC.parse(S.text); if (p.error) return;
        S.model = p; let k = 0; for (const m of S.model.mods) for (const t of m.tags) { t.a = sn.vals[k++]; t.b = sn.vals[k++]; }
        rebase(); S.sel = Math.min(sn.sel, S.model.mods.length - 1);
    }
    function undo() { if (!S.hist.length) return toast("لا يوجد ما يُتراجع عنه", "error"); restore(S.hist.pop()); renderAll(); }

    /* يعيد القيم الأصلية لكل وسم من الملف الأساسي (للمقارنة والمعاينة) */
    function rebase() {
        const bm = TC.parse(S.base); S.baseModel = bm.error ? null : bm;
        const seen = new Map();
        if (S.baseModel) S.baseModel.mods.forEach((m, mi) => { const c = new Map(); m.tags.forEach((t) => { const n = (c.get(t.tag) || 0); c.set(t.tag, n + 1); seen.set(mi + "|" + t.tag + "|" + n, t); }); });
        S.model.mods.forEach((m, mi) => { const c = new Map(); m.tags.forEach((t) => { const n = (c.get(t.tag) || 0); c.set(t.tag, n + 1); const b = S.baseModel && S.baseModel.mods[mi] && S.baseModel.mods[mi].name === m.name ? seen.get(mi + "|" + t.tag + "|" + n) : null; t.oa = b ? b.a : t.a; t.ob = b ? b.b : t.b; }); });
    }
    function structOp(fn) {
        push(true);
        S.text = TC.apply(S.text, S.model);
        const idx = S.sel;
        try { S.text = fn(S.text, idx); } catch (e) { toast(e.message || "فشلت العملية", "error"); S.text = TC.apply(S.text, S.model); }
        const p = TC.parse(S.text); if (p.error) { toast(p.error, "error"); return false; }
        S.model = p; rebase(); S.struct++; renderAll(); return true;
    }

    /* ============================ الهيكل العام ============================ */
    function head() {
        const has = !!S.model;
        return `<div class="st-head">
            <div class="st-logo"><div class="st-mark">CA</div><div><b>CA Studio</b><small>محرّر الجرافيكس</small></div></div>
            <div class="st-mods">
                <button class="st-mod ${S.mod === "tc" ? "on" : ""}" data-act="mod" data-m="tc">${ic("palette")}Timecycle</button>
                <button class="st-mod ${S.mod === "fx" ? "on" : ""}" data-act="mod" data-m="fx">${ic("drop")}BloodFX</button>
                <button class="st-mod ${S.mod === "tools" ? "on" : ""}" data-act="mod" data-m="tools">${ic("sliders")}أدوات عامة</button>
            </div>
            <span class="st-sp"></span>
            <span id="hDirty" class="st-dirty hidden">تعديلات غير محفوظة</span>
            ${S.mod !== "fx" ? `<span class="st-file ${has ? "has" : ""}" id="hFile">${esc(S.name || "لا يوجد ملف")}</span>
            <button class="btn btn-sm" data-act="undo" id="hUndo" title="Ctrl+Z" disabled>${ic("undo")}تراجع</button>
            <button class="btn btn-sm" data-act="open">${ic("folder")}فتح</button>
            <button class="btn btn-sm" data-act="detect">${ic("search")}كشف من FiveM</button>
            <button class="btn btn-sm btn-st" data-act="save" id="hSave" ${has ? "" : "disabled"}>${ic("check")}حفظ والتحقق</button>` : ""}
        </div>`;
    }
    function updHead() {
        const d = $q("#hDirty"); if (d) d.classList.toggle("hidden", S.mod === "fx" ? !(S.fx.model && FX.changed(S.fx.model)) : !dirty());
        const u = $q("#hUndo"); if (u) u.disabled = !S.hist.length;
        const f = $q("#hFile"); if (f) { f.textContent = S.name || "لا يوجد ملف"; f.classList.toggle("has", !!S.model); }
        const sv = $q("#hSave"); if (sv) sv.disabled = !S.model;
    }
    function renderAll() {
        const body = S.mod === "tc" ? tcView() : S.mod === "fx" ? fxView() : toolsView();
        root.innerHTML = head() + body;
        updHead();
        if (S.mod === "tc" && S.model) { S.items = TC.items(curMod() || { tags: [] }); drawPreview(); }
    }

    /* ============================ Timecycle ============================ */
    function emptyTc() {
        return `<div class="card pane" style="padding:34px;text-align:center;align-items:center">
            <div class="icon-tile" style="width:68px;height:68px;border-radius:20px">${ic("palette")}</div>
            <h3 style="color:#fff;font-size:18px">افتح ملف timecycle_mods.xml</h3>
            <p style="color:var(--text-3);font-size:13px;max-width:460px;line-height:1.8">تعدّل كل معدّلات الجرافيكس (الألوان، الضباب، التوهّج، الفينييت…) بمعاينة حيّة ومقارنة قبل/بعد. يحفظ البرنامج نسخة من الأصل ويتحقق من الملف قبل الكتابة.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-st" data-act="open">${ic("folder")}فتح ملف XML</button><button class="btn" data-act="detect">${ic("search")}كشف من FiveM</button></div>
        </div>`;
    }
    function listHtml() {
        const q = S.q.trim().toLowerCase();
        const out = [];
        S.model.mods.forEach((m, i) => {
            if (q && !m.name.toLowerCase().includes(q)) return;
            if (S.filter === "tags" && !m.tags.length) return;
            if (S.filter === "chg" && !m.tags.some((t) => t.a !== t.oa || t.b !== t.ob)) return;
            const ch = m.tags.some((t) => t.a !== t.oa || t.b !== t.ob);
            out.push(`<button class="mi ${i === S.sel ? "on" : ""} ${m.tags.length ? "" : "zero"}" data-act="sel" data-i="${i}">${ch ? '<i class="dot"></i>' : ""}<span class="n">${esc(m.name)}</span><em>${m.tags.length}</em></button>`);
        });
        return out.slice(0, 700).join("") + (out.length > 700 ? `<div class="empty-line">+${out.length - 700} — ضيّق البحث</div>` : "") || '<div class="empty-line">لا نتائج</div>';
    }
    function tcView() {
        if (!S.model) return emptyTc();
        const m = curMod();
        return `<div class="tc">
            <div class="card tc-l">
                <div class="sr"><input class="inp" id="q" placeholder="ابحث عن معدّل…" value="${esc(S.q)}" style="direction:ltr"><div class="chips">
                    ${[["all", "الكل"], ["tags", "فيه وسوم"], ["chg", "المعدّلة"]].map(([k, l]) => `<button class="cchip ${S.filter === k ? "on" : ""}" data-act="flt" data-k="${k}">${l}</button>`).join("")}</div>
                    <small style="color:var(--text-3);font-size:11px">${S.model.mods.length} معدّل · ${S.model.mods.reduce((a, x) => a + x.tags.length, 0)} وسم</small></div>
                <div class="mlist" id="mlist">${listHtml()}</div>
                <div class="ft"><button class="btn btn-sm" data-act="newmod">${ic("plus")}جديد</button><button class="btn btn-sm" data-act="clone" ${m ? "" : "disabled"}>${ic("copy")}نسخ</button><button class="btn btn-sm btn-danger" data-act="delmod" ${m ? "" : "disabled"}>${ic("trash")}</button></div>
            </div>
            <div class="tc-c" id="center">${m ? centerHtml(m) : '<div class="card empty-line" style="padding:40px">اختر معدّلاً من القائمة</div>'}</div>
            <div class="tc-r">${rightHtml(m)}</div>
        </div>`;
    }
    function rowHtml(it, i) {
        const chg = (t) => t.a !== t.oa || t.b !== t.ob;
        if (it.kind === "color") {
            const c = TC.colorOf(it), hex = TC.toHex(c[0], c[1], c[2]);
            const any = it.rgb.some(chg) || (it.alpha && chg(it.alpha));
            const over = c.some((x) => x > 1.0005);
            return `<div class="row c ${any ? "chg" : ""}" data-i="${i}"><div class="k"><b>${esc(it.key)}</b><small>${esc(arOf(it.key) || (over ? "قيمة أعلى من 1 (HDR)" : ""))}</small></div>
                <div class="v"><label class="sw" style="background:${hex}"><input type="color" data-f="pick" value="${hex}"></label><input class="hexi" data-f="hex" value="${hex}" maxlength="7" spellcheck="false">
                <span class="rgbm">${c.map((x, k) => `<input class="num" data-f="c${k}" value="${TC.fmt(x)}" title="${"RGB"[k]}">`).join("")}</span>${it.alpha ? `<input class="num" data-f="al" value="${TC.fmt(it.alpha.a)}" title="Alpha" style="width:62px">` : ""}</div>
                <input class="w" data-f="w" value="${TC.fmt(it.rgb[0].b)}" title="الرقم الثاني في الوسم"><button class="x" data-act="deltag" title="حذف">${ic("x")}</button></div>`;
        }
        const t = it.t, mx = nice(t.oa), mn = canNeg(it.key, t.oa) ? -mx : 0;
        return `<div class="row ${chg(t) ? "chg" : ""}" data-i="${i}"><div class="k"><b>${esc(it.key)}</b><small>${esc(arOf(it.key))}</small></div>
            <div class="v"><input type="range" data-f="rng" min="${mn}" max="${mx}" step="${mx / 1000}" value="${Math.min(mx, Math.max(mn, t.a))}"><input class="num" data-f="val" value="${TC.fmt(t.a)}"></div>
            <input class="w" data-f="w" value="${TC.fmt(t.b)}" title="الرقم الثاني في الوسم"><button class="x" data-act="deltag" title="حذف">${ic("x")}</button></div>`;
    }
    function centerHtml(m) {
        const items = TC.items(m); S.items = items;
        const byG = new Map(); items.forEach((it, i) => { if (!byG.has(it.group)) byG.set(it.group, []); byG.get(it.group).push([it, i]); });
        const groups = TC.GROUP_ORDER.filter((g) => byG.has(g));
        return `<div class="card mh"><div><h2>${esc(m.name)}</h2><div class="sub">${m.tags.length} وسم${m.numMods !== m.tags.length ? ` · numMods في الملف = ${m.numMods}` : ""}</div></div><span class="st-sp"></span>
                <button class="btn btn-sm" data-act="resetmod">${ic("refresh")}إرجاع هذا المعدّل</button></div>
            ${groups.map((g, gi) => `<details class="card grp" ${gi < 3 || groups.length < 4 ? "open" : ""}><summary>${esc(TC.groupLabel(g))}<span class="cnt">${byG.get(g).length}</span></summary>${byG.get(g).map(([it, i]) => rowHtml(it, i)).join("")}</details>`).join("") || '<div class="card empty-line" style="padding:26px">هذا المعدّل فارغ — أضف وسماً أو طبّق قالباً من اليمين</div>'}
            <div class="card"><div class="addbar"><input class="inp" id="addTag" list="tagdl" placeholder="أضف وسماً: postfx_desaturation …"><datalist id="tagdl">${TC.KNOWN_TAGS.map((k) => `<option value="${k}">`).join("")}</datalist>
                <input class="inp" id="addVal" value="0" style="width:90px;direction:ltr"><button class="btn btn-sm" data-act="addtag">${ic("plus")}إضافة</button></div></div>`;
    }
    function rightHtml(m) {
        const T = S.tune;
        return `<div class="card pv"><h4>${ic("eye")}معاينة تقريبية — قبل / بعد</h4>
                <div class="pvbox"><canvas id="pv" width="480" height="270"></canvas><span class="tag l">قبل</span><span class="tag r">بعد</span></div>
                <input type="range" id="split" min="0" max="100" value="${S.split}" aria-label="تقسيم المعاينة"><small>مشهد تجريبي يطبّق التصحيح اللوني والتشبع والتعريض والفينييت فقط. هي مؤشّر سريع وليست محاكاة دقيقة لما ستراه داخل اللعبة.</small></div>
            <div class="card sect"><h4>${ic("sliders2")}ضبط سريع لألوان المعدّل</h4>
                ${[["bri", "السطوع", 40, 180, "%"], ["sat", "التشبع", 0, 220, "%"], ["con", "التباين", 60, 160, "%"], ["temp", "الحرارة", -100, 100, ""]].map(([k, l, a, b, u]) => `<div class="tune"><span>${l}</span><input type="range" data-tune="${k}" min="${a}" max="${b}" value="${T[k]}"><b id="tv_${k}">${T[k]}${u}</b></div>`).join("")}
                <div style="display:flex;gap:6px"><button class="btn btn-sm btn-st" data-act="applytune" ${m ? "" : "disabled"}>تطبيق</button><button class="btn btn-sm" data-act="zerotune">تصفير</button></div>
                <small style="display:block;color:var(--text-3);font-size:10.8px;margin-top:8px;line-height:1.6">يؤثر على كل الألوان (…_r/_g/_b) داخل المعدّل المختار.</small></div>
            <div class="card sect"><h4>${ic("star")}قوالب جاهزة للمعدّل المختار</h4>
                <div class="looks">${TC.LOOKS.map((l) => `<button class="look" data-act="look" data-id="${l.id}" ${m ? "" : "disabled"}><i style="background:linear-gradient(90deg,${l.sw[0]},${l.sw[1]})"></i>${esc(l.name)}<small>${esc(l.sub)}</small></button>`).join("")}</div></div>`;
    }

    /* ---- معاينة ---- */
    const PV = { w: 480, h: 270, base: null };
    function buildBase() {
        const c = document.createElement("canvas"); c.width = PV.w; c.height = PV.h; const g = c.getContext("2d");
        let gr = g.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, "#2f64a8"); gr.addColorStop(.55, "#7fb0dc"); gr.addColorStop(1, "#f6cf98"); g.fillStyle = gr; g.fillRect(0, 0, 480, 270);
        g.fillStyle = "#fff4cf"; g.beginPath(); g.arc(380, 78, 24, 0, 7); g.fill();
        g.fillStyle = "rgba(255,255,255,.55)"; [[70, 50, 60], [160, 80, 44], [300, 40, 52]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(x, y, r, r / 3, 0, 0, 7); g.fill(); });
        g.fillStyle = "#4d6a52"; g.beginPath(); g.moveTo(0, 170); for (let x = 0; x <= 480; x += 40) g.lineTo(x, 130 + Math.sin(x / 55) * 22); g.lineTo(480, 170); g.fill();
        const bl = [[20, 90, 46, "#59616f"], [70, 120, 38, "#7c6f64"], [112, 80, 52, "#4a5160"], [170, 105, 40, "#8a8f9a"], [215, 70, 58, "#5a4d58"], [278, 115, 42, "#6c7482"], [324, 92, 50, "#4c5a68"], [380, 118, 36, "#836b5f"], [420, 86, 54, "#55607a"]];
        bl.forEach(([x, h, w, col]) => { g.fillStyle = col; g.fillRect(x, 190 - h, w, h); g.fillStyle = "rgba(255,226,150,.8)"; for (let yy = 190 - h + 8; yy < 182; yy += 14) for (let xx = x + 6; xx < x + w - 6; xx += 12) if ((xx * 7 + yy * 3) % 5 > 1) g.fillRect(xx, yy, 5, 6); });
        g.fillStyle = "#34373e"; g.fillRect(0, 190, 480, 80); g.fillStyle = "#cfd3da"; for (let x = 10; x < 480; x += 60) g.fillRect(x, 232, 32, 4);
        g.fillStyle = "#b8232f"; g.beginPath(); g.roundRect(150, 200, 150, 42, 14); g.fill(); g.fillStyle = "#7d1520"; g.beginPath(); g.roundRect(186, 180, 80, 30, 10); g.fill(); g.fillStyle = "#9ed7ff"; g.fillRect(196, 186, 28, 18); g.fillRect(228, 186, 28, 18);
        g.fillStyle = "#111"; [[180, 244], [270, 244]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); });
        g.fillStyle = "#e9c46a"; g.fillRect(150, 214, 10, 8);
        PV.base = g.getImageData(0, 0, PV.w, PV.h);
    }
    function gparams(m, orig) {
        const get = (k, d) => { const t = m.tags.find((x) => x.tag === k); return t ? (orig ? t.oa : t.a) : d; };
        return { cor: [get("postfx_correct_col_r", 1), get("postfx_correct_col_g", 1), get("postfx_correct_col_b", 1)], sh: [get("postfx_shift_col_r", 0), get("postfx_shift_col_g", 0), get("postfx_shift_col_b", 0)], des: get("postfx_desaturation", 1), exp: get("postfx_exposure", 0), bl: get("postfx_intensity_bloom", 0), vi: get("postfx_vignetting_intensity", 0), vr: get("postfx_vignetting_radius", 10), vc: [get("postfx_vignetting_col_r", 0), get("postfx_vignetting_col_g", 0), get("postfx_vignetting_col_b", 0)] };
    }
    function gradeInto(out, P) {
        const s = PV.base.data, d = out.data, W = PV.w, H = PV.h, ex = Math.pow(2, Math.max(-4, Math.min(4, P.exp)) * 0.4);
        const vi = Math.min(1, Math.max(0, P.vi)), vs = Math.min(1.4, Math.max(0.35, 14 / Math.max(P.vr, 2)));
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4; let r = s[o] / 255, g = s[o + 1] / 255, b = s[o + 2] / 255;
            r *= ex * P.cor[0]; g *= ex * P.cor[1]; b *= ex * P.cor[2];
            let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const sh = Math.pow(Math.max(0, 1 - l), 2) * 0.3; r += P.sh[0] * sh; g += P.sh[1] * sh; b += P.sh[2] * sh;
            l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = l + (r - l) * P.des; g = l + (g - l) * P.des; b = l + (b - l) * P.des;
            const hl = Math.max(0, l - 0.62) * P.bl * 0.35; r += hl; g += hl; b += hl;
            if (vi > 0) { const dx = (x / W - 0.5) * 2, dy = (y / H - 0.5) * 2, dd = Math.sqrt(dx * dx + dy * dy) / 1.414; const f = Math.pow(Math.max(0, Math.min(1, (dd - 0.35 / vs) / 0.75)), 1.6) * vi * 0.85; r = r * (1 - f) + P.vc[0] * f; g = g * (1 - f) + P.vc[1] * f; b = b * (1 - f) + P.vc[2] * f; }
            d[o] = Math.max(0, Math.min(255, r * 255)); d[o + 1] = Math.max(0, Math.min(255, g * 255)); d[o + 2] = Math.max(0, Math.min(255, b * 255)); d[o + 3] = 255;
        }
    }
    const drawPreview = rafOnce(() => {
        const cv = $q("#pv"); if (!cv) return;
        if (!PV.base) buildBase();
        const ctx = cv.getContext("2d"), m = curMod();
        const A = new ImageData(PV.w, PV.h), B = new ImageData(PV.w, PV.h);
        const none = { cor: [1, 1, 1], sh: [0, 0, 0], des: 1, exp: 0, bl: 0, vi: 0, vr: 10, vc: [0, 0, 0] };
        gradeInto(B, m ? gparams(m, true) : none); gradeInto(A, m ? gparams(m, false) : none);
        const sx = Math.round(PV.w * S.split / 100);
        for (let y = 0; y < PV.h; y++) { const o = y * PV.w * 4; for (let x = 0; x < sx * 4; x++) A.data[o + x] = B.data[o + x]; }
        ctx.putImageData(A, 0, 0); ctx.fillStyle = "#fff"; ctx.fillRect(sx - 1, 0, 2, PV.h);
    });

    /* ---- أحداث Timecycle ---- */
    function markChg(rowEl, on) { rowEl.classList.toggle("chg", on); }
    function onTcInput(e) {
        const el = e.target, row = el.closest(".row"), f = el.dataset.f;
        if (el.id === "q") { S.q = el.value; $q("#mlist").innerHTML = listHtml(); return; }
        if (el.id === "split") { S.split = +el.value; drawPreview(); return; }
        if (el.dataset.tune) { S.tune[el.dataset.tune] = +el.value; $q("#tv_" + el.dataset.tune).textContent = el.value + (el.dataset.tune === "temp" ? "" : "%"); return; }
        if (!row || !f) return;
        const it = S.items[+row.dataset.i]; if (!it) return;
        const isInput = e.type === "input";
        if (f === "hex") { const c = TC.fromHex(el.value); if (!c) return; push(); TC.setColor(it, c); syncColor(row, it, "hex"); }
        else if (f === "pick") { push(); TC.setColor(it, TC.fromHex(el.value)); syncColor(row, it, "pick"); }
        else if (/^c[012]$/.test(f)) { const v = parseFloat(el.value); if (!Number.isFinite(v)) return; push(); it.rgb[+f[1]].a = v; syncColor(row, it, f); }
        else if (f === "al") { const v = parseFloat(el.value); if (!Number.isFinite(v)) return; push(); it.alpha.a = v; }
        else if (f === "rng") { push(); it.t.a = +el.value; row.querySelector('[data-f="val"]').value = TC.fmt(it.t.a); }
        else if (f === "val") { const v = parseFloat(el.value); if (!Number.isFinite(v)) return; push(); it.t.a = v; const r = row.querySelector('[data-f="rng"]'); if (r) r.value = v; }
        else if (f === "w") { const v = parseFloat(el.value); if (!Number.isFinite(v)) return; push(); (it.kind === "color" ? it.rgb.concat(it.alpha ? [it.alpha] : []) : [it.t]).forEach((t) => { t.b = v; }); }
        void isInput;
        const ts = it.kind === "color" ? it.rgb.concat(it.alpha ? [it.alpha] : []) : [it.t];
        markChg(row, ts.some((t) => t.a !== t.oa || t.b !== t.ob));
        updHead(); drawPreview();
    }
    function syncColor(row, it, from) {
        const c = TC.colorOf(it), hex = TC.toHex(c[0], c[1], c[2]);
        row.querySelector(".sw").style.background = hex;
        if (from !== "pick") row.querySelector('[data-f="pick"]').value = hex;
        if (from !== "hex") row.querySelector('[data-f="hex"]').value = hex;
        [0, 1, 2].forEach((k) => { if (from !== "c" + k) row.querySelector(`[data-f="c${k}"]`).value = TC.fmt(c[k]); });
    }
    function applyTune() {
        const m = curMod(); if (!m) return; push(true);
        const T = S.tune; let n = 0;
        TC.items(m).forEach((it) => { if (it.kind !== "color") return; const c = TC.adjustColor(TC.colorOf(it), { bri: T.bri / 100, sat: T.sat / 100, con: T.con / 100, temp: T.temp / 100 }); TC.setColor(it, c); n++; });
        toast(n ? `عُدّل ${n} لون` : "لا توجد ألوان في هذا المعدّل", n ? "success" : "error"); S.tune = { bri: 100, sat: 100, con: 100, temp: 0 }; renderAll();
    }
    function applyLook(id) {
        const L = TC.LOOKS.find((x) => x.id === id), m = curMod(); if (!L || !m) return; push(true);
        const miss = [];
        for (const [k, v] of Object.entries(L.set)) { const t = m.tags.find((x) => x.tag === k); if (t) t.a = v; else miss.push([k, v]); }
        if (miss.length) { structOp((text, idx) => { let o = text; for (const [k, v] of miss) o = TC.addTag(o, idx, k, v, 0); return o; }); const mm = curMod(); for (const [k, v] of Object.entries(L.set)) { const t = mm.tags.find((x) => x.tag === k); if (t) t.a = v; } renderAll(); }
        else renderAll();
        toast(`طُبّق قالب «${L.name}» على ${m.name}`);
    }

    /* ============================ BloodFX ============================ */
    async function fxDetect(silent) {
        const r = await api.fx.detect();
        S.fx.info = r;
        if (!r.success) { if (!silent) toast(r.message, "error", 5000); } else if (!silent) toast(r.exists ? `وُجد ${r.files.length} ملف .dat` : "مجلد effects غير موجود — سيُنشأ عند التثبيت");
        if (S.mod === "fx") renderAll();
    }
    function fxLoad(name, text, fromDisk) {
        S.fx.name = name; S.fx.text = text; S.fx.model = FX.parse(text); S.fx.installed = fromDisk ? name : "";
        S.fx.sel = new Set(S.fx.model.lines.filter((l) => l.kind === "d" && l.tokens.some((t) => t.isF)).map((l) => l.i)); S.fx.mult = 1; S.fx.raw = false;
        renderAll();
    }
    function fxView() {
        const F = S.fx, inf = F.info, M = F.model;
        const left = `<div class="card sect"><h4>${ic("folder")}مجلد effects</h4>
                ${inf && inf.success ? `<div class="pathbox">${esc(inf.dir)}</div><div style="margin:8px 0;font-size:12px;color:${inf.exists ? "var(--ok)" : "var(--warn)"}">${inf.exists ? "المجلد موجود" : "المجلد غير موجود — سننشئه عند التثبيت"}</div>`
                    : `<div style="font-size:12.5px;color:var(--text-3);line-height:1.8;margin-bottom:8px">${esc(inf ? inf.message : "اضغط «كشف» ليجد البرنامج مجلد FiveM تلقائياً.")}</div>`}
                <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-sm" data-act="fxdetect">${ic("search")}كشف</button><button class="btn btn-sm btn-st" data-act="fximport">${ic("upload")}استيراد ملف .dat</button></div></div>
            ${inf && inf.success ? `<div class="card sect fxlist"><h4>ملفات .dat الحالية</h4>${inf.files.length ? inf.files.map((f) => `<button class="it ${F.name === f.name && F.installed ? "on" : ""}" data-act="fxopen" data-n="${esc(f.name)}">${ic("file")}${esc(f.name)}<small>${Math.round(f.size / 1024 * 10) / 10}KB</small></button>`).join("") : '<div class="empty-line">لا توجد ملفات بعد</div>'}</div>` : ""}`;
        let right;
        if (!M) right = `<div class="card pane" style="padding:34px;text-align:center;align-items:center"><div class="icon-tile" style="width:68px;height:68px;border-radius:20px">${ic("drop")}</div><h3 style="color:#fff;font-size:18px">BloodFX</h3>
                <p style="color:var(--text-3);font-size:13px;max-width:480px;line-height:1.8">استورد ملف BloodFX (.dat) الذي تريده ثم ثبّته مباشرة في <span class="ltr">citizen\\common\\data\\effects</span>. إن لم يكن المجلد موجوداً ينشئه البرنامج. يمكنك أيضاً ضبط شدة الدم بمضاعف قبل التثبيت، والرجوع للأصل بضغطة.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-st" data-act="fximport">${ic("upload")}استيراد ملف .dat</button><button class="btn" data-act="fxdetect">${ic("search")}فتح من FiveM</button></div></div>`;
        else {
            const n = FX.changed(M), all = M.lines.filter((l) => l.kind === "d");
            right = `<div class="card sect"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                    <div class="fld" style="flex:1;min-width:200px"><label>اسم الملف عند التثبيت</label><input class="inp ltr" id="fxName" value="${esc(F.name)}"></div>
                    <button class="btn btn-st" data-act="fxinstall" style="align-self:flex-end">${ic("download")}تثبيت في FiveM</button>
                    <button class="btn" data-act="fxrestore" style="align-self:flex-end" ${inf && inf.success ? "" : "disabled"}>${ic("undo")}استرجاع الأصل</button></div>
                    <small style="display:block;color:var(--text-3);font-size:11.5px;margin-top:8px;line-height:1.7">أغلق FiveM قبل التثبيت. تُحفظ نسخة من ملفك الأصلي تلقائياً أول مرة (داخل بيانات البرنامج) ويمكن استرجاعها.</small></div>
                <div class="card sect"><h4>${ic("zap")}ضبط الشدّة (من القيم الأصلية)</h4>
                    <div class="mult">${[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((x) => `<button class="cchip ${F.mult === x ? "on" : ""}" data-act="fxmult" data-x="${x}">×${x}</button>`).join("")}
                    <input class="inp" id="fxCustom" type="number" step="0.05" min="0" max="20" value="${F.mult}" style="width:84px;height:30px;direction:ltr">
                    <label style="display:inline-flex;gap:6px;align-items:center;font-size:12px;color:var(--text-2)"><input type="checkbox" id="fxInts" ${F.ints ? "checked" : ""}> تضمين الأرقام الصحيحة</label></div>
                    <small style="display:block;color:var(--text-3);font-size:11.5px;margin-top:8px;line-height:1.7">يؤثّر المضاعف على الأرقام ذات الفاصلة (البرتقالية) في الأسطر المحدّدة فقط. الأرقام الصحيحة قد تكون أعداداً أو أعلاماً فلا تُمَسّ افتراضياً.</small></div>
                <div class="card" style="overflow:hidden"><div class="chrow" style="background:rgba(255,255,255,.03)"><label style="display:flex;gap:8px;align-items:center;direction:rtl"><input type="checkbox" id="fxAll" ${F.sel.size === all.length ? "checked" : ""} style="accent-color:#ff9a7a"> تحديد الكل (${F.sel.size}/${all.length})</label><span class="t"></span><span class="d">${n} رقم معدّل</span>
                    <button class="btn btn-sm" data-act="fxtoggleraw">${F.raw ? "الجدول" : "النص الخام"}</button><button class="btn btn-sm" data-act="fxreset">${ic("refresh")}إرجاع</button></div>
                    ${F.raw ? `<textarea class="txt ltr" id="fxRaw" style="min-height:420px;border:0;border-radius:0;font-family:Consolas,monospace;font-size:12px" spellcheck="false">${esc(FX.build(M))}</textarea>` : `<div class="chlist" style="max-height:520px">${fxRows(M)}</div>`}</div>`;
        }
        return `<div class="fxg"><div class="pane">${left}</div><div class="pane">${right}</div></div>`;
    }
    function fxRows(M) {
        return M.lines.filter((l) => l.kind === "d").slice(0, 1500).map((L) => `<div class="fxrow"><input type="checkbox" data-fxsel="${L.i}" ${S.fx.sel.has(L.i) ? "checked" : ""} style="accent-color:#ff9a7a"><span class="ln">${L.i + 1}</span><span class="nm" title="${esc(L.name || L.text)}">${esc(L.name || "—")}</span><span class="tk">${L.tokens.map((t, k) => (L.name && k === 0) ? "" : t.num ? `<input class="num ${t.isF ? "f" : ""} ${t.v !== t.o ? "chg" : ""}" data-fxl="${L.i}" data-fxt="${k}" value="${esc(String(t.v !== t.o ? FX.fmtLike(t.v, t.txt) : t.txt))}">` : `<span class="tx">${esc(t.txt)}</span>`).join("")}</span></div>`).join("");
    }

    /* ============================ أدوات عامة ============================ */
    function toolsView() {
        if (!S.model) return `<div class="card pane" style="padding:34px;text-align:center;align-items:center"><div class="icon-tile" style="width:68px;height:68px;border-radius:20px">${ic("sliders")}</div><h3 style="color:#fff">افتح ملف Timecycle أولاً</h3><p style="color:var(--text-3);font-size:13px">الأدوات العامة تعمل على كل المعدّلات في الملف دفعة واحدة.</p><button class="btn btn-st" data-act="open">${ic("folder")}فتح XML</button></div>`;
        const cnt = (test) => S.model.mods.reduce((a, m) => a + m.tags.filter((t) => test.test(t.tag) && t.a !== 0).length, 0);
        const ch = [];
        S.model.mods.forEach((m, mi) => m.tags.forEach((t) => { if ((t.a !== t.oa || t.b !== t.ob) && ch.length < 400) ch.push({ m, mi, t }); }));
        return `<div class="pane">
            <div class="tools">${TC.GLOBAL_TOOLS.map((g) => { const n = cnt(g.test); return `<div class="card tool"><b>${esc(g.name)}</b><p>يضبط الوسوم المطابقة على 0 في كل المعدّلات. يوجد حالياً ${n} قيمة غير صفرية.</p><button class="btn btn-sm" data-act="gtool" data-id="${g.id}" ${n ? "" : "disabled"}>تطبيق على الكل</button></div>`; }).join("")}</div>
            <div class="card sect"><h4>${ic("layers")}تعديل وسم في كل المعدّلات</h4>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end"><div class="fld" style="flex:1;min-width:220px"><label>اسم الوسم</label><input class="inp ltr" id="bulkTag" list="tagdl2" placeholder="postfx_intensity_bloom"><datalist id="tagdl2">${TC.KNOWN_TAGS.map((k) => `<option value="${k}">`).join("")}</datalist></div>
                <div class="fld" style="width:110px"><label>القيمة / المعامل</label><input class="inp ltr" id="bulkVal" value="1"></div>
                <button class="btn btn-sm" data-act="bulkset">تعيين القيمة</button><button class="btn btn-sm" data-act="bulkmul">ضرب في المعامل</button></div>
                <small style="display:block;color:var(--text-3);font-size:11.5px;margin-top:8px" id="bulkInfo">يُعدّل الوسوم الموجودة فقط ولا يضيف وسوماً جديدة.</small></div>
            <div class="card sect"><h4>${ic("download")}استيراد معدّلات من ملف آخر</h4><p style="color:var(--text-3);font-size:12px;line-height:1.7;margin-bottom:10px">اختر ملف XML آخر (لمصمم آخر مثلاً) ثم حدّد المعدّلات التي تريد نسخها إلى ملفك. المعدّلات المتطابقة بالاسم تُتجاهل.</p><button class="btn btn-sm btn-st" data-act="importmods">${ic("upload")}اختيار ملف…</button></div>
            <div class="card"><div class="chrow" style="background:rgba(255,255,255,.03);direction:rtl"><b style="color:#fff">سجل التغييرات (${TC.changedCount(S.model)})</b><span class="t"></span>${S.struct ? `<span class="d">+ ${S.struct} عملية بنيوية (إضافة/حذف/نسخ)</span>` : ""}</div>
                <div class="chlist">${ch.length ? ch.map((c, i) => `<div class="chrow"><span class="m">${esc(c.m.name)}</span><span class="t">${esc(c.t.tag)}</span><span class="d">${TC.fmt(c.t.oa)} → ${TC.fmt(c.t.a)}</span><button data-act="revert" data-mi="${c.mi}" data-tg="${esc(c.t.tag)}" title="إرجاع">${ic("undo")}</button></div>`).join("") : '<div class="empty-line">لا توجد تعديلات في القيم بعد</div>'}</div></div></div>`;
    }

    /* ============================ الإجراءات ============================ */
    function loadXml(text, name) {
        const p = TC.parse(text); if (p.error) { toast("ملف غير مدعوم: " + p.error, "error", 5000); return false; }
        S.text = S.base = text; S.name = name; S.model = p; S.hist = []; S.struct = 0; rebase();
        S.sel = Math.max(0, p.mods.findIndex((m) => m.tags.length)); S.q = ""; S.filter = "all"; S.mod = S.mod === "fx" ? "tc" : S.mod;
        renderAll(); toast(`فُتح ${name} — ${p.mods.length} معدّل`); return true;
    }
    async function doOpen() { const r = await api.open(); if (r.canceled) return; if (!r.success) return toast(r.message || "تعذّر فتح الملف", "error"); loadXml(r.text, r.name); }
    async function doDetect() {
        const r = await api.detect(); if (!r.success) return toast(r.message, "error", 5000);
        if (!r.files.length) return toast("لم نجد ملفات timecycle داخل مجلد FiveM — استخدم «فتح»", "error", 5000);
        const d = dialog({ title: "ملفات Timecycle داخل FiveM", body: `<div style="display:flex;flex-direction:column;gap:6px">${r.files.map((f) => `<button class="btn" style="justify-content:flex-start;direction:ltr" data-tok="${esc(f.token)}">${ic("file")}${esc(f.rel)}</button>`).join("")}</div>` });
        d.body.addEventListener("click", async (e) => { const b = e.target.closest("[data-tok]"); if (!b) return; const o = await api.openToken(b.dataset.tok); d.close(); if (!o.success) return toast(o.message, "error"); loadXml(o.text, o.name); });
    }
    async function doSave() {
        if (!S.model) return;
        const out = TC.apply(S.text, S.model), v = TC.verify(out, S.model);
        if (!v.ok) return toast("لم يُحفظ الملف: " + v.why, "error", 6000);
        const r = await api.save(out); if (!r.success) return toast(r.message || "فشل الحفظ", "error", 5000);
        S.text = S.base = out; S.model = TC.parse(out); S.struct = 0; S.hist = []; rebase(); S.sel = Math.min(S.sel, S.model.mods.length - 1); renderAll(); toast("حُفظ الملف بعد التحقق ✓ — النسخة الأصلية محفوظة بجانبه");
    }
    async function askName(title, def) {
        return new Promise((res) => {
            const d = dialog({ title, body: `<div class="fld"><input class="inp ltr" id="nmIn" value="${esc(def || "")}" maxlength="60"></div>`, footer: '<button class="btn btn-st" id="nmOk">موافق</button><button class="btn" data-dlg="close">إلغاء</button>' });
            const go = () => { const v = d.el.querySelector("#nmIn").value.trim(); d.close(); res(v); };
            d.el.querySelector("#nmOk").addEventListener("click", go); d.el.querySelector("#nmIn").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }); d.el.querySelector("#nmIn").focus();
            d.el.addEventListener("click", (e) => { if (e.target.closest('[data-dlg="close"]') || e.target === d.el) res(""); });
        });
    }

    root.addEventListener("input", (e) => {
        if (S.mod === "tc") onTcInput(e);
        if (e.target.dataset && e.target.dataset.fxl != null) {
            const L = S.fx.model.lines[+e.target.dataset.fxl], t = L.tokens[+e.target.dataset.fxt], v = parseFloat(e.target.value);
            if (Number.isFinite(v)) { t.v = v; e.target.classList.toggle("chg", t.v !== t.o); updHead(); }
        }
        if (e.target.id === "fxRaw") { S.fx.text = e.target.value; }
    });
    root.addEventListener("change", (e) => {
        const el = e.target;
        if (S.mod === "tc" && (el.dataset.f === "pick" || el.dataset.f === "hex")) return;
        if (el.dataset && el.dataset.fxsel != null) { const i = +el.dataset.fxsel; if (el.checked) S.fx.sel.add(i); else S.fx.sel.delete(i); return; }
        if (el.id === "fxAll") { S.fx.sel = el.checked ? new Set(S.fx.model.lines.filter((l) => l.kind === "d").map((l) => l.i)) : new Set(); renderAll(); return; }
        if (el.id === "fxInts") { S.fx.ints = el.checked; return; }
        if (el.id === "fxCustom") { const v = parseFloat(el.value); if (Number.isFinite(v) && v >= 0 && v <= 20) fxApplyMult(v); return; }
        if (el.id === "fxRaw") { S.fx.model = FX.parse(el.value); S.fx.text = el.value; renderAll(); }
    });
    function fxApplyMult(x) { S.fx.mult = x; FX.reset(S.fx.model); const n = FX.scale(S.fx.model, x, S.fx.sel, S.fx.ints); renderAll(); toast(`×${x} على ${n} رقم`); }

    root.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-act]"); if (!b) return;
        const a = b.dataset.act, m = curMod();
        try {
            switch (a) {
                case "mod": S.mod = b.dataset.m; if (S.mod === "fx" && !S.fx.info) { renderAll(); fxDetect(true); } else renderAll(); break;
                case "open": await doOpen(); break;
                case "detect": await doDetect(); break;
                case "save": await doSave(); break;
                case "undo": undo(); break;
                case "sel": S.sel = +b.dataset.i; renderAll(); break;
                case "flt": S.filter = b.dataset.k; renderAll(); break;
                case "resetmod": if (m) { push(true); m.tags.forEach((t) => { t.a = t.oa; t.b = t.ob; }); renderAll(); } break;
                case "deltag": { const it = S.items[+b.closest(".row").dataset.i]; const tags = it.kind === "color" ? it.rgb.concat(it.alpha ? [it.alpha] : []) : [it.t]; structOp((tx, idx) => { let o = tx; tags.forEach((t) => { o = TC.removeTag(o, idx, t.tag); }); return o; }); break; }
                case "addtag": { const tg = $q("#addTag").value.trim(), v = parseFloat($q("#addVal").value); if (!/^[A-Za-z_]\w*$/.test(tg) || !Number.isFinite(v)) return toast("اسم الوسم أو القيمة غير صالحين", "error"); structOp((tx, idx) => TC.addTag(tx, idx, tg, v, 0)); break; }
                case "applytune": applyTune(); break;
                case "zerotune": S.tune = { bri: 100, sat: 100, con: 100, temp: 0 }; renderAll(); break;
                case "look": applyLook(b.dataset.id); break;
                case "newmod": { const n = await askName("اسم المعدّل الجديد", "CA_custom"); if (!n) break; structOp((tx) => TC.newModifier(tx, n)); S.sel = S.model.mods.length - 1; renderAll(); break; }
                case "clone": { const n = await askName("اسم النسخة", (m.name + "_copy").slice(0, 50)); if (!n) break; if (structOp((tx, idx) => TC.cloneModifier(tx, idx, n))) { S.sel = S.sel + 1; renderAll(); } break; }
                case "delmod": { if (!await askConfirm({ title: "حذف المعدّل", message: m.name, danger: true, confirmText: "حذف" })) break; structOp((tx, idx) => TC.deleteModifier(tx, idx)); S.sel = Math.min(S.sel, S.model.mods.length - 1); renderAll(); break; }
                case "gtool": { const g = TC.GLOBAL_TOOLS.find((x) => x.id === b.dataset.id); push(true); let n = 0; S.model.mods.forEach((mm) => mm.tags.forEach((t) => { if (g.test.test(t.tag) && t.a !== g.to) { t.a = g.to; n++; } })); renderAll(); toast(`${g.name}: عُدّلت ${n} قيمة`); break; }
                case "bulkset": case "bulkmul": {
                    const tg = $q("#bulkTag").value.trim(), v = parseFloat($q("#bulkVal").value); if (!tg || !Number.isFinite(v)) return toast("أدخل الوسم والقيمة", "error");
                    push(true); let n = 0; S.model.mods.forEach((mm) => mm.tags.forEach((t) => { if (t.tag === tg) { t.a = a === "bulkset" ? v : t.a * v; n++; } }));
                    if (!n) { S.hist.pop(); return toast("لا يوجد هذا الوسم في أي معدّل", "error"); } renderAll(); toast(`عُدّلت ${n} قيمة`); break; }
                case "revert": { const mm = S.model.mods[+b.dataset.mi]; if (mm) { push(true); mm.tags.forEach((t) => { if (t.tag === b.dataset.tg) { t.a = t.oa; t.b = t.ob; } }); renderAll(); } break; }
                case "importmods": await doImport(); break;
                /* BloodFX */
                case "fxdetect": await fxDetect(false); break;
                case "fxopen": { const r = await api.fx.open(b.dataset.n); if (!r.success) return toast(r.message, "error"); fxLoad(r.name, r.text, true); break; }
                case "fximport": { const r = await api.fx.import(); if (r.canceled) break; if (!r.success) return toast(r.message || "فشل الاستيراد", "error"); fxLoad(r.name, r.text, false); if (!S.fx.info) fxDetect(true); break; }
                case "fxmult": fxApplyMult(+b.dataset.x); break;
                case "fxreset": FX.reset(S.fx.model); S.fx.mult = 1; renderAll(); break;
                case "fxtoggleraw": S.fx.raw = !S.fx.raw; renderAll(); break;
                case "fxinstall": {
                    const name = ($q("#fxName") || {}).value || S.fx.name; const ta = $q("#fxRaw"); if (ta) S.fx.model = FX.parse(ta.value); const out = FX.build(S.fx.model);
                    if (!await askConfirm({ title: "تثبيت BloodFX", message: "سيُكتب الملف داخل مجلد effects في FiveM (وسيُنشأ المجلد إن لم يكن موجوداً).", details: [name, "أغلق FiveM قبل المتابعة", "تُحفظ نسخة من الأصل لاسترجاعه لاحقاً"], confirmText: "تثبيت" })) break;
                    const r = await api.fx.install(name, out); if (!r.success) return toast(r.message || "فشل التثبيت", "error", 5000);
                    toast("ثُبّت الملف ✓"); S.fx.name = name; await fxDetect(true); break; }
                case "fxrestore": {
                    const name = ($q("#fxName") || {}).value || S.fx.name;
                    if (!await askConfirm({ title: "استرجاع الأصل", message: name, details: ["سيُستبدل الملف الحالي بنسخة ما قبل أول تثبيت (أو يُحذف إن لم يكن موجوداً أصلاً)"], confirmText: "استرجاع" })) break;
                    const r = await api.fx.restore(name); if (!r.success) return toast(r.message || "فشل الاسترجاع", "error"); toast(r.removed ? "حُذف الملف المثبَّت (لم يكن موجوداً أصلاً)" : "استُرجع الملف الأصلي ✓"); S.fx.model = null; await fxDetect(true); break; }
            }
        } catch (er) { toast(er && er.message || "حدث خطأ", "error"); }
    });
    async function doImport() {
        const r = await api.pick(); if (r.canceled) return; if (!r.success) return toast(r.message || "فشل", "error");
        const p = TC.parse(r.text); if (p.error) return toast("ملف غير مدعوم: " + p.error, "error");
        const have = new Set(S.model.mods.map((x) => x.name.toLowerCase())), list = p.mods.filter((x) => !have.has(x.name.toLowerCase()));
        if (!list.length) return toast("كل معدّلات هذا الملف موجودة عندك مسبقاً", "error");
        const d = dialog({ title: `استيراد من ${r.name}`, wide: true, body: `<div style="margin-bottom:8px;display:flex;gap:8px"><button class="btn btn-sm" id="impAll">تحديد الكل</button><button class="btn btn-sm" id="impNone">إلغاء</button></div><div style="max-height:380px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px">${list.map((x, i) => `<label class="chrow" style="border:1px solid var(--line);border-radius:10px"><input type="checkbox" data-n="${esc(x.name)}" style="accent-color:#ff9a7a"><span class="t">${esc(x.name)}</span><span class="d">${x.tags.length}</span></label>`).join("")}</div>`, footer: '<button class="btn btn-st" id="impGo">استيراد المحدّد</button><button class="btn" data-dlg="close">إلغاء</button>' });
        d.el.querySelector("#impAll").onclick = () => d.el.querySelectorAll("[data-n]").forEach((c) => { c.checked = true; });
        d.el.querySelector("#impNone").onclick = () => d.el.querySelectorAll("[data-n]").forEach((c) => { c.checked = false; });
        d.el.querySelector("#impGo").onclick = () => {
            const names = [...d.el.querySelectorAll("[data-n]:checked")].map((c) => c.dataset.n); if (!names.length) return; d.close();
            let added = 0; if (structOp((tx) => { const o = TC.importMods(tx, r.text, names); added = o.added; return o.text; })) { toast(`استُورد ${added} معدّل`); S.mod = "tc"; renderAll(); }
        };
    }
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && S.mod === "tc" && !/textarea/i.test((e.target.tagName || ""))) { e.preventDefault(); undo(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && S.mod === "tc") { e.preventDefault(); doSave(); }
    });
    window.addEventListener("beforeunload", (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });

    window.CA.ready.then(renderAll);
    window.__studio = { S, loadXml, renderAll };
})();
