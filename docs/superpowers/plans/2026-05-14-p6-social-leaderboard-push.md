# P6 Social, Leaderboard And Notifications Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans` for cloud changes; `superpowers:test-driven-development` for every pure helper. Commits stay task-sized but P6 is the first iteration where features cross multiple App pages — keep the architecture notes near the top in mind before touching code.

**Goal:** Promote the App from a single-player checkin tracker to a network product. After P6, a user can add friends, see global and friends-only leaderboards, receive an in-app notification when something in their world changes, and share a route to a friend via deep link.

**Architecture:**
- App stays a read-mostly consumer for shared data (friendships, leaderboards, notifications).
- Writes go through `marker-center` (user-facing) or `admin-center` (moderation/broadcast).
- New cloud collections: `tourism_friendships`, `tourism_notifications`. Schema files live under `uniCloud-aliyun/database/`.
- Server emits notifications synchronously inside the same cloud method that caused the event (route completion, marker added to active route). Cron-driven reminders are out of scope this iteration; in-app red dot is enough.
- Real push (`uni-push 2.0`) is wired but kept behind a feature flag — the MVP only needs the in-app notification center to work end to end so the App is usable on simulators that lack push.
- Reuse existing patterns: cross-cloud boundary still uses `JSON.stringify(raw) -> JSON.parse<T>(...)`; native map marker ids stay SDK-safe; UTS 5.07 ban list (`Number(`, `Number.`, `switchTab`) applies.

---

## Task 0: Friendship Domain + Cloud APIs

**Problem:** No way for users to know each other exists. Need a minimal friend graph plus the data primitives every later task depends on.

Files:
- New: `uniCloud-aliyun/database/tourism_friendships.schema.json`
- New: `uniCloud-aliyun/cloudfunctions/marker-center/friendship-service.js` + `.test.js`
- Modify: `uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`
- New: `utils/friendCloud.uts` (App-side typed boundary using JSON.parse<T>)

Steps:
- [ ] Schema: `_id`, `userId`, `friendUserId`, `status: 'pending'|'accepted'|'rejected'`, `createdAt`, `updatedAt`. Index on `(userId, status)`. Always store the request as two-way after accept (or a single row with sorted uid pair — pick one and document).
- [ ] Tests first for the pure helper:
  - `buildFriendRequest(uid, targetUid, now)` rejects self-friending and empty uids.
  - `applyFriendDecision(row, 'accept'|'reject', now)` returns the new row shape without mutating input.
  - `dedupePendingRequest(rows)` so a duplicate request to the same target collapses.
- [ ] Cloud methods on `marker-center`: `requestFriend({ targetUid })`, `respondFriend({ friendshipId, decision })`, `listFriends({ status? })`, `getFriendProfile({ uid })` (returns public stats: nickname, checkin count, completed routes count — no email/phone).
- [ ] `utils/friendCloud.uts` exports typed `pullFriends()`, `requestFriend()`, etc., always going through `JSON.stringify -> JSON.parse<T>(...)`.

Acceptance:
1. Two users can complete the request/accept loop end to end on a real test build.
2. Cannot friend yourself; duplicate requests are idempotent.

---

## Task 1: Leaderboards (Pure Aggregator + API)

**Problem:** "How am I doing relative to others?" — purely data, no friend dependency yet, so do this before the friend filter so leaderboards work on day one.

Files:
- New: `uniCloud-aliyun/cloudfunctions/marker-center/leaderboard-service.js` + `.test.js`
- Modify: `marker-center/index.obj.js`
- Reuse: existing `aggregateRewardStatsByUser` in admin/marker reward-service.

Steps:
- [ ] Tests first:
  - `buildLeaderboard(rows, { metric, limit })` returns the top N with stable ordering (tie-break: earlier `firstCheckedAt` then uid string).
  - `metric` is one of `points`, `routes`, `checkins`.
  - `attachFriendFilter(rows, allowedUidSet)` returns only rows whose uid is in the set.
- [ ] `marker-center.getLeaderboard({ metric, scope, limit })`. `scope='global'` uses all users; `scope='friends'` pulls the caller's accepted friends + self before filtering.
- [ ] No DB caching for v1 — the result set is bounded by user count + a hard `limit <= 50`.

Acceptance:
1. Switching metric / scope visibly reorders the list within ~1s on test data.
2. `friends` scope without friends shows only the caller.

---

## Task 2: Route Sharing And Deep Link

**Problem:** Users want to invite friends to a route they liked. Building this on top of the friend list would gate adoption; route share should also work for non-friend recipients.

Files:
- Modify: `pages/route-detail/route-detail.uvue` (add "分享路线" action)
- Modify: `pages/index/index.uvue` (handle `onLaunch` / `onShow` deep-link params)
- Modify: `manifest.json` if needed for share scheme.

Steps:
- [ ] In `route-detail.uvue`, add a share button that calls `uni.share` (or `uni.setClipboardData` fallback) with text `「{name}」邀请你打卡 — 复制链接到 App 打开` + `mapcheckin://route?id={id}&shareFrom={uid}`.
- [ ] On launch, parse the scheme. If the user is not logged in, store the pending route id in storage and bounce to login; after login, jump straight to route-detail.
- [ ] Acceptance is "open the share text on the same device — App opens to that route detail".

Acceptance:
1. A logged-in user shares a route; opening the share text from outside the App opens it on the right route.
2. A logged-out recipient is bounced to login and lands on the same route after auth.

---

## Task 3: Notifications

**Problem:** Without notifications, friend / route activity has no surface. P6 needs at least an in-app inbox + red dot.

Files:
- New: `uniCloud-aliyun/database/tourism_notifications.schema.json`
- Modify: `marker-center/index.obj.js` (emit on route completion + new marker in active route + friend accepted)
- New: `marker-center/notification-service.js` + `.test.js`
- New App pages: `pages/notifications/notifications.uvue`
- New UTS: `utils/notificationCloud.uts`
- Modify: `pages/index/index.uvue` for a header bell + unread count badge.

Steps:
- [ ] Schema: `_id`, `userId`, `type: 'friend.requested'|'friend.accepted'|'route.completed'|'route.markerAdded'|'system.broadcast'`, `payload: object`, `read: boolean`, `createdAt`, `readAt`.
- [ ] Tests first for `buildNotification(type, userId, payload, now)` shape and `markRead(row, now)`.
- [ ] Server-side hook points:
  - In `marker-center.checkin` after route completion path, notify all friends who have the route in progress.
  - In `admin-center.updateRoute` when `markerIds` grows, notify users whose `user_progress` shows this route in progress.
  - In `marker-center.respondFriend` accept → notify the original requester.
- [ ] App `pages/notifications/notifications.uvue`: group by date, tap-to-mark-read, "全部标为已读" action.
- [ ] Index page bell shows unread count from `marker-center.getUnreadNotificationCount()`; tap navigates to the notifications page.

Acceptance:
1. Triggering an event from a second account shows a new notification on the first account within one refresh cycle.
2. Unread count drops correctly after reading; "全部标为已读" zeroes it.

---

## Task 4: App Pages — Friends, Friend Profile, Leaderboard

Files:
- New: `pages/friends/friends.uvue`
- New: `pages/friend-profile/friend-profile.uvue`
- New: `pages/leaderboard/leaderboard.uvue`
- Modify: `pages/index/index.uvue` for entries; `pages.json` for new routes.

Steps:
- [ ] `pages/friends/friends.uvue`: tabs for `已添加 / 收到的请求 / 我发出的请求`; "添加好友" input (paste uid or scan QR — QR optional in v1, paste uid is OK to ship).
- [ ] `pages/friend-profile/friend-profile.uvue`: shows public stats and a list of common completed routes; "解除好友" action.
- [ ] `pages/leaderboard/leaderboard.uvue`: top tabs for `全平台 / 好友圈`, segment for `积分 / 路线 / 打卡`. Caller is highlighted in the list when in the top N or shown at the bottom otherwise.
- [ ] Index page adds two small entries beside the auth pill: "好友" / "排行" — both use `uni.navigateTo`.

Acceptance:
1. All three pages load without errors on a 5.07 build and respect the UTS pitfall checklist (no `Number(`, no `switchTab`, no `display: block`).
2. Caller appears on a freshly added leaderboard within one refresh.

---

## Task 5: Admin Moderation + Broadcast

Files:
- Modify: `admin-center/index.obj.js`
- New: `uni-admin/pages/friendships/index.vue`
- New: `uni-admin/pages/notifications/index.vue` (broadcast composer)

Steps:
- [ ] Admin methods: `getFriendships({ status, userId, offset, limit })`, `revokeFriendship({ _id })`, `getNotifications({ userId?, type?, offset, limit })`, `broadcastNotification({ title, body, userIds? })`.
- [ ] uni-admin `friendships/index.vue` lists pending / accepted rows with revoke action and a per-user filter (mirroring the rewards page pattern landed in P5.5).
- [ ] uni-admin `notifications/index.vue` is a small form: title + body + audience (`all` or comma-separated uids) → server writes one row per target uid. Show the resulting list with a 30-day window.
- [ ] Dashboard and bottom-nav add entries (consistent with P5.4 admin records nav).

Acceptance:
1. Admin can revoke a friendship from the moderation page.
2. Admin broadcast lands in target users' notification inbox.

---

## Task 6: Verification And Docs

Verification commands:

```powershell
node --test `
  uniCloud-aliyun/cloudfunctions/marker-center/reward-service.test.js `
  uniCloud-aliyun/cloudfunctions/marker-center/audit-service.test.js `
  uniCloud-aliyun/cloudfunctions/marker-center/route-completion.test.js `
  uniCloud-aliyun/cloudfunctions/marker-center/friendship-service.test.js `
  uniCloud-aliyun/cloudfunctions/marker-center/leaderboard-service.test.js `
  uniCloud-aliyun/cloudfunctions/marker-center/notification-service.test.js `
  uniCloud-aliyun/cloudfunctions/marker-center/repair-service.test.js `
  uniCloud-aliyun/cloudfunctions/admin-center/route-service.test.js `
  uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js `
  uniCloud-aliyun/cloudfunctions/admin-center/reward-service.test.js `
  uniCloud-aliyun/cloudfunctions/admin-center/audit-service.test.js `
  uniCloud-aliyun/cloudfunctions/admin-center/task-service.test.js `
  uniCloud-aliyun/cloudfunctions/admin-center/repair-service.test.js `
  uniCloud-aliyun/cloudfunctions/photo-center/photo-service.test.js `
  uni-admin/pages/checkins/checkin-groups.test.js `
  utils/marker-id-service.test.js `
  utils/map-focus-navigation.test.js
```

```powershell
$files = Get-ChildItem -Path uniCloud-aliyun\cloudfunctions -Recurse -File | Where-Object { $_.Name -eq 'index.obj.js' -or $_.Name -like '*-service.js' } | Sort-Object FullName
foreach ($f in $files) { node --check $f.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

```powershell
Get-ChildItem -Path pages,utils,stores,types,components -Recurse -Include *.uvue,*.uts | Select-String -Pattern 'Number\(|Number\.|display:\s*(block|inline|inline-block|grid|table)|switchTab'
```

Docs:
- Append P6 landed commits and acceptance results to `uniapp_x_map_checkin_prompt.md`.
- Update `UTS_COMPILE_PITFALLS.md` only with new confirmed pitfalls.
- Write the next-session prompt at the bottom of this plan.

---

## Out Of Scope

- Real-time chat between friends (IM).
- Voice / video sharing.
- Real presence indicators (online/offline).
- Server-side cron reminders ("距上次打卡 N 天") — handled in P9 with the offline / undo work.
- Wechat-mini-program parity for new pages — handled in P9.

---

## Next Session AI Prompt

Continue development in `C:\Users\Raymond\Desktop\feinibuke\map_new` for the uni-app x / UTS 5.07 project. First read and obey:
- `uniapp_x_map_checkin_prompt.md`
- `UTS_COMPILE_PITFALLS.md`
- `docs/superpowers/plans/2026-05-14-p6-social-leaderboard-push.md`

P5.5 already landed: admin task marker picker + validation; route reward authoring guardrails (`points / both` require `rewardPoints > 0`, kind toggle resets hidden fields, card summary rewritten); App `pages/my-tasks/my-tasks` month grouping + active-tasks CTA; admin rewards page per-user filter and reward `_id` surfaced; legacy UGC marker audit helper `admin-center/repair-service.js` + `getLegacyUserMarkers()`; auth pill moved further down on the App home.

Implement P6 in task-sized commits on a fresh branch derived from `codex/p1-marker-json-boundary`:
1. Friendship domain (schema + pure helpers + cloud methods + UTS boundary).
2. Leaderboard aggregator + `getLeaderboard()`.
3. Route share + deep link.
4. Notifications schema + emit hooks + inbox page.
5. App pages for friends, friend profile, leaderboard (+ index entries).
6. Admin moderation + broadcast composer.
7. Full verification + docs.

Do not commit `.hbuilderx/launch.json`, `uni-admin/.hbuilderx/`, or `uniCloud-aliyun/cloudfunctions/admin-center/admin-center.param.js`. App `pages.json` has no tabBar, so do not use `switchTab`. Native map marker ids must stay SDK-safe; never bind business marker ids directly to `<map :markers>`. In UTS 5.07, do not use `Number(` / `Number.` and do not cast `getCurrentPages()` entries to `UTSJSONObject`. Cross cloud boundaries with `JSON.stringify(raw) -> JSON.parse<T>(...)`.
