/* لوحة الأدمن — النماذج والمحررات (معالج المودات، محرر الباكات، نماذج عامة) */
(function () {
    const { ic, esc, toast, dialog } = window.CA;
    const api = window.api.v4, A = "/api/v4/admin";
    const PLANS = ["CA-1", "CA-2", "CA-3", "CA-4", "CA-5"];
    const PERM_LABEL = { mods: "المودات", packs: "باكات الجرافيكس", presets: "الفلاتر والتخصيصات", bundles: "الحزم", announcements: "الإعلانات", users: "المستخدمون", logs: "السجلات", system: "النظام والروابط" };

    const chk = (name, label, on, extra = "") => `<label class="chk"><input type="checkbox" data-k="${esc(name)}" ${on ? "checked" : ""} ${extra}><span class="bx">${ic("check", "sm")}</span>${esc(label)}</label>`;
    const planChecks = (key, sel) => `<div style="display:flex;gap:14px;flex-wrap:wrap" data-group="${key}">${PLANS.map((p) => `<label class="chk"><input type="checkbox" data-plan="${p}" ${(sel || []).includes(p) ? "checked" : ""}><span class="bx">${ic("check", "sm")}</span>${p}</label>`).join("")}</div>`;
    const readPlans = (root, key) => [...root.querySelectorAll(`[data-group="${key}"] [data-plan]:checked`)].map((x) => x.dataset.plan);
    const lines = (v) => String(v || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const toLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return ""; const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    const fromLocal = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d.toISOString(); };
    const sizeLabel = (b) => { b = Number(b) || 0; if (!b) return "—"; return b >= 1073741824 ? (b / 1073741824).toFixed(2) + " GB" : b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; };
    const fld = (label, inner, hint) => `<div class="fld"><label>${esc(label)}</label>${inner}${hint ? `<small>${esc(hint)}</small>` : ""}</div>`;
    const inp = (k, v, o = {}) => `<input class="inp ${o.ltr ? "ltr" : ""}" data-k="${k}" value="${esc(v ?? "")}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} ${o.max ? `maxlength="${o.max}"` : ""} ${o.type ? `type="${o.type}"` : ""} autocomplete="off">`;
    const area = (k, v, o = {}) => `<textarea class="txt ${o.ltr ? "ltr" : ""}" data-k="${k}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} ${o.max ? `maxlength="${o.max}"` : ""}>${esc(v ?? "")}</textarea>`;
    const val = (root, k) => { const e = root.querySelector(`[data-k="${k}"]`); return e ? (e.type === "checkbox" ? e.checked : e.value) : undefined; };

    async function inspect(url, hash) {
        const r = await api.post(A + "/inspect-link", { url, hash: !!hash });
        return r;
    }
    function inspHtml(r) {
        if (!r || !r.success) return `<div class="insp bad">${ic("alert", "sm")} ${esc((r && r.message) || "تعذّر فحص الرابط")}</div>`;
        const w = (r.warnings || []).map((x) => `<div class="w">⚠ ${esc(x)}</div>`).join("");
        return `<div class="insp ${r.ok ? "ok" : "bad"}"><div>${r.ok ? "✔ الرابط يعمل" : "✖ الرابط لا يستجيب"} — الحالة ${esc(r.status)}</div><div>الحجم: <b>${esc(r.sizeLabel || sizeLabel(r.sizeBytes))}</b> · النوع: <span class="ltr">${esc(r.contentType || "—")}</span></div>${r.sha256 ? `<div>البصمة: <span class="hashbox">${esc(r.sha256)}</span></div>` : ""}${w}</div>`;
    }
    const fileFromUrl = (u) => { try { const n = decodeURIComponent(new URL(u).pathname.split("/").pop() || ""); return /^[\w\-. ()]{1,120}\.(rpf|zip|ini|xml|asi|dll|meta|ytd)$/i.test(n) ? n : ""; } catch { return ""; } };

    /* ───── مولّد النماذج العام ───── */
    function formHtml(fields, v) {
        return fields.map((f) => {
            const x = v[f.k];
            if (f.type === "check") return chk(f.k, f.label, x !== undefined ? !!x : !!f.def);
            if (f.type === "plans") return fld(f.label, planChecks(f.k, x), f.hint);
            if (f.type === "select") return fld(f.label, `<select class="sel" data-k="${f.k}">${f.options.map(([a, b]) => `<option value="${esc(a)}" ${String(x ?? f.def ?? "") === String(a) ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>`, f.hint);
            if (f.type === "area") return fld(f.label, area(f.k, x, f), f.hint);
            if (f.type === "lines") return fld(f.label, area(f.k, (x || []).join("\n"), f), f.hint || "سطر لكل عنصر");
            if (f.type === "date") return fld(f.label, inp(f.k, toLocal(x), { type: "datetime-local" }), f.hint);
            if (f.type === "perms") return fld(f.label, `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px 14px">${f.perms.map((p) => chk("perm:" + p, PERM_LABEL[p] || p, (x || []).includes(p))).join("")}</div>`, f.hint);
            if (f.type === "mods") return fld(f.label, `<div class="insp" style="max-height:220px;overflow:auto">${f.mods.map((m) => chk("mod:" + m.id, m.name, (x || []).includes(m.id))).join("") || "لا توجد مودات"}</div>`, f.hint);
            return fld(f.label, inp(f.k, x, f), f.hint);
        }).join("");
    }
    function readForm(fields, root) {
        const o = {};
        for (const f of fields) {
            if (f.type === "check") o[f.k] = val(root, f.k);
            else if (f.type === "plans") o[f.k] = readPlans(root, f.k);
            else if (f.type === "lines") o[f.k] = lines(val(root, f.k));
            else if (f.type === "date") o[f.k] = fromLocal(val(root, f.k));
            else if (f.type === "perms") o[f.k] = [...root.querySelectorAll('[data-k^="perm:"]:checked')].map((e) => e.dataset.k.slice(5));
            else if (f.type === "mods") o[f.k] = [...root.querySelectorAll('[data-k^="mod:"]:checked')].map((e) => Number(e.dataset.k.slice(4)));
            else if (f.type === "number") { const s = String(val(root, f.k) ?? "").trim(); o[f.k] = s === "" ? undefined : Number(s); }
            else o[f.k] = String(val(root, f.k) ?? "").trim();
        }
        return o;
    }
    /* نافذة تحرير عامة: يعيد Promise<true> عند الحفظ الناجح */
    function editDialog({ title, fields, values = {}, save, wide, extraTop = "", onOpen, saveText = "حفظ" }) {
        return new Promise((resolve) => {
            const d = dialog({ title, wide, body: extraTop + formHtml(fields, values) + `<div id="ferr" style="color:var(--err);font-size:12.5px;min-height:16px"></div>`, footer: `<button class="btn" data-dlg="close">إلغاء</button><button class="btn btn-primary" id="fsave">${esc(saveText)}</button>` });
            let done = false;
            const obs = new MutationObserver(() => { if (!document.body.contains(d.el)) { obs.disconnect(); if (!done) resolve(false); } });
            obs.observe(document.body, { childList: true });
            if (onOpen) onOpen(d);
            d.el.querySelector("#fsave").addEventListener("click", async (e) => {
                const b = e.currentTarget; b.disabled = true;
                const r = await save(readForm(fields, d.el), d);
                b.disabled = false;
                if (r && r.success) { done = true; d.close(); resolve(true); } else d.el.querySelector("#ferr").textContent = (r && r.message) || "تعذّر الحفظ";
            });
        });
    }

    /* ───── معالج المود ───── */
    function modWizard({ mod, cats, mods }) {
        return new Promise((resolve) => {
            const edit = !!mod;
            const m = Object.assign({ name: "", description: "", category: (cats[0] || {}).slug || "", cover: "", gallery: [], version: "1.0", changelog: "", fileName: "", url: "", sha256: "", sizeBytes: 0, plans: [], requiredRoles: [], premium: false, featured: false, published: true, publishAt: null, earlyPlans: [], conflicts: [], sort: 100, notify: true }, mod || {});
            let step = 0, finished = false;
            const STEPS = ["الملف والرابط", "التفاصيل", "الوصول والنشر", "المراجعة"];
            const d = dialog({ title: edit ? `تعديل: ${m.name}` : "إضافة مود جديد", wide: true, body: "", footer: "" });
            const obs = new MutationObserver(() => { if (!document.body.contains(d.el)) { obs.disconnect(); if (!finished) resolve(false); } });
            obs.observe(document.body, { childList: true });
            const dlg = d.el.querySelector(".dlg");
            const stepsEl = document.createElement("div"); stepsEl.className = "wsteps"; dlg.insertBefore(stepsEl, d.body);

            function collect() {
                const r = d.body;
                if (step === 0) { m.url = val(r, "url").trim(); m.fileName = val(r, "fileName").trim(); m.sha256 = val(r, "sha256").trim().toLowerCase(); }
                if (step === 1) { m.name = val(r, "name").trim(); m.category = val(r, "category"); m.description = val(r, "description").trim(); m.version = val(r, "version").trim(); m.changelog = val(r, "changelog").trim(); m.cover = val(r, "cover").trim(); m.gallery = lines(val(r, "gallery")); }
                if (step === 2) { m.plans = readPlans(r, "plans"); m.earlyPlans = readPlans(r, "earlyPlans"); m.requiredRoles = lines(val(r, "roles").replace(/[,،]/g, "\n")); m.featured = val(r, "featured"); m.premium = val(r, "premium"); m.published = val(r, "published"); m.publishAt = fromLocal(val(r, "publishAt")); m.notify = val(r, "notify"); m.conflicts = [...r.querySelectorAll('[data-k^="cf:"]:checked')].map((e) => Number(e.dataset.k.slice(3))); }
            }
            function validate() {
                if (step === 0) { if (!/^https?:\/\//i.test(m.url)) return "ضع رابط تحميل مباشر صحيح (http/https)"; if (!/^[\w\-. ()]{1,120}\.(rpf|zip|ini|xml|asi|dll|meta|ytd)$/i.test(m.fileName)) return "اسم الملف غير صالح (يجب أن ينتهي بـ .rpf أو .zip …)"; if (m.sha256 && !/^[0-9a-f]{64}$/.test(m.sha256)) return "البصمة يجب أن تكون 64 حرفاً (hex)"; }
                if (step === 1) { if (!m.name) return "اسم المود مطلوب"; if (!m.category) return "اختر القسم"; }
                return "";
            }
            function render() {
                stepsEl.innerHTML = STEPS.map((s, i) => `<div class="wstep ${i === step ? "on" : i < step ? "done" : ""}"><span class="n">${i < step ? "✓" : i + 1}</span>${s}</div>`).join("");
                let h = "";
                if (step === 0) h = `
                    ${fld("رابط التحميل المباشر", inp("url", m.url, { ltr: true, ph: "https://your-server/mods/file.rpf" }), "ارفع الملف على سيرفرك والصق الرابط هنا فقط")}
                    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="bInspect">${ic("search")} فحص الرابط</button><button class="btn" id="bHash">${ic("key")} فحص + حساب البصمة SHA-256</button></div>
                    <div id="insp">${m._insp ? inspHtml(m._insp) : ""}</div>
                    <div class="frow">${fld("اسم الملف عند العميل", inp("fileName", m.fileName, { ltr: true, ph: "name.rpf" }), "يُستخرج تلقائياً من الرابط")}${fld("بصمة SHA-256 (اختياري)", inp("sha256", m.sha256, { ltr: true, ph: "64 hex" }), "يتحقق منها البرنامج بعد التحميل")}</div>
                    <div style="font-size:12.5px;color:var(--text-3)">الحجم المكتشف: <b style="color:#fff">${esc(sizeLabel(m.sizeBytes))}</b></div>`;
                if (step === 1) h = `
                    <div class="frow">${fld("اسم المود", inp("name", m.name, { max: 80 }))}${fld("القسم", `<select class="sel" data-k="category">${cats.map((c) => `<option value="${esc(c.slug)}" ${c.slug === m.category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`)}</div>
                    ${fld("الوصف", area("description", m.description, { max: 1200 }))}
                    <div class="frow">${fld("رقم الإصدار", inp("version", m.version, { max: 20, ltr: true }))}${fld("ما الجديد في هذا الإصدار", inp("changelog", m.changelog, { max: 600 }))}</div>
                    ${fld("صورة الغلاف (رابط)", inp("cover", m.cover, { ltr: true, ph: "https://..." }))}
                    <img class="preview-cover" id="cvPrev" alt="" ${/^https?:/.test(m.cover) ? `src="${esc(m.cover)}"` : 'style="display:none"'}>
                    ${fld("معرض الصور (اختياري)", area("gallery", (m.gallery || []).join("\n"), { ltr: true }), "رابط في كل سطر")}`;
                if (step === 2) {
                    const others = mods.filter((x) => !mod || x.id !== mod.id);
                    h = `${fld("النسخ المسموح لها بالتحميل", planChecks("plans", m.plans), "بدون اختيار = مفتوح لكل المشتركين")}
                    ${fld("رولات ديسكورد إضافية تسمح بالتحميل (اختياري)", area("roles", (m.requiredRoles || []).join("\n"), { ltr: true, ph: "معرّف الرول في كل سطر" }))}
                    <div style="display:flex;gap:22px;flex-wrap:wrap">${chk("featured", "مود الأسبوع (مميّز)", m.featured)}${chk("premium", "مود بريميوم", m.premium)}${chk("published", "منشور الآن", m.published)}${chk("notify", "أرسل إشعار إصدار لروم التحديثات", m.notify)}</div>
                    <div class="frow">${fld("جدولة النشر (اختياري)", inp("publishAt", toLocal(m.publishAt), { type: "datetime-local" }), "إن كان في المستقبل يبقى مخفياً حتى الموعد")}${fld("وصول مبكر لهذه النسخ قبل الموعد", planChecks("earlyPlans", m.earlyPlans))}</div>
                    ${fld("مودات متعارضة مع هذا المود", `<div class="insp" style="max-height:150px;overflow:auto">${others.map((x) => chk("cf:" + x.id, x.name, (m.conflicts || []).includes(x.id))).join("") || "لا توجد مودات أخرى"}</div>`, "يحذّر البرنامج المستخدم قبل التثبيت")}`;
                }
                if (step === 3) h = `<div class="insp"><div><b>${esc(m.name)}</b> — v${esc(m.version)}</div><div>القسم: ${esc((cats.find((c) => c.slug === m.category) || {}).name || m.category)}</div><div>الملف: <span class="ltr">${esc(m.fileName)}</span> (${esc(sizeLabel(m.sizeBytes))})</div><div>النسخ: ${(m.plans || []).length ? esc(m.plans.join(" · ")) : "الجميع"}</div><div>الحالة: ${m.publishAt && new Date(m.publishAt) > new Date() ? "مجدول " + esc(new Date(m.publishAt).toLocaleString("ar")) : m.published ? "منشور" : "مسودة"}${m.featured ? " · مود الأسبوع" : ""}</div><div>البصمة: ${m.sha256 ? '<span class="hashbox">' + esc(m.sha256) + "</span>" : "بدون"}</div></div>${m.cover && /^https?:/.test(m.cover) ? `<img class="preview-cover" src="${esc(m.cover)}" alt="">` : ""}<div id="ferr" style="color:var(--err);font-size:12.5px"></div>`;
                d.body.innerHTML = h;
                d.footer = d.footer || dlg.querySelector(".dlg-f");
                let f = dlg.querySelector(".dlg-f"); if (!f) { f = document.createElement("div"); f.className = "dlg-f"; dlg.appendChild(f); }
                f.innerHTML = `<button class="btn" data-dlg="close">إلغاء</button><span style="flex:1"></span>${step > 0 ? '<button class="btn" id="wPrev">السابق</button>' : ""}${step < 3 ? '<button class="btn btn-primary" id="wNext">التالي</button>' : `<button class="btn btn-primary" id="wSave">${edit ? "حفظ التعديلات" : "نشر المود"}</button>`}`;
            }
            async function doInspect(hash, btn) {
                collect();
                if (!/^https?:\/\//i.test(m.url)) { d.body.querySelector("#insp").innerHTML = inspHtml({ message: "ضع رابطاً صحيحاً أولاً" }); return; }
                btn.disabled = true; d.body.querySelector("#insp").innerHTML = `<div class="insp">${hash ? "جاري تحميل الملف وحساب البصمة… قد يستغرق دقائق" : "جاري الفحص…"}</div>`;
                const r = await inspect(m.url, hash); m._insp = r; btn.disabled = false;
                if (r && r.success) { if (r.sizeBytes) m.sizeBytes = r.sizeBytes; if (r.sha256) m.sha256 = r.sha256; if (!m.fileName) m.fileName = fileFromUrl(r.finalUrl || m.url) || fileFromUrl(m.url); }
                const keep = { fileName: m.fileName, sha256: m.sha256, url: m.url }; render();
                void keep;
            }
            d.el.addEventListener("click", async (e) => {
                const t = e.target.closest("button"); if (!t) return;
                if (t.id === "bInspect") doInspect(false, t);
                else if (t.id === "bHash") doInspect(true, t);
                else if (t.id === "wPrev") { collect(); step--; render(); }
                else if (t.id === "wNext") { collect(); if (step === 0 && !m.fileName) m.fileName = fileFromUrl(m.url); const er = validate(); if (er) { toast(er, "error"); return; } step++; render(); }
                else if (t.id === "wSave") {
                    t.disabled = true;
                    const body = { name: m.name, description: m.description, category: m.category, cover: m.cover, gallery: m.gallery, version: m.version, changelog: m.changelog, fileName: m.fileName, url: m.url, sha256: m.sha256, sizeBytes: m.sizeBytes || 0, plans: m.plans, requiredRoles: m.requiredRoles, premium: m.premium, featured: m.featured, published: m.published, publishAt: m.publishAt, earlyPlans: m.earlyPlans, conflicts: m.conflicts, sort: m.sort, notify: m.notify };
                    const r = edit ? await api.put(`${A}/mods/${mod.id}`, body) : await api.post(A + "/mods", body);
                    t.disabled = false;
                    if (r && r.success) { finished = true; d.close(); toast(edit ? "تم حفظ التعديلات" : "تمت إضافة المود", "success"); resolve(true); } else d.el.querySelector("#ferr").textContent = (r && r.message) || "تعذّر الحفظ";
                }
            });
            d.el.addEventListener("input", (e) => { if (e.target.dataset.k === "cover") { const p = d.el.querySelector("#cvPrev"); const v = e.target.value.trim(); if (p) { if (/^https?:\/\//i.test(v)) { p.src = v; p.style.display = ""; } else p.style.display = "none"; } } });
            render();
        });
    }

    /* ───── محرر الباك والإصدارات ───── */
    function packEditor(pack) {
        return new Promise((resolve) => {
            const edit = !!pack;
            const p = Object.assign({ plan: "CA-1", name: "", level: 1, images: [], versions: [], published: true, sort: 100 }, pack || {});
            p.versions = (p.versions || []).map((v) => Object.assign({}, v));
            if (!p.versions.length) p.versions.push({ version: "1.0", date: new Date().toISOString().slice(0, 10), latest: true, size: "", features: [], changelog: "", url: "", sha256: "", sizeBytes: 0 });
            let finished = false;
            const d = dialog({ title: edit ? `تعديل الباك: ${p.name}` : "باك جرافيكس جديد", wide: true, body: "", footer: `<button class="btn" data-dlg="close">إلغاء</button><button class="btn btn-primary" id="pSave">حفظ</button>` });
            const obs = new MutationObserver(() => { if (!document.body.contains(d.el)) { obs.disconnect(); if (!finished) resolve(false); } });
            obs.observe(document.body, { childList: true });
            function vHtml(v, i) {
                return `<div class="insp" data-v="${i}" style="gap:10px"><div style="display:flex;align-items:center;gap:10px"><b>إصدار ${i + 1}</b><label class="chk" style="margin-inline-start:auto"><input type="radio" name="latest" data-k="latest" ${v.latest ? "checked" : ""}><span class="bx">${ic("check", "sm")}</span>الأحدث</label><button class="ibtn danger" data-act="vdel" title="حذف الإصدار">${ic("trash")}</button></div>
                <div class="frow three">${fld("رقم الإصدار", inp("version", v.version, { ltr: true, max: 20 }))}${fld("التاريخ", inp("date", v.date, { ltr: true, ph: "2026-01-31" }))}${fld("الحجم (نص)", inp("size", v.size, { ltr: true, ph: "1.2 GB" }))}</div>
                ${fld("رابط التحميل", inp("url", v.url, { ltr: true, ph: "https://..." }))}
                <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="vins">${ic("search")} فحص</button><button class="btn" data-act="vhash">${ic("key")} فحص + بصمة</button></div><div data-insp></div>
                <div class="frow">${fld("SHA-256 (اختياري)", inp("sha256", v.sha256, { ltr: true }))}${fld("الحجم بالبايت", inp("sizeBytes", v.sizeBytes || "", { ltr: true }))}</div>
                ${fld("المميزات", area("features", (v.features || []).join("\n")), "سطر لكل ميزة")}${fld("ما الجديد", area("changelog", v.changelog || "", { max: 600 }))}</div>`;
            }
            function render() {
                d.body.innerHTML = `<div class="frow three">${fld("نسخة الاشتراك", `<select class="sel" data-k="plan">${PLANS.map((x) => `<option ${x === p.plan ? "selected" : ""}>${x}</option>`).join("")}</select>`)}${fld("اسم الباك", inp("name", p.name, { max: 80 }))}${fld("المستوى (1-9)", inp("level", p.level, { type: "number" }))}</div>
                ${fld("صور الباك (روابط)", area("images", (p.images || []).join("\n"), { ltr: true }), "رابط في كل سطر")}
                <div style="display:flex;gap:22px">${chk("published", "منشور", p.published)}</div>
                <h4 style="color:#fff;font-size:14px">الإصدارات</h4><div id="vlist" style="display:flex;flex-direction:column;gap:12px">${p.versions.map(vHtml).join("")}</div>
                <button class="btn" id="vadd">${ic("plus")} إضافة إصدار</button><div id="ferr" style="color:var(--err);font-size:12.5px;min-height:16px"></div>`;
            }
            function collect() {
                p.plan = val(d.body, "plan"); p.name = val(d.body, "name").trim(); p.level = Number(val(d.body, "level")) || 1; p.images = lines(val(d.body, "images")); p.published = val(d.body, "published");
                p.versions = [...d.body.querySelectorAll("[data-v]")].map((el) => ({ version: val(el, "version").trim(), date: val(el, "date").trim(), size: val(el, "size").trim(), url: val(el, "url").trim(), sha256: val(el, "sha256").trim().toLowerCase(), sizeBytes: Number(val(el, "sizeBytes")) || 0, features: lines(val(el, "features")), changelog: val(el, "changelog").trim(), latest: val(el, "latest") }));
                if (p.versions.length && !p.versions.some((v) => v.latest)) p.versions[0].latest = true;
            }
            d.el.addEventListener("click", async (e) => {
                const t = e.target.closest("button"); if (!t) return;
                if (t.id === "vadd") { collect(); p.versions.push({ version: "", date: new Date().toISOString().slice(0, 10), latest: false, size: "", features: [], changelog: "", url: "", sha256: "", sizeBytes: 0 }); render(); }
                else if (t.dataset.act === "vdel") { collect(); const i = Number(t.closest("[data-v]").dataset.v); if (p.versions.length < 2) { toast("يجب بقاء إصدار واحد على الأقل", "error"); return; } p.versions.splice(i, 1); if (!p.versions.some((v) => v.latest)) p.versions[0].latest = true; render(); }
                else if (t.dataset.act === "vins" || t.dataset.act === "vhash") {
                    const el = t.closest("[data-v]"), url = val(el, "url").trim(), box = el.querySelector("[data-insp]");
                    if (!/^https?:\/\//i.test(url)) { box.innerHTML = inspHtml({ message: "ضع رابطاً صحيحاً" }); return; }
                    t.disabled = true; box.innerHTML = `<div class="insp">جاري الفحص…</div>`;
                    const r = await inspect(url, t.dataset.act === "vhash"); t.disabled = false; box.innerHTML = inspHtml(r);
                    if (r && r.success) { if (r.sizeBytes) { el.querySelector('[data-k="sizeBytes"]').value = r.sizeBytes; const s = el.querySelector('[data-k="size"]'); if (!s.value) s.value = sizeLabel(r.sizeBytes); } if (r.sha256) el.querySelector('[data-k="sha256"]').value = r.sha256; }
                } else if (t.id === "pSave") {
                    collect(); t.disabled = true;
                    const body = { plan: p.plan, name: p.name, level: p.level, images: p.images, versions: p.versions, published: p.published, sort: p.sort };
                    const r = edit ? await api.put(`${A}/packs/${encodeURIComponent(pack.id)}`, body) : await api.post(A + "/packs", body);
                    t.disabled = false;
                    if (r && r.success) { finished = true; d.close(); toast("تم الحفظ", "success"); resolve(true); } else d.el.querySelector("#ferr").textContent = (r && r.message) || "تعذّر الحفظ";
                }
            });
            render();
        });
    }

    window.AdminEdit = { A, api, PLANS, PERM_LABEL, chk, fld, inp, area, val, lines, toLocal, fromLocal, sizeLabel, formHtml, readForm, editDialog, modWizard, packEditor, inspect, inspHtml, fileFromUrl };
})();
