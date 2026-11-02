# CA Store — v4 contract (backend ⇄ Electron app)

Language of all user-facing UI text: **Arabic (RTL)**. Code comments may be Arabic or English.
Working dir: `/home/claude/work/v4/`.
- Backend base (user's latest, LF endings): `/home/claude/work/v4/base.lf.js` (2280 lines, Express + pg). **Output** goes to `/home/claude/work/v4/backend-v4.js` (full file, same style, all old routes preserved).
- App source (v3.2, copy to edit): `/home/claude/work/v4/app-src/` (Electron: `main.js`, `preload.js`, `app/*.html|js|css`).
- Design mockups to follow (HTML+screenshots): `/tmp/mock/*.html|png` (mods, admin1-3, load). Same tokens as `app/style.css` (black/silver, Cairo, RTL). Do NOT change colors; change layout/structure.

## 0. Rules
* Never hardcode secrets. Env only. Parameterized SQL only. Validate every input (types, lengths, allowed values).
* Every admin write → row in `app_audit`. Every list endpoint paginated/limited.
* Item types (string): `mod | pack | preset | custom | bundle`.
  IDs: mod=int, pack=text (`CA1`..), preset=text slug, custom=text (`no_water`..), bundle=int.
* Plans: `CA-1..CA-5` (see ROLE_PLAN_MAP in backend). Owner = `ADMIN_DISCORD_ID` (`1336347875206234292`).
* Discord channels (bot, `allowed_mentions:{parse:[]}`):
  * `CH_OPS = process.env.APP_OPS_CHANNEL_ID || "1565845719217217706"` → link-health alerts + install-failure alerts.
  * `CH_RELEASES = process.env.APP_RELEASES_CHANNEL_ID || "1479819609262522408"` → "new/updated mod|pack|preset|bundle" release notes (professional embeds: author=CA Store, title, description=changelog, fields: category/plans/size/version, thumbnail=cover when it is an http(s) URL, footer, color by type).
* App CSP meta tag every HTML page must include (no inline scripts allowed):
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; media-src 'self' http: https:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'">`
  → so **no inline `<script>` and no inline `onclick="..."` attributes** in pages (existing pages use `onclick="window.api.openPage(..)"` — convert to `data-open="page.html"` handled in shell.js).

## 1. Auth model
* App JWT from `/auth/callback` (`{discordId,hwid}`) — sent as `Authorization: Bearer`, plus header `x-hwid`. Web tokens (no hwid) are NOT valid for v4 app/admin routes.
* `appAuth` middleware: verify JWT, require `decoded.hwid` and `x-hwid===decoded.hwid`, user row exists, hwid matches `users.hwid`, not in `app_bans` (→ 403 `{code:"BANNED"}`), loads `plans` (+ member `roles`) from Discord with 60s in-memory cache. `req.user={discordId,plans,roles,hwid,isOwner,isAdmin,perms}`.
* Maintenance: when setting `maintenance_on`=1, all `appAuth` routes except admin/owner return 503 `{code:"MAINTENANCE",message}`.
* Admin perms: `mods, packs, presets, bundles, announcements, users, logs, system`. Owner has all + is the only one for `admins` (manage admins), `purge` (hard delete), `settings` write for `admin_lock`.
* `admin_lock` setting (default ON for new installs): admin routes require token hwid == `users.hwid` AND (if `admin_hwids` setting non-empty) hwid ∈ list. Hard delete (`purge`) requires body `{confirm:"<exact item name>"}`.

## 2. Public/auth endpoints (`/api/v4`)
| Method+path | Auth | Returns |
|---|---|---|
| GET `/config` | none (rate-limited) | `{success, serverTime, maintenance:{on,message}, minVersion, banners:[Announcement(kind info/warning/maintenance, active, in window)], legacyLinks}` |
| GET `/me` | appAuth | `{success, discordId, plans, isOwner, isAdmin, perms, role:"owner|admin|user"}` |
| GET `/library` | appAuth | see below |
| POST `/link` `{type,id,version?}` | appAuth | `{success,url,sha256,sizeBytes,fileName,name,destination?,expiresAt?}`; 403 `{code:"LOCKED"}` if user lacks plan/role; 404; logs `app_downloads`; increments counters; signed URL if signing enabled |
| POST `/report` `{type,id,version?,ok,error?,appVersion?}` | appAuth | `{success}`; stores `app_reports`; on failure sends throttled alert (max 1 per item / 15 min) to CH_OPS |
| GET `/prefs` / PUT `/prefs` | appAuth | `{success,prefs}` / body `{prefs}`; prefs = `{favorites:{mod:[],pack:[],preset:[],bundle:[]}, installed:{mod:[ids]}, profiles:[{id,name,mods:[ids],presets:[ids],createdAt}] }`, max 64KB, sanitized |
| GET `/news?limit=30` | appAuth | `{success, news:[Announcement kind news], releases:[{id,type,itemId,name,version,changelog,cover,createdAt}]}` |
| GET `/whats-new?version=x.y.z` | appAuth | `{success, notes:[Announcement kind release for that app version]}` |

### `/library` shape (no URLs ever in this payload)
```
{ success, categories:[{slug,name,icon,sort,count}],
  mods:[{id,name,description,category,cover,gallery:[str],version,changelog,fileName,sizeBytes,sizeLabel,
         plans:[str],premium,featured,isNew,early,conflicts:[modId],downloads,createdAt,updatedAt,
         unlocked:bool,lockReason:null|"plan:CA-5"}],
  bundles:[{id,name,description,cover,modIds:[int],plans:[str],unlocked,totalSizeBytes,sizeLabel}],
  packs:[{id,plan,name,level,images:[str],unlocked,versions:[{version,date,latest,size,features:[str],changelog,hasHash}]}],
  presets:[{id,name,file,description,img,size,downloads}],
  customizations:[{id,name,description,file,destination,icon,warning}] }
```
* `featured`=مود الأسبوع. `isNew` = created < 7 days. `early`=true when item is before `publish_at` but visible because user's plan ∈ `early_plans` (or admin). Unpublished / future (non-early) / deleted items are NOT returned to normal users.
* Locked items ARE returned (so UI shows them locked) but `/link` refuses them.
* Unlocked rule: user plan ∈ item.plans OR user role ∈ item.required_roles (empty plans = no restriction).

## 3. Legacy endpoints (must keep working for old app versions)
`GET /api/packs`, `/api/mods`, `/api/presets`, `/api/customizations` keep their **exact old response shape**, now built from DB. If setting `legacy_public_links`=0 they omit `url` fields. Seed DB from the hardcoded data in `base.lf.js` on first start (only if tables empty). Pack ids, ratings (`ratings`, `comments` tables keyed by pack id) must keep working.

## 4. Admin endpoints (`/api/v4/admin/*`, perm in brackets; all JSON `{success,...}`)
* GET `/overview` [any admin] → `{users:{total,active7d,banned}, downloads:{today,d7,d30,series:[{day,count}] (14 days)}, top:[{type,id,name,count}] (30d, top 5), unused:[{type,id,name}] (0 downloads 30d), failuresToday, reportsOk24h, links:{ok,bad,unknown}, counts:{mods,packs,presets,bundles,trash}}`
* mods [mods]: GET `/mods?deleted=0|1` (full rows incl. url/sha256/stats: downloads, installsOk, installsFail, linkOk, linkStatus, linkCheckedAt), POST `/mods`, PUT `/mods/:id`, DELETE `/mods/:id` (soft → `deleted_at`), POST `/mods/:id/restore`, DELETE `/mods/:id/purge` {confirm}.
  Writable fields: `name, description, category, cover, gallery[], version, changelog, fileName, url, sha256, sizeBytes, plans[], requiredRoles[], premium, featured, published, publishAt (ISO|null), earlyPlans[], conflicts[], sort, notify(bool: send release note now)`.
  Validation: url must be http(s), ≤500 chars, host not private/loopback (SSRF guard), `fileName` `[\w\-. ()]+\.(rpf|zip|ini|xml|asi|dll|meta|ytd)` ; sha256 = 64 hex or empty; `category` must exist.
* packs [packs]: GET/POST/PUT/DELETE/restore/purge `/packs[/:id]`; writable: `plan,name,level,images[],versions[{version,date,latest,size,features[],changelog,url,sha256,sizeBytes}],published,sort`. Exactly one version `latest`.
* presets [presets], customizations [presets], bundles [bundles], categories [mods] — same CRUD pattern (`/presets`, `/customizations`, `/bundles`, `/categories`).
* POST `/inspect-link` {url,hash?:bool} [mods|packs|presets] → `{success,ok,status,sizeBytes,contentType,finalUrl,sha256?,warnings:[str]}` (HEAD then ranged GET; if `hash` stream-download up to 2GB computing sha256; warnings for http://, wrong content-type, missing size, redirect to other host).
* GET `/links` [system] → statuses; POST `/links/check` [system] → runs checker now.
* users [users]: GET `/users?q=&page=&limit=` (`discordId,username?,hasDevice,lastLogin,banned,banReason`), POST `/users/:id/ban` {reason}, POST `/users/:id/unban`, POST `/users/:id/reset-device`.
* admins [owner]: GET/POST `{discordId,name,role,perms[]}`/DELETE `/admins[/:id]`.
* audit [logs]: GET `/audit?q=&type=&limit=` ; GET `/audit.csv`. reports [logs]: GET `/reports?ok=&limit=`, GET `/reports.csv`.
* announcements [announcements]: CRUD `/announcements` — kinds: `info|warning|maintenance|news|release`; fields `title, body, active, startsAt, endsAt, minAppVersion(for release notes: shown once on that version)`.
* settings [system]: GET/PUT `/settings` → `{maintenanceOn,maintenanceMessage,minVersion,signLinks,legacyPublicLinks,adminLock(owner only),adminHwids(owner only)}`.
* trash [mods|packs|presets|bundles]: GET `/trash` → deleted items of all types with `deletedAt`, `daysLeft` (30-day retention, daily purge job).

## 5. Background jobs (in-process, `setInterval`, unref'd)
* Link checker every 30 min (+manual): for every published item URL (mods, pack versions, presets, customizations): HEAD (fallback ranged GET), 10s timeout, concurrency 4. Store `link_ok, link_status, link_checked_at, link_fail_count`. Alert to CH_OPS when an item fails 2 consecutive checks (once), and a "recovered" note when it returns. Compare `Content-Length` with `sizeBytes` when both known → warning, not failure.
* Scheduler: every minute publish items whose `publish_at` passed (set `published=true`, write `app_releases`, send release note to CH_RELEASES).
* Trash purge daily (>30 days).
* Release notes (CH_RELEASES): on first publish, on version change of a published item, or when admin ticks `notify`.

## 6. Link signing (optional hardening, no storage needed)
If env `LINK_SIGNING_SECRET` set AND setting `signLinks`=1: `/link` returns nginx `secure_link`-compatible URL: `url?md5=<base64url(md5(expires + uriPath + " " + secret))>&expires=<unix>` with 10 min expiry (document nginx snippet in README). Otherwise the plain URL.

## 7. Electron preload API (implemented by D in `preload.js`/`main.js`; UI agents consume)
```
api.v4.get(path) / post(path,body) / put(path,body) / del(path,body)
   -> Promise<object>  // the backend JSON body; main adds Authorization + x-hwid + x-app-version; path MUST start with /api/v4/
   // network failure => {success:false, offline:true, message:"تعذّر الاتصال بالخادم"}
api.session() -> {discordId,username,plans,isOwner,isAdmin,perms,appVersion} | null   // cached from startup
api.splash.onEvent(cb)  // cb({type:"step", id, state:"pending|active|done|error", detail?}|{type:"progress",percent}|{type:"tip",text}|{type:"state",kind:"maintenance|forceUpdate|offline|ready",message?}|{type:"update",version,percent})
api.splash.retry()
api.lib.preflight({type,id}) -> {success, freeBytes, needBytes, conflicts:[{id,name}], warnings:[str]}
api.lib.install({type,id,version?,overwrite?}) -> {success,message,code?}   // resolves URL via backend /link; verifies sha256 if present; progress via existing download queue events
api.lib.installBundle(id) -> {success, results:[{id,ok,message}]}
api.lib.installed() -> {mods:[fileName], presets:[fileName], customizations:[id]}
api.lib.remove({type,id|fileName}) -> {success,message}
api.diag.run() -> {fivem:{found,path,freeBytes}, os, cpu, ramGB, gpu?, ping:{backendMs,ok}, internet:bool, appVersion, installed:{mods:n,presets:n}, checks:[{id,label,state:"ok|warn|error",detail}]}
api.diag.export() -> {success, path}   // text report saved via dialog
api.app.version() -> "x.y.z"
```
Existing APIs (`openPage`, `getFiveMPath`, download queue events, presets, etc.) remain unless explicitly replaced by `api.lib.*`.

## 8. Test harness (for UI agents)
`/home/claude/work/v4/harness/harness.js`: `const {openPage, startBackend}=require(...)`. `openPage(browser,"addons.html",{user:{...},plans:[...],owner:true})` loads `app-src/app/<page>` in Playwright (chromium at `/opt/pw-browsers/chromium`, viewport 1180x740) with a stubbed `window.api` whose `api.v4.*` call the real local backend (`http://localhost:3999`, JWT signed with `testsecret`) and whose other methods are harmless stubs. Backend test server lives in `/tmp/claude-0/bt/` (see its `run.js`, `server.js`; Postgres 16 on port 5444: start with `rm -f /tmp/pgdata/d/postmaster.pid; su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata/d -o '-p 5444' -l /tmp/pg.log start"`). Never `pkill -f` patterns that match your own shell; use `fuser -k 3999/tcp`.
