/* لوحة الأدمن — التبويبات */
(async function () {
    const { ic, esc, toast, confirm: askConfirm, dialog, fmtNum, ago } = window.CA;
    const E = window.AdminEdit, api = E.api, A = E.A;
    const $ = (id) => document.getElementById(id);
    const S = await window.CA.ready; if (!S) return;
    if (!(S.isOwner || S.isAdmin)) { $("view").innerHTML = `<div class="empty"><div class="icon-tile">${ic("lock")}</div><h3>غير مصرّح</h3><p>هذه الصفحة للمشرفين فقط.</p></div>`; $("tabs").remove(); return; }
    const can = (p) => S.isOwner || (S.perms || []).includes(p);
    const TABS = [
        { id: "overview", label: "نظرة عامة", icon: "gauge", show: true },
        { id: "mods", label: "المودات", icon: "package", show: can("mods") },
        { id: "packs", label: "باكات الجرافيكس", icon: "grid", show: can("packs") },
        { id: "presets", label: "الفلاتر", icon: "sliders", show: can("presets") },
        { id: "customs", label: "التخصيصات", icon: "palette", show: can("presets") },
        { id: "sounds", label: "ساوندات الأسلحة", icon: "waves", show: can("presets") },
        { id: "bundles", label: "الحزم", icon: "layers", show: can("bundles") },
        { id: "cats", label: "الأقسام", icon: "folder", show: can("mods") },
        { id: "users", label: "المستخدمون", icon: "users", show: can("users") },
        { id: "admins", label: "المشرفون", icon: "shield", show: S.isOwner },
        { id: "logs", label: "السجلات", icon: "history", show: can("logs") },
        { id: "reports", label: "بلاغات التثبيت", icon: "alert", show: can("logs") },
        { id: "ann", label: "الإعلانات", icon: "megaphone", show: can("announcements") },
        { id: "system", label: "النظام والروابط", icon: "server", show: can("system") },
        { id: "trash", label: "المحذوفات", icon: "trash", show: true }
    ].filter((t) => t.show);
    let cur = null, gen = 0;
    const view = $("view");
    const empty = (t) => `<div class="empty"><div class="icon-tile">${ic("search")}</div><p>${esc(t)}</p></div>`;
    const loading = () => { view.innerHTML = `<div class="skel" style="height:90px"></div><div class="skel" style="height:90px;margin-top:10px"></div>`; };
    const linkBadge = (x) => x.linkOk === true ? '<span class="badge ok">سليم</span>' : x.linkOk === false ? '<span class="badge err">معطّل</span>' : '<span class="badge">لم يُفحص</span>';
    const dt = (x) => x ? new Date(x).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" }) : "—";
    const fail = (r) => toast((r && r.message) || "تعذّر تنفيذ العملية", "error");
    const th = (a) => `<tr>${a.map((x) => `<th>${x}</th>`).join("")}</tr>`;
    const tbl = (head, rows) => `<div class="tbl-wrap"><table class="tbl"><thead>${th(head)}</thead><tbody>${rows || `<tr><td colspan="${head.length}">${empty("لا توجد بيانات")}</td></tr>`}</tbody></table></div>`;
    const csvOf = (head, rows) => [head, ...rows].map((r) => r.map((c) => { let s = String(c ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(",")).join("\r\n");
    const acts = (a) => `<div class="acts">${a.map(([act, icon, title, cls]) => `<button class="ibtn ${cls || ""}" data-act="${act}" title="${esc(title)}">${ic(icon)}</button>`).join("")}</div>`;

    function renderTabs() {
        $("tabs").innerHTML = TABS.map((t) => `<button class="atab ${t.id === cur ? "on" : ""}" data-tab="${t.id}">${ic(t.icon)}${esc(t.label)}</button>`).join("");
    }
    $("tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) open(b.dataset.tab); });
    async function open(id) { cur = id; const g = ++gen; renderTabs(); loading(); try { sessionStorage.setItem("ca_admin_tab", id); } catch {} const fn = RENDER[id]; if (fn) await fn(g); }
    const stale = (g) => g !== gen;

    /* ───── نظرة عامة ───── */
    async function overview(g) {
        const r = await api.get(A + "/overview"); if (stale(g)) return;
        if (!r || !r.success) { view.innerHTML = empty((r && r.message) || "تعذّر التحميل"); return; }
        const max = Math.max(1, ...r.downloads.series.map((s) => s.count));
        view.innerHTML = `
        <section class="stats4">
            <div class="kpi"><div class="k">المستخدمون</div><div class="v">${fmtNum(r.users.total)}</div><div class="s">${fmtNum(r.users.active7d)} نشط هذا الأسبوع · ${r.users.banned} محظور</div></div>
            <div class="kpi"><div class="k">التحميلات اليوم</div><div class="v">${fmtNum(r.downloads.today)}</div><div class="s">${fmtNum(r.downloads.d7)} خلال 7 أيام · ${fmtNum(r.downloads.d30)} خلال 30</div></div>
            <div class="kpi"><div class="k">إخفاقات التثبيت اليوم</div><div class="v">${r.failuresToday}</div><div class="s ${r.failuresToday ? "err" : "ok"}">${r.reportsOk24h} تثبيت ناجح خلال 24 ساعة</div></div>
            <div class="kpi"><div class="k">صحة الروابط</div><div class="v">${r.links.ok}<span style="font-size:15px;color:var(--text-3)"> / ${r.links.ok + r.links.bad + r.links.unknown}</span></div><div class="s ${r.links.bad ? "err" : "ok"}">${r.links.bad ? r.links.bad + " رابط معطّل" : "كل الروابط سليمة"}</div></div>
        </section>
        <div class="cols2" style="margin-top:14px">
            <section class="panel"><h3>${ic("activity")} التحميلات — آخر 14 يوماً</h3><div class="bars">${r.downloads.series.map((s) => `<div class="b" title="${esc(s.day)}: ${s.count}"><i style="height:${Math.round((s.count / max) * 100)}%"></i><span>${esc(s.day.slice(8))}</span></div>`).join("")}</div></section>
            <section class="panel"><h3>${ic("star")} الأكثر تحميلاً (30 يوماً)</h3><div class="feed">${r.top.map((t, i) => `<div class="fi"><div class="ic">${i + 1}</div><div><div class="t">${esc(t.name)}</div><div class="m">${esc(t.type)}</div></div><div class="tm">${fmtNum(t.count)}</div></div>`).join("") || empty("لا بيانات بعد")}</div></section>
        </div>
        <div class="cols2" style="margin-top:14px">
            <section class="panel"><h3>${ic("clock")} مودات بلا تحميل (30 يوماً)</h3><div class="feed">${r.unused.map((t) => `<div class="fi"><div class="ic">${ic("package")}</div><div><div class="t">${esc(t.name)}</div></div></div>`).join("") || empty("كل المودات لها تحميلات")}</div></section>
            <section class="panel"><h3>${ic("layers")} المحتوى</h3><div class="feed">${[["المودات", r.counts.mods], ["باكات الجرافيكس", r.counts.packs], ["الفلاتر", r.counts.presets], ["الحزم", r.counts.bundles], ["في المحذوفات", r.counts.trash]].map(([k, v]) => `<div class="fi"><div><div class="t">${k}</div></div><div class="tm" style="color:#fff;font-weight:800">${v}</div></div>`).join("")}</div></section>
        </div>`;
    }

    /* ───── قوائم المحتوى ───── */
    let CATS = [], MODS = [];
    const catName = (slug) => (CATS.find((c) => c.slug === slug) || {}).name || slug;
    async function loadCats() { const r = await api.get(A + "/categories"); CATS = (r && r.items) || []; }
    function listShell(title, addLabel, body) { return `<div class="toolrow"><h3 style="color:#fff;font-size:16px;flex:1">${esc(title)}</h3>${addLabel ? `<button class="btn btn-primary" data-act="add">${ic("plus")} ${esc(addLabel)}</button>` : ""}</div>${body}`; }
    async function softDelete(kind, id, name) {
        if (!await askConfirm({ title: "نقل إلى المحذوفات؟", message: `«${name}» سيُخفى عن المستخدمين ويمكن استرجاعه خلال 30 يوماً.`, confirmText: "حذف", danger: true })) return false;
        const r = await api.del(`${A}/${kind}/${encodeURIComponent(id)}`); if (r && r.success) { toast("نُقل إلى المحذوفات", "success"); return true; } fail(r); return false;
    }
    function bindList(root, items, h) {
        root.onclick = async (e) => {
            const b = e.target.closest("[data-act]"); if (!b) return;
            const tr = b.closest("[data-id]"); const it = tr ? items.find((x) => String(x.id ?? x.slug) === tr.dataset.id) : null;
            await h(b.dataset.act, it);
        };
    }
    async function modsTab(g) {
        const [r] = await Promise.all([api.get(A + "/mods"), loadCats()]); if (stale(g)) return;
        MODS = (r && r.items) || [];
        const status = (m) => m.deletedAt ? "" : !m.published ? (m.publishAt && new Date(m.publishAt) > new Date() ? '<span class="badge warn">مجدول</span>' : '<span class="badge">مسودة</span>') : '<span class="badge ok">منشور</span>';
        view.innerHTML = listShell("المودات", "إضافة مود", tbl(["المود", "القسم", "النسخ", "الإصدار", "التحميل", "التثبيت", "الرابط", "الحالة", ""], MODS.map((m) => `<tr data-id="${m.id}"><td><div style="display:flex;gap:10px;align-items:center">${/^https?:/.test(m.cover || "") ? `<img class="thumb" src="${esc(m.cover)}" alt="">` : `<div class="thumb"></div>`}<span class="nm">${esc(m.name)}</span>${m.featured ? '<span class="badge hi">مود الأسبوع</span>' : ""}</div></td><td>${esc(catName(m.category))}</td><td>${(m.plans || []).length ? esc(m.plans.join(" ")) : "الجميع"}</td><td class="ltr">${esc(m.version)}</td><td>${fmtNum(m.downloads || 0)}</td><td>${m.installsOk || 0}✔ ${m.installsFail ? `<span style="color:var(--err)">${m.installsFail}✖</span>` : ""}</td><td>${linkBadge(m)}</td><td>${status(m)}</td><td>${acts([["feat", "star", m.featured ? "إلغاء التمييز" : "مود الأسبوع"], ["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`).join("")));
        bindList(view, MODS, async (act, m) => {
            if (act === "add") { if (!CATS.length) { toast("أنشئ قسماً أولاً", "error"); return; } if (await E.modWizard({ cats: CATS, mods: MODS })) open("mods"); }
            else if (act === "edit") { if (await E.modWizard({ mod: m, cats: CATS, mods: MODS })) open("mods"); }
            else if (act === "feat") { const r2 = await api.put(`${A}/mods/${m.id}`, { featured: !m.featured, notify: false }); if (r2 && r2.success) open("mods"); else fail(r2); }
            else if (act === "del") { if (await softDelete("mods", m.id, m.name)) open("mods"); }
        });
    }
    async function packsTab(g) {
        const r = await api.get(A + "/packs"); if (stale(g)) return;
        const items = (r && r.items) || [];
        view.innerHTML = listShell("باكات الجرافيكس", "إضافة باك", tbl(["الباك", "النسخة", "الإصدارات", "الأحدث", "الرابط", "الحالة", ""], items.map((p) => { const vs = p.versions || [], lv = vs.find((v) => v.latest) || vs[0] || {}; const ls = p.linkState ? Object.values(p.linkState) : []; const bad = ls.filter((x) => !x.ok).length; return `<tr data-id="${esc(p.id)}"><td class="nm">${esc(p.name)}</td><td>${esc(p.plan)}</td><td>${vs.length}</td><td class="ltr">${esc(lv.version || "—")}</td><td>${!ls.length ? '<span class="badge">لم يُفحص</span>' : bad ? `<span class="badge err">${bad} معطّل</span>` : '<span class="badge ok">سليم</span>'}</td><td>${p.published ? '<span class="badge ok">منشور</span>' : '<span class="badge">مخفي</span>'}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`; }).join("")));
        bindList(view, items, async (act, p) => {
            if (act === "add") { if (await E.packEditor(null)) open("packs"); }
            else if (act === "edit") { if (await E.packEditor(p)) open("packs"); }
            else if (act === "del") { if (await softDelete("packs", p.id, p.name)) open("packs"); }
        });
    }
    const LINKFIELDS = (extra) => [
        { k: "name", label: "الاسم", max: 80 }, { k: "file", label: "اسم الملف", ltr: true, hint: "مثال: filter.ini" }, ...extra,
        { k: "url", label: "رابط التحميل المباشر", ltr: true }, { k: "sha256", label: "بصمة SHA-256 (اختياري)", ltr: true }, { k: "sizeBytes", label: "الحجم بالبايت", type: "number", ltr: true },
        { k: "published", label: "منشور", type: "check", def: true }];
    function inspectRow(d) {
        const box = document.createElement("div");
        box.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-x="i">${ic("search")} فحص الرابط</button><button class="btn" data-x="h">${ic("key")} فحص + بصمة</button></div><div data-o></div>`;
        const first = d.body.querySelector('[data-k="sha256"]').closest(".fld"); first.parentNode.insertBefore(box, first);
        box.addEventListener("click", async (e) => {
            const t = e.target.closest("[data-x]"); if (!t) return; const url = E.val(d.body, "url").trim();
            if (!/^https?:\/\//i.test(url)) { box.querySelector("[data-o]").innerHTML = E.inspHtml({ message: "ضع رابطاً صحيحاً" }); return; }
            t.disabled = true; box.querySelector("[data-o]").innerHTML = `<div class="insp">جاري الفحص…</div>`;
            const r = await E.inspect(url, t.dataset.x === "h"); t.disabled = false; box.querySelector("[data-o]").innerHTML = E.inspHtml(r);
            if (r && r.success) { if (r.sizeBytes) d.body.querySelector('[data-k="sizeBytes"]').value = r.sizeBytes; if (r.sha256) d.body.querySelector('[data-k="sha256"]').value = r.sha256; const f = d.body.querySelector('[data-k="file"]'); if (f && !f.value) f.value = E.fileFromUrl(r.finalUrl || url); }
        });
    }
    function simpleTab(route, title, addLabel, head, row, fields, kindLabel) {
        return async function (g) {
            const r = await api.get(`${A}/${route}`); if (stale(g)) return;
            const items = (r && r.items) || [];
            view.innerHTML = listShell(title, addLabel, tbl(head, items.map(row).join("")));
            bindList(view, items, async (act, it) => {
                if (act === "add" || act === "edit") {
                    const ok = await E.editDialog({ title: act === "add" ? addLabel : `تعديل: ${it.name}`, fields: fields(), values: it || {}, onOpen: fields().some((f) => f.k === "url") ? inspectRow : null, save: (v) => { if (v.sizeBytes === undefined) delete v.sizeBytes; return act === "add" ? api.post(`${A}/${route}`, v) : api.put(`${A}/${route}/${encodeURIComponent(it.id ?? it.slug)}`, v); } });
                    if (ok) open(cur);
                } else if (act === "del") { if (await softDelete(route, it.id ?? it.slug, it.name)) open(cur); }
            });
        };
    }
    const presetsTab = simpleTab("presets", "الفلاتر (ReShade)", "إضافة فلتر", ["الفلتر", "الملف", "التحميلات", "الرابط", "الحالة", ""],
        (p) => `<tr data-id="${esc(p.id)}"><td class="nm">${esc(p.name)}</td><td class="ltr">${esc(p.file)}</td><td>${fmtNum(p.downloads || 0)}</td><td>${linkBadge(p)}</td><td>${p.published ? '<span class="badge ok">منشور</span>' : '<span class="badge">مخفي</span>'}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`,
        () => LINKFIELDS([{ k: "description", label: "الوصف", type: "area", max: 300 }, { k: "img", label: "صورة (رابط)", ltr: true }, { k: "size", label: "الحجم (نص)", ltr: true }]));
    const customsTab = simpleTab("customizations", "التخصيصات", "إضافة تخصيص", ["التخصيص", "الملف", "الوجهة", "الرابط", "الحالة", ""],
        (p) => `<tr data-id="${esc(p.id)}"><td class="nm">${esc(p.name)}</td><td class="ltr">${esc(p.file)}</td><td class="ltr">${esc(p.destination || "")}</td><td>${linkBadge(p)}</td><td>${p.published ? '<span class="badge ok">منشور</span>' : '<span class="badge">مخفي</span>'}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`,
        () => LINKFIELDS([{ k: "description", label: "الوصف", type: "area", max: 300 }, { k: "destination", label: "مسار الوجهة داخل FiveM", ltr: true }, { k: "icon", label: "أيقونة (اسم)", ltr: true }, { k: "warning", label: "تحذير يظهر قبل التثبيت" }]));
    const soundsTab = simpleTab("sounds", "ساوندات الأسلحة", "إضافة ساوند", ["الساوند", "السلاح", "ملف الهدف", "النسخ", "التحميلات", "الرابط", "الحالة", ""],
        (p) => `<tr data-id="${esc(p.id)}"><td class="nm">${esc(p.name)}</td><td>${esc(p.weapon || "—")}</td><td class="ltr">${esc(p.file)}</td><td>${(p.plans || []).length ? esc(p.plans.join(" ")) : "الجميع"}</td><td>${fmtNum(p.downloads || 0)}</td><td>${linkBadge(p)}</td><td>${p.published ? '<span class="badge ok">منشور</span>' : '<span class="badge">مخفي</span>'}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`,
        () => [{ k: "name", label: "الاسم", max: 80 }, { k: "weapon", label: "السلاح (للعرض)", max: 60 }, { k: "file", label: "اسم الملف", ltr: true, hint: "إن كان .rpf يجب أن يطابق اسم ملف في مجلد sfx مثل WEAPONS_PLAYER.rpf. أو .zip يحوي ملفات .rpf" }, { k: "description", label: "الوصف", type: "area", max: 300 }, { k: "img", label: "صورة (رابط)", ltr: true }, { k: "size", label: "الحجم (نص)", ltr: true },
            { k: "url", label: "رابط التحميل المباشر", ltr: true }, { k: "sha256", label: "بصمة SHA-256 (اختياري)", ltr: true }, { k: "sizeBytes", label: "الحجم بالبايت", type: "number", ltr: true }, { k: "plans", label: "النسخ المسموحة", type: "plans", hint: "بدون اختيار = للجميع" }, { k: "published", label: "منشور", type: "check", def: true }]);
    async function bundlesTab(g) {
        const [r, m] = await Promise.all([api.get(A + "/bundles"), api.get(A + "/mods")]); if (stale(g)) return;
        const items = (r && r.items) || [], mods = (m && m.items) || [];
        view.innerHTML = listShell("حزم المودات", "إضافة حزمة", tbl(["الحزمة", "عدد المودات", "النسخ", "الحالة", ""], items.map((b) => `<tr data-id="${b.id}"><td class="nm">${esc(b.name)}</td><td>${(b.modIds || []).length}</td><td>${(b.plans || []).length ? esc(b.plans.join(" ")) : "الجميع"}</td><td>${b.published ? '<span class="badge ok">منشور</span>' : '<span class="badge">مخفي</span>'}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`).join("")));
        const fields = () => [{ k: "name", label: "اسم الحزمة", max: 80 }, { k: "description", label: "الوصف", type: "area", max: 400 }, { k: "cover", label: "الغلاف (رابط)", ltr: true }, { k: "modIds", label: "المودات داخل الحزمة", type: "mods", mods }, { k: "plans", label: "النسخ المسموحة", type: "plans" }, { k: "published", label: "منشورة", type: "check", def: true }];
        bindList(view, items, async (act, it) => {
            if (act === "add" || act === "edit") { if (await E.editDialog({ title: act === "add" ? "حزمة جديدة" : `تعديل: ${it.name}`, fields: fields(), values: it || {}, save: (v) => act === "add" ? api.post(A + "/bundles", v) : api.put(`${A}/bundles/${it.id}`, v) })) open("bundles"); }
            else if (act === "del") { if (await softDelete("bundles", it.id, it.name)) open("bundles"); }
        });
    }
    const catsTab = simpleTab("categories", "أقسام المودات", "إضافة قسم", ["القسم", "المعرّف", "الأيقونة", "الترتيب", ""],
        (c) => `<tr data-id="${esc(c.slug)}"><td class="nm">${esc(c.name)}</td><td class="ltr">${esc(c.slug)}</td><td class="ltr">${esc(c.icon || "")}</td><td>${c.sort}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`,
        () => [{ k: "name", label: "اسم القسم (مثل: أشجار، شوارع)", max: 40 }, { k: "icon", label: "الأيقونة", type: "select", options: [["package", "حزمة"], ["tree", "أشجار"], ["road", "شوارع"], ["car", "سيارات"], ["mountain", "طبيعة"], ["star", "نجمة"], ["layers", "طبقات"]] }, { k: "sort", label: "الترتيب", type: "number", def: 100 }]);

    /* ───── المستخدمون ───── */
    let uq = "", up = 1;
    async function usersTab(g) {
        const r = await api.get(`${A}/users?q=${encodeURIComponent(uq)}&page=${up}&limit=20`); if (stale(g)) return;
        if (!r || !r.success) { view.innerHTML = empty((r && r.message) || "تعذّر التحميل"); return; }
        const pages = Math.max(1, Math.ceil(r.total / 20));
        view.innerHTML = `<div class="toolrow"><input class="inp" id="uq" placeholder="ابحث بمعرّف ديسكورد…" value="${esc(uq)}" inputmode="numeric"><button class="btn" data-act="search">${ic("search")} بحث</button><span style="flex:1"></span><span style="color:var(--text-3);font-size:12px">${r.total} مستخدم</span></div>` +
            tbl(["المستخدم", "المعرّف", "الجهاز", "آخر دخول", "الحالة", ""], r.users.map((u) => `<tr data-id="${esc(u.discordId)}"><td class="nm">${esc(u.name || "—")}</td><td class="ltr">${esc(u.discordId)}</td><td>${u.hasDevice ? '<span class="badge ok">مربوط</span>' : '<span class="badge">لا</span>'}</td><td>${esc(dt(u.lastLogin))}</td><td>${u.banned ? `<span class="badge err" title="${esc(u.banReason)}">محظور</span>` : '<span class="badge ok">نشط</span>'}</td><td>${acts([u.banned ? ["unban", "undo", "رفع الحظر"] : ["ban", "lock", "حظر", "danger"], ["reset", "refresh", "إعادة ضبط الجهاز"]])}</td></tr>`).join("")) +
            `<div class="toolrow" style="margin-top:12px;justify-content:center"><button class="btn" data-act="prev" ${up <= 1 ? "disabled" : ""}>السابق</button><span style="color:var(--text-3)">${up} / ${pages}</span><button class="btn" data-act="next" ${up >= pages ? "disabled" : ""}>التالي</button></div>`;
        const go = () => { uq = $("uq").value.replace(/\D/g, ""); up = 1; open("users"); };
        $("uq").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
        view.onclick = async (e) => {
            const b = e.target.closest("[data-act]"); if (!b) return; const id = b.closest("[data-id]")?.dataset.id, act = b.dataset.act;
            if (act === "search") go(); else if (act === "prev") { up--; open("users"); } else if (act === "next") { up++; open("users"); }
            else if (act === "ban") {
                const d = dialog({ title: "حظر المستخدم", body: `<div class="fld"><label>سبب الحظر</label><input class="inp" id="rs" maxlength="200"></div>`, footer: `<button class="btn" data-dlg="close">إلغاء</button><button class="btn btn-danger" id="go">حظر</button>` });
                d.el.querySelector("#go").addEventListener("click", async () => { const r2 = await api.post(`${A}/users/${id}/ban`, { reason: d.el.querySelector("#rs").value }); if (r2 && r2.success) { d.close(); toast("تم الحظر", "success"); open("users"); } else fail(r2); });
            } else if (act === "unban") { const r2 = await api.post(`${A}/users/${id}/unban`, {}); if (r2 && r2.success) { toast("رُفع الحظر", "success"); open("users"); } else fail(r2); }
            else if (act === "reset") { if (await askConfirm({ title: "إعادة ضبط الجهاز؟", message: "سيستطيع المستخدم ربط حسابه بجهاز جديد عند تسجيل الدخول القادم.", confirmText: "إعادة ضبط" })) { const r2 = await api.post(`${A}/users/${id}/reset-device`, {}); if (r2 && r2.success) { toast("تمت إعادة الضبط", "success"); open("users"); } else fail(r2); } }
        };
    }

    /* ───── المشرفون (للمالك) ───── */
    async function adminsTab(g) {
        const r = await api.get(A + "/admins"); if (stale(g)) return;
        if (!r || !r.success) { view.innerHTML = empty((r && r.message) || "تعذّر التحميل"); return; }
        const items = (r.admins || []).map((a) => ({ ...a, id: a.discordId }));
        view.innerHTML = `<div class="panel" style="margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center">${ic("crown")}<b style="color:#fff">المالك</b><span class="ltr" style="color:var(--text-3)">${esc(r.owner)}</span><span class="badge hi">كل الصلاحيات</span></div></div>` + listShell("المشرفون المساعدون", "إضافة مشرف", tbl(["المشرف", "المعرّف", "الدور", "الصلاحيات", ""], items.map((a) => `<tr data-id="${esc(a.id)}"><td class="nm">${esc(a.name || "—")}</td><td class="ltr">${esc(a.id)}</td><td>${esc(a.role)}</td><td>${(a.perms || []).map((p) => `<span class="badge">${esc(E.PERM_LABEL[p] || p)}</span>`).join(" ")}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "إزالة", "danger"]])}</td></tr>`).join("")));
        bindList(view, items, async (act, a) => {
            if (act === "add" || act === "edit") {
                const fields = [{ k: "discordId", label: "معرّف ديسكورد", ltr: true, hint: "أرقام فقط" }, { k: "name", label: "الاسم", max: 40 }, { k: "role", label: "المسمّى", max: 30, def: "مشرف" }, { k: "perms", label: "الصلاحيات", type: "perms", perms: r.allPerms }];
                if (await E.editDialog({ title: act === "add" ? "مشرف جديد" : `تعديل: ${a.name || a.id}`, fields, values: a || { role: "مشرف", perms: [] }, save: (v) => api.post(A + "/admins", v) })) open("admins");
            } else if (act === "del" && await askConfirm({ title: "إزالة المشرف؟", message: a.name || a.id, danger: true, confirmText: "إزالة" })) { const r2 = await api.del(`${A}/admins/${a.id}`); if (r2 && r2.success) { toast("أُزيل", "success"); open("admins"); } else fail(r2); }
        });
    }

    /* ───── السجلات والبلاغات ───── */
    let lq = "";
    async function logsTab(g) {
        const r = await api.get(`${A}/audit?q=${encodeURIComponent(lq)}&limit=200`); if (stale(g)) return;
        const rows = (r && r.logs) || [];
        view.innerHTML = `<div class="toolrow"><input class="inp" id="lq" placeholder="ابحث في السجل…" value="${esc(lq)}"><button class="btn" data-act="s">${ic("search")}</button><span style="flex:1"></span><button class="btn" data-act="csv">${ic("download")} تصدير CSV</button></div>` +
            tbl(["الوقت", "المنفّذ", "العملية", "النوع", "الهدف", "التفاصيل"], rows.map((x) => `<tr><td>${esc(dt(x.createdAt))}</td><td class="nm">${esc(x.actorName || x.actorId || "—")}</td><td>${esc(x.action)}</td><td>${esc(x.targetType)}</td><td>${esc(x.target)}</td><td style="max-width:320px">${esc(x.detail)}</td></tr>`).join(""));
        const go = () => { lq = $("lq").value.trim(); open("logs"); };
        $("lq").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
        view.onclick = async (e) => { const b = e.target.closest("[data-act]"); if (!b) return; if (b.dataset.act === "s") go(); else { const c = await window.api.saveText("audit.csv", csvOf(["الوقت", "المنفّذ", "المعرّف", "العملية", "النوع", "الهدف", "التفاصيل"], rows.map((x) => [x.createdAt, x.actorName, x.actorId, x.action, x.targetType, x.target, x.detail]))); if (c && c.success) toast("تم الحفظ", "success"); } };
    }
    let rf = "";
    async function reportsTab(g) {
        const r = await api.get(`${A}/reports?limit=300${rf ? "&ok=" + rf : ""}`); if (stale(g)) return;
        const rows = (r && r.reports) || [];
        view.innerHTML = `<div class="toolrow"><select class="sel" id="rf" style="width:180px"><option value="">كل البلاغات</option><option value="0" ${rf === "0" ? "selected" : ""}>الفاشلة فقط</option><option value="1" ${rf === "1" ? "selected" : ""}>الناجحة فقط</option></select><span style="flex:1"></span><button class="btn" data-act="csv">${ic("download")} تصدير CSV</button></div>` +
            tbl(["الوقت", "المستخدم", "العنصر", "الإصدار", "النتيجة", "الخطأ", "إصدار البرنامج"], rows.map((x) => `<tr><td>${esc(dt(x.createdAt))}</td><td class="ltr">${esc(x.discordId)}</td><td class="nm">${esc(x.itemName || x.itemId)} <span class="badge">${esc(x.itemType)}</span></td><td class="ltr">${esc(x.version)}</td><td>${x.ok ? '<span class="badge ok">نجح</span>' : '<span class="badge err">فشل</span>'}</td><td style="max-width:260px">${esc(x.error)}</td><td class="ltr">${esc(x.appVersion)}</td></tr>`).join(""));
        $("rf").addEventListener("change", (e) => { rf = e.target.value; open("reports"); });
        view.onclick = async (e) => { if (e.target.closest('[data-act="csv"]')) { const c = await window.api.saveText("reports.csv", csvOf(["الوقت", "المستخدم", "النوع", "العنصر", "الإصدار", "النتيجة", "الخطأ", "إصدار البرنامج"], rows.map((x) => [x.createdAt, x.discordId, x.itemType, x.itemName || x.itemId, x.version, x.ok ? "نجح" : "فشل", x.error, x.appVersion]))); if (c && c.success) toast("تم الحفظ", "success"); } };
    }

    /* ───── الإعلانات ───── */
    const KIND = { info: "معلومة", warning: "تنبيه", maintenance: "صيانة", news: "خبر", release: "ملاحظات إصدار البرنامج" };
    async function annTab(g) {
        const r = await api.get(A + "/announcements"); if (stale(g)) return;
        const items = (r && r.items) || [];
        view.innerHTML = listShell("الإعلانات والأخبار", "إعلان جديد", tbl(["العنوان", "النوع", "الفترة", "الحالة", ""], items.map((a) => `<tr data-id="${a.id}"><td class="nm">${esc(a.title)}</td><td>${esc(KIND[a.kind] || a.kind)}</td><td>${esc(dt(a.startsAt))} → ${esc(dt(a.endsAt))}</td><td>${a.active ? '<span class="badge ok">فعّال</span>' : '<span class="badge">متوقف</span>'}</td><td>${acts([["edit", "edit", "تعديل"], ["del", "trash", "حذف", "danger"]])}</td></tr>`).join("")));
        const fields = () => [{ k: "kind", label: "النوع", type: "select", options: Object.entries(KIND), def: "news", hint: "«ملاحظات إصدار البرنامج» تظهر مرة واحدة بعد التحديث إلى الإصدار المحدد" }, { k: "title", label: "العنوان", max: 120 }, { k: "body", label: "النص", type: "area", max: 1500 }, { k: "startsAt", label: "يبدأ (اختياري)", type: "date" }, { k: "endsAt", label: "ينتهي (اختياري)", type: "date" }, { k: "minAppVersion", label: "إصدار البرنامج (لملاحظات الإصدار)", ltr: true, max: 20 }, { k: "active", label: "فعّال", type: "check", def: true }];
        bindList(view, items, async (act, a) => {
            if (act === "add" || act === "edit") { if (await E.editDialog({ title: act === "add" ? "إعلان جديد" : "تعديل الإعلان", fields: fields(), values: a || {}, save: (v) => act === "add" ? api.post(A + "/announcements", v) : api.put(`${A}/announcements/${a.id}`, v) })) open("ann"); }
            else if (act === "del" && await askConfirm({ title: "حذف الإعلان؟", message: a.title, danger: true, confirmText: "حذف" })) { const r2 = await api.del(`${A}/announcements/${a.id}`); if (r2 && r2.success) open("ann"); else fail(r2); }
        });
    }

    /* ───── النظام والروابط ───── */
    async function systemTab(g) {
        const [sr, lr] = await Promise.all([api.get(A + "/settings"), api.get(A + "/links")]); if (stale(g)) return;
        const s = (sr && sr.settings) || {};
        const links = (lr && lr.items) || [];
        view.innerHTML = `<div class="cols2"><section class="panel"><h3>${ic("sliders")} الإعدادات</h3><div style="display:flex;flex-direction:column;gap:14px" id="sform">
            ${E.chk("maintenanceOn", "وضع الصيانة (يمنع المستخدمين العاديين)", s.maintenanceOn)}${E.fld("رسالة الصيانة", E.inp("maintenanceMessage", s.maintenanceMessage, { max: 300 }))}
            ${E.fld("أدنى إصدار مسموح للبرنامج (تحديث إجباري)", E.inp("minVersion", s.minVersion, { ltr: true, ph: "2.0.0" }))}
            ${E.chk("signLinks", "روابط تحميل مؤقتة موقّعة (تتطلب إعداد السيرفر)", s.signLinks)}${E.chk("legacyPublicLinks", "السماح للإصدارات القديمة من البرنامج بالتحميل (روابط عامة)", s.legacyPublicLinks)}
            ${S.isOwner ? E.chk("adminLock", "قفل الأدمن على الجهاز المسجّل", s.adminLock) + E.fld("أجهزة أدمن إضافية مسموحة (HWID مفصولة بفاصلة)", E.inp("adminHwids", s.adminHwids, { ltr: true })) : ""}
            <button class="btn btn-primary" id="ssave" style="align-self:flex-start">حفظ الإعدادات</button></div></section>
            <section class="panel"><h3>${ic("wifi")} صحة الروابط <span class="more">${lr && lr.summary ? `${lr.summary.ok} سليم · ${lr.summary.bad} معطّل` : ""}</span></h3><button class="btn" id="lchk" style="margin-bottom:10px">${ic("refresh")} فحص الآن</button><div class="feed" style="max-height:340px;overflow:auto">${links.map((l) => `<div class="fi"><div class="ic">${ic(l.ok === false ? "alert" : "check")}</div><div><div class="t">${esc(l.name)}</div><div class="m">${esc(l.type)} · ${l.status || "—"}</div></div><div class="tm">${l.ok === false ? '<span class="badge err">معطّل</span>' : l.ok ? '<span class="badge ok">سليم</span>' : '<span class="badge">—</span>'}</div></div>`).join("") || empty("لا روابط")}</div></section></div>`;
        $("ssave").addEventListener("click", async (e) => {
            const f = $("sform"), body = { maintenanceOn: E.val(f, "maintenanceOn"), maintenanceMessage: E.val(f, "maintenanceMessage"), minVersion: E.val(f, "minVersion").trim(), signLinks: E.val(f, "signLinks"), legacyPublicLinks: E.val(f, "legacyPublicLinks") };
            if (S.isOwner) { body.adminLock = E.val(f, "adminLock"); body.adminHwids = E.val(f, "adminHwids"); }
            if (body.maintenanceOn && !await askConfirm({ title: "تفعيل وضع الصيانة؟", message: "سيُمنع كل المستخدمين العاديين من استخدام البرنامج حتى تعطّله.", confirmText: "تفعيل", danger: true })) return;
            e.currentTarget.disabled = true; const r2 = await api.put(A + "/settings", body); e.currentTarget.disabled = false;
            if (r2 && r2.success) toast("تم الحفظ", "success"); else fail(r2);
        });
        $("lchk").addEventListener("click", async (e) => { e.currentTarget.disabled = true; toast("جاري فحص الروابط…", "info"); const r2 = await api.post(A + "/links/check", {}); if (r2 && r2.success) { toast("اكتمل الفحص", "success"); open("system"); } else { e.currentTarget.disabled = false; fail(r2); } });
    }

    /* ───── المحذوفات ───── */
    const KL = { mods: "مود", packs: "باك", presets: "فلتر", customizations: "تخصيص", sounds: "ساوند", bundles: "حزمة", categories: "قسم" };
    async function trashTab(g) {
        const r = await api.get(A + "/trash"); if (stale(g)) return;
        const items = (r && r.items) || [];
        view.innerHTML = `<p style="color:var(--text-3);font-size:12.5px;margin-bottom:12px">تُحذف العناصر نهائياً تلقائياً بعد 30 يوماً. الحذف النهائي اليدوي للمالك فقط ويتطلب كتابة الاسم.</p>` + tbl(["العنصر", "النوع", "حُذف", "المتبقي", ""], items.map((t, i) => `<tr data-id="${i}"><td class="nm">${esc(t.name)}</td><td>${esc(KL[t.kind] || t.kind)}</td><td>${esc(dt(t.deletedAt))}</td><td>${t.daysLeft} يوم</td><td>${acts([["restore", "undo", "استرجاع"], ...(S.isOwner ? [["purge", "trash", "حذف نهائي", "danger"]] : [])])}</td></tr>`).join(""));
        view.onclick = async (e) => {
            const b = e.target.closest("[data-act]"); if (!b) return; const t = items[Number(b.closest("[data-id]").dataset.id)];
            if (b.dataset.act === "restore") { const r2 = await api.post(`${A}/${t.kind}/${encodeURIComponent(t.id)}/restore`, {}); if (r2 && r2.success) { toast("تم الاسترجاع", "success"); open("trash"); } else fail(r2); }
            else { const c = await askConfirm({ title: "حذف نهائي؟", message: "لا يمكن التراجع عن هذا الإجراء.", typeToConfirm: t.name, confirmText: "حذف نهائي", danger: true }); if (!c) return; const r2 = await api.del(`${A}/${t.kind}/${encodeURIComponent(t.id)}/purge`, { confirm: t.name }); if (r2 && r2.success) { toast("حُذف نهائياً", "success"); open("trash"); } else fail(r2); }
        };
    }

    const RENDER = { overview, mods: modsTab, packs: packsTab, presets: presetsTab, customs: customsTab, sounds: soundsTab, bundles: bundlesTab, cats: catsTab, users: usersTab, admins: adminsTab, logs: logsTab, reports: reportsTab, ann: annTab, system: systemTab, trash: trashTab };
    let first = "overview"; try { const t = sessionStorage.getItem("ca_admin_tab"); if (t && TABS.some((x) => x.id === t)) first = t; } catch {}
    open(first);
})();
