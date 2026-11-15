/* الرئيسية — تعتمد على /api/v4/library و /news */
const { ic, esc, safeImg, fmtNum, ago } = window.CA;
const $ = (id) => document.getElementById(id);

function card(m) {
    const img = safeImg(m.cover);
    return `<div class="mcard" data-focus="${esc(m.id)}" style="cursor:pointer"><div class="cv">${img ? `<img src="${esc(img)}" alt="">` : `<div class="ph">${ic("package")}</div>`}<div class="tg"><span class="badge hi">${m.isNew ? "جديد" : "مُحدَّث"}</span></div></div><div class="cb" style="padding-bottom:12px"><h5 style="font-size:13.5px">${esc(m.name)}</h5><div class="meta"><span>${esc(m.sizeLabel || "")}</span><span>v${esc(m.version || "1")}</span></div></div></div>`;
}
const NEWS_ICON = { release: "package", news: "megaphone", info: "info", warning: "alert" };

(async function init() {
    const S = await window.CA.ready; if (!S) return;
    $("heroTitle").textContent = `أهلاً بعودتك، ${S.username || "مستخدم"}`;
    $("kPlan").textContent = (S.plans || []).slice().sort().pop() || "—";
    $("kPlanS").textContent = (S.plans || []).length > 1 ? S.plans.join(" + ") : (S.isOwner ? "المالك" : S.isAdmin ? "مشرف" : "");

    const [L, N, inst, fv] = await Promise.all([
        window.CA.getLibrary(), window.api.v4.get("/api/v4/news?limit=6"), window.api.lib.installed().catch(() => null), window.api.getFiveMPath().catch(() => ({}))
    ]);

    if (L && L.success) {
        const mods = L.mods || [];
        const open = mods.filter((m) => m.unlocked);
        $("kMods").textContent = fmtNum(open.length);
        $("kModsS").textContent = `من أصل ${mods.length}`;
        const feat = mods.find((m) => m.featured) || mods.find((m) => m.isNew);
        if (feat) {
            $("heroTag").textContent = feat.featured ? "مود الأسبوع" : "جديد";
            $("heroTitle").textContent = feat.name;
            $("heroDesc").textContent = feat.description || "";
            $("heroBtn").dataset.open = "addons.html";
            $("heroBtn").addEventListener("click", () => { try { sessionStorage.setItem("ca_focus", String(feat.id)); } catch {} });
            const img = safeImg(feat.cover); if (img) $("heroFeat").style.backgroundImage = `url("${img.replace(/"/g, "%22")}")`;
        }
        const fresh = mods.filter((m) => m.isNew || (m.updatedAt && Date.now() - new Date(m.updatedAt) < 7 * 864e5)).slice(0, 6);
        $("newGrid").innerHTML = fresh.length ? fresh.map(card).join("") : `<div class="empty" style="grid-column:1/-1"><p>لا جديد هذا الأسبوع</p></div>`;
        $("newGrid").addEventListener("click", (e) => { const c = e.target.closest("[data-focus]"); if (c) { try { sessionStorage.setItem("ca_focus", c.dataset.focus); } catch {} window.CA.go("addons.html"); } });
        if (inst) {
            const have = new Set((inst.mods || []).map((x) => x.toLowerCase()));
            const n = mods.filter((m) => m.fileName && have.has(String(m.fileName).toLowerCase())).length;
            $("kInst").textContent = fmtNum(n);
            const upd = 0; $("kInstS").textContent = (inst.presets || []).length ? `${inst.presets.length} فلتر` : "";
        }
    } else {
        $("newGrid").innerHTML = `<div class="empty" style="grid-column:1/-1"><p>${esc((L && L.message) || "تعذّر تحميل المكتبة")}</p></div>`;
    }

    if (N && N.success) {
        const items = [...(N.news || []).map((x) => ({ k: x.kind || "news", t: x.title, m: (x.body || "").slice(0, 70), at: x.startsAt || x.createdAt })),
            ...(N.releases || []).map((x) => ({ k: "release", t: `${x.name} ${x.version ? "v" + x.version : ""}`, m: (x.changelog || "").slice(0, 70), at: x.createdAt }))]
            .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5);
        $("newsFeed").innerHTML = items.length ? items.map((i) => `<div class="fi"><div class="ic">${ic(NEWS_ICON[i.k] || "megaphone")}</div><div><div class="t">${esc(i.t)}</div><div class="m">${esc(i.m)}</div></div><div class="tm">${esc(ago(i.at))}</div></div>`).join("") : `<div class="empty"><p>لا توجد أخبار</p></div>`;
    } else $("newsFeed").innerHTML = `<div class="empty"><p>تعذّر تحميل الأخبار</p></div>`;

    if (fv && fv.success) { $("kFivem").textContent = "جاهز"; $("kFivem").style.color = "var(--ok)"; $("kFivemS").textContent = fv.path; $("kFivemS").classList.add("ltr"); }
    else { $("kFivem").textContent = "غير مُعدّ"; $("kFivem").style.color = "var(--warn)"; $("kFivemS").textContent = "حدّد المسار من الإعدادات"; }
})();
