const { ic, esc, toast, ago } = window.CA;
const $ = (id) => document.getElementById(id);
let prefs = {}, lib = null, installed = { mods: [], presets: [] };
async function save() { prefs.profiles = prefs.profiles || []; const r = await window.api.v4.put("/api/v4/prefs", { prefs }); if (!r || !r.success) toast((r && r.message) || "تعذّر الحفظ", "error"); return r && r.success; }
function nameOf(id) { const m = (lib.mods || []).find((x) => x.id === id); return m ? m.name : "#" + id; }
function render() {
    const l = prefs.profiles || [];
    $("list").innerHTML = l.length ? l.map((p) => `<div class="prof"><h5>${esc(p.name)}</h5>
        <div style="font-size:12px;color:var(--text-3)">${(p.mods || []).length} مود · ${(p.presets || []).length} فلتر · ${esc(ago(p.createdAt))}</div>
        <div style="font-size:12px;color:var(--text-2);max-height:54px;overflow:hidden">${(p.mods || []).slice(0, 6).map((i) => esc(nameOf(i))).join("، ")}${(p.mods || []).length > 6 ? "…" : ""}</div>
        <div style="display:flex;gap:8px;margin-top:auto"><button class="btn btn-primary" data-act="apply" data-id="${esc(p.id)}" >${ic("download")} تطبيق</button><button class="ibtn danger" data-act="del" data-id="${esc(p.id)}" title="حذف">${ic("trash")}</button></div></div>`).join("")
        : `<div class="empty" style="grid-column:1/-1"><div class="icon-tile">${ic("layers")}</div><h3>لا توجد ملفات تعريف</h3><p>أنشئ ملفاً من المودات المثبّتة حالياً.</p></div>`;
}
async function create() {
    const have = new Set((installed.mods || []).map((x) => x.toLowerCase()));
    const mods = (lib.mods || []).filter((m) => m.fileName && have.has(String(m.fileName).toLowerCase())).map((m) => m.id);
    const presets = (lib.presets || []).filter((p) => (installed.presets || []).map((x) => x.toLowerCase()).includes(String(p.file || "").toLowerCase())).map((p) => p.id);
    if (!mods.length && !presets.length) { toast("لا توجد عناصر مثبّتة من المكتبة لحفظها", "error"); return; }
    const d = window.CA.dialog({ title: "ملف تعريف جديد", body: `<label class="fld"><span>الاسم</span><input class="txt" id="pn" maxlength="40" placeholder="مثال: إعداد السباقات"></label><p style="color:var(--text-3);font-size:12.5px">سيُحفظ: ${mods.length} مود و ${presets.length} فلتر مثبّتة حالياً.</p>`, footer: `<button class="btn" data-dlg="close">إلغاء</button><button class="btn btn-primary" id="pok">حفظ</button>` });
    d.el.querySelector("#pok").addEventListener("click", async () => {
        const name = d.el.querySelector("#pn").value.trim(); if (!name) return;
        prefs.profiles = [...(prefs.profiles || []), { id: "p" + Date.now().toString(36), name, mods, presets, createdAt: new Date().toISOString() }].slice(-20);
        if (await save()) { d.close(); render(); toast("تم الحفظ", "success"); }
    });
}
async function apply(p) {
    const ok = await window.CA.confirm({ title: `تطبيق «${p.name}»؟`, message: `سيتم تثبيت ${(p.mods || []).length} مود و ${(p.presets || []).length} فلتر غير المثبّتة مسبقاً.`, confirmText: "تطبيق" });
    if (!ok) return;
    let okN = 0, tot = 0;
    for (const id of p.mods || []) { const m = (lib.mods || []).find((x) => x.id === id); if (!m || !m.unlocked) continue; tot++; const r = await window.api.lib.install({ type: "mod", id }); if (r && r.success) okN++; }
    for (const id of p.presets || []) { tot++; const r = await window.api.lib.install({ type: "preset", id }); if (r && r.success) okN++; }
    toast(`اكتمل ${okN} من ${tot}`, okN === tot ? "success" : "error");
}
$("newProf").addEventListener("click", create);
$("list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const p = (prefs.profiles || []).find((x) => x.id === b.dataset.id); if (!p) return;
    if (b.dataset.act === "apply") apply(p);
    else if (await window.CA.confirm({ title: "حذف الملف؟", message: p.name, danger: true, confirmText: "حذف" })) { prefs.profiles = prefs.profiles.filter((x) => x !== p); await save(); render(); }
});
(async () => {
    const S = await window.CA.ready; if (!S) return;
    const [P, L, I] = await Promise.all([window.api.v4.get("/api/v4/prefs"), window.CA.getLibrary(), window.api.lib.installed().catch(() => ({}))]);
    prefs = (P && P.success && P.prefs) || {}; lib = (L && L.success) ? L : { mods: [], presets: [] }; installed = I || {};
    render();
})();
