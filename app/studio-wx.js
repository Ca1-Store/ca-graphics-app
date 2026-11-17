/* CA Studio — محرّر ملفات الطقس (timecycle_keyframe_data: w_*.xml / underwater_*.xml)
   كل وسم = 13 قيمة على مدار اليوم. التعديل نصّي: تتغيّر الأرقام المعدّلة فقط وتبقى التعليقات والمسافات كما هي.
   لا تحتوي هذه الوحدة على أي قيم جاهزة: كل القيم تأتي من الملف الذي يفتحه المستخدم. */
(function () {
    "use strict";
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const NUMRE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
    /* أوقات المفاتيح الـ13 (تقريبية: الشائع في timecycle GTA V) */
    const KEYTIMES = [0, 5, 6, 7, 9, 12, 16, 17, 18, 19, 20, 21, 24];
    const hh = (h) => { const x = Math.round(h * 60) % 1440; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };
    function fmt4(n) { if (!Number.isFinite(n)) n = 0; let s = n.toFixed(4); return s === "-0.0000" ? "0.0000" : s; }
    const mask = (t) => t.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));
    const isWeather = (text) => /<timecycle_keyframe_data\b/.test(String(text || "").slice(0, 4000));

    /* ---------- قراءة ---------- */
    function parse(text) {
        const m = mask(text);
        if (!/<timecycle_keyframe_data\b/.test(m)) return { error: "ليس ملف طقس (timecycle_keyframe_data)" };
        const cycles = [];
        const cre = /<cycle\b([^>]*)>/g; let cm;
        while ((cm = cre.exec(m))) {
            const cEnd = m.indexOf("</cycle>", cre.lastIndex); if (cEnd < 0) return { error: "وسم cycle بلا إغلاق" };
            const cyc = { name: (/name\s*=\s*"([^"]*)"/.exec(cm[1]) || [, "?"])[1], regions: [] };
            const body = m.slice(cre.lastIndex, cEnd), base = cre.lastIndex;
            const rre = /<region\b([^>]*)>/g; let rm;
            while ((rm = rre.exec(body))) {
                const rEnd = body.indexOf("</region>", rre.lastIndex); if (rEnd < 0) return { error: "وسم region بلا إغلاق" };
                const reg = { name: (/name\s*=\s*"([^"]*)"/.exec(rm[1]) || [, "?"])[1], tags: [] };
                const rb = body.slice(rre.lastIndex, rEnd), rbase = base + rre.lastIndex;
                const tre = /<([A-Za-z_][\w]*)>([^<]*)<\/\1>/g; let t;
                while ((t = tre.exec(rb))) {
                    const parts = t[2].trim().split(/\s+/).filter(Boolean);
                    if (!parts.length || parts.some((p) => !NUMRE.test(p))) continue;
                    const vs = rbase + t.index + t[1].length + 2;
                    const vals = parts.map(num);
                    reg.tags.push({ tag: t[1], vals, orig: vals.slice(), start: vs, end: vs + t[2].length, raw: t[2] });
                }
                cyc.regions.push(reg); rre.lastIndex = rEnd + 9;
            }
            cycles.push(cyc); cre.lastIndex = cEnd + 8;
        }
        if (!cycles.length || !cycles.some((c) => c.regions.some((r) => r.tags.length))) return { error: "لا توجد وسوم قيم داخل الملف" };
        return { cycles };
    }

    /* ---------- كتابة: نستبدل الأرقام التي تغيّرت فقط ---------- */
    function apply(text, model) {
        const reps = [];
        for (const c of model.cycles) for (const r of c.regions) for (const t of r.tags) {
            if (!t.vals.some((v, i) => v !== t.orig[i])) continue;
            let k = 0;
            const out = t.raw.replace(/\S+/g, (tok) => { const i = k++; return t.vals[i] !== t.orig[i] ? fmt4(t.vals[i]) : tok; });
            reps.push({ s: t.start, e: t.end, v: out });
        }
        reps.sort((a, b) => b.s - a.s);
        let out = text; for (const r of reps) out = out.slice(0, r.s) + r.v + out.slice(r.e);
        return out;
    }
    /* تحقق: إعادة القراءة تعطي نفس القيم وبنفس البنية */
    function verify(text, model) {
        const p = parse(text); if (p.error) return p.error;
        if (p.cycles.length !== model.cycles.length) return "اختلف عدد الدورات";
        for (let ci = 0; ci < p.cycles.length; ci++) {
            const a = p.cycles[ci], b = model.cycles[ci];
            if (a.regions.length !== b.regions.length) return "اختلف عدد المناطق";
            for (let ri = 0; ri < a.regions.length; ri++) {
                const x = a.regions[ri].tags, y = b.regions[ri].tags;
                if (x.length !== y.length) return "اختلف عدد الوسوم";
                for (let i = 0; i < x.length; i++) {
                    if (x[i].tag !== y[i].tag || x[i].vals.length !== y[i].vals.length) return "اختلف الوسم " + y[i].tag;
                    for (let k = 0; k < x[i].vals.length; k++) if (Math.abs(x[i].vals[k] - y[i].vals[k]) > 0.00006) return "قيمة غير مطابقة في " + y[i].tag;
                }
            }
        }
        return "";
    }
    const changedCount = (model) => model.cycles.reduce((n, c) => n + c.regions.reduce((m, r) => m + r.tags.filter((t) => t.vals.some((v, i) => v !== t.orig[i])).length, 0), 0);

    /* ---------- تصنيف وتجميع ---------- */
    const CATS = [
        ["sky", "السماء", /^sky_(zenith|azimuth|hdr|plane)/],
        ["sun", "الشمس", /^(sky_sun|sun_)/],
        ["moon", "القمر والنجوم", /^(sky_moon|sky_stars|moon_|sprite_|Lensflare)/],
        ["cloud", "الغيوم", /^(sky_cloud|sky_small_cloud)/],
        ["cshadow", "ظلال الغيوم", /^cloud_shadow/],
        ["light", "الإضاءة", /^(light_|natural_|artificial_|ped_light|ssao|dir_shadow|shadow_|particle_|vfxlightning)/],
        ["fog", "الضباب", /^(fog|environmental_)/],
        ["post", "المعالجة (PostFX)", /^(postfx_|lens_|chrom_|blur_|screen_|dof_|bokeh_)/],
        ["water", "الماء والانعكاس", /^(water_|reflection_|mirror_)/],
        ["night", "الرؤية الليلية والحرارة", /^(nv_|hh_)/],
        ["other", "أخرى", /./],
    ];
    const catOf = (tag) => { for (const c of CATS) if (c[2].test(tag)) return c[0]; return "other"; };
    function items(region) {
        const idx = new Map(); region.tags.forEach((t, i) => { if (!idx.has(t.tag)) idx.set(t.tag, []); idx.get(t.tag).push(i); });
        const used = new Set(), out = [], seen = new Map();
        region.tags.forEach((t, i) => {
            if (used.has(i)) return;
            const m = /^(.*)_([rgb])$/.exec(t.tag);
            if (m && m[2] === "r" && idx.has(m[1] + "_g") && idx.has(m[1] + "_b")) {
                const g = idx.get(m[1] + "_g").find((j) => j > i && !used.has(j)), b = idx.get(m[1] + "_b").find((j) => j > i && !used.has(j));
                if (g != null && b != null) { used.add(i); used.add(g); used.add(b); out.push({ key: m[1], kind: "color", ix: [i, g, b], cat: catOf(m[1]) }); return; }
            }
            used.add(i);
            const n = (seen.get(t.tag) || 0) + 1; seen.set(t.tag, n);
            out.push({ key: t.tag, dup: n, kind: "scalar", ix: [i], cat: catOf(t.tag) });
        });
        return out;
    }

    /* ---------- أدوات القيم ---------- */
    function at(vals, h) {
        h = clamp(h, 0, 24);
        if (vals.length !== KEYTIMES.length) return vals[Math.min(vals.length - 1, Math.round(h / 24 * (vals.length - 1)))];
        for (let i = 0; i < 12; i++) if (h <= KEYTIMES[i + 1]) { const f = (h - KEYTIMES[i]) / ((KEYTIMES[i + 1] - KEYTIMES[i]) || 1); return vals[i] + (vals[i + 1] - vals[i]) * f; }
        return vals[12];
    }
    function mkGet(region) {
        const map = new Map(); region.tags.forEach((t) => { if (!map.has(t.tag)) map.set(t.tag, t); });
        const f = (name, h, orig) => { const t = map.get(name); return t ? at(orig ? t.orig : t.vals, h) : null; };
        f.has = (n) => map.has(n);
        f.col = (base, h, orig) => { const r = f(base + "_r", h, orig), g = f(base + "_g", h, orig), b = f(base + "_b", h, orig); return r == null ? null : [r, g, b]; };
        return f;
    }
    const toHex = (r, g, b) => { const h = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0"); return "#" + h(r) + h(g) + h(b); };
    const fromHex = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return null; const n = parseInt(m[1], 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

    /* عمليات على منحنى (وسم واحد أو مجموعة وسوم للون) */
    const ops = {
        scale: (t, f) => { t.vals = t.vals.map((v) => v * f); },
        offset: (t, d) => { t.vals = t.vals.map((v) => v + d); },
        flat: (t, k) => { const v = t.vals[k]; t.vals = t.vals.map(() => v); },
        smooth: (t) => { const a = t.vals, o = a.slice(); for (let i = 1; i < a.length - 1; i++) o[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4; t.vals = o; },
        reset: (t) => { t.vals = t.orig.slice(); },
        /* إزاحة زمنية: تدوير المفاتيح (مع إبقاء أول وآخر مفتاح متطابقين كما في الملفات) */
        shiftKeys: (t, n) => { const a = t.vals.slice(0, -1), L = a.length, o = a.map((_, i) => a[((i - n) % L + L) % L]); t.vals = o.concat([o[0]]); },
    };

    /* ---------- أسماء عربية للوسوم المهمة ---------- */
    const AR = {
        sky_zenith_col: "لون قمة السماء", sky_zenith_col_inten: "شدّة لون قمة السماء", sky_zenith_transition_col: "لون الانتقال (علوي)", sky_zenith_transition_position: "موضع الانتقال العلوي",
        sky_azimuth_east_col: "لون الأفق شرقاً", sky_azimuth_west_col: "لون الأفق غرباً", sky_azimuth_transition_col: "لون الانتقال عند الأفق", sky_hdr: "سطوع السماء (HDR)", sky_plane: "لون مستوى السماء",
        sky_sun_col: "لون وهج الشمس", sky_sun_disc_col: "لون قرص الشمس", sky_sun_disc_size: "حجم قرص الشمس", sky_sun_hdr: "سطوع الشمس", sky_sun_scatter_inten: "تشتّت ضوء الشمس", sky_sun_influence_radius: "نطاق تأثير الشمس",
        sky_moon_col: "لون القمر", sky_moon_disc_size: "حجم القمر", sky_moon_iten: "سطوع القمر", sky_stars_iten: "سطوع النجوم",
        sky_cloud_mid_col: "لون الغيوم (الوسط)", sky_cloud_base_col: "لون قاعدة الغيوم", sky_cloud_shadow_col: "لون ظلّ الغيوم", sky_cloud_density_mult: "كثافة الغيوم", sky_cloud_density_bias: "انحياز الكثافة",
        sky_cloud_overall_strength: "قوة الغيوم الكلية", sky_cloud_hdr: "سطوع الغيوم", sky_cloud_edge_strength: "قوة حواف الغيوم", sky_cloud_gen_frequency: "تردد تكوّن الغيوم", sky_cloud_gen_scale: "حجم تكوّن الغيوم",
        sky_cloud_gen_threshold: "عتبة ظهور الغيوم", sky_cloud_gen_softness: "نعومة الغيوم", sky_small_cloud_col: "لون الغيوم الصغيرة", sky_small_cloud_density_mult: "كثافة الغيوم الصغيرة",
        cloud_shadow_density: "كثافة ظلال الغيوم", cloud_shadow_softness: "نعومة ظلال الغيوم", cloud_shadow_opacity: "شفافية ظلال الغيوم",
        light_dir_col: "لون الضوء الموجّه (الشمس)", light_dir_mult: "قوة الضوء الموجّه", light_directional_amb_col: "لون الإضاءة المحيطة الموجّهة", light_directional_amb_intensity: "شدّة الإضاءة المحيطة الموجّهة",
        light_natural_amb_down_col: "محيطة طبيعية (من الأسفل)", light_natural_amb_up_col: "محيطة طبيعية (من الأعلى)", natural_ambient_multiplier: "مضاعف الإضاءة الطبيعية", artificial_int_ambient_multiplier: "مضاعف الإضاءة الداخلية",
        fog_col: "لون الضباب", fog_near_col: "لون الضباب القريب", fog_density: "كثافة الضباب", fog_start: "بداية الضباب", fog_haze_col: "لون الغبش", fog_haze_density: "كثافة الغبش", fog_moon_col: "لون ضباب القمر", fog_east_col: "لون ضباب الشرق",
        postfx_exposure: "التعريض", postfx_intensity_bloom: "قوة التوهّج", postfx_desaturation: "التشبع (1 عادي)", postfx_correct_col: "لون التصحيح", postfx_shift_col: "لون إزاحة الظلال", postfx_noise: "الحبيبات (Noise)",
        ssao_inten: "قوة الظلال الملامسة (SSAO)", dir_shadow_softness: "نعومة الظلال", shadow_distance_mult: "مسافة الظلال", lod_mult: "مسافة الرسم", wind_speed_mult: "سرعة الرياح", temperature: "درجة الحرارة",
        water_specular_intensity: "لمعان الماء", water_foam_intensity_mult: "رغوة الماء", sun_direction_x: "اتجاه الشمس X", sun_direction_y: "اتجاه الشمس Y", sun_direction_z: "اتجاه الشمس Z",
    };
    const arOf = (k) => AR[k] || "";

    window.WX = { KEYTIMES, hh, isWeather, parse, apply, verify, changedCount, items, CATS, at, mkGet, toHex, fromHex, ops, arOf, fmt4, clamp };
})();
