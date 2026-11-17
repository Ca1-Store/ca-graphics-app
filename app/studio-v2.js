/* CA Studio — الشرح التفاعلي (Tutorial) + نافذة إنشاء الملفات من القوالب */
(function () {
    "use strict";
    let H = null;
    const $a = (s) => Array.from(document.querySelectorAll(s));
    /* ---------- خطوات الشرح ---------- */
    const COMMON = [
        ["tabs", "الأقسام الأربعة", "من هنا تنتقل بين أدوات الاستوديو: Timecycle لألوان الشاشة، الطقس والسماء، BloodFX للدم، وأدوات عامة للتعديل الجماعي."],
        ["file", "الملف الحالي", "اسم الملف المفتوح. إذا ظهرت بجانبه «تعديلات غير محفوظة» فمعناها أنك غيّرت شيئاً ولم تحفظه بعد."],
        ["open", "فتح ملف", "افتح ملفاً موجوداً على جهازك (XML أو DAT) لتعديله."],
        ["create", "إنشاء ملف", "ليس لديك الملف؟ اضغط هنا وسينشئه البرنامج لك من قالب جاهز، وعند الحفظ يُكتب مباشرة في مجلد FiveM الصحيح."],
        ["detect", "كشف من FiveM", "يبحث البرنامج بنفسه عن ملفاتك داخل مجلد FiveM فلا تحتاج لمعرفة المسار."],
        ["undo", "تراجع", "يلغي آخر تعديل. اختصاره Ctrl+Z."],
        ["saveas", "حفظ كنسخة", "يحفظ تعديلاتك في ملف جديد من اختيارك دون أن يمس الأصل."],
        ["save", "حفظ", "يتحقق أن الملف سليم ثم يكتبه، ويحتفظ بنسخة من الأصل لتسترجعها لاحقاً. اختصاره Ctrl+S."],
    ];
    const STEPS = {
        wx: [
            ["wx-search", "البحث", "اكتب اسم الوسم بالإنجليزية (مثل sky_zenith) أو كلمة عربية (مثل سماء، غيوم) لتجده بسرعة."],
            ["wx-cats", "التصنيفات", "اضغط تصنيفاً (السماء، الشمس، الغيوم، الضباب…) لتعرض عناصره فقط."],
            ["wx-region", "المنطقة", "GLOBAL هي الطقس العام، والمناطق الأخرى (مثل URBAN) تُطبّق داخل المدن. عدّل المنطقة التي تريد."],
            ["wx-list", "قائمة العناصر", "كل عنصر يخص جزءاً من المشهد. النقطة الملونة بجانب العنصر تعني أنك عدّلته."],
            ["wx-tools", "أدوات المنحنى", "×1.2 يضخّم كل اليوم، +0.1 يرفع القيم، «تثبيت» يجعل اليوم كله بقيمة المفتاح المحدد، «تنعيم» يلين القفزات، والأسهم تزيح الوقت، و«أصل» يرجع الأصلي."],
            ["wx-chart", "منحنى اليوم", "المحور الأفقي هو ساعات اليوم والعمودي هو القيمة. اسحب أي نقطة لأعلى أو أسفل لتغيّر القيمة في ذلك الوقت."],
            ["wx-keys", "مفاتيح الوقت", "كل مربع وقت معيّن من اليوم. اضغطه ثم غيّر رقمه أو لونه بدقة. المعاينة تنتقل لذلك الوقت تلقائياً."],
            ["wx-view", "طريقة العرض", "«مشهد واحد» يعرض لقطة كبيرة. «كل المشاهد» يعرض الليل والنهار والغروب وغيرها، كلٌّ منها قبل وبعد التعديل جنباً إلى جنب."],
            ["wx-time", "وقت المعاينة", "حرّك الشريط لترى السماء في أي ساعة. الصورة السفلية ترسم السماء مباشرة من قيمك."],
            ["wx-diff", "ما الذي تغيّر", "جدول يقارن قيمك الحالية بالأصلية عند هذا الوقت، مع نسبة الفرق، لتعرف تأثير تعديلاتك بالأرقام."],
        ],
        fx: [
            ["fx-folder", "مجلد effects", "هنا يضع البرنامج ملف bloodfx.dat داخل FiveM. إن لم يوجد المجلد ينشئه لك."],
            ["fx-install", "التثبيت والاسترجاع", "«تثبيت في FiveM» يكتب الملف في اللعبة (أغلق FiveM قبلها)، و«استرجاع الأصل» يعيد نسختك القديمة."],
            ["fx-tabs", "أقسام BloodFX", "«شرح الملف» يوضح كيف يعمل. «اللون والمؤثرات» للتعديل السريع. «أنواع الإصابات» لتعديل كل إصابة على حدة. «متقدم» للأرقام الخام."],
        ],
        tc: [
            ["tc-list", "قائمة المعدّلات", "كل معدّل (modifier) هو حزمة تأثيرات للشاشة. اختر واحداً لتعديله."],
            ["tc-edit", "التعديل", "غيّر الألوان والقيم هنا. الأقسام مرتبة: الألوان، التعريض، العدسة، الضباب…"],
            ["tc-prev", "المعاينة", "تعرض أثر تعديلاتك على مشهد تجريبي أو على لقطة لعبة تضيفها أنت."],
        ],
    };
    let T = null;
    function tour(mod) {
        end();
        const list = (mod === "wx" || mod === "fx" || mod === "tc" ? COMMON.slice(0, 1).concat(STEPS[mod] || [], COMMON.slice(1)) : COMMON)
            .map(([k, t, b]) => ({ el: document.querySelector(`[data-tour="${k}"]`), t, b })).filter((x) => x.el && x.el.offsetParent !== null);
        if (!list.length) return H.toast("افتح ملفاً أولاً ثم اضغط «شرح الاستخدام» لتظهر شروحات المحرر", "info", 4500);
        T = { list, i: 0, ov: document.createElement("div") };
        T.ov.className = "tour"; T.ov.innerHTML = `<div class="tour-spot"></div><div class="tour-card"><div class="tour-n"></div><b class="tour-t"></b><p class="tour-b"></p><div class="tour-a"><button class="btn btn-sm" data-t="prev">السابق</button><button class="btn btn-sm btn-st" data-t="next">التالي</button><button class="btn btn-sm" data-t="end">إنهاء</button></div></div>`;
        document.body.appendChild(T.ov); T.ov.addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; if (b.dataset.t === "next") go(T.i + 1); else if (b.dataset.t === "prev") go(T.i - 1); else end(); });
        T.key = (e) => { if (e.key === "Escape") end(); else if (e.key === "ArrowLeft") go(T.i + 1); else if (e.key === "ArrowRight") go(T.i - 1); };
        document.addEventListener("keydown", T.key); T.re = () => place(); window.addEventListener("resize", T.re); go(0);
    }
    function go(i) { if (!T) return; if (i >= T.list.length) return end(); T.i = Math.max(0, i); const x = T.list[T.i]; try { x.el.scrollIntoView({ block: "center", behavior: "instant" }); } catch { x.el.scrollIntoView(); } setTimeout(place, 30); }
    function place() {
        if (!T) return; const x = T.list[T.i], r = x.el.getBoundingClientRect(), sp = T.ov.querySelector(".tour-spot"), cd = T.ov.querySelector(".tour-card"), pad = 6;
        Object.assign(sp.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
        T.ov.querySelector(".tour-n").textContent = `الخطوة ${T.i + 1} من ${T.list.length}`; T.ov.querySelector(".tour-t").textContent = x.t; T.ov.querySelector(".tour-b").textContent = x.b;
        T.ov.querySelector('[data-t="prev"]').disabled = T.i === 0; T.ov.querySelector('[data-t="next"]').textContent = T.i === T.list.length - 1 ? "تم" : "التالي";
        const ch = cd.offsetHeight || 190, cw = cd.offsetWidth || 340, below = r.bottom + ch + 20 < innerHeight;
        cd.style.top = Math.max(10, below ? r.bottom + 14 : r.top - ch - 14) + "px";
        cd.style.left = Math.min(innerWidth - cw - 10, Math.max(10, r.left + r.width / 2 - cw / 2)) + "px";
    }
    function end() { if (!T) return; document.removeEventListener("keydown", T.key); window.removeEventListener("resize", T.re); T.ov.remove(); T = null; try { localStorage.setItem("ca_studio_tour", "1"); } catch {} }
    function firstRun(mod) { try { if (localStorage.getItem("ca_studio_tour")) return; } catch { return; } H.toast("أول مرة؟ اضغط «شرح الاستخدام» في أعلى الصفحة ليشرح لك البرنامج كل زر", "info", 6000); try { localStorage.setItem("ca_studio_tour", "1"); } catch {} }

    /* ---------- نافذة القوالب ---------- */
    async function templates(kind) {
        const r = await H.api.tpl.list(); if (!r.success) return H.toast(r.message || "تعذّر قراءة القوالب", "error");
        const items = r.items.filter((x) => x.kind === kind);
        const d = H.dialog({ title: kind === "weather" ? "إنشاء ملف طقس" : "إنشاء ملف BloodFX", body: `<p style="color:var(--text-2);font-size:13px;line-height:1.8;margin-bottom:12px">${kind === "weather" ? "اختر الطقس الذي تريد إنشاءه. سيفتح الملف في المحرر بقيمه الأساسية الجاهزة، وعند الضغط على «حفظ» يُكتب مباشرة في مجلد <span class='ltr'>citizen\\common\\data\\timecycle</span> داخل FiveM مع حفظ نسخة من أي ملف سابق." : "سيُنشأ ملف bloodfx.dat بقيمه الأساسية ويفتح في المحرر."}${r.fivem ? "" : " <b style='color:var(--warn)'>لم نجد FiveM على جهازك؛ ستحفظ الملف كنسخة وتضعه بنفسك.</b>"}</p><div class="tplgrid">${items.map((x) => `<button class="tpl" data-n="${H.esc(x.name)}"><b>${H.esc(x.label)}</b><small class="ltr">${H.esc(x.name)}</small><em class="${x.exists ? "ok" : "no"}">${x.exists ? "موجود في FiveM" : "غير موجود"}</em></button>`).join("")}</div>` });
        d.body.addEventListener("click", async (e) => { const b = e.target.closest(".tpl"); if (!b) return; const g = await H.api.tpl.get(b.dataset.n); d.close(); if (!g.success) return H.toast(g.message || "تعذّر فتح القالب", "error"); H.openTemplate(kind, g.name, g.text); });
    }
    window.V2 = { init: (h) => { H = h; }, tour, templates, firstRun };
})();
