/* CA Studio — واجهة محرّر الطقس والسماء (تعمل فوق studio-wx.js) */
(function () {
    "use strict";
    const WX = window.WX;
    let H = null;                         // أدوات الصفحة المضيفة (init)
    const W = { model: null, text: "", base: "", name: "", cy: 0, rg: 0, sel: 0, key: 5, hour: 12, cat: "all", q: "", hist: [], lastPush: 0, scene: "auto", split: 0, list: [], view: "one", installAs: "", fresh: false };
    const cl = WX.clamp;
    const $ = (s) => H.root.querySelector(s);
    const region = () => W.model && W.model.cycles[W.cy].regions[W.rg];
    const isOn = () => H && H.mode() === "wx";

    /* ============ سجلّ التراجع ============ */
    const snap = () => W.model.cycles.map((c) => c.regions.map((r) => r.tags.map((t) => t.vals.slice())));
    const dirty = () => !!W.model && (W.fresh || W.text !== W.base || WX.changedCount(W.model) > 0);
    function push(force) { if (!W.model) return; const n = Date.now(); if (!force && n - W.lastPush < 700) return; W.lastPush = n; W.hist.push(snap()); if (W.hist.length > 40) W.hist.shift(); H.upd(); }
    function undo() {
        if (!W.hist.length) return H.toast("لا يوجد ما يُتراجع عنه", "error");
        const s = W.hist.pop(); W.model.cycles.forEach((c, ci) => c.regions.forEach((r, ri) => r.tags.forEach((t, ti) => { t.vals = s[ci][ri][ti].slice(); })));
        render();
    }

    /* ============ تحميل ============ */
    function load(text, name, opts) {
        const p = WX.parse(text); if (p.error) { H.toast("ملف غير مدعوم: " + p.error, "error", 5000); return false; }
        W.model = p; W.text = W.base = text; W.name = name; W.cy = 0; W.rg = Math.max(0, p.cycles[0].regions.findIndex((r) => r.tags.length)); W.hist = []; W.sel = 0; W.q = ""; W.cat = "all"; W.key = 5; W.hour = 12; W.installAs = (opts && opts.installAs) || ""; W.fresh = !!W.installAs;
        W.list = WX.items(region());
        const first = W.list.findIndex((it) => it.key === "sky_zenith_col"); W.sel = first >= 0 ? first : 0;
        const nt = p.cycles.reduce((a, c) => a + c.regions.reduce((b, r) => b + r.tags.length, 0), 0);
        H.setMode("wx"); H.toast(W.installAs ? `أُنشئ ${name} بقيمه الأساسية — عدّل ما تريد ثم اضغط «حفظ» ليُكتب في FiveM` : `فُتح ${name} — ${p.cycles.map((c) => c.name).join("، ")} · ${nt} وسم`); return true;
    }

    /* ============ العرض ============ */
    const curItem = () => W.list[W.sel];
    const tagsOf = (it) => it.ix.map((i) => region().tags[i]);
    const itemChanged = (it) => tagsOf(it).some((t) => t.vals.some((v, k) => v !== t.orig[k]));
    function emptyView() {
        const { ic } = H;
        return `<div class="card hero">
            <div class="hero-ic">${ic("sun")}</div>
            <h3>محرّر الطقس والسماء</h3>
            <p>عدّل ألوان السماء والغيوم والشمس والقمر والنجوم والضباب والإضاءة لكل طقس في اللعبة، وشاهد النتيجة قبل وبعد على لقطات حقيقية.</p>
            <div class="steps3"><div><i>1</i><b>ابدأ بملف</b><small>افتح ملف طقس موجود، أو اتركنا ننشئه لك</small></div><div><i>2</i><b>عدّل</b><small>اسحب المنحنى أو اكتب القيم وشاهد المعاينة</small></div><div><i>3</i><b>احفظ</b><small>يُكتب الملف في FiveM مع نسخة احتياطية</small></div></div>
            <div class="hero-act"><button class="btn btn-st" data-act="tplpick">${ic("plus")}إنشاء ملف طقس (أسهل طريقة)</button><button class="btn" data-act="open">${ic("folder")}فتح ملف من جهازي</button><button class="btn" data-act="detect">${ic("search")}كشف من FiveM</button></div>
            <small class="hero-note">مكان ملفات الطقس في اللعبة: <span class="ltr">citizen\\common\\data\\timecycle</span> — الأسماء مثل w_clear.xml وw_rain.xml</small>
        </div>`;
    }
    function listHtml() {
        const q = W.q.trim().toLowerCase(), out = [];
        W.list.forEach((it, i) => {
            if (W.cat !== "all" && it.cat !== W.cat) return;
            const ar = WX.arOf(it.key);
            if (q && !(it.key.toLowerCase().includes(q) || ar.includes(q))) return;
            if (out.length > 400) return;
            out.push(`<button class="mi ${i === W.sel ? "on" : ""}" data-wx="sel" data-i="${i}">${itemChanged(it) ? '<i class="dot"></i>' : ""}<span class="n">${H.esc(it.key)}${it.dup > 1 ? " #" + it.dup : ""}</span><em>${it.kind === "color" ? "لون" : ""}</em></button>`);
        });
        return out.join("") || `<div class="empty-line" style="padding:20px;color:var(--text-3);font-size:12.5px">لا نتائج</div>`;
    }
    function view() {
        if (!W.model) return emptyView();
        const { ic, esc } = H, cyc = W.model.cycles[W.cy];
        const nCh = WX.changedCount(W.model);
        return `<div class="tc wx">
            <div class="card tc-l">
                <div class="sr"><div data-tour="wx-search"><input class="inp" id="wxq" placeholder="ابحث (sky, cloud, سماء…)" value="${esc(W.q)}" style="direction:rtl"></div>
                    <div class="chips" data-tour="wx-cats" style="margin-top:6px">${[["all", "الكل"]].concat(WX.CATS.map((c) => [c[0], c[1]])).map(([k, l]) => `<button class="cchip ${W.cat === k ? "on" : ""}" data-wx="cat" data-k="${k}">${l}</button>`).join("")}</div>
                    <div data-tour="wx-region" style="display:flex;gap:6px;margin-top:8px;align-items:center">
                        ${W.model.cycles.length > 1 ? `<select class="sel" data-wx="cycle">${W.model.cycles.map((c, i) => `<option value="${i}" ${i === W.cy ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>` : `<span class="badge">${esc(cyc.name)}</span>`}
                        <select class="sel" data-wx="region" title="المنطقة">${cyc.regions.map((r, i) => `<option value="${i}" ${i === W.rg ? "selected" : ""}>${esc(r.name)} (${r.tags.length})</option>`).join("")}</select></div>
                    <small id="wxcount" style="color:var(--text-3);font-size:11px;display:block;margin-top:6px">${W.list.length} عنصر · ${nCh} وسم معدّل</small></div>
                <div class="mlist" id="wxlist" data-tour="wx-list">${listHtml()}</div>
                <div class="ft"><button class="btn btn-sm" data-wx="copyreg" title="ينسخ كل قيم هذه المنطقة إلى المناطق الأخرى في نفس الدورة">${ic("copy")}نسخ المنطقة للباقي</button><button class="btn btn-sm" data-wx="resetall">${ic("refresh")}إرجاع الكل</button></div>
            </div>
            <div class="tc-c" id="wxc">${centerHtml()}</div>
            <div class="tc-r">${previewHtml()}</div>
        </div>`;
    }

    /* ---- المركز: منحنى + مفاتيح ---- */
    const COLS = ["#ff6b6b", "#5fe08a", "#6aa8ff"];
    function chartParts(it) {
        const ts = tagsOf(it), w = 620, h = 190, px = 34, py = 14;
        let mn = Infinity, mx = -Infinity;
        ts.forEach((t) => t.vals.forEach((v) => { mn = Math.min(mn, v); mx = Math.max(mx, v); }));
        if (!Number.isFinite(mn)) { mn = 0; mx = 1; }
        if (mx - mn < 1e-6) { mx = mn + 1; }
        const pad = (mx - mn) * 0.12; mn -= pad; mx += pad;
        const X = (hr) => px + (hr / 24) * (w - px - 8), Y = (v) => py + (1 - (v - mn) / (mx - mn)) * (h - 2 * py);
        W._ch = { mn, mx, h, py, px, w };
        let g = "";
        for (let hr = 0; hr <= 24; hr += 3) g += `<line x1="${X(hr)}" x2="${X(hr)}" y1="${py}" y2="${h - py}" stroke="rgba(255,255,255,.06)"/><text x="${X(hr)}" y="${h - 1}" fill="#8a8a96" font-size="9" text-anchor="middle">${hr}</text>`;
        for (let i = 0; i <= 4; i++) { const v = mn + (mx - mn) * i / 4; g += `<line x1="${px}" x2="${w - 8}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.06)"/><text x="${px - 4}" y="${Y(v) + 3}" fill="#8a8a96" font-size="9" text-anchor="end">${+v.toFixed(2)}</text>`; }
        const colr = it.kind === "color";
        let lines = "", pts = "";
        ts.forEach((t, c) => {
            const col = colr ? COLS[c] : "#ffb15c";
            lines += `<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" points="${t.vals.map((v, k) => X(WX.KEYTIMES[k]) + "," + Y(v)).join(" ")}"/>`;
            t.vals.forEach((v, k) => { pts += `<circle class="wxpt ${k === W.key ? "on" : ""}" data-c="${c}" data-k="${k}" cx="${X(WX.KEYTIMES[k])}" cy="${Y(v)}" r="${k === W.key ? 6 : 4.5}" fill="${col}" stroke="#0c0c10" stroke-width="1.5"/>`; });
        });
        const hx = X(W.hour);
        return { w, h, inner: `${g}<line x1="${hx}" x2="${hx}" y1="${py}" y2="${h - py}" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 3"/>${lines}${pts}` };
    }
    function chartSvg(it) { const c = chartParts(it); return `<svg id="wxsvg" viewBox="0 0 ${c.w} ${c.h}" style="width:100%;height:auto;touch-action:none;direction:ltr">${c.inner}</svg>`; }
    function refreshChart() { const it = curItem(), svg = $("#wxsvg"); if (it && svg) svg.innerHTML = chartParts(it).inner; }
    function keysHtml(it) {
        const ts = tagsOf(it);
        const cells = WX.KEYTIMES.map((hr, k) => {
            const on = k === W.key ? "on" : "";
            if (it.kind === "color") {
                const c = ts.map((t) => t.vals[k]);
                return `<button class="wxk ${on}" data-wx="key" data-k="${k}"><small>${WX.hh(hr)}</small><i style="background:${WX.toHex(c[0], c[1], c[2])}"></i></button>`;
            }
            return `<div class="wxk ${on}" data-wx="key" data-k="${k}"><small>${WX.hh(hr)}</small><input class="num" data-wx="kv" data-k="${k}" value="${+ts[0].vals[k].toFixed(4)}"></div>`;
        }).join("");
        let edit = "";
        if (it.kind === "color") {
            const c = ts.map((t) => t.vals[W.key]), hex = WX.toHex(c[0], c[1], c[2]), over = c.some((x) => x > 1.0005);
            edit = `<div class="wxe"><b>المفتاح ${WX.hh(WX.KEYTIMES[W.key])}</b>
                <label class="sw" style="background:${hex}"><input type="color" data-wx="kc" value="${hex}"></label>
                <input class="hexi" data-wx="khex" value="${hex}" maxlength="7" spellcheck="false">
                ${c.map((x, i) => `<input class="num" data-wx="krgb" data-c="${i}" value="${WX.fmt4(x)}" title="${"RGB"[i]}" style="border-color:${COLS[i]}55">`).join("")}
                ${over ? `<small style="color:var(--warn)">قيمة أعلى من 1 (HDR)</small>` : ""}</div>`;
        }
        return `<div class="wxkeys">${cells}</div>${edit}`;
    }
    function centerHtml() {
        const it = curItem(); if (!it) return `<div class="card empty-line" style="padding:40px">اختر عنصراً من القائمة</div>`;
        const { ic, esc } = H, ar = WX.arOf(it.key);
        return `<div class="card sect">
            <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b class="ltr" style="color:#fff;font-size:15px">${esc(it.key)}${it.dup > 1 ? " #" + it.dup : ""}</b><div style="color:var(--text-3);font-size:12px;margin-top:3px">${esc(ar || (WX.CATS.find((c) => c[0] === it.cat) || [])[1] || "")} · ${it.kind === "color" ? "لون (R/G/B)" : "قيمة"}</div></div>
                <div class="wxtools" data-tour="wx-tools">
                    <button class="btn btn-sm" data-wx="op" data-op="scale" data-v="0.8">×0.8</button><button class="btn btn-sm" data-wx="op" data-op="scale" data-v="1.2">×1.2</button>
                    <button class="btn btn-sm" data-wx="op" data-op="offset" data-v="-0.1">−0.1</button><button class="btn btn-sm" data-wx="op" data-op="offset" data-v="0.1">+0.1</button>
                    <button class="btn btn-sm" data-wx="op" data-op="flat" title="يجعل كل اليوم بقيمة المفتاح المحدّد">تثبيت</button><button class="btn btn-sm" data-wx="op" data-op="smooth">تنعيم</button>
                    <button class="btn btn-sm" data-wx="op" data-op="shift" data-v="1" title="يزيح المنحنى مفتاحاً للأمام">⟶</button><button class="btn btn-sm" data-wx="op" data-op="shift" data-v="-1" title="يزيح المنحنى مفتاحاً للخلف">⟵</button>
                    <button class="btn btn-sm" data-wx="op" data-op="reset">${ic("undo")}أصل</button></div></div>
            <div class="wxchart" id="wxchart" data-tour="wx-chart">${chartSvg(it)}</div>
            <small style="color:var(--text-3);font-size:11.5px;display:block;margin:2px 0 8px">اسحب النقاط لتغيير القيمة${it.kind === "color" ? " (للألوان استخدم منتقي اللون أسفل المنحنى؛ الخطوط حمراء/خضراء/زرقاء)" : ""}. أوقات المفاتيح تقريبية.</small>
            <div id="wxkeys" data-tour="wx-keys">${keysHtml(it)}</div></div>`;
    }
    const ANCH = [["night", "الليل", 1], ["day", "النهار الصافي", 11.5], ["cloudy", "نهار غائم جزئياً", 14.5], ["sunset", "الغروب", 18], ["dusk", "الغسق", 19.5]];
    function previewHtml() {
        const { ic } = H;
        const one = W.view !== "all";
        return `<div class="card sect wxpv">
            <h4>${ic("eye")}المعاينة</h4>
            <div class="wxseg" data-tour="wx-view"><button class="${one ? "on" : ""}" data-wx="view" data-v="one">مشهد واحد</button><button class="${!one ? "on" : ""}" data-wx="view" data-v="all">كل المشاهد: قبل / بعد</button></div>
            <div id="wxOne" class="${one ? "" : "hidden"}">
                <canvas id="wxScene" width="960" height="420" style="width:100%;border-radius:12px;background:#000;display:block"></canvas>
                <div class="wxrow" data-tour="wx-time"><span class="wxl">الوقت</span><span id="wxTime" class="badge">${WX.hh(W.hour)}</span><input type="range" id="wxHour" min="0" max="24" step="0.25" value="${W.hour}" style="flex:1"></div>
                <div class="wxrow"><span class="wxl">المشهد</span>
                    <select class="sel" id="wxScene2"><option value="auto" ${W.scene === "auto" ? "selected" : ""}>تلقائي حسب الوقت</option>${ANCH.map(([k, l]) => `<option value="${k}" ${W.scene === k ? "selected" : ""}>${l}</option>`).join("")}</select>
                    <span class="wxl">قبل ◄► بعد</span><input type="range" id="wxSplit" min="0" max="100" value="${W.split}" style="width:100px" title="اسحب لترى الصورة الأصلية على اليسار والمعدّلة على اليمين"></div>
                <small class="wxhint">الجزء الأيسر من الصورة (عند سحب الشريط) هو الأصلي، والباقي هو ما بعد تعديلك.</small></div>
            <div id="wxAll" class="${one ? "hidden" : ""}">${ANCH.map(([k, l, h]) => `<div class="wxcmp"><div class="wxcmp-h"><b>${l}</b><span class="badge">${WX.hh(h)}</span></div><div class="wxcmp-p"><figure><canvas data-cmp="${k}" data-side="b" width="480" height="212"></canvas><figcaption>قبل (الأصل)</figcaption></figure><figure><canvas data-cmp="${k}" data-side="a" width="480" height="212"></canvas><figcaption class="aft">بعد (تعديلك)</figcaption></figure></div></div>`).join("")}</div>
            <canvas id="wxDome" width="640" height="170" style="width:100%;border-radius:12px;display:block;margin-top:10px"></canvas>
            <div id="wxdiff" data-tour="wx-diff">${diffHtml()}</div>
            <small class="wxhint">الصور لقطات حقيقية من اللعبة بدون مودات، ويُطبَّق عليها <b>فرق</b> تعديلك عن ملفك الأصلي، فهي تقريبية ولا تغني عن تجربة اللعبة. الشريط الملوّن أعلى الجدول يرسم السماء مباشرة من قيمك.</small>
        </div>`;
    }
    /* جدول: ما الذي تغيّر عند الوقت المختار */
    function diffRows(h) {
        const R = region(); if (!R) return []; const g = mkG(R), rows = [];
        const C = (label, base, inten) => { const f = (o) => { const c = g.col(base, h, o); if (!c) return null; const i = inten ? (g(inten, h, o) ?? 1) : 1; return c.map((v) => v * i); }; const a = f(false), b = f(true); if (a) rows.push({ label, col: true, a, b }); };
        const S1 = (label, tag) => { const a = g(tag, h, false), b = g(tag, h, true); if (a != null) rows.push({ label, a, b }); };
        C("لون قمة السماء", "sky_zenith_col", "sky_zenith_col_inten"); C("لون الأفق (شرق)", "sky_azimuth_east_col", "sky_azimuth_east_col_inten"); C("لون الأفق (غرب)", "sky_azimuth_west_col", "sky_azimuth_west_col_inten"); S1("سطوع السماء", "sky_hdr");
        C("لون وهج الشمس", "sky_sun_col"); S1("قوة تشتّت الشمس", "sky_sun_scatter_inten"); S1("حجم قرص الشمس", "sky_sun_disc_size");
        C("لون الغيوم", "sky_cloud_mid_col"); S1("كثافة الغيوم", "sky_cloud_density_mult"); S1("قوة الغيوم", "sky_cloud_overall_strength"); S1("سطوع النجوم", "sky_stars_iten"); S1("سطوع القمر", "sky_moon_iten");
        C("لون ضوء الشمس", "light_dir_col"); S1("قوة ضوء الشمس", "light_dir_mult"); S1("الإضاءة المحيطة", "light_directional_amb_intensity");
        C("لون الضباب", "fog_col"); S1("كثافة الضباب", "fog_density"); S1("التعريض", "postfx_exposure"); S1("التشبع", "postfx_desaturation"); S1("التوهّج", "postfx_intensity_bloom");
        return rows;
    }
    function diffHtml() {
        if (!W.model) return "";
        const rows = diffRows(W.hour), nz = (x) => Math.abs(x) < 5e-5;
        const sw = (c) => `<i class="dsw" style="background:${css(c, 1)}"></i>`;
        const delta = (r) => { if (r.col) { const l = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], a = l(r.a), b = l(r.b); if (r.a.every((v, i) => nz(v - r.b[i]))) return null; return b > 1e-4 ? (a - b) / b * 100 : 100; } if (nz(r.a - r.b)) return null; return Math.abs(r.b) > 1e-4 ? (r.a - r.b) / Math.abs(r.b) * 100 : (r.a > r.b ? 100 : -100); };
        const ch = rows.map((r) => ({ r, d: delta(r) })), n = ch.filter((x) => x.d != null).length;
        return `<div class="wxdiff-h"><b>ما الذي تغيّر عند ${WX.hh(W.hour)}؟</b><span class="badge ${n ? "warn" : ""}">${n ? n + " قيمة مختلفة" : "لا تغييرات في هذا الوقت"}</span></div>
            <div class="wxdiff">${ch.map(({ r, d }) => `<div class="drow ${d == null ? "same" : ""}"><span class="dl">${r.label}</span><span class="dv">${r.col ? sw(r.b) + "<em>←</em>" + sw(r.a) : `<code>${+r.b.toFixed(3)}</code><em>←</em><code>${+r.a.toFixed(3)}</code>`}</span><span class="dd ${d == null ? "" : d > 0 ? "up" : "dn"}">${d == null ? "—" : (d > 0 ? "+" : "") + Math.round(d) + "%"}</span></div>`).join("")}</div>`;
    }
    function drawCompare() {
        if (W.view !== "all") return;
        ANCH.forEach(([k, , h]) => {
            const sc = sceneData(k, () => requestPaint()); if (!sc) return; sc.name = k;
            const cb = H.root.querySelector(`canvas[data-cmp="${k}"][data-side="b"]`), ca = H.root.querySelector(`canvas[data-cmp="${k}"][data-side="a"]`); if (!cb || !ca) return;
            cb.width = ca.width = sc.w; cb.height = ca.height = sc.h;
            cb.getContext("2d").putImageData(sc.d, 0, 0);
            const P = params(h) || NONE, A = new ImageData(sc.w, sc.h); gradeInto(A, sc, P); ca.getContext("2d").putImageData(A, 0, 0);
        });
    }

    /* ============ المعاينة ============ */
    const PV = { scenes: {}, loading: {}, w: 960, raf: false };
    const SCENE_T = [["night", 0], ["sunset", 6], ["day", 11], ["cloudy", 14], ["sunset", 18], ["dusk", 19.5], ["night", 24]];
    function autoScene(h) {
        const r = [[4.5, "night"], [7.5, "sunset"], [12.5, "day"], [16.5, "cloudy"], [18.8, "sunset"], [21, "dusk"], [25, "night"]];
        for (const [lim, s] of r) if (h < lim) return s; return "night";
    }
    const horizon = (x) => x < 0.06 ? 0.30 : x < 0.12 ? 0.30 + (x - 0.06) / 0.06 * 0.04 : x < 0.2 ? 0.40 : x < 0.3 ? 0.40 + (x - 0.2) / 0.1 * 0.10 : x < 0.4 ? 0.5 + (x - 0.3) / 0.1 * 0.12 : x < 0.46 ? 0.62 + (x - 0.4) / 0.06 * 0.12 : 0.74;
    const sstep = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    function sceneData(name, cb) {
        if (PV.scenes[name]) return PV.scenes[name];
        if (PV.loading[name]) return null;
        const src = window.WX_PV && window.WX_PV[name]; if (!src) return null;
        PV.loading[name] = 1;
        const im = new Image();
        im.onload = () => {
            const w = PV.w, h = Math.round(w * im.height / im.width), c = document.createElement("canvas"); c.width = w; c.height = h;
            const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
            const d = g.getImageData(0, 0, w, h), sky = new Float32Array(w * h), rowL = new Float32Array(h), rowC = new Float32Array(h * 3), rowN = new Float32Array(h);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const s = 1 - sstep(horizon(x / w) - 0.025, horizon(x / w) + 0.012, y / h); sky[y * w + x] = s;
                if (s > 0.9) { const i = (y * w + x) * 4, r = d.data[i] / 255, gg = d.data[i + 1] / 255, b = d.data[i + 2] / 255; rowL[y] += 0.299 * r + 0.587 * gg + 0.114 * b; rowC[y * 3] += r; rowC[y * 3 + 1] += gg; rowC[y * 3 + 2] += b; rowN[y]++; }
            }
            for (let y = 0; y < h; y++) { const n = rowN[y] || 1; rowL[y] /= n; rowC[y * 3] /= n; rowC[y * 3 + 1] /= n; rowC[y * 3 + 2] /= n; if (!rowN[y] && y > 0) { rowL[y] = rowL[y - 1]; rowC[y * 3] = rowC[(y - 1) * 3]; rowC[y * 3 + 1] = rowC[(y - 1) * 3 + 1]; rowC[y * 3 + 2] = rowC[(y - 1) * 3 + 2]; } }
            PV.scenes[name] = { w, h, d, sky, rowL, rowC, sun: name === "sunset" ? { x: 0.577, y: 0.26 } : null };
            delete PV.loading[name]; if (cb) cb();
        };
        im.onerror = () => { delete PV.loading[name]; }; im.src = src; return null;
    }
    const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const ratio = (a, b, lo, hi) => (a == null || b == null) ? 1 : cl((Math.abs(a) + 0.02) / (Math.abs(b) + 0.02), lo || 0.2, hi || 4);
    /* قيم الصورة: نسب القيم الحالية إلى قيم الملف الأصلي عند الوقت المختار */
    function params(h) {
        const R = region(); if (!R) return null; const g = mkG(R);
        const P = {}, one = [1, 1, 1];
        const colI = (base, inten, o) => { const c = g.col(base, h, o); if (!c) return null; const i = inten ? (g(inten, h, o) ?? 1) : 1; return c.map((v) => v * i); };
        const cr = (a, b) => (a && b) ? a.map((v, i) => ratio(v, b[i], 0.25, 4)) : one;
        const dirC = (o) => { const c = g.col("light_dir_col", h, o), m = g("light_dir_mult", h, o); return c ? lum(c) * (m ?? 1) : 0; };
        const ambC = (o) => { const c = g.col("light_directional_amb_col", h, o), i = g("light_directional_amb_intensity", h, o); return c ? lum(c) * (i ?? 1) : 0; };
        const natC = (o) => { const c = g.col("light_natural_amb_up_col", h, o), i = g("light_natural_amb_up_intensity", h, o); return c ? lum(c) * (i ?? 0) : 0; };
        const L = (o) => dirC(o) * 0.8 + ambC(o) * 0.5 + natC(o) * 0.3;
        P.gain = cl(Math.pow((L(false) + 0.05) / (L(true) + 0.05), 0.6), 0.25, 3);
        const aC = (o) => g.col("light_directional_amb_col", h, o);
        const a1 = aC(false), a0 = aC(true);
        P.tint = (a1 && a0) ? a1.map((v, i) => cl(Math.pow(ratio(v / (lum(a1) + 1e-3), a0[i] / (lum(a0) + 1e-3), 0.6, 1.6), 0.5), 0.7, 1.4)) : one;
        const ex1 = g("postfx_exposure", h, false), ex0 = g("postfx_exposure", h, true);
        P.exp = (ex1 != null && ex0 != null) ? Math.pow(2, (ex1 - ex0) * 0.5) : 1;
        const ds1 = g("postfx_desaturation", h, false), ds0 = g("postfx_desaturation", h, true);
        P.sat = (ds1 != null && ds0 != null) ? cl(1 + (ds1 - ds0), 0, 2) : 1;
        P.corr = cr(g.col("postfx_correct_col", h, false), g.col("postfx_correct_col", h, true)).map((v) => cl(v, 0.5, 2));
        const z = (o) => colI("sky_zenith_col", "sky_zenith_col_inten", o), ae = (o) => colI("sky_azimuth_east_col", "sky_azimuth_east_col_inten", o), aw = (o) => colI("sky_azimuth_west_col", "sky_azimuth_west_col_inten", o);
        P.sky = cr(z(false), z(true));
        const hz = (o) => { const e = ae(o), w2 = aw(o); return e && w2 ? e.map((v, i) => (v + w2[i]) / 2) : null; };
        P.hor = cr(hz(false), hz(true));
        const hdr1 = g("sky_hdr", h, false), hdr0 = g("sky_hdr", h, true); P.hdr = ratio(hdr1, hdr0, 0.3, 3);
        P.cloud = cr(g.col("sky_cloud_mid_col", h, false), g.col("sky_cloud_mid_col", h, true));
        const dm = (o) => ((g("sky_cloud_density_mult", h, o) ?? 0.65) + 0.35) * (g("sky_cloud_overall_strength", h, o) ?? 1);
        P.dens = cl(ratio(dm(false), dm(true), 0.05, 3), 0, 3);
        const sc = (o) => { const c = g.col("sky_sun_col", h, o); return c ? lum(c) * (g("sky_sun_scatter_inten", h, o) ?? 1) * (g("sky_sun_hdr", h, o) ?? 1) : null; };
        P.sun = ratio(sc(false), sc(true), 0, 4);
        P.stars = ratio(g("sky_stars_iten", h, false), g("sky_stars_iten", h, true), 0.1, 4);
        const fd1 = g("fog_density", h, false), fd0 = g("fog_density", h, true);
        P.fog = (fd1 != null && fd0 != null) ? cl(Math.log2((Math.abs(fd1) + 1e-4) / (Math.abs(fd0) + 1e-4)), -2, 2) : 0;
        P.fogc = g.col("fog_col", h, false) || [0.6, 0.65, 0.7];
        return P;
    }
    const _gc = new WeakMap(); const mkG = (R) => { let c = _gc.get(R); if (!c || c.n !== R.tags.length) { c = { n: R.tags.length, g: WX.mkGet(R) }; _gc.set(R, c); } return c.g; };

    function gradeInto(out, sc, P) {
        const { w, h, d, sky, rowL, rowC } = sc, s = d.data, o = out.data, n = w * h;
        for (let p = 0; p < n; p++) {
            const i = p * 4, y = (p / w) | 0, sw = sky[p];
            let r = s[i] / 255, g = s[i + 1] / 255, b = s[i + 2] / 255;
            if (sw > 0.01) {
                const L0 = 0.299 * r + 0.587 * g + 0.114 * b, cw = cl(Math.abs(L0 - rowL[y]) / 0.2, 0, 1);
                const vf = y / (h * 0.75), mixv = cl(vf, 0, 1);
                const sr = [0, 1, 2].map((c) => (P.sky[c] * (1 - mixv) + P.hor[c] * mixv) * P.hdr);
                const wS = sw * (1 - cw), wC = sw * cw;
                r *= 1 + (sr[0] - 1) * wS; g *= 1 + (sr[1] - 1) * wS; b *= 1 + (sr[2] - 1) * wS;
                if (wC > 0) {
                    r *= 1 + (P.cloud[0] * P.hdr - 1) * wC; g *= 1 + (P.cloud[1] * P.hdr - 1) * wC; b *= 1 + (P.cloud[2] * P.hdr - 1) * wC;
                    if (P.dens < 1) { const f = wC * (1 - P.dens), rr = rowC[y * 3] * sr[0], rg = rowC[y * 3 + 1] * sr[1], rb = rowC[y * 3 + 2] * sr[2]; r += (rr - r) * f; g += (rg - g) * f; b += (rb - b) * f; }
                    else if (P.dens > 1) { const f = 1 + (P.dens - 1) * 0.25 * wC; r *= f; g *= f; b *= f; }
                }
                if (sc.name === "night" && P.stars !== 1 && L0 > rowL[y] * 1.5 + 0.03) { const f = 1 + (P.stars - 1) * sw; r *= f; g *= f; b *= f; }
            }
            const gn = P.gain * P.exp;
            r *= gn * P.tint[0] * P.corr[0]; g *= gn * P.tint[1] * P.corr[1]; b *= gn * P.tint[2] * P.corr[2];
            if (P.sat !== 1) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = l + (r - l) * P.sat; g = l + (g - l) * P.sat; b = l + (b - l) * P.sat; }
            if (P.fog !== 0) { const hz = Math.exp(-Math.pow((y / h - 0.72) / 0.12, 2)), f = cl(P.fog * 0.12, -0.3, 0.5) * hz; if (f > 0) { r += (P.fogc[0] - r) * f; g += (P.fogc[1] - g) * f; b += (P.fogc[2] - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; } }
            if (sc.sun && P.sun !== 1) { const dx = p % w / w - sc.sun.x, dy = y / h - sc.sun.y, gl = Math.exp(-(dx * dx + dy * dy) / 0.004); if (P.sun > 1) { const a = (P.sun - 1) * 0.35 * gl; r += a; g += a * 0.95; b += a * 0.8; } else { const f = 1 - (1 - P.sun) * 0.6 * gl; r *= f; g *= f; b *= f; } }
            o[i] = cl(r, 0, 1) * 255; o[i + 1] = cl(g, 0, 1) * 255; o[i + 2] = cl(b, 0, 1) * 255; o[i + 3] = 255;
        }
    }
    const NONE = { gain: 1, tint: [1, 1, 1], exp: 1, sat: 1, corr: [1, 1, 1], sky: [1, 1, 1], hor: [1, 1, 1], hdr: 1, cloud: [1, 1, 1], dens: 1, sun: 1, stars: 1, fog: 0, fogc: [1, 1, 1] };
    function drawScene() {
        const cv = $("#wxScene"); if (!cv || !W.model) return;
        const name = W.scene === "auto" ? autoScene(W.hour) : W.scene, sc = sceneData(name, () => requestPaint());
        const ctx = cv.getContext("2d");
        if (!sc) { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height); return; }
        sc.name = name; cv.height = sc.h;
        const P = params(W.hour) || NONE, A = new ImageData(sc.w, sc.h);
        gradeInto(A, sc, P); ctx.putImageData(A, 0, 0);
        const sx = Math.round(sc.w * W.split / 100);
        if (sx > 0) { const B = new ImageData(sc.w, sc.h); gradeInto(B, sc, NONE); ctx.putImageData(B, 0, 0, 0, 0, sx, sc.h); ctx.fillStyle = "#fff"; ctx.fillRect(sx - 1, 0, 2, sc.h); }
    }
    /* تمثيل مباشر للسماء من القيم نفسها */
    const tm = (v) => { v = Math.max(0, v); return cl(v / (1 + v * 0.6) * 1.25, 0, 1); };
    const css = (c, k) => `rgb(${Math.round(tm(c[0] * (k || 1)) * 255)},${Math.round(tm(c[1] * (k || 1)) * 255)},${Math.round(tm(c[2] * (k || 1)) * 255)})`;
    function drawDome() {
        const cv = $("#wxDome"); if (!cv || !W.model) return; const g = mkG(region()), h = W.hour, ctx = cv.getContext("2d"), w = cv.width, ht = cv.height;
        const I = (b, n) => { const c = g.col(b, h); if (!c) return null; const i = n ? (g(n, h) ?? 1) : 1; return c.map((v) => v * i); };
        const z = I("sky_zenith_col", "sky_zenith_col_inten"), zt = I("sky_zenith_transition_col", "sky_zenith_transition_col_inten"), at = I("sky_azimuth_transition_col", "sky_azimuth_transition_col_inten"), ae = I("sky_azimuth_east_col", "sky_azimuth_east_col_inten"), aw = I("sky_azimuth_west_col", "sky_azimuth_west_col_inten");
        const hdr = g("sky_hdr", h) ?? 10, k = cl(hdr / 10, 0.02, 3);
        const gr = ctx.createLinearGradient(0, 0, 0, ht);
        const hor = ae && aw ? ae.map((v, i) => (v + aw[i]) / 2) : (at || z || [0.2, 0.3, 0.5]);
        gr.addColorStop(0, css(z || hor, k)); gr.addColorStop(0.4, css(zt || z || hor, k)); gr.addColorStop(0.78, css(at || hor, k)); gr.addColorStop(1, css(hor, k));
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, ht);
        // نجوم
        const st = cl((g("sky_stars_iten", h) ?? 0) / 2, 0, 1);
        if (st > 0.01) { let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${(0.3 + rnd() * 0.7) * st})`; ctx.fillRect(rnd() * w, rnd() * ht * 0.7, 1.6, 1.6); } }
        // الشمس / القمر
        const day = h >= 5.5 && h <= 18.5, a = (h - 6) / 12 * Math.PI, sx = w * (0.5 - Math.cos(a) * 0.42), sy = ht * 0.92 - Math.sin(a) * ht * 0.8;
        if (day) {
            const gc = g.col("sky_sun_col", h) || [1, 0.9, 0.7], dc = g.col("sky_sun_disc_col", h) || [1, 1, 0.9], ds = cl((g("sky_sun_disc_size", h) ?? 1), 0.3, 8), sc = g("sky_sun_scatter_inten", h) ?? 1;
            const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 70 + sc * 30); rg.addColorStop(0, css(gc, 0.8)); rg.addColorStop(1, "rgba(0,0,0,0)"); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = rg; ctx.fillRect(0, 0, w, ht); ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = css(dc); ctx.beginPath(); ctx.arc(sx, sy, 5 + ds * 2.5, 0, 7); ctx.fill();
        } else {
            const mc = g.col("sky_moon_col", h) || [0.8, 0.85, 1], mi = cl(g("sky_moon_iten", h) ?? 1, 0.1, 3), ms = cl(g("sky_moon_disc_size", h) ?? 1, 0.3, 8), mxp = w * (0.5 + Math.cos(((h + 6) % 24) / 12 * Math.PI) * 0.35);
            ctx.fillStyle = css(mc, mi); ctx.beginPath(); ctx.arc(mxp, ht * 0.28, 5 + ms * 2.2, 0, 7); ctx.fill();
        }
        // غيوم
        const cm = g.col("sky_cloud_mid_col", h) || [0.8, 0.8, 0.8], cb = g.col("sky_cloud_base_col", h) || cm, ov = g("sky_cloud_overall_strength", h) ?? 1, dn = g("sky_cloud_density_mult", h) ?? 1;
        const amt = cl((dn + 0.35) * ov, 0, 1.4), chdr = g("sky_cloud_hdr", h) ?? 1;
        let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let i = 0; i < 16; i++) { const cx = rnd() * w, cy = ht * (0.12 + rnd() * 0.5), rx = 40 + rnd() * 70, ry = 10 + rnd() * 16, al = cl(amt * (0.35 + rnd() * 0.5), 0, 0.95);
            const gg = ctx.createLinearGradient(0, cy - ry, 0, cy + ry); gg.addColorStop(0, css(cm, chdr)); gg.addColorStop(1, css(cb, chdr)); ctx.globalAlpha = al; ctx.fillStyle = gg;
            for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(cx + (j - 1.5) * rx * 0.45, cy + (rnd() - 0.5) * ry * 0.5, rx * (0.5 + rnd() * 0.4), ry * (0.7 + rnd() * 0.5), 0, 0, 7); ctx.fill(); } }
        ctx.globalAlpha = 1;
        // ضباب الأفق
        const fc = g.col("fog_col", h), fdn = g("fog_density", h);
        if (fc && fdn != null) { const fg = ctx.createLinearGradient(0, ht * 0.55, 0, ht); fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(1, css(fc).replace("rgb", "rgba").replace(")", `,${cl(Math.log10(1 + Math.abs(fdn) * 400) * 0.45, 0, 0.8)})`)); ctx.fillStyle = fg; ctx.fillRect(0, 0, w, ht); }
        ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = "11px sans-serif"; ctx.fillText("تمثيل مباشر من القيم · " + WX.hh(h), 8, ht - 8);
    }
    function requestPaint() { if (PV.raf) return; PV.raf = true; requestAnimationFrame(() => { PV.raf = false; if (!isOn() || !W.model) return; drawScene(); drawDome(); drawCompare(); const d = H.root.querySelector("#wxdiff"); if (d) d.innerHTML = diffHtml(); }); }

    /* ============ تعديلات ============ */
    function afterEdit(full) {
        H.upd(); { const c = H.root.querySelector("#wxcount"); if (c) c.textContent = `${W.list.length} عنصر · ${WX.changedCount(W.model)} وسم معدّل`; }
        if (full) { render(); return; }
        refreshChart();
        const it = curItem(); const k = $("#wxkeys"); if (k && it) { const act = document.activeElement; if (!act || !k.contains(act)) k.innerHTML = keysHtml(it); }
        const l = $("#wxlist"); if (l) { const st = l.scrollTop; l.innerHTML = listHtml(); l.scrollTop = st; }
        requestPaint();
    }
    function render() { H.rerender(); }
    function setAt(it, k, vals) { it.ix.forEach((ti, c) => { region().tags[ti].vals[k] = vals[c]; }); }
    function after() { if (!isOn() || !W.model) return; bindChart(); requestPaint(); }
    function bindChart() {
        const svg = $("#wxsvg"); if (!svg) return;
        let drag = null;
        svg.addEventListener("pointerdown", (e) => {
            const p = e.target.closest(".wxpt"); if (!p) return; e.preventDefault(); svg.setPointerCapture(e.pointerId);
            drag = { c: +p.dataset.c, k: +p.dataset.k }; W.key = drag.k; W.hour = WX.KEYTIMES[drag.k]; push(true);
        });
        svg.addEventListener("pointermove", (e) => {
            if (!drag) return; const it = curItem(), ch = W._ch, r = svg.getBoundingClientRect();
            const y = (e.clientY - r.top) / r.height * ch.h; let v = ch.mn + (1 - (y - ch.py) / (ch.h - 2 * ch.py)) * (ch.mx - ch.mn);
            v = Math.round(v * 1000) / 1000; const t = region().tags[it.ix[drag.c]];
            if (it.kind === "color") v = cl(v, 0, 8);
            t.vals[drag.k] = v; if (drag.k === 0) t.vals[12] = v; if (drag.k === 12) t.vals[0] = v;
            const hr = $("#wxHour"); if (hr) { hr.value = W.hour; const tl = $("#wxTime"); if (tl) tl.textContent = WX.hh(W.hour); }
            afterEdit(false);
        });
        const end = () => { drag = null; };
        svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
    }

    function onClick(e) {
        if (!isOn() || !W.model) return;
        const b = e.target.closest("[data-wx]"); if (!b || b.tagName === "INPUT" || b.tagName === "SELECT") return;
        const a = b.dataset.wx, it = curItem();
        switch (a) {
            case "view": W.view = b.dataset.v; { const o = $("#wxOne"), a = $("#wxAll"); if (o) o.classList.toggle("hidden", W.view === "all"); if (a) a.classList.toggle("hidden", W.view !== "all"); document.querySelectorAll(".wxseg button").forEach((x) => x.classList.toggle("on", x.dataset.v === W.view)); } requestPaint(); break;
            case "sel": W.sel = +b.dataset.i; render(); break;
            case "cat": W.cat = b.dataset.k; { const l = $("#wxlist"); document.querySelectorAll(".wx .cchip").forEach((x) => x.classList.toggle("on", x.dataset.k === W.cat)); if (l) l.innerHTML = listHtml(); } break;
            case "key": if (e.target.tagName === "INPUT") break; W.key = +b.dataset.k; W.hour = WX.KEYTIMES[W.key]; { const hr = $("#wxHour"); if (hr) hr.value = W.hour; const tl = $("#wxTime"); if (tl) tl.textContent = WX.hh(W.hour); } { const k = $("#wxkeys"); if (k && it) k.innerHTML = keysHtml(it); refreshChart(); } requestPaint(); break;
            case "op": {
                if (!it) break; push(true); const ts = tagsOf(it), v = parseFloat(b.dataset.v);
                ts.forEach((t) => { switch (b.dataset.op) { case "scale": WX.ops.scale(t, v); break; case "offset": WX.ops.offset(t, v); break; case "flat": WX.ops.flat(t, W.key); break; case "smooth": WX.ops.smooth(t); break; case "reset": WX.ops.reset(t); break; case "shift": WX.ops.shiftKeys(t, v); break; } });
                if (it.kind === "color" && ["scale", "offset"].includes(b.dataset.op)) ts.forEach((t) => { t.vals = t.vals.map((x) => Math.max(0, x)); });
                afterEdit(true); break;
            }
            case "copyreg": {
                const c = W.model.cycles[W.cy], src = c.regions[W.rg]; if (c.regions.length < 2) { H.toast("لا توجد منطقة أخرى", "error"); break; }
                H.confirm({ title: "نسخ القيم", message: `ستُنسخ كل قيم «${src.name}» إلى باقي المناطق في ${c.name} (الوسوم المتطابقة بالاسم والترتيب).`, confirmText: "نسخ" }).then((ok) => {
                    if (!ok) return; push(true); let n = 0;
                    c.regions.forEach((r, ri) => { if (ri === W.rg) return; const cnt = new Map(), sc = new Map(); src.tags.forEach((t) => { const k = t.tag + "#" + (sc.set(t.tag, (sc.get(t.tag) || 0) + 1), sc.get(t.tag)); cnt.set(k, t); }); const seen = new Map(); r.tags.forEach((t) => { const k = t.tag + "#" + (seen.set(t.tag, (seen.get(t.tag) || 0) + 1), seen.get(t.tag)); const s = cnt.get(k); if (s && s.vals.length === t.vals.length) { t.vals = s.vals.slice(); n++; } }); });
                    H.toast(`نُسخت ${n} قيمة`); afterEdit(true);
                }); break;
            }
            case "resetall": H.confirm({ title: "إرجاع الكل", message: "ستعود كل القيم إلى ما في الملف عند آخر حفظ.", confirmText: "إرجاع" }).then((ok) => { if (!ok) return; push(true); W.model.cycles.forEach((c) => c.regions.forEach((r) => r.tags.forEach((t) => WX.ops.reset(t)))); afterEdit(true); }); break;
        }
    }
    function onInput(e) {
        if (!isOn() || !W.model) return; const el = e.target, it = curItem();
        if (el.id === "wxq") { W.q = el.value; const l = $("#wxlist"); if (l) l.innerHTML = listHtml(); return; }
        if (el.id === "wxHour") { W.hour = parseFloat(el.value); const tl = $("#wxTime"); if (tl) tl.textContent = WX.hh(W.hour); refreshChart(); requestPaint(); return; }
        if (el.id === "wxSplit") { W.split = +el.value; requestPaint(); return; }
        if (!it) return; const d = el.dataset.wx;
        if (d === "kv") { const v = parseFloat(el.value); if (!Number.isFinite(v)) return; push(false); const k = +el.dataset.k, t = tagsOf(it)[0]; t.vals[k] = v; if (k === 0) t.vals[12] = v; if (k === 12) t.vals[0] = v; W.key = k; afterEdit(false); }
        else if (d === "kc") { const c = WX.fromHex(el.value); if (!c) return; push(false); setAt(it, W.key, c); afterEdit(false); const x = $('[data-wx="khex"]'); if (x) x.value = el.value; if (el.parentElement) el.parentElement.style.background = el.value; }
        else if (d === "khex") { const c = WX.fromHex(el.value); if (!c) return; push(false); setAt(it, W.key, c); afterEdit(false); }
        else if (d === "krgb") { const v = parseFloat(el.value); if (!Number.isFinite(v)) return; push(false); region().tags[it.ix[+el.dataset.c]].vals[W.key] = Math.max(0, v); afterEdit(false); }
    }
    function onChange(e) {
        if (!isOn() || !W.model) return; const el = e.target, d = el.dataset && el.dataset.wx;
        if (el.id === "wxScene2") { W.scene = el.value; requestPaint(); }
        else if (d === "region") { W.rg = +el.value; W.list = WX.items(region()); W.sel = Math.min(W.sel, W.list.length - 1); render(); }
        else if (d === "cycle") { W.cy = +el.value; W.rg = Math.max(0, W.model.cycles[W.cy].regions.findIndex((r) => r.tags.length)); W.list = WX.items(region()); W.sel = 0; render(); }
        else if (d === "kv" || d === "krgb" || d === "khex" || d === "kc") { const it = curItem(); const k = $("#wxkeys"); if (k && it) k.innerHTML = keysHtml(it); }
    }

    /* ============ حفظ ============ */
    async function save(asCopy) {
        if (!W.model) return;
        const out = WX.apply(W.text, W.model), err = WX.verify(out, W.model);
        if (err) { H.toast("فشل التحقق قبل الحفظ: " + err + " — لم يُكتب شيء", "error", 6000); return; }
        let r;
        if (W.installAs && !asCopy) { r = await H.api.tpl.installWeather(W.installAs, out); if (r && r.noFivem) { H.toast(r.message, "info", 5000); r = await H.api.saveAs(out, true); W.installAs = ""; } }
        else r = asCopy ? await H.api.saveAs(out, true) : await H.api.save(out);
        if (r && r.canceled) return;
        if (!r || !r.success) { H.toast((r && r.message) || "فشل الحفظ", "error", 6000); return; }
        W.text = W.base = out; W.fresh = false; W.name = r.name || W.name;
        const p = WX.parse(out); if (!p.error) { W.model = p; W.list = WX.items(region()); }
        W.hist = []; H.toast(asCopy ? "حُفظت النسخة" : (W.installAs ? "كُتب الملف في مجلد FiveM (timecycle). أعد تشغيل اللعبة لرؤيته" : "تم الحفظ بعد التحقق") + (r.backup ? " · نسخة الأصل محفوظة" : "")); render();
    }
    function init(host) {
        H = host;
        const r = H.root;
        r.addEventListener("click", onClick); r.addEventListener("input", onInput); r.addEventListener("change", onChange);
        document.addEventListener("keydown", (e) => { if (!isOn()) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); e.stopImmediatePropagation(); save(false); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !/textarea|input/i.test(e.target.tagName || "")) { e.preventDefault(); e.stopImmediatePropagation(); undo(); } }, true);
    }
    window.WXUI = { init, load, view, after, dirty, undo, save, hasModel: () => !!W.model, name: () => W.name, histLen: () => W.hist.length, _W: W };
})();
