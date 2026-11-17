/* CA Studio — واجهة BloodFX المبسّطة: شرح الملف + اللون والمؤثرات + أنواع الإصابات (والمتقدم هو الجدول الخام) */
(function () {
    "use strict";
    const FX = window.FX; let H = null;
    const T = { tab: "guide", hex: "", alien: false, zero: false, row: -1, model: null, q: "" };
    const PRESETS = [["أحمر", [50, 0, 0]], ["أحمر قاني", [90, 0, 5]], ["داكن", [25, 0, 0]], ["أسود", [8, 8, 8]], ["أخضر", [0, 70, 10]], ["أزرق", [0, 20, 90]]];
    const hex2 = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const toHex = (a) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
    const W_AR = { "MELEE BLUNT": "ضرب بأداة صلبة", "MELEE SHARP": "سلاح حاد", "MELEE": "ضرب", "FIREARMS": "أسلحة نارية", "VEHICLE_HEAVY": "مركبات ثقيلة", "SMALL": "صغير", "MEDIUM": "متوسط", "LARGE": "كبير", "NECK": "الرقبة", "THROAT": "الحلق", "HEADSHOT": "طلقة رأس", "HEADSHOTFATAL": "طلقة رأس قاتلة", "HEADSHOTNONFATAL": "طلقة رأس غير قاتلة", "THIGH": "الفخذ", "SHOTGUN": "شوتغن", "SNIPER": "قنّاص", "NORMAL": "عادي", "SMALL PUNCH_KICK": "لكمة/ركلة", "EXPLOSION": "انفجار", "FIRE": "حريق", "RUBBER": "رصاص مطاطي", "STUNGUN": "صاعق", "LASER": "ليزر", "ROCKET": "صاروخ", "GRENADE": "قنبلة" };
    const WEAPONS = [["PUNCH_KICK", "لكمة/ركلة"], ["MELEE_WOOD", "سلاح خشبي"], ["MELEE_METAL", "سلاح معدني"], ["MELEE_SHARP", "سلاح حاد"], ["MELEE_GENERIC", "ضرب عام"], ["PISTOL_SMALL", "مسدس صغير"], ["PISTOL_LARGE", "مسدس كبير"], ["PISTOL_SILENCED", "مسدس كاتم"], ["RUBBER", "مطاطي"], ["SMG", "رشاش خفيف"], ["SHOTGUN", "شوتغن"], ["RIFLE_ASSAULT", "رشاش هجومي"], ["RIFLE_SNIPER", "قنّاص"], ["ROCKET", "صاروخ"], ["GRENADE", "قنبلة"], ["MOLOTOV", "مولوتوف"], ["FIRE", "حريق"], ["EXPLOSION", "انفجار"], ["LASER", "ليزر"], ["STUNGUN", "صاعق"], ["HEAVY_MG", "رشاش ثقيل"], ["VEHICLE_MG", "رشاش مركبات"], ["CLOWN", "مهرّج"], ["ALIEN", "فضائي"]];
    const ar = (k) => W_AR[k] ? `${W_AR[k]} (${k})` : k;

    /* ---- تجميع الصفوف مع عناوينها من تعليقات الملف ---- */
    function groups(M) {
        const out = []; let parent = "", sub = "", bar = 0;
        for (const L of M.lines) {
            if (L.kind !== "d" || !L.tokens || !L.tokens.length) {
                const t = (L.text || "").trim();
                if (/^#{10,}\s*$/.test(t)) { bar = bar === 2 ? 0 : 1; continue; }
                const m = /^#\s*([A-Z][A-Z0-9 _\[\]\-]*[A-Z0-9\]])\s*$/.exec(t);
                if (m && !/^(ID|DECALS|PROB)\b/.test(m[1])) { if (bar === 1) { parent = m[1].trim(); sub = ""; bar = 2; } else sub = m[1].trim(); }
                continue;
            }
            if (FX.isInfoRow(L)) out.push({ L, sec: L.sec === "BLOODFX_ENTRY_INFO" ? "entry" : "exit", parent, sub });
        }
        return out;
    }
    const rowTitle = (g) => `${g.L.tokens[0].o}` + (g.parent || g.sub ? " · " + [g.parent, g.sub].filter(Boolean).map((x) => W_AR[x] || x).join(" › ") : "");

    /* ---- التبويبات ---- */
    function tabs() {
        const { ic } = H;
        const T4 = [["guide", "help", "شرح الملف"], ["color", "drop", "اللون والمؤثرات"], ["types", "layers", "أنواع الإصابات"], ["adv", "sliders", "متقدم (أرقام خام)"]];
        return `<div class="fxtabs" data-tour="fx-tabs">${T4.map(([k, i, l]) => `<button class="${T.tab === k ? "on" : ""}" data-fxs="tab" data-k="${k}">${ic(i)}${l}</button>`).join("")}</div>`;
    }
    function content(M) {
        if (T.model !== M) { T.model = M; T.hex = FX.commonTint(M); T.row = -1; }
        return T.tab === "guide" ? guide(M) : T.tab === "color" ? colorFx(M) : T.tab === "types" ? types(M) : "";
    }
    const isAdv = () => T.tab === "adv";

    function guide(M) {
        const { ic, esc } = H, rows = FX.rowsInfo(M), en = rows.filter((L) => L.sec === "BLOODFX_ENTRY_INFO").length, ex = rows.length - en, nm = FX.names(M).size;
        return `<div class="card sect fxg-intro"><h4>${ic("help")}ما هو ملف bloodfx.dat؟</h4>
            <p>هذا الملف يتحكم في <b>كيف يظهر الدم</b> عند إصابة الشخصيات في اللعبة: لونه، وكميته، وأين يظهر، وأي مؤثرات (جسيمات) تتطاير معه.</p>
            <div class="flow"><div><i>1</i><b>السلاح + مكان الإصابة</b><small>جداول التوجيه (ALIVE/DEAD) تحدد لكل جزء من الجسم ولكل نوع سلاح <u>رقم تأثير</u></small></div><span>←</span><div><i>2</i><b>جرح الدخول</b><small>جدول ENTRY يصف شكل الدم عند دخول الإصابة (${en} نوع)</small></div><span>+</span><div><i>3</i><b>جرح الخروج</b><small>جدول EXIT يصف الدم عند خروج الرصاصة (${ex} نوع)</small></div></div></div>
            <div class="card sect"><h4>${ic("zap")}ماذا تريد أن تفعل؟</h4>
                <div class="goals">
                    <button data-fxs="tab" data-k="color"><span class="gi">${ic("drop")}</span><b>أغيّر لون الدم</b><small>أحمر، أسود، أخضر… لكل الجداول بضغطة واحدة</small></button>
                    <button data-fxs="tab" data-k="color"><span class="gi">${ic("sparkle")}</span><b>أغيّر مؤثرات الدم المتطاير</b><small>استبدال اسم مؤثر الجسم أو الرأس في كل أماكنه (${nm} اسم)</small></button>
                    <button data-fxs="tab" data-k="types"><span class="gi">${ic("layers")}</span><b>أعدّل إصابة معيّنة</b><small>مثل طلقة الرأس أو الشوتغن: احتمال الظهور واللون والملصقات</small></button>
                    <button data-fxs="tab" data-k="adv"><span class="gi">${ic("sliders")}</span><b>أريد التحكم الكامل</b><small>كل الأرقام الخام + مضاعف شدة عام + النص الخام</small></button></div></div>
            <div class="card sect"><h4>${ic("file")}أنواع الأسلحة التي يفرّق بينها الملف (${WEAPONS.length})</h4><div class="chips">${WEAPONS.map(([k, a]) => `<span class="cchip" title="${k}">${a}</span>`).join("")}</div>
                <small class="wxhint">جداول التوجيه تحدد لكل جزء من الجسم (الرأس، الرقبة، الصدر، الأطراف…) أي تأثير يظهر لكل سلاح من هذه القائمة. تعديلها يتم من تبويب «متقدم».</small></div>
            <div class="card sect"><h4>${ic("shield")}آمن للتجربة</h4><p>عند «تثبيت في FiveM» يحفظ البرنامج نسخة من ملفك الأصلي تلقائياً، ويمكنك الرجوع إليه بزر «استرجاع الأصل». أغلق FiveM قبل التثبيت.</p></div>`;
    }

    function colorFx(M) {
        const { ic, esc } = H;
        const nm = [...FX.names(M)].sort((a, b) => b[1] - a[1]);
        const dl = `<datalist id="fxNames">${nm.map(([n]) => `<option value="${esc(n)}">`).join("")}</datalist>`;
        return `<div class="card sect" data-tour="fx-color"><h4>${ic("drop")}لون الدم</h4>
            <p class="lead">اختر اللون ثم اضغط «تطبيق». يتغير لون الدم في كل أنواع الإصابات (ENTRY وEXIT). القيم تُحفظ بصيغة RGB من 0 إلى 255 كما يريدها الملف.</p>
            <div class="rowx"><label class="sw" style="background:${T.hex}"><input type="color" data-fxs="pick" value="${T.hex}"></label>
                <input class="hexi" data-fxs="hex" value="${T.hex}" maxlength="7" spellcheck="false" style="width:96px">
                <button class="btn btn-st" data-fxs="applytint">${ic("check")}تطبيق اللون</button></div>
            <div class="lbl">ألوان جاهزة</div>
            <div class="chips">${PRESETS.map(([l, c]) => `<button class="cchip" data-fxs="preset" data-c="${c.join(",")}"><i class="dotc" style="background:${toHex(c)}"></i>${l}</button>`).join("")}</div>
            <div class="opts"><label><input type="checkbox" data-fxs="alien" ${T.alien ? "checked" : ""}> تضمين المهرّج والفضائي (ID 900 و950)</label><label><input type="checkbox" data-fxs="zero" ${T.zero ? "checked" : ""}> تضمين الإصابات بدون لون أصلاً (0 0 0)</label></div>
            <canvas id="fxSplat" width="640" height="150" style="width:100%;border-radius:12px;margin-top:10px;background:#0d0d11;display:block"></canvas>
            <small class="wxhint">الرسم أعلاه تمثيل لوني تقريبي فقط؛ اللعبة تعرض الدم بنُسَج خاصة.</small></div>
            <div class="card sect" data-tour="fx-names"><h4>${ic("sparkle")}مؤثرات الجسيمات والأضرار (${nm.length})</h4>${dl}
                <p class="lead">كل اسم هنا هو مؤثر في اللعبة (دم متطاير، رذاذ، علامة ضرر…). اكتب اسماً جديداً ثم «استبدال» ليتغير في <b>كل أماكنه</b> دفعة واحدة. يجب أن يكون الاسم موجوداً في اللعبة وإلا لن يظهر المؤثر.</p>
                <div class="nmhead"><span>الاسم الحالي</span><span>مرات الاستخدام</span><span>الاسم الجديد</span><span></span></div>
                ${nm.map(([n, c]) => `<div class="nmrow"><span class="ltr nmv">${esc(n)}</span><span class="cnt">${c} مرة</span><input class="inp ltr" list="fxNames" data-fxs="to" data-from="${esc(n)}" placeholder="اكتب أو اختر…"><button class="btn btn-sm" data-fxs="rename" data-from="${esc(n)}">استبدال</button></div>`).join("")}</div>`;
    }

    function types(M) {
        const { ic, esc } = H, G = groups(M), q = T.q.trim().toLowerCase();
        const list = G.filter((g) => !q || rowTitle(g).toLowerCase().includes(q) || String(g.L.tokens[0].o).includes(q));
        const cur = G.find((g) => g.L.i === T.row) || null;
        const sec = (k, l) => { const a = list.filter((g) => g.sec === k); return a.length ? `<div class="tsec">${l} <em>${a.length}</em></div>` + a.map((g) => `<button class="mi ${cur && g.L.i === cur.L.i ? "on" : ""}" data-fxs="row" data-i="${g.L.i}"><span class="n">${esc(rowTitle(g))}</span></button>`).join("") : ""; };
        return `<div class="fxt"><div class="card tl"><div class="sr"><input class="inp" id="fxq" placeholder="ابحث (رأس، SHOTGUN، 105…)" value="${esc(T.q)}" style="direction:rtl"><small>${G.length} نوع إصابة</small></div><div class="mlist">${sec("entry", "جرح الدخول (ENTRY)") + sec("exit", "جرح الخروج (EXIT)") || '<div class="empty-line">لا نتائج</div>'}</div></div>
            <div class="card sect te">${cur ? rowEditor(cur) : `<div class="empty-pane">${ic("layers")}<b>اختر نوع إصابة من القائمة</b><small>كل نوع له رقم (ID) يربطه الملف بسلاح ومكان إصابة. عدّل احتمال ظهوره ولونه وملصقاته ومؤثراته.</small></div>`}</div></div>`;
    }
    const DECAL = ["بقعة (عادي)", "بقعة (مبتل)", "رذاذ (عادي)", "رذاذ (مبتل)", "ضباب (عادي)", "ضباب (مبتل)"];
    function rowEditor(g) {
        const { ic, esc } = H, L = g.L, tk = L.tokens, hex = toHex([tk[8].v, tk[9].v, tk[10].v]);
        const names = L.tokens.map((t, i) => ({ t, i })).filter((x) => !x.t.num && x.t.txt !== "-" || (!x.t.num));
        const nm = (x, lab) => `<div class="fld"><label>${lab}</label><input class="inp ltr" list="fxNames" data-fxs="nm" data-i="${L.i}" data-k="${x.i}" value="${esc(x.t.nt != null ? x.t.nt : x.t.txt)}"></div>`;
        return `<div class="te-h"><div><b>${esc(rowTitle(g))}</b><small>${g.sec === "entry" ? "جرح الدخول" : "جرح الخروج"} · السطر ${L.i + 1}</small></div></div>
            <div class="grid2">
                <div class="fld"><label>احتمال ظهور الدم (0 إلى 1)</label><div class="rowx"><input type="range" min="0" max="1" step="0.05" data-fxs="num" data-i="${L.i}" data-k="1" value="${tk[1].v}" style="flex:1"><input class="num" data-fxs="num" data-i="${L.i}" data-k="1" value="${tk[1].v}" style="width:70px"></div><small>1 = يظهر دائماً، 0.5 = في نصف الإصابات</small></div>
                <div class="fld"><label>لون الدم لهذا النوع</label><div class="rowx"><label class="sw" style="background:${hex}"><input type="color" data-fxs="rowtint" data-i="${L.i}" value="${hex}"></label><input class="hexi" data-fxs="rowtinthex" data-i="${L.i}" value="${hex}" maxlength="7" style="width:92px"></div><small>R G B: ${tk[8].v} ${tk[9].v} ${tk[10].v}</small></div></div>
            <div class="lbl">ملصقات الدم على الأسطح (أرقام Decal)</div>
            <div class="grid6">${DECAL.map((l, k) => `<div class="fld"><label>${l}</label><input class="num" data-fxs="num" data-i="${L.i}" data-k="${2 + k}" value="${tk[2 + k].v}"></div>`).join("")}</div>
            <small class="wxhint">0 = بدون ملصق. الأرقام تشير إلى ملصقات معرّفة في ملفات اللعبة الأخرى، فغيّرها فقط إن كنت تعرف الرقم المطلوب.</small>
            <div class="lbl">أسماء المؤثرات</div>
            <div class="grid2">${names.map((x, k) => nm(x, k < 4 ? `مؤثر جسيمات ${k + 1}` : `علامة ضرر ${k - 3}`)).join("") || "<small>لا توجد أسماء في هذا السطر</small>"}</div>
            <small class="wxhint">باقي الأعمدة (الأحجام والأعمار والمجسات…) تجدها في تبويب «متقدم» بنفس السطر ${L.i + 1}.</small>`;
    }

    function splat() {
        const cv = H.root.querySelector("#fxSplat"); if (!cv) return; const c = cv.getContext("2d"), w = cv.width, h = cv.height, rgb = hex2(T.hex) || [50, 0, 0];
        c.clearRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#15151a"); g.addColorStop(1, "#0b0b0e"); c.fillStyle = g; c.fillRect(0, 0, w, h);
        const k = 2.6, col = (a) => `rgba(${Math.min(255, rgb[0] * k + 25)},${Math.min(255, rgb[1] * k + 5)},${Math.min(255, rgb[2] * k + 5)},${a})`;
        let s = 5; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let i = 0; i < 4; i++) { const cx = 90 + i * 150 + rnd() * 30, cy = h / 2 + (rnd() - 0.5) * 30, r = 22 + rnd() * 18;
            for (let j = 0; j < 14; j++) { const a = rnd() * 6.28, d = rnd() * r * 1.5, rr = 3 + rnd() * r * 0.45; c.fillStyle = col(0.45 + rnd() * 0.45); c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, rr, 0, 7); c.fill(); }
            for (let j = 0; j < 9; j++) { const a = rnd() * 6.28, d = r * (1.4 + rnd() * 1.4); c.fillStyle = col(0.8); c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 1 + rnd() * 2.4, 0, 7); c.fill(); } }
    }
    const lineOf = (M, i) => M.lines[i];
    function init(host) {
        H = host; const r = H.root;
        r.addEventListener("input", (e) => {
            const el = e.target, d = el.dataset && el.dataset.fxs; if (!d) { if (el.id === "fxq") { T.q = el.value; const M = H.model(); if (M) { const f = r.querySelector(".fxt .mlist"); if (f) { const tmp = document.createElement("div"); tmp.innerHTML = types(M); f.innerHTML = tmp.querySelector(".mlist").innerHTML; } } } return; }
            const M = H.model(); if (!M) return;
            if (d === "pick") { T.hex = el.value; const x = r.querySelector('[data-fxs="hex"]'); if (x) x.value = T.hex; el.parentElement.style.background = T.hex; splat(); }
            else if (d === "hex" && hex2(el.value)) { T.hex = el.value.startsWith("#") ? el.value : "#" + el.value; splat(); }
            else if (d === "num") { const L = lineOf(M, +el.dataset.i), t = L.tokens[+el.dataset.k], v = parseFloat(el.value); if (!Number.isFinite(v)) return; t.v = +el.dataset.k === 1 ? Math.max(0, Math.min(1, v)) : v; r.querySelectorAll(`[data-fxs="num"][data-i="${el.dataset.i}"][data-k="${el.dataset.k}"]`).forEach((x) => { if (x !== el) x.value = t.v; }); H.upd(); }
            else if (d === "rowtint" || (d === "rowtinthex" && hex2(el.value))) { const rgb = hex2(el.value), L = lineOf(M, +el.dataset.i); [8, 9, 10].forEach((k, i) => { L.tokens[k].v = rgb[i]; }); if (d === "rowtint") { el.parentElement.style.background = el.value; const x = r.querySelector(`[data-fxs="rowtinthex"][data-i="${el.dataset.i}"]`); if (x) x.value = el.value; } H.upd(); }
            else if (d === "nm") { const L = lineOf(M, +el.dataset.i), t = L.tokens[+el.dataset.k], v = el.value.trim(); if (/^[\w\-.]{1,64}$/.test(v)) { t.nt = v; H.upd(); } }
        });
        r.addEventListener("change", (e) => { const d = e.target.dataset && e.target.dataset.fxs; if (d === "alien") T.alien = e.target.checked; else if (d === "zero") T.zero = e.target.checked; });
        r.addEventListener("click", (e) => {
            const b = e.target.closest("[data-fxs]"); if (!b || b.tagName === "INPUT") return; const M = H.model(); if (!M) return; const d = b.dataset.fxs;
            if (d === "tab") { T.tab = b.dataset.k; H.rerender(); }
            else if (d === "row") { T.row = +b.dataset.i; H.rerender(); }
            else if (d === "preset") { T.hex = toHex(b.dataset.c.split(",").map(Number)); H.rerender(); }
            else if (d === "applytint") { const rgb = hex2(T.hex); if (!rgb) return H.toast("لون غير صالح", "error"); const n = FX.setTint(M, rgb, { alien: T.alien, zero: T.zero }); H.toast(n ? `طُبّق اللون على ${n} نوع إصابة` : "لا توجد صفوف مطابقة", n ? "success" : "error"); H.rerender(); }
            else if (d === "rename") { const inp = r.querySelector(`[data-fxs="to"][data-from="${CSS.escape(b.dataset.from)}"]`), to = inp ? inp.value : ""; const n = FX.rename(M, b.dataset.from, to); if (n < 0) return H.toast("اسم غير صالح (حروف وأرقام و _ - . فقط)", "error"); H.toast(`استُبدل في ${n} موضع`, "success"); H.rerender(); }
        });
    }
    window.FXUI = { init, tabs, content, isAdv, after: splat, isBlood: (M) => FX.isBlood(M) };
})();
