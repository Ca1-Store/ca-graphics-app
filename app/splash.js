const { ic, esc } = window.CA;
const STEPS = [
    ["update", "فحص التحديثات"],
    ["server", "الاتصال بالخادم"],
    ["auth", "التحقق من حسابك ورتبتك"],
    ["fivem", "اكتشاف مسار FiveM"],
    ["library", "تجهيز المكتبة والمودات"]
];
const $ = (id) => document.getElementById(id);
const box = $("spSteps");
const t0 = {};
box.innerHTML = STEPS.map(([id, label]) => `<div class="sp-step" id="st-${id}"><span class="sdot">${ic("check")}</span><span class="lbl">${label}</span><span class="dt"></span></div>`).join("");

function setPct(p) {
    const c = 2 * Math.PI * 76;
    $("spPg").style.strokeDashoffset = String(c * (1 - Math.max(0, Math.min(100, p)) / 100));
    $("spBar").style.width = p + "%";
}
setPct(2);

function showState(kind, message) {
    const el = $("spState");
    if (kind === "ready") { el.innerHTML = ""; $("spSub").textContent = "جاهز"; return; }
    const meta = {
        maintenance: ["صيانة", "wrench"], offline: ["لا يوجد اتصال", "wifi"], forceUpdate: ["تحديث إلزامي", "refresh"]
    }[kind] || ["تنبيه", "alert"];
    $("spSub").textContent = "";
    el.innerHTML = `<div class="sp-state ${esc(kind)}"><h3>${meta[0]}</h3><p>${esc(message || "")}</p>${kind !== "forceUpdate" ? '<button class="btn btn-primary" id="spRetry">إعادة المحاولة</button>' : ""}</div>`;
    const r = $("spRetry");
    if (r) r.addEventListener("click", () => { el.innerHTML = ""; setPct(2); STEPS.forEach(([id]) => { $("st-" + id).className = "sp-step"; $("st-" + id).querySelector(".dt").textContent = ""; }); $("spSub").textContent = "جاري تجهيز بيئتك..."; window.api.splash.retry(); });
}

window.api.splash.onEvent((e) => {
    if (e.type === "step") {
        const el = $("st-" + e.id); if (!el) return;
        el.className = "sp-step " + (e.state === "pending" ? "" : e.state);
        if (e.state === "active") t0[e.id] = performance.now();
        const dt = el.querySelector(".dt");
        if (e.state === "done" || e.state === "error") dt.textContent = e.detail || ((t0[e.id] ? ((performance.now() - t0[e.id]) / 1000).toFixed(1) + "s" : ""));
        else if (e.detail) dt.textContent = e.detail;
        if (e.state === "active") $("spSub").textContent = STEPS.find((s) => s[0] === e.id)[1] + "...";
    } else if (e.type === "progress") setPct(e.percent);
    else if (e.type === "tip") { $("spTipTxt").textContent = e.text; $("spTip").classList.remove("hidden"); }
    else if (e.type === "state") showState(e.kind, e.message);
    else if (e.type === "update") {
        $("spUpd").classList.remove("hidden");
        if (e.version) $("spUpd").dataset.v = e.version;
        $("spUpdTxt").textContent = `تحديث ${$("spUpd").dataset.v || ""} — يتم تنزيله ${e.percent != null ? e.percent + "%" : ""}`;
    }
});
window.api.app.version().then((v) => { $("spFoot").textContent = `CA STORE  •  الإصدار ${v}`; }).catch(() => {});
window.api.splash.ready();
