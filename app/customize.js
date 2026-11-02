/* ==========================================================================
   CUSTOMIZE — التخصيص
   ========================================================================== */
const { ic, esc, toast, confirm: askConfirm } = window.CA;

const ICON_BY_ID = { no_water: "waves", no_snow: "snow", no_mountain: "mountain", no_rain: "rain" };
const SAFE_ICONS = new Set(["waves", "snow", "mountain", "rain", "sliders", "palette", "zap", "eye", "layers", "package", "gauge"]);
let customizations = [];
let LIBRARY = null;

const grid = document.getElementById("customizationsGrid");
let installed = {};

async function loadLib() {
    const L = await window.CA.getLibrary(true);
    if (!L || !L.success) return false;
    LIBRARY = L;
    customizations = (L.customizations || []).map((c) => ({
        id: c.id, title: c.name, en: "", description: c.description || "", warning: c.warning || "",
        icon: SAFE_ICONS.has(c.icon) ? c.icon : (ICON_BY_ID[c.id] || "sliders")
    }));
    return true;
}

async function checkInstalledStatus() {
    const out = {};
    let ids = [];
    try { const r = await window.api.lib.installed(); ids = (r && r.customizations) || []; } catch {}
    customizations.forEach((c) => { out[c.id] = ids.includes(c.id); });
    return out;
}

function render() {
    grid.innerHTML = customizations.map((c) => {
        const on = !!installed[c.id];
        return `
        <article class="cust ${on ? "on" : ""}" data-id="${c.id}">
            <div class="cust-head">
                <div class="icon-tile ${on ? "ok" : ""}">${ic(c.icon, "lg")}</div>
                <div class="grow">
                    <h3 class="cust-title">${esc(c.title)} <small class="ltr">${esc(c.en)}</small></h3>
                    <span class="pill ${on ? "ok" : ""}">${on ? "مثبّت" : "غير مثبّت"}</span>
                </div>
            </div>
            <p class="cust-desc">${esc(c.description)}</p>${c.warning ? `<p class="hint" style="color:var(--warn);margin-top:6px">${esc(c.warning)}</p>` : ""}
            <div class="pack-actions">
                ${on ? `
                    <button class="btn grow" data-act="install" data-id="${c.id}">${ic("refresh")}إعادة التثبيت</button>
                    <button class="btn btn-danger" data-act="delete" data-id="${c.id}">${ic("trash")}حذف</button>`
                : `<button class="btn btn-primary grow" data-act="install" data-id="${c.id}">${ic("download")}تثبيت</button>`}
            </div>
        </article>`;
    }).join("");
}

function busy(btn, label) {
    btn.disabled = true;
    btn.dataset.html = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>${label}`;
}
function idle(btn) { btn.disabled = false; btn.innerHTML = btn.dataset.html; }

async function install(id, btn) {
    busy(btn, "جاري التثبيت...");
    try {
        const r = await window.api.lib.install({ type: "custom", id, overwrite: true });
        if (r && r.success) {
            toast("تم التثبيت بنجاح");
            installed = await checkInstalledStatus();
            render();
        } else {
            toast((r && r.message) || "فشل التثبيت", "error");
            idle(btn);
        }
    } catch (e) {
        console.error(e);
        toast("حدث خطأ أثناء التثبيت", "error");
        idle(btn);
    }
}

async function remove(id, btn) {
    const c = customizations.find((x) => x.id === id);
    const ok = await askConfirm({ title: `حذف «${c.title}»؟`, message: "ستُزال ملفات هذا التخصيص من FiveM.", confirmText: "حذف", danger: true });
    if (!ok) return;
    busy(btn, "جاري الحذف...");
    try {
        const r = await window.api.lib.remove({ type: "custom", id });
        if (r && r.success) {
            toast("تم الحذف بنجاح");
            installed = await checkInstalledStatus();
            render();
        } else {
            toast((r && r.message) || "فشل الحذف", "error");
            idle(btn);
        }
    } catch (e) {
        console.error(e);
        toast("حدث خطأ أثناء الحذف", "error");
        idle(btn);
    }
}

grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    if (b.dataset.act === "install") install(b.dataset.id, b);
    else if (b.dataset.act === "delete") remove(b.dataset.id, b);
});

(async () => {
    const S = await window.CA.ready; if (!S) return;
    grid.innerHTML = '<div class="skel"></div><div class="skel"></div>';
    if (!(await loadLib())) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon-tile err">${ic("wifi", "lg")}</div><h3>تعذّر تحميل التخصيصات</h3><p>تحقق من الاتصال ثم أعد فتح الصفحة.</p></div>`; return; }
    installed = await checkInstalledStatus();
    render();
})();

/* ==========================================================================
   FILTERS — فلاتر ReShade  (.ini فقط)
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const pf = { files: [], lib: [], libOk: null, q: "", sel: new Set(), dir: "", noPath: false, busy: new Set() };

/* ── tabs ── */
function showView(v) {
    $("viewCust").classList.toggle("hidden", v !== "cust");
    $("viewPresets").classList.toggle("hidden", v !== "presets");
    document.querySelectorAll("#custTabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.view === v));
    try { localStorage.setItem("cust_view", v); } catch {}
    if (v === "presets" && !pf.loaded) loadPresets();
}
$("custTabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) showView(t.dataset.view); });

/* ── helpers ── */
const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const fmtDate = (ms) => new Date(ms).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric", numberingSystem: "latn" });
const stem = (f) => String(f).replace(/\.ini$/i, "");
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const libFiles = () => pf.lib.map((l) => l.file);

/* ── data ── */
async function loadInstalled() {
    const r = await window.api.presets.list();
    pf.noPath = !!(r && r.noPath);
    pf.files = r && r.success ? r.files : [];
    pf.sel = new Set([...pf.sel].filter((n) => pf.files.some((f) => f.file === n)));
    $("pfNoPath").classList.toggle("hidden", !pf.noPath);
    if (r && !r.success && !r.noPath) toast(r.message || "تعذّر قراءة الفلاتر", "error");
}
async function loadLibrary() {
    try {
        const L = LIBRARY || await window.CA.getLibrary(true);
        if (!L || !L.success) throw new Error("bad");
        pf.lib = (L.presets || []).filter((p) => p.file && /\.ini$/i.test(p.file));
        pf.libOk = true;
    } catch (e) { console.error(e); pf.lib = []; pf.libOk = false; }
}
async function loadPresets() {
    pf.loaded = true;
    await Promise.all([loadInstalled(), loadLibrary()]);
    renderPresets();
}

/* ── render ── */
function renderPresets() {
    const q = pf.q.toLowerCase();
    const files = pf.files.filter((f) => !q || f.file.toLowerCase().includes(q));
    $("presetTabN").textContent = pf.files.length ? `(${pf.files.length})` : "";
    $("pfCount").textContent = pf.files.length ? `· ${pf.files.length}` : "";

    $("pfList").innerHTML = files.length ? files.map((f) => {
        const fromLib = libFiles().some((x) => same(x, f.file));
        const sel = pf.sel.has(f.file);
        return `
        <div class="pf-row${sel ? " sel" : ""}" data-file="${esc(f.file)}">
            <span class="pf-chk" data-act="sel">${ic("check")}</span>
            <div class="icon-tile sm">${ic("file")}</div>
            <div class="grow" style="min-width:0">
                <div class="pf-name">${esc(stem(f.file))}</div>
                <div class="pf-meta"><span>${fmtSize(f.size)}</span><span>${fmtDate(f.mtime)}</span>
                    <span class="chip ${fromLib ? "ok" : ""}" style="direction:rtl">${fromLib ? "من المكتبة" : "مضاف يدوياً"}</span></div>
            </div>
            <button class="btn btn-sm btn-danger" data-act="del" title="حذف">${ic("trash", "sm")}حذف</button>
        </div>`;
    }).join("") : `<div class="empty-line">${pf.noPath ? "حدّد مسار FiveM أولاً" : pf.files.length ? "لا توجد نتائج" : "لا توجد فلاتر مثبّتة بعد. أضف فلتراً من جهازك أو نزّل من المكتبة."}</div>`;

    $("pfDelSel").disabled = !pf.sel.size;
    $("pfDelSel").innerHTML = `${ic("trash")}حذف المحدد${pf.sel.size ? ` (${pf.sel.size})` : ""}`;
    $("pfSelAll").innerHTML = `${ic("check")}${pf.sel.size && pf.sel.size === files.length ? "إلغاء التحديد" : "تحديد الكل"}`;

    const lib = pf.lib.filter((l) => !q || `${l.name} ${l.description || ""}`.toLowerCase().includes(q));
    $("pfLibCount").textContent = pf.lib.length ? `· ${pf.lib.length}` : "";
    if (pf.libOk === false) {
        $("pfLib").innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon-tile err">${ic("wifi", "lg")}</div><h3>تعذّر تحميل المكتبة</h3><p>تحقق من اتصالك بالإنترنت.</p><button class="btn" data-act="retryLib">${ic("refresh")}إعادة المحاولة</button></div>`;
        return;
    }
    if (!lib.length) {
        $("pfLib").innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon-tile">${ic("palette", "lg")}</div><h3>${pf.lib.length ? "لا توجد نتائج" : "المكتبة فارغة حالياً"}</h3><p>${pf.lib.length ? "جرّب كلمة بحث أخرى." : "سيتم إضافة فلاتر جديدة قريباً."}</p></div>`;
        return;
    }
    $("pfLib").innerHTML = lib.map((l) => {
        const on = pf.files.some((f) => same(f.file, l.file));
        const busy = pf.busy.has(l.file);
        return `
        <article class="pf-card${on ? " on" : ""}" data-lib="${esc(l.file)}">
            <div class="pf-img">${l.img ? `<img src="${esc(l.img)}" alt="${esc(l.name)}" loading="lazy">` : ic("palette", "xl")}
                ${on ? `<span class="chip ok">${ic("check")}مثبّت</span>` : ""}</div>
            <div class="pf-body">
                <div class="pf-card-name">${esc(l.name || stem(l.file))}</div>
                <div class="pf-card-desc">${esc(l.description || "فلتر ReShade جاهز للاستخدام.")}</div>
                <div class="pf-foot">
                    <button class="cta${on ? " ghost" : ""}" data-act="get" ${busy ? "disabled" : ""}>${busy ? '<span class="spinner"></span>جاري التنزيل...' : `${ic(on ? "refresh" : "download")}${on ? "إعادة التنزيل" : "تنزيل"}`}</button>
                    ${l.size ? `<span class="pf-size">${esc(l.size)}</span>` : ""}
                </div>
            </div>
        </article>`;
    }).join("");
}

/* ── actions ── */
async function refreshInstalled() { await loadInstalled(); renderPresets(); }

async function saveOne(name, b64) {
    if (!/\.ini$/i.test(name)) { toast(`«${name}» مرفوض: يُسمح بملفات .ini فقط`, "error"); return false; }
    if (b64 === null) { toast(`«${name}» كبير جداً (الحد 2MB)`, "error"); return false; }
    let r = await window.api.presets.save(name, b64, false);
    if (r && r.exists) {
        const ok = await askConfirm({ title: "الفلتر موجود مسبقاً", message: `هل تريد استبدال «${stem(name)}»؟`, confirmText: "استبدال" });
        if (!ok) return false;
        r = await window.api.presets.save(name, b64, true);
    }
    if (r && r.success) return true;
    toast(`«${name}»: ${(r && r.message) || "فشل الحفظ"}`, "error");
    return false;
}
async function saveMany(items) {
    let n = 0;
    for (const it of items) if (await saveOne(it.name, it.content)) n++;
    if (n) toast(`تمت إضافة ${n} ${n === 1 ? "فلتر" : "فلاتر"}`);
    await refreshInstalled();
}
const toB64 = async (file) => {
    if (file.size > 2 * 1024 * 1024) return null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
};

/* اختيار من الجهاز */
const dropEl = $("pfDrop");
async function pickFiles() {
    const r = await window.api.presets.pick();
    if (r && r.success && r.items.length) await saveMany(r.items);
}
dropEl.addEventListener("click", pickFiles);
dropEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFiles(); } });
/* سحب وإفلات */
["dragenter", "dragover"].forEach((ev) => dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.remove("over"); }));
dropEl.addEventListener("drop", async (e) => {
    const list = [...(e.dataTransfer?.files || [])];
    if (!list.length) return;
    const items = [];
    for (const f of list) items.push({ name: f.name, content: /\.ini$/i.test(f.name) ? await toB64(f) : "" });
    await saveMany(items);
});
/* منع فتح الملف إذا أُفلت خارج المنطقة */
["dragover", "drop"].forEach((ev) => window.addEventListener(ev, (e) => e.preventDefault()));

/* قائمة المثبّتة */
$("pfList").addEventListener("click", async (e) => {
    const row = e.target.closest(".pf-row");
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!row || !act) return;
    const file = row.dataset.file;
    if (act === "sel") {
        pf.sel.has(file) ? pf.sel.delete(file) : pf.sel.add(file);
        renderPresets();
    } else if (act === "del") {
        const ok = await askConfirm({ title: `حذف «${stem(file)}»؟`, message: "سيُحذف هذا الفلتر من اللعبة.", confirmText: "حذف", danger: true });
        if (!ok) return;
        const r = await window.api.presets.remove([file]);
        toast(r && r.success ? "تم حذف الفلتر" : "فشل الحذف", r && r.success ? "success" : "error");
        pf.sel.delete(file);
        refreshInstalled();
    }
});
$("pfSelAll").addEventListener("click", () => {
    const q = pf.q.toLowerCase();
    const vis = pf.files.filter((f) => !q || f.file.toLowerCase().includes(q)).map((f) => f.file);
    if (pf.sel.size && pf.sel.size === vis.length) pf.sel.clear(); else pf.sel = new Set(vis);
    renderPresets();
});
$("pfDelSel").addEventListener("click", async () => {
    const names = [...pf.sel];
    if (!names.length) return;
    const ok = await askConfirm({ title: `حذف ${names.length} ${names.length === 1 ? "فلتر" : "فلاتر"}؟`, message: "لا يمكن التراجع عن هذا الإجراء.", details: names.slice(0, 6).map(stem).concat(names.length > 6 ? [`و ${names.length - 6} أخرى...`] : []), confirmText: "حذف", danger: true });
    if (!ok) return;
    const r = await window.api.presets.remove(names);
    toast(r && r.success ? `تم حذف ${r.removed} فلتر` : "فشل الحذف", r && r.success ? "success" : "error");
    pf.sel.clear();
    refreshInstalled();
});

/* المكتبة */
$("pfLib").addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "retryLib") { pf.libOk = null; await loadLibrary(); return renderPresets(); }
    if (act !== "get") return;
    const item = pf.lib.find((l) => l.file === e.target.closest("[data-lib]").dataset.lib);
    if (!item || pf.busy.has(item.file)) return;
    pf.busy.add(item.file); renderPresets();
    try {
        let r = await window.api.lib.install({ type: "preset", id: item.id, overwrite: false });
        if (r && r.exists) {
            pf.busy.delete(item.file); renderPresets();
            const ok = await askConfirm({ title: "الفلتر موجود مسبقاً", message: `هل تريد إعادة تنزيل «${item.name || stem(item.file)}» واستبداله؟`, confirmText: "استبدال" });
            if (!ok) return;
            pf.busy.add(item.file); renderPresets();
            r = await window.api.lib.install({ type: "preset", id: item.id, overwrite: true });
        }
        if (r && r.success) toast(`تم تنزيل «${item.name || stem(item.file)}»`);
        else toast((r && r.message) || "فشل التنزيل", "error");
    } catch (err) { console.error(err); toast("فشل التنزيل", "error"); }
    pf.busy.delete(item.file);
    await refreshInstalled();
});

$("pfSearch").addEventListener("input", (e) => { pf.q = e.target.value.trim(); renderPresets(); });
$("pfRefresh").addEventListener("click", async () => { await refreshInstalled(); toast("تم التحديث", "info"); });

try { if (localStorage.getItem("cust_view") === "presets") showView("presets"); } catch {}
