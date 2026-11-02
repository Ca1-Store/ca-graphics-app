/* ==========================================================================
   CA STORE — SHELL
   يبني شريط العنوان + القائمة الجانبية لكل الصفحات من مكان واحد،
   ويوفّر أدوات مشتركة: الأيقونات، الإشعارات، نافذة التأكيد.
   ========================================================================== */
(function () {
    "use strict";

    /* ---------- icon sprite ---------- */
    const ICONS = {
        pause:    '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
        upload:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
        ext:      '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        sliders2: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/><circle cx="9" cy="6" r="2" fill="#13161b"/><circle cx="15" cy="12" r="2" fill="#13161b"/><circle cx="7" cy="18" r="2" fill="#13161b"/>',
        heart:    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
        list:     '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
        undo:     '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
        home:     '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        grid:     '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
        package:  '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
        palette:  '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
        zap:      '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
        sliders:  '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
        logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
        search:   '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        x:        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
        minus:    '<path d="M5 12h14"/>',
        square:   '<rect width="16" height="16" x="4" y="4" rx="2"/>',
        trash:    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
        check:    '<path d="M20 6 9 17l-5-5"/>',
        lock:     '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        star:     '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        clock:    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        folder:   '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
        refresh:  '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        shield:   '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
        cpu:      '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
        wifi:     '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/>',
        user:     '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        alert:    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        info:     '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        copy:     '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        drive:    '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
        eye:      '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        archive:  '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
        history:  '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
        gauge:    '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
        monitor:  '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
        layers:   '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
        chevron:  '<path d="m6 9 6 6 6-6"/>',
        message:  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        waves:    '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
        snow:     '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
        mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
        rain:     '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
        network:  '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
        memory:   '<path d="M6 19v-3"/><path d="M10 19v-3"/><path d="M14 19v-3"/><path d="M18 19v-3"/><path d="M8 11V9"/><path d="M16 11V9"/><path d="M12 11V9"/><path d="M2 15h20"/><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.8V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.8z"/>',
        play:     '<polygon points="6 3 20 12 6 21 6 3"/>',
        key:      '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
        file:     '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
        discord:  '<path fill="currentColor" stroke="none" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.4a18.3 18.3 0 0 1 4.4 1.4 15.9 15.9 0 0 0-15.2 0A18.3 18.3 0 0 1 8.8 3.4L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9.1-.3 13.7.1 18.2a19.9 19.9 0 0 0 6 3l1.3-2.1a13 13 0 0 1-2-.9l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a13 13 0 0 1-2 .9l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.8-3.6-13.8zM8.3 15.5c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/>'
    };
    Object.assign(ICONS, window.CA_ICONS_EXTRA || {});

    function ic(name, cls) {
        return `<svg class="i ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`;
    }
    function esc(v) {
        return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function injectSprite() {
        if (document.getElementById("ca-sprite")) return;
        const wrap = document.createElement("div");
        wrap.innerHTML =
            '<svg id="ca-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">' +
            Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("") +
            "</svg>";
        document.body.prepend(wrap.firstChild);
    }
    /* رابط صورة آمن للعرض (http/https فقط) */
    const safeImg = (u) => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
    const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");
    function ago(iso) {
        const t = new Date(iso).getTime(); if (!t) return "";
        const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
        if (s < 60) return "قبل لحظات"; const m = Math.floor(s / 60); if (m < 60) return `قبل ${m} د`;
        const h = Math.floor(m / 60); if (h < 24) return `قبل ${h} س`; const d = Math.floor(h / 24); if (d < 30) return `قبل ${d} يوم`;
        return new Date(iso).toLocaleDateString("ar-SA");
    }

    /* ---------- toast ---------- */
    let toastTimer;
    function toast(message, type = "success", ms = 3200) {
        let box = document.getElementById("notify");
        if (!box) { box = document.createElement("div"); box.id = "notify"; box.className = "notification"; document.body.appendChild(box); }
        box.textContent = message;
        box.className = `notification show ${type}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => box.classList.remove("show"), ms);
    }

    /* ---------- confirm dialog ---------- */
    function confirmDialog({ title = "تأكيد الإجراء", message = "", details = [], confirmText = "تأكيد", cancelText = "إلغاء", danger = false, typeToConfirm = "" } = {}) {
        return new Promise((resolve) => {
            const el = document.createElement("div");
            el.className = "popup";
            el.style.zIndex = 3000;
            el.innerHTML = `
                <div class="modal" role="dialog" aria-modal="true">
                    <div class="modal-head">
                        <div style="display:flex;gap:14px;align-items:center;">
                            <div class="icon-tile ${danger ? "err" : "warn"}">${ic(danger ? "trash" : "alert", "lg")}</div>
                            <div>
                                <div class="modal-title">${esc(title)}</div>
                                ${message ? `<div class="modal-sub">${esc(message)}</div>` : ""}
                            </div>
                        </div>
                    </div>
                    ${details.length ? `<ul class="detail-list">${details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
                    ${typeToConfirm ? `<div class="fld" style="margin-top:14px"><label>اكتب الاسم للتأكيد: <b>${esc(typeToConfirm)}</b></label><input class="inp" id="ttc" autocomplete="off"></div>` : ""}
                    <div class="modal-actions">
                        <button class="btn" data-act="no">${esc(cancelText)}</button>
                        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="yes" ${typeToConfirm ? "disabled" : ""}>${esc(confirmText)}</button>
                    </div>
                </div>`;
            const done = (v) => { document.removeEventListener("keydown", onKey); el.remove(); resolve(v); };
            const onKey = (e) => { if (e.key === "Escape") done(false); };
            el.addEventListener("click", (e) => {
                const act = e.target.closest("[data-act]")?.dataset.act;
                if (act === "yes") done(typeToConfirm ? (el.querySelector("#ttc").value === typeToConfirm ? typeToConfirm : false) : true);
                else if (act === "no" || e.target === el) done(false);
            });
            if (typeToConfirm) el.querySelector("#ttc").addEventListener("input", (e) => { el.querySelector('[data-act="yes"]').disabled = e.target.value !== typeToConfirm; });
            document.addEventListener("keydown", onKey);
            document.body.appendChild(el);
            (typeToConfirm ? el.querySelector("#ttc") : el.querySelector('[data-act="yes"]')).focus();
        });
    }

    /* ---------- حوار عام (يُستخدم في الأدمن والمودال) ---------- */
    function dialog({ title = "", body = "", footer = "", wide = false } = {}) {
        const el = document.createElement("div");
        el.className = "dlg-ov";
        el.innerHTML = `<div class="dlg ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><div class="dlg-h"><h3>${esc(title)}</h3><button class="modal-x" data-dlg="close">${ic("x")}</button></div><div class="dlg-b">${body}</div>${footer ? `<div class="dlg-f">${footer}</div>` : ""}</div>`;
        const close = () => { document.removeEventListener("keydown", onKey); el.remove(); };
        const onKey = (e) => { if (e.key === "Escape") close(); };
        el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });
        el.addEventListener("click", (e) => { if (e.target.closest('[data-dlg="close"]')) close(); });
        document.addEventListener("keydown", onKey);
        document.body.appendChild(el);
        return { el, close, body: el.querySelector(".dlg-b"), footer: el.querySelector(".dlg-f") };
    }

    /* ---------- الجلسة والـAPI ---------- */
    let SESSION = null;
    const api = (m, p, b) => {
        const f = { GET: "get", POST: "post", PUT: "put", DELETE: "del" }[m];
        return f === "get" || f === undefined ? window.api.v4.get(p) : window.api.v4[f](p, b);
    };
    let libCache = null, libAt = 0;
    async function getLibrary(force) {
        if (!force && libCache && Date.now() - libAt < 45000) return libCache;
        const r = await window.api.v4.get("/api/v4/library");
        if (r && r.success) { libCache = r; libAt = Date.now(); }
        return r;
    }

    /* ---------- تخزين خفيف + مفضلة متزامنة ---------- */
    const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
    let serverPrefs = null, saveT = null;
    function pushPrefs() {
        clearTimeout(saveT);
        saveT = setTimeout(async () => {
            if (!serverPrefs) { const r = await window.api.v4.get("/api/v4/prefs"); serverPrefs = (r && r.success && r.prefs) || {}; }
            const f = { mod: [], pack: [], preset: [], bundle: [] };
            lsGet("ca_favs", []).forEach((k) => { const [t, ...r] = String(k).split(":"); if (f[t]) f[t].push(t === "mod" || t === "bundle" ? Number(r.join(":")) : r.join(":")); });
            serverPrefs.favorites = f;
            window.api.v4.put("/api/v4/prefs", { prefs: serverPrefs });
        }, 1200);
    }
    async function pullPrefs() {
        const r = await window.api.v4.get("/api/v4/prefs");
        if (!r || !r.success) return;
        serverPrefs = r.prefs || {};
        const f = serverPrefs.favorites || {};
        const keys = []; Object.keys(f).forEach((t) => (f[t] || []).forEach((id) => keys.push(t + ":" + id)));
        if (keys.length || !lsGet("ca_favs", []).length) lsSet("ca_favs", keys);
    }
    const favs = {
        has: (key) => lsGet("ca_favs", []).includes(key),
        toggle(key) {
            const l = lsGet("ca_favs", []);
            const i = l.indexOf(key);
            if (i >= 0) l.splice(i, 1); else l.push(key);
            lsSet("ca_favs", l);
            pushPrefs();
            return i < 0;
        },
        count: (prefix) => lsGet("ca_favs", []).filter((k) => k.startsWith(prefix)).length
    };
    const prefs = { get: (k, d) => lsGet("ca_pref_" + k, d), set: (k, v) => lsSet("ca_pref_" + k, v) };
    const applyDensity = () => document.body.classList.toggle("compact", prefs.get("density", "cozy") === "compact");
    applyDensity();

    /* ---------- التنقل ---------- */
    const NAV = [
        { group: "الرئيسية" },
        { page: "index",       file: "index.html",       icon: "home",    label: "الرئيسية" },
        { page: "versions",    file: "versions.html",    icon: "grid",    label: "باكات الجرافيكس", badge: "plan" },
        { page: "addons",      file: "addons.html",      icon: "package", label: "مكتبة المودات", badge: "newMods" },
        { page: "customize",   file: "customize.html",   icon: "sliders", label: "التخصيص والفلاتر" },
        { page: "performance", file: "performance.html", icon: "gauge",   label: "تحسين الأداء" },
        { page: "sounds",      file: "sounds.html",      icon: "waves",   label: "ساوندات الأسلحة" },
        { group: "حسابي" },
        { page: "downloads",   file: "downloads.html",   icon: "download",label: "التحميلات" },
        { page: "profiles",    file: "profiles.html",    icon: "layers",  label: "ملفات التعريف" },
        { page: "news",        file: "news.html",        icon: "megaphone", label: "الأخبار والتحديثات" },
        { page: "diagnostics", file: "diagnostics.html", icon: "activity",label: "التشخيص" },
        { page: "settings",    file: "settings.html",    icon: "sliders2",label: "الإعدادات" },
        { group: "الإدارة — لك فقط", admin: true },
        { page: "admin",       file: "admin.html",       icon: "shield",  label: "لوحة الأدمن", admin: true }
    ];
    const PAGE_LABEL = Object.fromEntries(NAV.filter((n) => n.page).map((n) => [n.page, n.label]));
    PAGE_LABEL.splash = "";

    async function logout() {
        try { sessionStorage.clear(); } catch {}
        try { await window.api.auth.logout(); } catch {}
        window.api.openPage("login.html");
    }
    const go = (file) => window.api.openPage(file);

    function buildTopBar() {
        const bar = document.createElement("div");
        bar.className = "top-bar drag-region";
        bar.innerHTML = `
            <div class="top-title"><img src="../assets/logo.png" alt="">CA STORE · GRAPHICS MANAGER</div>
            <div class="win-controls">
                <button class="win-btn" data-win="minimize" title="تصغير">${ic("minus")}</button>
                <button class="win-btn" data-win="fullscreen" title="تكبير">${ic("square")}</button>
                <button class="win-btn close" data-win="close" title="إغلاق">${ic("x")}</button>
            </div>`;
        bar.addEventListener("click", (e) => {
            const b = e.target.closest("[data-win]");
            if (b) window.api[b.dataset.win]?.();
        });
        return bar;
    }

    function buildSidebar(page) {
        const admin = !!(SESSION && (SESSION.isAdmin || SESSION.isOwner));
        const aside = document.createElement("aside");
        aside.className = "sidebar";
        const plan = SESSION && SESSION.plans && SESSION.plans.length ? SESSION.plans.slice().sort().pop() : "";
        aside.innerHTML = `
            <div class="brand">
                <img src="../assets/logo.png" alt="Ca Store">
                <div class="brand-text"><span class="brand-name">Ca Store</span><span class="brand-sub">الإصدار ${esc((SESSION && SESSION.appVersion) || "")}</span></div>
            </div>
            <button class="side-search" id="palBtn">${ic("search")}<span>ابحث أو اكتب أمراً...</span><kbd>Ctrl K</kbd></button>
            ${NAV.filter((n) => !n.admin || admin).map((n) => n.group
                ? `<div class="nav-title">${n.group}</div>`
                : `<button class="nav-item ${n.page === page ? "active" : ""}" data-file="${n.file}" title="${n.label}">${ic(n.icon)}<span>${n.label}</span>${n.badge === "plan" && plan ? `<span class="nav-badge">${esc(plan)}</span>` : ""}${n.badge === "newMods" ? `<span class="nav-badge ok hidden" id="navNew"></span>` : ""}</button>`
            ).join("")}
            <div class="side-spacer"></div>
            <div class="side-foot">
                <div class="user-chip" id="userChip">
                    <div class="user-avatar" id="userAvatar">${ic("user")}</div>
                    <div class="user-meta">
                        <span class="user-name" id="userName">${esc((SESSION && SESSION.username) || "...")}</span>
                        <span class="user-plan" id="userPlan">${SESSION ? esc(SESSION.isOwner ? "المالك · " : (SESSION.isAdmin ? "مشرف · " : "")) + esc((SESSION.plans || []).join(" + ") || "بدون اشتراك") : ""}</span>
                    </div>
                </div>
                <div class="side-actions">
                    <button class="nav-item" id="updateBtn" title="التحقق من التحديثات">${ic("refresh")}<span>تحديث</span></button>
                    <button class="nav-item danger" id="logoutBtn" title="تسجيل الخروج">${ic("logout")}<span>خروج</span></button>
                </div>
            </div>`;
        aside.addEventListener("click", (e) => {
            const item = e.target.closest(".nav-item[data-file]");
            if (item && !item.classList.contains("active")) go(item.dataset.file);
        });
        aside.querySelector("#logoutBtn").addEventListener("click", logout);
        aside.querySelector("#updateBtn").addEventListener("click", checkUpdate);
        aside.querySelector("#palBtn").addEventListener("click", openPalette);
        const nm = (SESSION && SESSION.username) || "";
        if (nm) aside.querySelector("#userAvatar").textContent = nm.trim().charAt(0).toUpperCase();
        return aside;
    }

    /* ---------- الشريط العلوي (فتات الخبز + حالة) ---------- */
    function buildTopline(page) {
        const el = document.createElement("div");
        el.className = "topline";
        const plan = SESSION && SESSION.plans && SESSION.plans.length ? SESSION.plans.slice().sort().pop() : "";
        el.innerHTML = `
            <div class="crumbs">${ic("home")}<span>الرئيسية</span>${page !== "index" ? `<span>/</span><b>${esc(PAGE_LABEL[page] || "")}</b>` : ""}</div>
            <div class="grow"></div>
            <span class="tpill hidden" id="pillDl">${ic("download")}<span id="pillDlTxt"></span></span>
            <span class="tpill" id="pillConn"><span class="d"></span><span id="pillConnTxt">فحص...</span></span>
            ${plan ? `<span class="tpill">${ic("crown")}${esc(plan)}</span>` : ""}
            <button class="tpill" id="pillNews" title="الأخبار">${ic("bell")}<span class="cnt hidden" id="newsCnt"></span></button>`;
        el.querySelector("#pillNews").addEventListener("click", () => go("news.html"));
        el.querySelector("#pillDl").addEventListener("click", () => go("downloads.html"));
        return el;
    }
    async function pingLoop() {
        const pill = document.getElementById("pillConn"), txt = document.getElementById("pillConnTxt");
        if (!pill) return;
        const t0 = performance.now();
        const r = await window.api.v4.get("/api/v4/config");
        const ms = Math.round(performance.now() - t0);
        const ok = !!(r && r.success);
        pill.className = "tpill " + (ok ? (ms > 1500 ? "warn" : "ok") : "err");
        txt.textContent = ok ? `متصل · ${ms}ms` : "غير متصل";
        const sb = document.getElementById("sbPing"); if (sb) sb.textContent = ok ? ms + " ms" : "—";
        if (ok) renderBanners(r.banners || []);
        setTimeout(pingLoop, 60000);
    }
    function renderBanners(list) {
        const box = document.getElementById("banners"); if (!box) return;
        const dis = lsGet("ca_banner_dis", []);
        box.innerHTML = list.filter((b) => b.kind !== "news" && b.kind !== "release" && !dis.includes(b.id)).map((b) =>
            `<div class="banner ${esc(b.kind)}" data-bid="${esc(b.id)}">${ic(b.kind === "info" ? "info" : "alert")}<span><b>${esc(b.title || "")}</b> ${esc(b.body || "")}</span><button class="x" data-x="${esc(b.id)}">${ic("x")}</button></div>`).join("");
    }
    async function pollDl() {
        try {
            const s = await window.api.getDownloadState?.();
            const pill = document.getElementById("pillDl"), t = document.getElementById("pillDlTxt");
            const run = s && (s.running || (s.stage && !["done", "error", ""].includes(s.stage)));
            if (pill) { pill.classList.toggle("hidden", !run); if (run) t.textContent = `${s.name || "تحميل"} · ${s.percent || 0}%`; }
            const bar = document.getElementById("sbBar"); if (bar) bar.style.width = run ? (s.percent || 0) + "%" : "0";
        } catch {}
        setTimeout(pollDl, 1500);
    }
    async function loadNewsBadge() {
        const r = await window.api.v4.get("/api/v4/news?limit=10");
        if (!r || !r.success) return;
        const seen = lsGet("ca_news_seen", 0);
        const items = [...(r.news || []), ...(r.releases || [])];
        const n = items.filter((x) => new Date(x.createdAt || x.startsAt || 0).getTime() > seen).length;
        const c = document.getElementById("newsCnt"); if (c && n) { c.textContent = n > 9 ? "+9" : String(n); c.classList.add("ltr"); c.classList.remove("hidden"); }
    }
    async function loadNavNew() {
        try {
            const L = await getLibrary(); if (!L || !L.success) return;
            const n = (L.mods || []).filter((m) => m.isNew).length;
            const b = document.getElementById("navNew"); if (b && n) { b.textContent = n + " جديد"; b.classList.remove("hidden"); }
        } catch {}
    }

    /* ---------- لوحة الأوامر Ctrl+K ---------- */
    let palEl = null;
    async function openPalette() {
        if (palEl) return;
        const items = NAV.filter((n) => n.page && (!n.admin || (SESSION && (SESSION.isAdmin || SESSION.isOwner)))).map((n) => ({ label: n.label, hint: "صفحة", icon: n.icon, run: () => go(n.file) }));
        items.push({ label: "التحقق من التحديثات", hint: "أمر", icon: "refresh", run: checkUpdate });
        items.push({ label: "تبديل الكثافة (مريح / مضغوط)", hint: "أمر", icon: "list", run: () => { prefs.set("density", prefs.get("density", "cozy") === "compact" ? "cozy" : "compact"); applyDensity(); } });
        items.push({ label: "تسجيل الخروج", hint: "أمر", icon: "logout", run: logout });
        try { const L = await getLibrary(); ((L && L.mods) || []).forEach((m) => items.push({ label: m.name, hint: "مود", icon: "package", run: () => { try { sessionStorage.setItem("ca_focus", String(m.id)); } catch {} go("addons.html"); } })); } catch {}
        palEl = document.createElement("div");
        palEl.className = "pal-ov";
        palEl.innerHTML = `<div class="pal"><div class="pal-in">${ic("search")}<input id="palIn" placeholder="ابحث عن صفحة أو مود أو أمر..." autocomplete="off"><span class="kbd">Esc</span></div><div class="pal-list" id="palList"></div></div>`;
        document.body.appendChild(palEl);
        const inp = palEl.querySelector("#palIn"), list = palEl.querySelector("#palList");
        let cur = 0, shown = [];
        const draw = () => {
            const q = inp.value.trim().toLowerCase();
            shown = items.filter((i) => !q || i.label.toLowerCase().includes(q)).slice(0, 40);
            cur = Math.min(cur, Math.max(0, shown.length - 1));
            list.innerHTML = shown.length ? shown.map((i, k) => `<button class="pal-it ${k === cur ? "on" : ""}" data-k="${k}">${ic(i.icon)}<span>${esc(i.label)}</span><small>${i.hint}</small></button>`).join("") : '<div class="pal-empty">لا توجد نتائج</div>';
        };
        const close = () => { palEl && palEl.remove(); palEl = null; };
        const pick = (k) => { const it = shown[k]; close(); if (it) it.run(); };
        inp.addEventListener("input", () => { cur = 0; draw(); });
        inp.addEventListener("keydown", (e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") { cur = Math.min(shown.length - 1, cur + 1); draw(); e.preventDefault(); }
            else if (e.key === "ArrowUp") { cur = Math.max(0, cur - 1); draw(); e.preventDefault(); }
            else if (e.key === "Enter") pick(cur);
        });
        list.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) pick(Number(b.dataset.k)); });
        palEl.addEventListener("mousedown", (e) => { if (e.target === palEl) close(); });
        draw(); inp.focus();
    }

    /* ---------- ما الجديد بعد التحديث ---------- */
    async function whatsNew() {
        try {
            const v = SESSION && SESSION.appVersion; if (!v) return;
            const seen = lsGet("ca_seen_version", null);
            if (seen === v) return;
            lsSet("ca_seen_version", v);
            if (!seen) return; // أول تشغيل بعد التثبيت: لا نزعج المستخدم
            const r = await window.api.v4.get("/api/v4/whats-new?version=" + encodeURIComponent(v));
            if (!r || !r.success || !(r.notes || []).length) return;
            const d = dialog({ title: "ما الجديد في الإصدار " + v, body: `<div class="wn">${r.notes.map((n) => `<h4 style="color:#fff">${esc(n.title)}</h4><p style="color:var(--text-2);white-space:pre-wrap;font-size:13px;margin-top:4px">${esc(n.body)}</p>`).join("<hr style='border:0;border-top:1px solid var(--line);margin:14px 0'>")}</div>`, footer: '<button class="btn btn-primary" data-dlg="close">فهمت</button>' });
        } catch {}
    }

    /* ---------- تحديثات ---------- */
    function checkUpdate() {
        const btn = document.getElementById("updateBtn");
        if (!btn || btn.classList.contains("is-busy")) return;
        btn.classList.add("is-busy");
        window.api.onUpdateStatus?.((d) => {
            toast(d.message || "", d.status === "error" ? "error" : (d.status === "none" ? "success" : "info"), 4000);
            if (d.status !== "checking") btn.classList.remove("is-busy");
        });
        window.api.onUpdateProgress?.((d) => toast(`جاري تحميل التحديث ${d.percent}%`, "info", 2000));
        Promise.resolve(window.api.checkUpdate?.()).catch(() => { btn.classList.remove("is-busy"); toast("تعذّر التحقق من التحديثات", "error"); });
        setTimeout(() => btn.classList.remove("is-busy"), 15000);
    }

    /* ---------- boot ---------- */
    async function boot() {
        const page = document.body.dataset.page || "";
        injectSprite();
        document.body.insertBefore(buildTopBar(), document.body.querySelector(".bg")?.nextSibling || document.body.firstChild.nextSibling);
        document.querySelectorAll("[data-ic]").forEach((el) => { el.insertAdjacentHTML("afterbegin", ic(el.dataset.ic, el.dataset.icSize || "")); });

        // تفويض الأحداث (بدل onclick المضمّن — ممنوع بسياسة CSP)
        document.addEventListener("click", (e) => {
            const o = e.target.closest("[data-open]"); if (o) { go(o.dataset.open); return; }
            const x = e.target.closest("[data-ext]"); if (x) { window.api.openExternal(x.dataset.ext); return; }
            const bx = e.target.closest(".banner .x"); if (bx) { const l = lsGet("ca_banner_dis", []); l.push(bx.dataset.x); lsSet("ca_banner_dis", l.slice(-50)); bx.closest(".banner").remove(); }
        });
        document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && page !== "login" && page !== "splash") { e.preventDefault(); openPalette(); } });
        document.addEventListener("contextmenu", (e) => { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
        window.api.onSessionEnded?.((d) => { toast(d && d.code === "BANNED" ? "تم إيقاف هذا الحساب" : "انتهت الجلسة، سجّل الدخول من جديد", "error", 4000); setTimeout(() => go("login.html"), 1200); });

        if (page === "login" || page === "splash") { resolveReady(null); return; }

        SESSION = await window.api.session();
        if (!SESSION) { go("splash.html"); return; }
        window.CA.session = SESSION;

        const content = document.querySelector("main.content");
        if (content) {
            const shell = document.createElement("div");
            shell.className = "app-shell";
            const col = document.createElement("div");
            col.className = "main-col";
            const banners = document.createElement("div"); banners.className = "banners"; banners.id = "banners";
            const sb = document.createElement("div"); sb.className = "statusbar";
            sb.innerHTML = `<span class="sb">${ic("server")}<span id="sbPing" class="ltr">—</span></span><span class="sb">${ic("shield")}اتصال مُوثَّق</span><span class="grow"></span><span class="sb" id="sbDl"><span class="sbar"><i id="sbBar"></i></span></span><span class="sb">v${esc(SESSION.appVersion || "")}</span>`;
            content.replaceWith(shell);
            shell.appendChild(buildSidebar(page));
            shell.appendChild(col);
            col.append(buildTopline(page), banners, content, sb);
        }
        pingLoop(); pollDl(); loadNewsBadge(); loadNavNew(); pullPrefs(); whatsNew();
        resolveReady(SESSION);
    }

    let resolveReady; const ready = new Promise((r) => { resolveReady = r; });
    window.CA = { ic, esc, toast, confirm: confirmDialog, dialog, logout, favs, prefs, lsGet, lsSet, applyDensity, api, getLibrary, safeImg, fmtNum, ago, go, openPalette, session: null, ready };
    window.logout = logout;
    boot();
})();
