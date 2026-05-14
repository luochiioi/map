# Roadmap P6 → P9 (decided 2026-05-14)

Until P5.5 the iterations were intentionally small and ops-focused. From P6 onwards each iteration ships a noticeable product capability. The full plan file is written at the start of each iteration; this roadmap fixes the order and the headline scope so we do not rediscover the priority each session.

## Sequence

| Iteration | Theme | Headline value to the user | Full plan |
|-----------|-------|----------------------------|-----------|
| **P6** | Social + Leaderboard + Push | "Friends, leaderboards, share routes, get notified." | `2026-05-14-p6-social-leaderboard-push.md` |
| **P7** | Profile + Achievement v2 + City Packs | "Your journey is a book — a personal profile with timeline, dynamic admin-configurable badges, and city-themed bundles." | TBD before P7 |
| **P8** | UI Overhaul (App + Admin) | "Visual quality bar raised across both surfaces — no more template look." | TBD before P8 |
| **P9** | Offline + Undo + WeChat Hardening | "Works on the subway. Undo accidental deletes. Mini-program reaches parity." | TBD before P9 |

## P7 outline (write the full plan when starting P7)

- New `pages/profile/profile.uvue`: avatar, nickname, "我的旅程" timeline (last 20 checkins + completed routes), summary cards (累计打卡 / 完成路线 / 积分余额 / 解锁徽章 / 参与城市).
- `tourism_achievements` cloud collection + admin page to author badges (id, name, icon, conditions JSON). Replace the hard-coded 7 in `stores/useAchievementStore.uts` with a server-driven list while keeping the fallback for offline boot.
- City packs: add `city` field to `tourism_markers` (back-compat nullable). New `tourism_city_packs` collection storing curated `(city, markerIds[])`. App index page gets a "城市挑战" entry. Admin can author city packs in a new uni-admin page.
- `marker-center.getProfileSummary({ uid })` returns the combined profile blob so the new profile page loads in one round-trip.

## P8 outline — UI overhaul (write the full plan when starting P8)

**Hard constraint from the product owner:** P8 must use the design / frontend skills and plugins. Default invocation order during P8:

1. `frontend-design` skill — for editorial / scrollytelling / bento style decisions on the App home and route detail; produces ASCII mockups and component refs before any code change.
2. `ui-ux-pro-max:ui-ux-pro-max` — global App + Admin design system pass (typography scale, color tokens, spacing rhythm, motion).
3. `frontend-patterns` + `coding-standards` skills — to land the component refactors without regressing UTS 5.07 ban list.
4. `liquid-glass-design` skill — for the App detail panel and notification bell only, as accents, not site-wide.
5. `a11y-architect` agent — accessibility audit after each major surface lands.
6. `e2e-runner` agent / `everything-claude-code:e2e` skill — visual regression at breakpoints 360 / 414 / 768 (App) and 1280 / 1440 (Admin) using Playwright.

App targets:
- Replace the current "白底 + 绿色 chip" look on the index page with a layered hero (map background + glass marker panel) without breaking the existing UTS marker / panel logic.
- Tasks / my-tasks / my-checkins / rewards / leaderboard get a unified card system + month / status grouping.
- Route detail becomes a magazine-style page (cover, intro, marker list with progress, reward summary).

Admin targets:
- Apply a real design system (tokens for color, spacing, typography). Rebuild AdminHeader, summary cards, list cards, modals as shared components.
- Audit log + reward records + checkin records share a "ops list" template.
- Form modals get inline validation and friendlier empty states.

Out of scope for P8: rewriting the data layer, changing existing cloud APIs, redesigning auth flows (handled in P9 if needed).

## P9 outline (write the full plan when starting P9)

- Offline queue for checkins (storage-backed FIFO; retry on network back; UI shows 上传中 / 等网络).
- Soft delete + N-second undo for `rewards` and `user_tasks` (add `deletedAt`, sweep job optional).
- Task progress rollback when a checkin is removed (audit log entry + UI grayed-out reward badge).
- WeChat mini-program parity for the new pages (friends, leaderboard, notifications, profile) — at least no broken pages and the share link landing works.

---

## Working norms (apply from P6 onwards)

- Branch per iteration, derived from the previous iteration's tip on `codex/p1-marker-json-boundary`.
- Every cloud-side service change is preceded by a pure-helper test; UI is verified manually on a 5.07 build before commit.
- Every iteration ends with the three verification commands documented in `2026-05-14-p6-social-leaderboard-push.md` (node --test suite + node --check sweep + UTS forbidden-token grep) and an updated section in `uniapp_x_map_checkin_prompt.md`.
- The local-only files (`.hbuilderx/launch.json`, `uni-admin/.hbuilderx/`, `admin-center.param.js`) are never committed.
