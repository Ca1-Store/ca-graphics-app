/* ساوندات الأسلحة — تثبيت من المكتبة أو من جهاز العميل، واسترجاع الأصل */
const { ic, esc, toast, safeImg, confirm: askConfirm } = window.CA;
const $ = (id) => document.getElementById(id);
let G = null, LIB = [], busy = null;

function gtaBox() {
    if (!G || !G.success) {
        $("gtaBox").innerHTML = `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div class="icon-tile">${ic("alert")}</div><div style="flex:1"><b style="color:#fff">لم نجد لعبة GTA V</b><div style="color:var(--text-3);font-size:12.5px">${esc((G && G.message) || "حدّد مجلد اللعبة (الذي يحتوي مجلد x64)")}</div></div><button class="btn" id="bDetect">${ic("refresh")} بحث تلقائي</button><button class="btn btn-primary" id="bPick">${ic("folder")} تحديد المجلد</button></div>`;
    } else {
        $("gtaBox").innerHTML = `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div class="icon-tile">${ic("check")}</div><div style="flex:1;min-width:0"><b style="color:#fff">تم العثور على GTA V</b> <span class="badge ${G.source === "manual" ? "" : "ok"}">${G.source === "manual" ? "يدوي" : "تلقائي"}</span><div class="ltr" style="color:var(--text-3);font-size:12px;word-break:break-all">${esc(G.sfx || G.path)}</div></div><button class="btn" id="bDetect">${ic("refresh")} إعادة البحث</button><button class="btn" id="bPick">${ic("folder")} تغيير</button></div>
        <div style="margin-top:12px;font-size:12px;color:var(--text-3)">أغلق اللعبة وبرنامج FiveM قبل التثبيت. إن ظهر خطأ صلاحيات شغّل البرنامج «كمسؤول». يُحتفظ بنسخة من ملفك الأصلي لاسترجاعه في أي وقت.</div>`;
    }
}
async function loadGta(force) {
    let r = await window.api.gta.detect(force);
    if (r && r.success) { const s = await window.api.gta.state(); G = Object.assign({}, r, s && s.success ? { files: s.files } : {}); } else G = r;
    gtaBox();
}
function card(s) {
    const img = safeImg(s.img), isBusy = busy === s.id;
    let act;
    if (!s.unlocked) act = `<div class="lock-note">${ic("lock", "sm")} ${esc(s.plans.length ? "يتطلب " + s.plans.join(" / ") : "غير متاح")}</div>`;
    else if (isBusy) act = `<div class="dlp"><i id="bar"></i></div><div class="dlm"><span id="dtxt">جاري التحضير...</span></div>`;
    else act = `<button class="btn btn-primary" data-act="install" ${busy ? "disabled" : ""}>${ic("download")} تركيب الساوند</button>`;
    const done = G && G.files && G.files.find((f) => f.info && f.info.id === s.id);
    return `<div class="mcard" data-id="${esc(s.id)}"><div class="cv">${img ? `<img src="${esc(img)}" alt="">` : `<div class="ph">${ic("waves")}</div>`}${done ? `<div class="tg"><span class="badge ok">مركّب</span></div>` : ""}</div><div class="cb"><h5>${esc(s.name)}</h5><div class="meta">${s.weapon ? `<span>${esc(s.weapon)}</span>` : ""}<span>${esc(s.sizeLabel || "")}</span><span class="ltr">${esc(s.file)}</span></div>${s.description ? `<p style="font-size:12px;color:var(--text-3);margin:6px 0">${esc(s.description)}</p>` : ""}<div class="ca">${act}</div></div></div>`;
}
function renderLib() {
    $("grid").innerHTML = LIB.length ? LIB.map(card).join("") : `<div class="empty" style="grid-column:1/-1"><div class="icon-tile">${ic("waves")}</div><h3>لا توجد ساوندات بعد</h3><p>سيضيف المشرفون ساوندات قريباً. يمكنك تركيب ساوندك الخاص من تبويب «ساوندات جهازي».</p></div>`;
}
function renderMine() {
    const files = (G && G.files) || [];
    const changed = files.filter((f) => f.replaced);
    $("pMine").innerHTML = `<div class="toolrow"><button class="btn btn-primary" id="bLocal" ${G && G.success ? "" : "disabled"}>${ic("upload")} تركيب ساوند من جهازي (.rpf أو .zip)</button><span style="flex:1"></span>${changed.length ? `<button class="btn btn-danger" id="bRestoreAll">${ic("undo")} استرجاع كل الأصليات (${changed.length})</button>` : ""}</div>
    <p style="color:var(--text-3);font-size:12.5px;margin-bottom:12px">اختر ملف الساوند الذي تملكه. يجب أن يحمل اسم ملف موجود في المجلد، مثل <span class="ltr">WEAPONS_PLAYER.rpf</span>، وإلا ستختار أي ملف تريد استبداله.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ملف الصوت</th><th>الحجم</th><th>الحالة</th><th></th></tr></thead><tbody>${files.map((f) => `<tr data-n="${esc(f.name)}"><td class="nm ltr">${esc(f.name)}</td><td>${f.size ? (f.size / 1048576).toFixed(1) + " MB" : "—"}</td><td>${f.replaced ? `<span class="badge warn">مستبدَل</span> <span style="color:var(--text-3);font-size:11.5px">${esc((f.info && f.info.name) || "")}</span>` : '<span class="badge">أصلي</span>'}</td><td>${f.replaced && f.hasBackup ? `<button class="ibtn" data-act="restore" title="استرجاع الأصل">${ic("undo")}</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty"><p>حدّد مسار GTA V لعرض الملفات</p></div></td></tr>`}</tbody></table></div>`;
}
async function refresh() { const s = await window.api.gta.state(); if (G && s && s.success) G.files = s.files; renderLib(); renderMine(); }

async function afterInstall(r, okMsg) {
    if (r && r.needTarget) { await chooseTarget(r); return; }
    if (r && r.canceled) return;
    toast(r && r.success ? (r.message || okMsg) : ((r && r.message) || "فشل التثبيت"), r && r.success ? "success" : "error", 4500);
    await refresh();
}
async function chooseTarget(r) {
    const d = window.CA.dialog({ title: "اختر الملف المراد استبداله", body: `<p style="color:var(--text-2);font-size:13px">«${esc(r.fileName)}» لا يطابق اسم أي ملف في المجلد. اختر الملف الذي سيحلّ محلّه:</p><select class="sel ltr" id="tg">${r.candidates.map((c) => `<option>${esc(c)}</option>`).join("")}</select>`, footer: `<button class="btn" data-dlg="close">إلغاء</button><button class="btn btn-primary" id="tgGo">استبدال</button>` });
    d.el.querySelector("#tgGo").addEventListener("click", async () => { const t = d.el.querySelector("#tg").value; d.close(); const x = await window.api.gta.installLocalAs(r.token, t); await afterInstall(x, "تم الاستبدال"); });
}
document.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "bDetect") { await loadGta(true); await refresh(); }
    else if (b.id === "bPick") { const r = await window.api.gta.select(); if (r && r.success) { await loadGta(false); await refresh(); toast("تم حفظ المسار", "success"); } else if (r && r.message) toast(r.message, "error"); }
    else if (b.id === "bLocal") { const r = await window.api.gta.installLocal(); await afterInstall(r, "تم التثبيت"); }
    else if (b.id === "bRestoreAll") { if (await askConfirm({ title: "استرجاع كل الأصليات؟", message: "ستُعاد كل ملفات الصوت التي استبدلتها إلى حالتها الأصلية.", confirmText: "استرجاع" })) { const r = await window.api.gta.restore({ all: true }); toast(r.message, r.success ? "success" : "error"); await refresh(); } }
    else if (b.dataset.act === "restore") { const n = b.closest("[data-n]").dataset.n; const r = await window.api.gta.restore({ name: n }); toast(r.message, r.success ? "success" : "error"); await refresh(); }
    else if (b.dataset.act === "install") {
        const id = b.closest("[data-id]").dataset.id; const s = LIB.find((x) => x.id === id); if (!s || busy) return;
        if (!G || !G.success) { toast("حدّد مسار GTA V أولاً", "error"); return; }
        busy = id; renderLib();
        const r = await window.api.lib.install({ type: "sound", id }); busy = null; await afterInstall(r, "تم تركيب الساوند");
    }
});
$("tabsS").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; document.querySelectorAll("#tabsS .cchip").forEach((x) => x.classList.toggle("on", x === b)); $("pLib").classList.toggle("hidden", b.dataset.t !== "lib"); $("pMine").classList.toggle("hidden", b.dataset.t !== "mine"); });
window.api.onDownloadProgress((d) => { const b = $("bar"), t = $("dtxt"); if (b) b.style.width = d.percent + "%"; if (t) t.textContent = `${d.percent}%` + (d.speed && d.speed !== "0" ? ` · ${d.speed} MB/s` : ""); });
window.api.onInstallStatus((d) => { const t = $("dtxt"); if (t && d.msg) t.textContent = d.msg; });
(async () => {
    const S = await window.CA.ready; if (!S) return;
    await loadGta(false);
    const L = await window.CA.getLibrary(true);
    LIB = (L && L.success && L.sounds) || [];
    renderLib(); renderMine();
})();
