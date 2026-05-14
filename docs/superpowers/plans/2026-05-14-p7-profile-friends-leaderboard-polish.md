# P7 我的主页 + 加好友修复 + 排行榜显示优化（2026-05-14）

> **For agentic workers**: REQUIRED SUB-SKILL: `superpowers:executing-plans`. 严格遵守 `UTS_COMPILE_PITFALLS.md §41-§48`（P6 收尾时新增的 8 条 5.07 规则），并参考 §法则 12（cross-cloud 边界）、§Phase 1.5/A（Kotlin 名义类型）。本轮**不引入新业务领域**，纯粹补 UI/UX 缺口。

**Goal**: 把"账号体系"从隐藏后台变成用户可见的主页面。P7 后，用户能在 App 内查到自己的 userId 并复制分享、能成功添加好友并看到加好友失败的原因、能在排行榜上看清"我是谁、对方是谁、排名是几"。

**Architecture**：
- **不新增**云函数 / 不新增 collection。`marker-center.whoami` 增加返回 `nickname` / `avatar` 字段；`user-center` 增加 `updateProfile({ nickname?, avatar?, oldPassword?, newPassword? })` 这一个 RPC（密码改动复用 uni-id-common 的现有 hash 校验流程）。
- 头像存储走 `uniCloud.uploadFile` 直传 → 拿 `cloudPath` → `user-center.updateProfile({ avatar: cloudPath })` 写 `uni-id-users.avatar` 列。读取时用 `cloudPath -> tempFileURL` 转可访问 URL（**前端 `<image>` 直接吃 cloudPath，uniCloud SDK 自动转**，所以不需要服务端单独 sign URL）。
- 排行榜显示重做**纯前端**：`marker-center.leaderboard-service.js:54` 早已返回 `avatar` 字段（P6 实装），客户端没渲染而已。

---

## Task 0: 后端补三个最小切片（先做，前端依赖）

### 0.1 marker-center.whoami() 返回更多字段

**File**: `uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js` (现有 whoami 方法)

Current 仅返回 `uid`。改为：

```js
async whoami() {
  const uid = this.auth && this.auth.uid
  if (!uid) return { errCode: 401, errMsg: '未登录', data: null }
  const userRes = await db.collection('uni-id-users')
    .doc(uid)
    .field({ _id: 1, nickname: 1, avatar: 1, username: 1 })
    .get()
  const user = (userRes.data || [])[0]
  if (!user) return { errCode: 404, errMsg: '用户不存在', data: null }
  return {
    errCode: 0,
    data: {
      uid: user._id,
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      accountId: user.username || ''
    }
  }
}
```

**测试**: `marker-center/__tests__/whoami.test.js` 新建一例，mock db.collection.doc.field.get 验证字段映射。

### 0.2 user-center.updateProfile

**File**: `uniCloud-aliyun/cloudfunctions/user-center/index.obj.js` (新增方法)

```js
async updateProfile(payload) {
  const uid = this.auth && this.auth.uid
  if (!uid) return { errCode: 'NOT_LOGIN', errMsg: '未登录', data: null }
  const { nickname, avatar, oldPassword, newPassword } = payload || {}
  const update = {}
  if (typeof nickname === 'string' && nickname.trim().length > 0) {
    update.nickname = nickname.trim()
  }
  if (typeof avatar === 'string') update.avatar = avatar  // 允许空串清除头像
  if (typeof newPassword === 'string' && newPassword.length >= 6) {
    const userRes = await db.collection('uni-id-users').doc(uid).get()
    const user = (userRes.data || [])[0]
    if (!user) return { errCode: 'USER_NOT_FOUND', errMsg: '用户不存在', data: null }
    if (user.password !== oldPassword) {
      return { errCode: 'OLD_PASSWORD_WRONG', errMsg: '旧密码错误', data: null }
    }
    update.password = newPassword
  }
  if (Object.keys(update).length === 0) {
    return { errCode: 'NOTHING_TO_UPDATE', errMsg: '没有可更新内容', data: null }
  }
  await db.collection('uni-id-users').doc(uid).update(update)
  return { errCode: 0, data: { updated: Object.keys(update) } }
}
```

**测试**: `user-center/__tests__/updateProfile.test.js` 覆盖：(a) 改昵称、(b) 改头像、(c) 旧密码错、(d) 旧密码对+改密码、(e) 空 payload。

### 0.3 schema 加 avatar 字段

**File**: `uniCloud-aliyun/database/uni-id-users.schema.json`

确认 `avatar` 字段已经存在（uni-id 默认 schema 含）；若没有则补：
```json
"avatar": { "bsonType": "string", "title": "头像 cloudPath" }
```

---

## Task 1: 用户类型扩展（App 端）

### 1.1 UserInfo 增加 avatar

**File**: `user/index.uts`

```ts
export type UserInfo = {
  userId: string
  userName: string
  avatar: string   // 新增；可为空串
}
```

`setUserInfo` / `refreshUserInfo` 增加 avatar 字段。`refreshUserIdFromAuth()` 在 whoami 返回后写回 nickname + avatar。

**Migration**: `savedUserInfo instanceof UTSJSONObject` 解析时，若 `avatar` 字段缺失（旧版本登录的 storage），fallback 为 `''`。

---

## Task 2: 我的主页 `pages/profile/profile.uvue`（新建）

### 路由

`pages.json` 增加：
```json
{ "path": "pages/profile/profile", "style": { "navigationBarTitleText": "我的" } }
```

### 视觉结构

```
┌────────────────────────────────────┐
│  [头像]  昵称                       │
│         ID: 6843...da3a  [复制]    │
│         全部打卡 12  路线 3  积分 240│
├────────────────────────────────────┤
│  我的打卡记录              ›        │
│  我的奖励                  ›        │
│  我的任务                  ›        │
│  编辑资料                  ›        │
├────────────────────────────────────┤
│  [        退出登录        ]         │
└────────────────────────────────────┘
```

### Script

- onShow:
  1. 若未登录 → `uni.redirectTo('/pages/login/login')`
  2. `await refreshUserIdFromAuth()` 拉最新 nickname/avatar
  3. `pullPointsSummary()`（来自 cloudSync）拿累计数据
- 复制ID：`uni.setClipboardData({ data: userId })` + toast
- 我的打卡/我的奖励/我的任务：`navigateTo` 到已有页面
- 编辑资料：`navigateTo('/pages/profile-edit/profile-edit')`
- 退出登录：`clearUserInfo()` + `uni.reLaunch('/pages/index/index')`

### PITFALLS 强相关
- §41：所有定位 CSS 不用 calc()/env()
- §44：onShow 内若有 async 操作，包成 `async function init(): Promise<void>` 调用
- §47：whoami 返回的 res.data `as UTSJSONObject` 后必判 null
- 头像 `<image :src="avatarUrl">`，avatarUrl 为 cloudPath 时 uniCloud 自动转 https；无头像时显示首字母 fallback view（避免空 `<image>` 抖动）

---

## Task 3: 编辑资料页 `pages/profile-edit/profile-edit.uvue`（新建）

### 三块独立可保存

1. **头像**：点击当前头像 → `uni.chooseImage({count:1, sourceType:['album','camera']})` → `uni.uploadFile` 直传到 `uniCloud.storage` → 拿 `cloudPath` → `user-center.updateProfile({avatar:cloudPath})` → 成功后 `refreshUserInfo()` 更新本地
2. **修改昵称**：input 框 + 保存按钮 → `updateProfile({nickname})` → 重名时显示后端 errMsg
3. **修改密码**：旧密码 / 新密码 / 确认新密码 三个 input → 客户端先校验新密码两次一致 + 长度≥6 → `updateProfile({oldPassword, newPassword})`

### PITFALLS 强相关
- §44：`async function doUploadAvatar(): Promise<void>` 不要写 `: void`
- §45：被回调引用的 async 函数（如 `runUpload` 之于 `chooseImage.success`）必须**词法上**先声明
- §47：`uni.uploadFile` 的 res 解析必须 `JSON.parse<UTSJSONObject>(res.data)` 然后判 null

---

## Task 4: 首页 auth chip 跳转改造 `pages/index/index.uvue`

`goAuth()` 当前在登录态下 `showActionSheet`，改为：
```ts
function goAuth(): void {
  if (userState.userInfo == null) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  uni.navigateTo({ url: '/pages/profile/profile' })
}
```

**删除** actionSheet 入口（"我的打卡 / 我的奖励 / 退出登录"被 profile 页面接管）。

---

## Task 5: 加好友修复 `pages/friends/friends.uvue`

### Bug 现状

`doAddFriend` 调用 `requestFriend(uid)`：
- `requestFriend` 在 errCode!=0 时 **throw new Error(msg)**（参 `utils/friendCloud.uts:85-100`）
- 但 `doAddFriend` 没有 try/catch，异常被静默吞掉 → UI 无任何提示

### Fix

```ts
async function doAddFriend(): Promise<void> {
  const uid = addUid.value.trim()
  if (uid.length == 0) {
    uni.showToast({ title: '请输入用户 ID', icon: 'none' })
    return
  }
  // 自检：不能加自己
  const myUid = userState.userInfo != null ? userState.userInfo!!.userId : ''
  if (uid == myUid) {
    uni.showToast({ title: '不能添加自己', icon: 'none' })
    return
  }
  try {
    const result = await requestFriend(uid)
    if (result != null) {
      uni.showToast({
        title: result.autoAccepted ? '已自动成为好友' : '请求已发送',
        icon: 'success'
      })
      addUid.value = ''
      reload()
    } else {
      uni.showToast({ title: '请求失败，请检查用户 ID', icon: 'none' })
    }
  } catch (e) {
    const err = e as Error
    const msg = err.message
    uni.showToast({ title: msg.length > 0 ? msg : '请求失败', icon: 'none' })
  }
}
```

### 输入提示文案
顶部 input 上方加一行小字：`输入对方用户 ID（可在【我的】页复制自己 ID 分享）`

### PITFALLS 强相关
- §44：保持 `Promise<void>`
- §48：模板里 `userState.userInfo` 访问 `.userId` 时若条件复合，加 `!!`

---

## Task 6: 排行榜显示重做 `pages/leaderboard/leaderboard.uvue`

### 6.1 排名徽章 — 不用 emoji（🥇🥈🥉 Android 渲染失败已实证）

替换 `rankText()`：
```ts
// 返回数字字符串；颜色由 CSS class 控制
function rankText(rank: number): string {
  return rank.toString()
}
function rankClass(rank: number): string {
  if (rank == 1) return 'rank-badge rank-gold'
  if (rank == 2) return 'rank-badge rank-silver'
  if (rank == 3) return 'rank-badge rank-bronze'
  return 'rank-badge rank-normal'
}
```

CSS：
```css
.rank-badge { width: 56rpx; height: 56rpx; border-radius: 28rpx; display: flex; align-items: center; justify-content: center; }
.rank-gold   { background-color: #f7c548; }   /* 金 */
.rank-silver { background-color: #c0c0c0; }   /* 银 */
.rank-bronze { background-color: #cd7f32; }   /* 铜 */
.rank-normal { background-color: #f0f2f5; }
.rank-badge-text { font-size: 26rpx; font-weight: 700; color: #ffffff; }
.rank-normal .rank-badge-text { color: #555555; }
```

### 6.2 头像 — 替换首字母

模板：
```html
<view class="lb-avatar">
  <image v-if="row.avatar.length > 0" :src="row.avatar" class="lb-avatar-img" mode="aspectFill" />
  <text v-else class="lb-avatar-text">{{ initial(row.nickname) }}</text>
</view>
```

CSS `.lb-avatar` 固定 80×80 rpx 圆形；`.lb-avatar-img` 同尺寸；缺头像时 fallback 首字母（保持 P6 现有视觉）。

### 6.3 行结构重排

当前：`[rank emoji] [avatar 首字母] [nickname / 积分XX] [大号数值]` —— "积分 XX"和右侧数值字段冲突。

改为：`[rank徽章] [头像] [nickname + 一行小字描述] [大号数值]`

其中"小字描述"按 metric 切换语义、不与右侧重复：
- `metric == 'points'`  → 副标题显示 `完成 X 条路线`
- `metric == 'routes'`  → 副标题显示 `打卡 Y 次`
- `metric == 'checkins'`→ 副标题显示 `积分 Z`

实现：`subTextFor(row: LeaderboardRow): string` 替换现有 `labelFor`。

### 6.4 self-row footer（已 commit b8c5074 用 !!）保持同款重写

footer 5 处 `selfRow!!.xxx` → 改成新结构（rank徽章 / 头像 / 昵称 / 副标题 / 数值），都加 `!!`。

### PITFALLS 强相关
- §41：CSS 无 calc()
- §44：reload 已是 Promise<void>
- §45：`rankClass` / `subTextFor` 必须先于 `setMetric/setScope` 声明
- §48：模板 v-if 复合条件内的 `selfRow!!.*` 全部保留

---

## Task 7: PITFALLS 文档加 §规则 49（emoji 渲染）

详见同分支 commit `<P7-final>`，已先行追加。

---

## 接受标准（真机验收 checklist）

### A 我的主页
- [ ] 登录后点击首页左上"已登录"胶囊 → 进入 `/pages/profile/profile`
- [ ] 头像区显示当前用户头像（无则首字母）+ 昵称 + 完整 userId
- [ ] 点击"复制 ID" → toast 提示 + 剪贴板内容正确
- [ ] 累计统计：打卡数 / 路线数 / 积分 三个数字与"我的打卡/奖励"页一致
- [ ] 点击"我的打卡 / 我的奖励 / 我的任务" → 跳转到对应已有页面
- [ ] 点击"编辑资料" → 进入 profile-edit
- [ ] 点击"退出登录" → 清本地 token + 回首页未登录态

### B 编辑资料
- [ ] 点击头像 → 弹相机/相册选择 → 上传成功后头像立即更新（我的主页 + 首页都看到）
- [ ] 修改昵称 → 保存后首页"已登录"胶囊文字变化
- [ ] 旧密码错误 → 显示后端 errMsg "旧密码错误"
- [ ] 新密码 < 6 位 → 客户端校验拒绝
- [ ] 新密码两次不一致 → 客户端校验拒绝
- [ ] 全部成功 → 保留登录态（不强制退出）

### C 加好友
- [ ] 空 ID → toast "请输入用户 ID"
- [ ] 自己的 ID → toast "不能添加自己"
- [ ] 不存在的 ID → toast 显示后端 errMsg（如"目标用户不存在"）
- [ ] 已是好友 → toast "对方已是你的好友"
- [ ] 正常请求 → toast "请求已发送" + 输入框清空 + 已发送 tab 列表更新

### D 排行榜
- [ ] 全平台 / 好友圈 切换正常
- [ ] 积分 / 路线 / 打卡 切换正常，每次切换排序应该立即生效（不需要等到 reload 完成；现状已经是 reload-driven，约 1s 延迟可接受）
- [ ] 排名 1 显示金色圆形徽章 + 白色 "1"；2 银；3 铜；4+ 灰底深色数字
- [ ] 每行头像：有头像显示头像图，无头像 fallback 首字母（与 P6 旧版视觉一致）
- [ ] 主列文字：昵称居左 + 副标题（按 metric 切换文案）；右侧大号数值不重复
- [ ] selfRow footer：自己不在前 50 时出现，结构与列表项一致

---

## 不在 P7 范围

- 真推送（uni-push 2.0）真机接通：仍延期到 P8，App 端继续靠铃铛轮询
- 后台管理新增"用户管理"页：admin 侧 P5.4 已做，本轮不动
- 删好友 / 拉黑：好友列表里 unfriend 已可用，无新增
- 第三方登录：仍走原 user-center.login（账号密码）

---

## Commit 切分建议

| commit | 范围 |
|---|---|
| `feat(cloud): marker-center.whoami returns nickname+avatar; user-center.updateProfile` | Task 0 |
| `feat(app): UserInfo + state 增加 avatar 字段` | Task 1 |
| `feat(app): 我的主页 pages/profile/profile.uvue` | Task 2 |
| `feat(app): 编辑资料 pages/profile-edit/profile-edit.uvue` | Task 3 |
| `feat(app): 首页 auth chip 直跳 profile 页` | Task 4 |
| `fix(app): friends 加好友错误处理 + 自检` | Task 5 |
| `refactor(app): 排行榜重做 rank 徽章 / 头像 / 字段布局` | Task 6 |
| `docs: PITFALLS §规则 49 emoji 渲染禁忌` | Task 7 |
