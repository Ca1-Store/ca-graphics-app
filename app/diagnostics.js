const { ic, esc, toast } = window.CA;
const $ = (id) => document.getElementById(id);
async function run() {
    $("checks").innerHTML = `<div class="skel" style="height:60px"></div><div class="skel" style="height:60px"></div>`;
    const d = await window.api.diag.run();
    if (!d || d.success === false) { $("checks").innerHTML = `<div class="empty"><p>تعذّر تشغيل الفحص</p></div>`; return; }
    const gb = (b) => b == null ? "—" : (b / 1073741824).toFixed(1) + " GB";
    $("kp").innerHTML = [
        ["النظام", d.os || "—", ""], ["المعالج", (d.cpu || "—").toString().slice(0, 28), ""], ["الذاكرة", (d.ramGB || "—") + " GB", ""],
        ["المساحة الحرة", gb(d.fivem && d.fivem.freeBytes), d.fivem && d.fivem.found ? "على قرص اللعبة" : ""],
        ["زمن الاستجابة", d.ping && d.ping.ok ? d.ping.backendMs + " ms" : "—", d.ping && d.ping.ok ? "ok" : "err"]
    ].map(([k, v, s]) => `<div class="kpi"><div class="k">${esc(k)}</div><div class="v" style="font-size:20px">${esc(String(v))}</div><div class="s ${s === "ok" || s === "err" ? s : ""}">${s && s !== "ok" && s !== "err" ? esc(s) : ""}</div></div>`).join("");
    const ICON = { ok: "check", warn: "alert", error: "x" };
    $("checks").innerHTML = (d.checks || []).map((c) => `<div class="chk-row ${esc(c.state)}"><div class="st">${ic(ICON[c.state] || "info")}</div><div class="t">${esc(c.label)}</div><div class="d">${esc(c.detail || "")}</div></div>`).join("") || `<div class="empty"><p>لا نتائج</p></div>`;
}
$("rerun").addEventListener("click", run);
$("exp").addEventListener("click", async () => { const r = await window.api.diag.export(); if (r && r.success) toast("تم حفظ التقرير", "success"); else if (r && r.message) toast(r.message, "error"); });
window.CA.ready.then((S) => { if (S) run(); });
