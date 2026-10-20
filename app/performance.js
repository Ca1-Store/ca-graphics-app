/* ==========================================================================
   PERFORMANCE — الأداء
   ========================================================================== */
const { ic, esc, toast, confirm: askConfirm } = window.CA;

/* كل إجراء: [عنوان التأكيد، وصف، تفاصيل، رسالة النجاح، رسالة الفشل] أو null بدون تأكيد */
const ACTIONS = {
    clearTempFiles: {
        confirm: { title: "حذف الملفات المؤقتة؟", message: "سيتم حذف محتويات مجلد temp.", details: ["حذف الملفات في %TEMP%", "تحرير مساحة القرص", "الملفات المحذوفة لا يمكن استعادتها"], danger: true },
        ok: (r) => `تم حذف ${r.filesDeleted || 0} ملف مؤقت`, fail: "فشل حذف الملفات المؤقتة"
    },
    clearCache: {
        confirm: { title: "حذف كاش FiveM؟", message: "سيُعاد تحميل الموارد عند التشغيل القادم.", details: ["حذف الكاش في %LOCALAPPDATA%\\FiveM", "قد يحسّن الأداء بعد إعادة بنائه"] },
        ok: () => "تم حذف الكاش بنجاح", fail: "فشل حذف الكاش"
    },
    clearLogs: {
        confirm: { title: "حذف ملفات السجلات؟", message: "قد تفقد معلومات تساعد في تشخيص الأخطاء.", details: ["حذف ملفات .log و .txt في مجلد FiveM", "تحرير مساحة القرص"], danger: true },
        ok: (r) => `تم حذف ${r.filesDeleted || 0} ملف سجل`, fail: "فشل حذف السجلات"
    },
    optimizeNvidia: {
        confirm: { title: "تطبيق تحسينات NVIDIA؟", message: "سيتم تعديل إعدادات كرت الشاشة.", details: ["تفعيل High Performance Mode", "تعطيل V-Sync و G-Sync", "تفعيل Low Latency Mode", "Pre-rendered Frames = 1"] },
        ok: () => "تم تطبيق تحسينات NVIDIA", fail: "فشل تطبيق تحسينات NVIDIA"
    },
    enableGameMode: {
        confirm: { title: "تفعيل Game Mode؟", message: "سيتم تعديل إعدادات ويندوز للألعاب.", details: ["تفعيل Windows Game Mode", "خطة طاقة عالية الأداء", "تعطيل Xbox Game Bar و Game DVR"] },
        ok: () => "تم تفعيل Game Mode", fail: "فشل تفعيل Game Mode"
    },
    optimizeFiveMGraphics: {
        confirm: { title: "تحسين رسوميات FiveM؟", message: "سيرتفع الـ FPS على حساب الجودة.", details: ["تقليل الظلال والإضاءة والانعكاسات", "تعطيل Motion Blur و Depth of Field"] },
        ok: () => "تم تطبيق تحسينات الرسوميات", fail: "فشل تحسين الرسوميات"
    },
    optimizeServices: {
        confirm: { title: "إيقاف الخدمات غير الضرورية؟", message: "يمكنك استعادتها لاحقاً من زر «استعادة».", details: ["Windows Search و Windows Update", "Print Spooler و Fax", "خدمات Xbox"] },
        ok: () => "تم تحسين خدمات النظام", fail: "فشل تحسين الخدمات"
    },
    optimizeNetwork: {
        confirm: { title: "تحسين إعدادات الشبكة؟", message: "سيتم تعديل إعدادات TCP.", details: ["تعطيل Nagle's Algorithm", "تعطيل TCP Auto-tuning و LSO", "تقليل الـ Lag في FiveM"] },
        ok: () => "تم تحسين الشبكة", fail: "فشل تحسين الشبكة"
    },
    optimizeRAM: {
        confirm: { title: "تحسين الذاكرة؟", message: "سيتم تعديل إعدادات الذاكرة في النظام.", details: ["Clear Page File at Shutdown", "تعطيل Memory Dump", "تفعيل Large System Cache"] },
        ok: () => "تم تحسين الذاكرة", fail: "فشل تحسين الذاكرة"
    },
    fullOptimization: {
        apiName: "fullOptimization",
        confirm: { title: "تطبيق كل التحسينات؟", message: "قد تستغرق العملية بضع دقائق وقد تتطلب إعادة تشغيل الجهاز.", details: ["تحسينات NVIDIA و Game Mode", "رسوميات FiveM والخدمات", "الشبكة والذاكرة"] },
        ok: () => "تم تطبيق التحسين الشامل", fail: "فشل التحسين الشامل"
    },
    restoreNvidia:        { ok: () => "تمت استعادة إعدادات NVIDIA", fail: "فشلت استعادة NVIDIA" },
    restoreGameMode:      { ok: () => "تمت استعادة إعدادات Game Mode", fail: "فشلت استعادة Game Mode" },
    restoreFiveMGraphics: { ok: () => "تمت استعادة إعدادات الرسوميات", fail: "فشلت استعادة الرسوميات" },
    restoreServices:      { ok: () => "تمت استعادة خدمات النظام", fail: "فشلت استعادة الخدمات" },
    restoreNetwork:       { ok: () => "تمت استعادة إعدادات الشبكة", fail: "فشلت استعادة الشبكة" },
    restoreRAM:           { ok: () => "تمت استعادة إعدادات الذاكرة", fail: "فشلت استعادة الذاكرة" },
    restoreAll:           { ok: () => "تمت استعادة كل الإعدادات", fail: "فشلت الاستعادة الشاملة" }
};
// data-act="full" → fullOptimization
const ALIAS = { full: "fullOptimization" };

/* ── بيانات التحسينات ── */
const TOGGLES = [
    { key: "nvidia",   apply: "optimizeNvidia",        restore: "restoreNvidia",        icon: "cpu",     name: "تحسين NVIDIA",    desc: "ضبط إعدادات كرت الشاشة لأعلى أداء",   impact: 3, tag: ["ok", "آمن"] },
    { key: "game",     apply: "enableGameMode",        restore: "restoreGameMode",      icon: "zap",     name: "Game Mode",       desc: "خطة طاقة عالية الأداء وتعطيل Game DVR", impact: 2, tag: ["ok", "آمن"] },
    { key: "graphics", apply: "optimizeFiveMGraphics", restore: "restoreFiveMGraphics", icon: "layers",  name: "رسوميات FiveM",   desc: "خفض الظلال والانعكاسات وتعطيل الـ Blur", impact: 3, tag: ["warn", "تقلّل الجودة"] },
    { key: "services", apply: "optimizeServices",      restore: "restoreServices",      icon: "shield",  name: "إيقاف الخدمات",   desc: "إيقاف الخدمات غير الضرورية",           impact: 2, tag: ["warn", "يحتاج حذر"] },
    { key: "network",  apply: "optimizeNetwork",       restore: "restoreNetwork",       icon: "network", name: "تحسين الشبكة",    desc: "تقليل الـ Lag وتحسين الاستجابة",       impact: 1, tag: ["ok", "آمن"] },
    { key: "ram",      apply: "optimizeRAM",           restore: "restoreRAM",           icon: "memory",  name: "تحسين الذاكرة",   desc: "ضبط إعدادات الذاكرة العشوائية",        impact: 1, tag: ["ok", "آمن"] }
];
const CLEANS = [
    { act: "clearTempFiles", icon: "folder",  name: "الملفات المؤقتة", desc: "حذف ملفات temp لتحرير مساحة القرص", danger: true },
    { act: "clearCache",     icon: "archive", name: "كاش FiveM",       desc: "حذف الكاش لإعادة بناء الموارد" },
    { act: "clearLogs",      icon: "file",    name: "السجلات",         desc: "حذف ملفات .log و .txt في مجلد FiveM", danger: true }
];

let state = {};
try { state = JSON.parse(localStorage.getItem("perf_state") || "{}"); } catch {}
const saveState = () => { try { localStorage.setItem("perf_state", JSON.stringify(state)); } catch {} };

function renderToggles() {
    document.getElementById("toggleGrid").innerHTML = TOGGLES.map((t) => `
        <div class="pt ${state[t.key] ? "on" : ""}" data-key="${t.key}">
            <div class="pt-h">
                <div class="icon-tile sm ${state[t.key] ? "ok" : ""}">${ic(t.icon, "sm")}</div>
                <div class="grow"><div class="pt-n">${t.name}</div><div class="pt-d">${t.desc}</div></div>
                <button class="sw ${state[t.key] ? "on" : ""}" data-toggle="${t.key}" role="switch" aria-checked="${!!state[t.key]}" aria-label="${t.name}"></button>
            </div>
            <div class="pt-f">
                <div class="imp">التأثير ${[1, 2, 3].map((n) => `<i class="${n <= t.impact ? "f" : ""}"></i>`).join("")}</div>
                <span class="chip ${t.tag[0]}">${t.tag[1]}</span>
            </div>
        </div>`).join("");

    document.getElementById("cleanGrid").innerHTML = CLEANS.map((c) => `
        <div class="pt">
            <div class="pt-h">
                <div class="icon-tile sm">${ic(c.icon, "sm")}</div>
                <div class="grow"><div class="pt-n">${c.name}</div><div class="pt-d">${c.desc}</div></div>
            </div>
            <div class="pt-f"><span></span><button class="btn btn-sm ${c.danger ? "btn-danger" : "btn-primary"}" data-act="${c.act}">${ic("trash", "sm")}تنظيف</button></div>
        </div>`).join("");

    const n = TOGGLES.filter((t) => state[t.key]).length;
    const score = Math.round((n / TOGGLES.length) * 100);
    document.getElementById("ring").style.setProperty("--p", score);
    document.getElementById("ringNum").textContent = score;
    document.getElementById("boostChip").textContent = `${n} من ${TOGGLES.length} تحسينات مفعّلة`;
}

/* ── تنفيذ إجراء (مع التأكيد) — يرجع true عند النجاح ── */
async function exec(name, { confirm = true } = {}) {
    const def = ACTIONS[name];
    if (!def || typeof window.api[name] !== "function") return false;
    if (confirm && def.confirm) {
        const ok = await askConfirm({ ...def.confirm, confirmText: def.confirm.danger ? "نعم، احذف" : "تطبيق" });
        if (!ok) return false;
    }
    try {
        const r = await window.api[name]();
        if (r && r.success) { toast(r.message || def.ok(r)); return true; }
        toast((r && r.message) || def.fail, "error");
    } catch (e) {
        console.error(e);
        toast("حدث خطأ أثناء التنفيذ", "error");
    }
    return false;
}

async function withBusy(btn, fn) {
    if (btn.disabled || btn.classList.contains("busy")) return;
    const isSw = btn.classList.contains("sw");
    const html = btn.innerHTML;
    if (isSw) btn.classList.add("busy"); else { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
    try { await fn(); } finally {
        if (isSw) btn.classList.remove("busy"); else { btn.disabled = false; btn.innerHTML = html; }
    }
}

document.querySelector(".content-inner").addEventListener("click", (e) => {
    const sw = e.target.closest("[data-toggle]");
    if (sw) {
        const t = TOGGLES.find((x) => x.key === sw.dataset.toggle);
        return withBusy(sw, async () => {
            const turningOn = !state[t.key];
            const ok = await exec(turningOn ? t.apply : t.restore, { confirm: turningOn });
            if (ok) { state[t.key] = turningOn; saveState(); renderToggles(); }
        });
    }
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const name = ALIAS[b.dataset.act] || b.dataset.act;
    withBusy(b, async () => {
        const ok = await exec(name);
        if (!ok) return;
        if (name === "fullOptimization") TOGGLES.forEach((t) => (state[t.key] = true));
        if (name === "restoreAll") state = {};
        if (name === "fullOptimization" || name === "restoreAll") { saveState(); renderToggles(); }
    });
});

renderToggles();

const GB = 1024 ** 3;
async function loadSystemInfo() {
    try {
        const r = await window.api.getSystemInfo();
        if (r.diskSpace) {
            const { free, total } = r.diskSpace;
            const used = (1 - free / total) * 100;
            document.getElementById("diskSpace").textContent = `\u2066${(free / GB).toFixed(1)} GB\u2069 متاحة من \u2066${(total / GB).toFixed(0)} GB\u2069`;
            const b = document.getElementById("diskBadge");
            b.textContent = used > 80 ? "حرج" : used > 60 ? "تنبيه" : "جيد";
            b.className = "status-pill " + (used > 80 ? "offline" : used > 60 ? "pending" : "online");
        }
        if (r.fivemStatus) {
            const ok = !!r.fivemStatus.installed;
            document.getElementById("fivemStatus").textContent = ok ? "FiveM مثبّت" : "لم يتم العثور على FiveM";
            const b = document.getElementById("fivemBadge");
            b.textContent = ok ? "مثبّت" : "غير موجود";
            b.className = "status-pill " + (ok ? "online" : "offline");
        }
    } catch (e) { console.error(e); }
}
loadSystemInfo();
