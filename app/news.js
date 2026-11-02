const { ic, esc, ago } = window.CA;
const $ = (id) => document.getElementById(id);
let items = [], filter = "all";
const ICON = { release: "package", news: "megaphone", info: "info", warning: "alert" };
function render() {
    const l = items.filter((i) => filter === "all" || (filter === "release" ? i.k === "release" : i.k !== "release"));
    $("list").innerHTML = l.length ? l.map((i) => `<article class="news-item"><div class="ni">${ic(ICON[i.k] || "megaphone")}</div><div style="flex:1;min-width:0"><h4>${esc(i.t)} ${i.k === "release" ? '<span class="badge hi">تحديث</span>' : ""}</h4><p>${esc(i.b)}</p><div class="dt">${esc(ago(i.at))}</div></div></article>`).join("") : `<div class="empty"><div class="icon-tile">${ic("megaphone")}</div><h3>لا يوجد شيء هنا</h3><p>سنُعلمك فور وجود جديد.</p></div>`;
}
$("nf").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; filter = b.dataset.f; document.querySelectorAll("#nf .cchip").forEach((x) => x.classList.toggle("on", x === b)); render(); });
(async () => {
    const S = await window.CA.ready; if (!S) return;
    const r = await window.api.v4.get("/api/v4/news?limit=40");
    if (!r || !r.success) { $("list").innerHTML = `<div class="empty"><p>${esc((r && r.message) || "تعذّر التحميل")}</p></div>`; return; }
    items = [...(r.news || []).map((x) => ({ k: x.kind || "news", t: x.title, b: x.body || "", at: x.startsAt || x.createdAt })),
        ...(r.releases || []).map((x) => ({ k: "release", t: `${x.name}${x.version ? " — v" + x.version : ""}`, b: x.changelog || "تم إصدار تحديث جديد.", at: x.createdAt }))]
        .sort((a, b) => new Date(b.at) - new Date(a.at));
    render();
})();
