# P10 非遗内容深化 Implementation Plan（2026-05-15）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现。Steps 用 checkbox（`- [ ]`）语法跟踪。
>
> 严格遵守 `UTS_COMPILE_PITFALLS.md §规则 41-§规则 54` 全部。本轮新增云对象与云集合，不破坏既有打卡链路。

**Goal:** 把"打卡点"从纯 GPS 图钉升级为有内容的"非遗条目" —— App 端可查看非遗详情、按类别浏览名录，后台可创建/编辑非遗内容。

**Architecture:** 新建 `tourism_heritage` 集合按 `markerId` 与 `tourism_markers` 1:1 关联（地图首页 `syncFromCloud()` 仍只拉轻量 markers，非遗内容仅在详情页按需加载）。新建 `heritage-center` 云对象承载公开读 + 管理写（marker-center/admin-center 均已逼近 800 行上限，不再扩展）。媒体复用 `photo-center.upload` 的 folder 参数。

**Tech Stack:** uni-app x / UTS 5.07、uniCloud 云对象（`index.obj.js`）、`node:test`（云端纯函数测试）、uni-admin（Vue2 后台）。

**P10 起点 commit:** `13fbd7a`（P9 docs）。分支 `dev`。

---

## Pitfalls 合规速查（每个 .uvue/.uts 文件改动前 grep 自检）

- §41 CSS `top/bottom/left/right` 无 `calc()/env()`
- §42 `type X = A | B` 的分支不是匿名对象字面量
- §43 列表不混合两种结构差异大的类型；用扁平 `DisplayItem`
- §44 `async function` 一律显式 `Promise<T>`
- §45 `<script setup>` 被引用函数声明在引用方之前
- §46 云对象只用**内联** `const api = uniCloud.importObject(...)`，禁止 `function api(): any` 包装
- §47 `JSON.parse<T>()` 之后必判 `null` 才能索引
- §48 模板 `v-if` 复合条件内字段访问加 `!!`
- §49 emoji 不承载核心信息（类别用 CSS 徽章，不用 emoji）
- §50 鉴权云对象 `_before` 必须注入 `this.auth.uid`
- §51 服务端写跨表引用前先验目标存在
- §52 跨云 `JSON.parse<T>` 前，把服务端不返的 non-optional 字段注入 rawObj
- §53 返回 index 用 `navigateBack`，禁止 `reLaunch`
- §54 双通道状态成对消费
- 客户端 `.uvue/.uts` 禁用 `Number()`、`switchTab`、`showModal`；服务端 `.js` 可用
- §23 纵向 scroll-view 不内嵌横向 scroll-view
- 跨云返回一律 `JSON.stringify` → `JSON.parse<T>`

---

## File Structure（本轮创建/修改的文件）

**新建 — 云端：**
- `uniCloud-aliyun/database/tourism_heritage.schema.json` — 非遗内容集合 schema
- `uniCloud-aliyun/cloudfunctions/heritage-center/index.obj.js` — 非遗云对象（公开读 + 管理写）
- `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.js` — 纯函数（构造/校验/规范化/种子数据）
- `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js` — node:test
- `uniCloud-aliyun/cloudfunctions/heritage-center/package.json` — 依赖 uni-id-common

**新建 — App 端：**
- `types/heritage.uts` — 非遗类型定义
- `utils/heritageCloud.uts` — 客户端云封装
- `pages/heritage-detail/heritage-detail.uvue` — F1 非遗详情页
- `pages/heritage-list/heritage-list.uvue` — F2 非遗名录页

**新建 — 后台：**
- `uni-admin/pages/heritage/list.vue` — 非遗内容列表
- `uni-admin/pages/heritage/edit.vue` — 非遗内容创建/编辑表单

**修改：**
- `uniCloud-aliyun/cloudfunctions/photo-center/index.obj.js` — `upload` 加 `folder` 参数
- `pages/index/index.uvue` — marker-panel 加"了解非遗详情"按钮 + 导航簇加"非遗名录"入口
- `pages.json` — 注册 `heritage-detail`、`heritage-list`
- `uni-admin/pages.json` — 注册 `heritage/list`、`heritage/edit`
- `uniapp_x_map_checkin_prompt.md` — 追加 P10 章节
- `changelog.md` — 追加 P10 条目

---

# Phase P10.1 — 云端数据层（F4）

产出可独立验证的云端基础设施。所有纯逻辑进 `heritage-service.js` + node:test。

## Task 1: `tourism_heritage` 集合 schema

**Files:**
- Create: `uniCloud-aliyun/database/tourism_heritage.schema.json`

- [ ] **Step 1: 写 schema**

```json
{
  "bsonType": "object",
  "required": ["markerId", "category"],
  "permission": {
    "read": true,
    "create": "auth.role == 'admin'",
    "update": "auth.role == 'admin'",
    "delete": "auth.role == 'admin'"
  },
  "properties": {
    "_id": { "description": "云端自动生成的文档ID" },
    "markerId": { "bsonType": "int", "description": "关联 tourism_markers.id（1:1，唯一）" },
    "category": {
      "bsonType": "string",
      "enum": ["传统技艺", "民俗", "曲艺", "传统音乐", "传统舞蹈", "传统美术", "传统医药", "民间文学", "传统体育"],
      "description": "非遗类别"
    },
    "summary": { "bsonType": "string", "maxLength": 300, "description": "项目简介" },
    "story": { "bsonType": "string", "maxLength": 5000, "description": "历史故事长文" },
    "images": { "bsonType": "array", "items": { "bsonType": "string" }, "description": "图文云存储URL列表" },
    "inheritorName": { "bsonType": "string", "maxLength": 50, "description": "传承人姓名" },
    "inheritorBio": { "bsonType": "string", "maxLength": 500, "description": "传承人简介" },
    "inheritorPhoto": { "bsonType": "string", "description": "传承人照片云存储URL" },
    "relatedMarkerIds": { "bsonType": "array", "items": { "bsonType": "int" }, "description": "相关条目 markerId" },
    "status": { "bsonType": "string", "enum": ["draft", "published"], "defaultValue": "draft", "description": "草稿不在App端F2列表出现" },
    "createdAt": { "bsonType": "timestamp" },
    "updatedAt": { "bsonType": "timestamp" }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add uniCloud-aliyun/database/tourism_heritage.schema.json
git commit -m "feat(cloud): 新增 tourism_heritage 集合 schema (P10.1)"
```

> 部署说明：在 HBuilderX uniCloud 控制台上传该 schema 后再联调。集合不带 `markerId` 唯一索引约束（uniCloud schema 不支持唯一索引声明），唯一性由 `heritage-service.validateHeritageInput` + `create` 方法的存在性查询保证。

---

## Task 2: `heritage-service.js` 纯函数 + node:test

**Files:**
- Create: `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.js`
- Test: `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`

- [ ] **Step 1: 写失败测试**

```js
const test = require('node:test')
const assert = require('node:assert')
const {
  CATEGORY_ENUM,
  HERITAGE_UPDATE_WHITELIST,
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  DEFAULT_SEED_HERITAGE
} = require('./heritage-service')

test('CATEGORY_ENUM 含 9 个法定类别', () => {
  assert.strictEqual(CATEGORY_ENUM.length, 9)
  assert.ok(CATEGORY_ENUM.includes('传统技艺'))
})

test('validateHeritageInput 拒绝缺 markerId', () => {
  const r = validateHeritageInput({ category: '传统技艺' })
  assert.strictEqual(r.ok, false)
})

test('validateHeritageInput 拒绝非法类别', () => {
  const r = validateHeritageInput({ markerId: 1, category: '不存在的类别' })
  assert.strictEqual(r.ok, false)
})

test('validateHeritageInput 接受合法输入', () => {
  const r = validateHeritageInput({ markerId: 1, category: '传统技艺' })
  assert.strictEqual(r.ok, true)
})

test('buildHeritageDoc 注入默认值与时间戳', () => {
  const doc = buildHeritageDoc({ markerId: 4, category: '民俗' }, 1700000000000)
  assert.strictEqual(doc.markerId, 4)
  assert.strictEqual(doc.status, 'draft')
  assert.deepStrictEqual(doc.images, [])
  assert.deepStrictEqual(doc.relatedMarkerIds, [])
  assert.strictEqual(doc.createdAt, 1700000000000)
  assert.strictEqual(doc.updatedAt, 1700000000000)
})

test('buildHeritageUpdate 只保留白名单字段', () => {
  const u = buildHeritageUpdate({ summary: 'x', _id: 'hack', markerId: 999 }, 1700000000000)
  assert.strictEqual(u.summary, 'x')
  assert.strictEqual(u._id, undefined)
  assert.strictEqual(u.markerId, undefined)
  assert.strictEqual(u.updatedAt, 1700000000000)
})

test('normalizeHeritageDetail 补齐 non-optional 字段', () => {
  const n = normalizeHeritageDetail({ markerId: 1, category: '曲艺' })
  assert.strictEqual(n.summary, '')
  assert.strictEqual(n.story, '')
  assert.deepStrictEqual(n.images, [])
  assert.strictEqual(n.inheritorName, '')
  assert.deepStrictEqual(n.relatedMarkerIds, [])
})

test('DEFAULT_SEED_HERITAGE 含澳门与湖南条目且类别合法', () => {
  assert.ok(DEFAULT_SEED_HERITAGE.length >= 8)
  for (const s of DEFAULT_SEED_HERITAGE) {
    assert.ok(CATEGORY_ENUM.includes(s.category), `非法类别 ${s.category}`)
    assert.strictEqual(typeof s.markerId, 'number')
    assert.strictEqual(s.status, 'published')
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`
Expected: FAIL（`Cannot find module './heritage-service'`）

- [ ] **Step 3: 写实现**

```js
const CATEGORY_ENUM = [
  '传统技艺', '民俗', '曲艺', '传统音乐', '传统舞蹈',
  '传统美术', '传统医药', '民间文学', '传统体育'
]

const HERITAGE_UPDATE_WHITELIST = [
  'category', 'summary', 'story', 'images',
  'inheritorName', 'inheritorBio', 'inheritorPhoto',
  'relatedMarkerIds', 'status'
]

function toStr(v) { return typeof v === 'string' ? v : '' }
function toIntArray(v) {
  if (!Array.isArray(v)) return []
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n))
}
function toStrArray(v) {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string')
}

function validateHeritageInput(data) {
  if (data == null) return { ok: false, msg: '缺少内容' }
  const markerId = Number(data.markerId)
  if (!Number.isFinite(markerId)) return { ok: false, msg: '缺少关联打卡点' }
  if (!CATEGORY_ENUM.includes(data.category)) return { ok: false, msg: '非遗类别非法' }
  return { ok: true, msg: '' }
}

function buildHeritageDoc(data, now) {
  return {
    markerId: Number(data.markerId),
    category: data.category,
    summary: toStr(data.summary),
    story: toStr(data.story),
    images: toStrArray(data.images),
    inheritorName: toStr(data.inheritorName),
    inheritorBio: toStr(data.inheritorBio),
    inheritorPhoto: toStr(data.inheritorPhoto),
    relatedMarkerIds: toIntArray(data.relatedMarkerIds),
    status: data.status === 'published' ? 'published' : 'draft',
    createdAt: now,
    updatedAt: now
  }
}

function buildHeritageUpdate(data, now) {
  const out = {}
  for (const key of HERITAGE_UPDATE_WHITELIST) {
    if (data[key] === undefined) continue
    if (key === 'images') { out.images = toStrArray(data.images); continue }
    if (key === 'relatedMarkerIds') { out.relatedMarkerIds = toIntArray(data.relatedMarkerIds); continue }
    if (key === 'category' && !CATEGORY_ENUM.includes(data.category)) continue
    if (key === 'status') { out.status = data.status === 'published' ? 'published' : 'draft'; continue }
    out[key] = data[key]
  }
  out.updatedAt = now
  return out
}

function normalizeHeritageDetail(doc) {
  return {
    _id: toStr(doc && doc._id),
    markerId: Number((doc && doc.markerId) || 0),
    category: toStr(doc && doc.category),
    summary: toStr(doc && doc.summary),
    story: toStr(doc && doc.story),
    images: toStrArray(doc && doc.images),
    inheritorName: toStr(doc && doc.inheritorName),
    inheritorBio: toStr(doc && doc.inheritorBio),
    inheritorPhoto: toStr(doc && doc.inheritorPhoto),
    relatedMarkerIds: toIntArray(doc && doc.relatedMarkerIds),
    status: (doc && doc.status === 'published') ? 'published' : 'draft'
  }
}

// 种子数据：澳门 + 湖南真实非遗。markerId 由 Task 12 一并种入 tourism_markers。
// summary/story 在 Task 12 实现时写入真实内容（此处为占位骨架，仅用于测试形状）。
const DEFAULT_SEED_HERITAGE = [
  { markerId: 1001, category: '民俗',     status: 'published', title: '鱼行醉龙节' },
  { markerId: 1002, category: '传统美术', status: 'published', title: '澳门神像雕刻' },
  { markerId: 1003, category: '传统医药', status: 'published', title: '凉茶配制' },
  { markerId: 1004, category: '曲艺',     status: 'published', title: '土生土语话剧' },
  { markerId: 1005, category: '传统音乐', status: 'published', title: '道教科仪音乐' },
  { markerId: 1101, category: '传统美术', status: 'published', title: '湘绣' },
  { markerId: 1102, category: '曲艺',     status: 'published', title: '花鼓戏' },
  { markerId: 1103, category: '传统美术', status: 'published', title: '滩头年画' },
  { markerId: 1104, category: '民间文学', status: 'published', title: '江永女书' },
  { markerId: 1105, category: '传统技艺', status: 'published', title: '醴陵釉下五彩瓷烧制技艺' }
]

module.exports = {
  CATEGORY_ENUM,
  HERITAGE_UPDATE_WHITELIST,
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  DEFAULT_SEED_HERITAGE
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`
Expected: PASS（8 tests）

- [ ] **Step 5: 提交**

```bash
git add uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.js uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js
git commit -m "feat(cloud): heritage-service 纯函数 + node:test (P10.1)"
```

---

## Task 3: `heritage-center` 云对象 + package.json

**Files:**
- Create: `uniCloud-aliyun/cloudfunctions/heritage-center/index.obj.js`
- Create: `uniCloud-aliyun/cloudfunctions/heritage-center/package.json`

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "heritage-center",
  "dependencies": {
    "uni-id-common": "file:../../../uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common"
  }
}
```

- [ ] **Step 2: 写 index.obj.js**

`_before` 走"catch 不抛"模板（§50）—— 公开读方法 `getDetail/list` 无需登录，管理方法各自调 `_requireAdmin()`。

```js
const db = uniCloud.database()
const col = db.collection('tourism_heritage')
const authUtil = require('../common/auth-util')
const {
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  CATEGORY_ENUM
} = require('./heritage-service')

module.exports = {
  _before: async function () {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      // 公开读方法允许未登录；管理方法自行校验
    }
  },

  async _requireAdmin() {
    if (!this.auth || !this.auth.uid) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
    const res = await db.collection('uni-id-users')
      .where({ _id: this.auth.uid, role: 'admin' }).get()
    if (!res.data || res.data.length === 0) {
      throw { errCode: -2, errMsg: '无管理员权限' }
    }
  },

  // ---- 公开读 ----
  async getDetail(data) {
    const markerId = Number(data && data.markerId)
    if (!Number.isFinite(markerId)) return { errCode: -1, errMsg: '缺少 markerId', data: null }
    const res = await col.where({ markerId, status: 'published' }).limit(1).get()
    if (!res.data || res.data.length === 0) return { errCode: 0, errMsg: '', data: null }
    return { errCode: 0, errMsg: '', data: normalizeHeritageDetail(res.data[0]) }
  },

  async list(data) {
    const category = (data && typeof data.category === 'string') ? data.category : ''
    const offset = Number((data && data.offset) || 0)
    const limit = Math.min(Number((data && data.limit) || 20), 50)
    const where = category && CATEGORY_ENUM.includes(category)
      ? { status: 'published', category }
      : { status: 'published' }
    const res = await col.where(where).skip(offset).limit(limit).get()
    const items = (res.data || []).map((d) => normalizeHeritageDetail(d))
    return { errCode: 0, errMsg: '', data: { items, offset, limit } }
  },

  // ---- 管理写 ----
  async adminList(data) {
    await this._requireAdmin()
    const offset = Number((data && data.offset) || 0)
    const limit = Math.min(Number((data && data.limit) || 50), 100)
    const res = await col.skip(offset).limit(limit).get()
    return { errCode: 0, errMsg: '', data: (res.data || []).map((d) => normalizeHeritageDetail(d)) }
  },

  async adminGet(data) {
    await this._requireAdmin()
    const markerId = Number(data && data.markerId)
    const res = await col.where({ markerId }).limit(1).get()
    if (!res.data || res.data.length === 0) return { errCode: 0, errMsg: '', data: null }
    return { errCode: 0, errMsg: '', data: normalizeHeritageDetail(res.data[0]) }
  },

  async create(data) {
    await this._requireAdmin()
    const v = validateHeritageInput(data)
    if (!v.ok) return { errCode: -1, errMsg: v.msg, data: null }
    // §51：验证关联 marker 存在
    const markerRes = await db.collection('tourism_markers').where({ id: Number(data.markerId) }).limit(1).get()
    if (!markerRes.data || markerRes.data.length === 0) {
      return { errCode: -1, errMsg: '关联打卡点不存在', data: null }
    }
    // markerId 唯一性
    const dup = await col.where({ markerId: Number(data.markerId) }).limit(1).get()
    if (dup.data && dup.data.length > 0) {
      return { errCode: -1, errMsg: '该打卡点已有非遗内容', data: null }
    }
    const doc = buildHeritageDoc(data, Date.now())
    const addRes = await col.add(doc)
    return { errCode: 0, errMsg: '创建成功', data: { _id: addRes.id } }
  },

  async update(data) {
    await this._requireAdmin()
    const id = data && data._id
    if (!id) return { errCode: -1, errMsg: '缺少 _id', data: null }
    const patch = buildHeritageUpdate(data, Date.now())
    await col.doc(id).update(patch)
    return { errCode: 0, errMsg: '保存成功', data: null }
  },

  async remove(data) {
    await this._requireAdmin()
    const id = data && data._id
    if (!id) return { errCode: -1, errMsg: '缺少 _id', data: null }
    await col.doc(id).remove()
    return { errCode: 0, errMsg: '删除成功', data: null }
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add uniCloud-aliyun/cloudfunctions/heritage-center/index.obj.js uniCloud-aliyun/cloudfunctions/heritage-center/package.json
git commit -m "feat(cloud): heritage-center 云对象（公开读+管理写） (P10.1)"
```

> 部署说明：HBuilderX 右键 `heritage-center` → 上传部署，勾选"上传公共模块"以带上 `common/auth-util`。

---

## Task 4: `photo-center.upload` 加 folder 参数

**Files:**
- Modify: `uniCloud-aliyun/cloudfunctions/photo-center/index.obj.js`

- [ ] **Step 1: 改 upload 方法** ✅ 已落地 commit `0ee7eec`

注意：P9 已把 photo-center 瘦身为仅头像上传，实际 cloudPath 是 `avatars/...`（非计划初稿写的 `checkin-photos/...`）。已落地实现：
```js
const folder = (data && typeof data.folder === 'string' && data.folder) ? data.folder : 'avatars'
const result = await uniCloud.uploadFile({
  cloudPath: `${folder}/${this.auth.uid}/${Date.now()}_${fileName || 'avatar.jpg'}`,
  fileContent: Buffer.from(fileContent, 'base64')
})
```

> 不传 `folder` 时行为与现状完全一致（头像上传不受影响）。非遗图必须显式传 `folder: 'heritage-media'`。

- [ ] **Step 2: 提交**

```bash
git add uniCloud-aliyun/cloudfunctions/photo-center/index.obj.js
git commit -m "feat(cloud): photo-center.upload 支持 folder 参数 (P10.1)"
```

- [ ] **Step 3: 运行全量云端测试确认不退化**

Run: `node --test "uniCloud-aliyun/cloudfunctions/**/*.test.js"`（Node v24 不接受裸目录形式）
Expected: PASS（基线 161 + 新增 8 heritage-service = 169，全绿）

---

# Phase P10.2 — F1 非遗详情页 + marker-panel 入口

## Task 5: `types/heritage.uts`

**Files:**
- Create: `types/heritage.uts`

- [ ] **Step 1: 写类型**

```ts
export type HeritageDetail = {
  _id: string
  markerId: number
  category: string
  summary: string
  story: string
  images: string[]
  inheritorName: string
  inheritorBio: string
  inheritorPhoto: string
  relatedMarkerIds: number[]
  status: string
}

export type HeritageListItem = {
  _id: string
  markerId: number
  category: string
  summary: string
  images: string[]
}
```

- [ ] **Step 2: 提交**

```bash
git add types/heritage.uts
git commit -m "feat(app): 新增 heritage 类型定义 (P10.2)"
```

---

## Task 6: `utils/heritageCloud.uts` 客户端云封装

**Files:**
- Create: `utils/heritageCloud.uts`

- [ ] **Step 1: 写封装**

严守 §46（内联 const importObject）、§47（parse 后判 null）、§52（non-optional 字段先注入 rawObj）、§44（显式 Promise）。

```ts
import type { HeritageDetail, HeritageListItem } from '@/types/heritage'

// §52 兜底：服务端可能不返某些 non-optional 字段，parse 前注入空值
function injectHeritageDefaults(raw: UTSJSONObject): void {
  if (raw['summary'] == null) { raw['summary'] = '' }
  if (raw['story'] == null) { raw['story'] = '' }
  if (raw['images'] == null) { raw['images'] = [] as string[] }
  if (raw['inheritorName'] == null) { raw['inheritorName'] = '' }
  if (raw['inheritorBio'] == null) { raw['inheritorBio'] = '' }
  if (raw['inheritorPhoto'] == null) { raw['inheritorPhoto'] = '' }
  if (raw['relatedMarkerIds'] == null) { raw['relatedMarkerIds'] = [] as number[] }
  if (raw['_id'] == null) { raw['_id'] = '' }
  if (raw['status'] == null) { raw['status'] = 'published' }
}

export async function fetchHeritageDetail(markerId: number): Promise<HeritageDetail | null> {
  const heritageApi = uniCloud.importObject('heritage-center', { customUI: true } as UniCloudImportObjectOptions)
  const res = await heritageApi.getDetail({ markerId: markerId } as UTSJSONObject) as UTSJSONObject
  const dataField = res['data']
  if (dataField == null) return null
  const rawObj = dataField as UTSJSONObject
  injectHeritageDefaults(rawObj)
  const parsed = JSON.parse<HeritageDetail>(JSON.stringify(rawObj))
  if (parsed == null) return null
  return parsed
}

export async function fetchHeritageList(category: string, offset: number, limit: number): Promise<HeritageListItem[]> {
  const heritageApi = uniCloud.importObject('heritage-center', { customUI: true } as UniCloudImportObjectOptions)
  const res = await heritageApi.list({ category: category, offset: offset, limit: limit } as UTSJSONObject) as UTSJSONObject
  const dataField = res['data']
  if (dataField == null) return [] as HeritageListItem[]
  const dataObj = dataField as UTSJSONObject
  const itemsField = dataObj['items']
  if (itemsField == null) return [] as HeritageListItem[]
  const arr = itemsField as UTSJSONObject[]
  const out: HeritageListItem[] = []
  for (let i = 0; i < arr.length; i++) {
    const rawObj = arr[i]
    if (rawObj['summary'] == null) { rawObj['summary'] = '' }
    if (rawObj['images'] == null) { rawObj['images'] = [] as string[] }
    if (rawObj['_id'] == null) { rawObj['_id'] = '' }
    const parsed = JSON.parse<HeritageListItem>(JSON.stringify(rawObj))
    if (parsed != null) { out.push(parsed) }
  }
  return out
}
```

- [ ] **Step 2: 提交**

```bash
git add utils/heritageCloud.uts
git commit -m "feat(app): heritageCloud 客户端云封装 (P10.2)"
```

---

## Task 7: `pages/heritage-detail/heritage-detail.uvue` F1 详情页

**Files:**
- Create: `pages/heritage-detail/heritage-detail.uvue`
- Modify: `pages.json`

- [ ] **Step 1: 写页面**

结构（参考 `pages/route-detail/route-detail.uvue`）：

- `onLoad`：从 query 取 `markerId`。**不可用 `Number()`** —— 用 UTS `(opt['markerId'] as string).toInt()` 或 `parseInt`。
- `onReady` 异步调 `fetchHeritageDetail(markerId)`，写入 `detail = ref<HeritageDetail | null>(null)`、`loading = ref<boolean>(true)`。
- 模板分区：
  1. 加载骨架 `v-if="loading"`
  2. 空状态 `v-if="loading == false && detail == null"` → "暂无非遗内容"
  3. 内容 `v-if="detail != null"`（简单条件可 narrow）：
     - 类别徽章（CSS 徽章，§49 —— 不用 emoji）
     - 简介 `{{ detail!!.summary }}`
     - **图片画廊**：横向 `<scroll-view scroll-x>`。§23 —— 此横向 scroll-view 不被任何纵向 scroll-view 包裹。整页用页面原生滚动（不套最外层纵向 scroll-view），画廊为独立横向 scroll-view。
     - 历史故事 `{{ detail!!.story }}`
     - 传承人卡片：`v-if="detail!!.inheritorName.length > 0"` → 头像 `<image>` + 姓名 + 简介
     - 相关条目：`v-for` over `detail!!.relatedMarkerIds`，每项 `@click` → `navigateTo('/pages/heritage-detail/heritage-detail?markerId=' + rid.toString())`
- 返回：页面自带导航栏返回即 `navigateBack`，不写 `reLaunch`（§53）。
- 所有 async 函数显式 `Promise<void>`（§44）；`loadDetail` 等被引用函数声明在引用方之前（§45）。

CSS 类别徽章（§49）：
```css
.cat-badge { padding: 6rpx 20rpx; border-radius: 24rpx; background-color: #e8f0fe; }
.cat-badge-text { font-size: 24rpx; color: #1a73e8; }
```

- [ ] **Step 2: 注册路由**

`pages.json` 的 `pages` 数组加：
```json
{ "path": "pages/heritage-detail/heritage-detail", "style": { "navigationBarTitleText": "非遗详情" } }
```

- [ ] **Step 3: HBuilderX 编译验证**

运行到 Android 真机，编译通过无 UTS 报错。

- [ ] **Step 4: 提交**

```bash
git add pages/heritage-detail/heritage-detail.uvue pages.json
git commit -m "feat(app): 非遗详情页 heritage-detail (P10.2)"
```

---

## Task 8: marker-panel 加"了解非遗详情"按钮

**Files:**
- Modify: `pages/index/index.uvue`

- [ ] **Step 1: panel-actions 加按钮**

在 `pages/index/index.uvue` 的 `<view class="panel-actions">`（约 L106-119）内加：
```html
<view class="panel-btn panel-btn-ghost" @click="openHeritageDetail">
  <text class="panel-btn-text muted">了解非遗详情</text>
</view>
```

`<script setup>` 加方法（声明在模板引用前，§45）：
```ts
function openHeritageDetail() {
  if (activeMarker.value == null) return
  const id = activeMarker.value!!.id
  uni.navigateTo({ url: '/pages/heritage-detail/heritage-detail?markerId=' + id.toString() })
}
```

> 按钮常显，内容有无由 F1 空状态兜底 —— 不给地图加载链路加额外查询。

- [ ] **Step 2: 编译验证 + 提交**

真机点开 marker-panel → 点"了解非遗详情" → 进入详情页（无内容显示空状态）。
```bash
git add pages/index/index.uvue
git commit -m "feat(app): marker-panel 增加非遗详情入口 (P10.2)"
```

---

# Phase P10.3 — F2 非遗名录页

## Task 9: `pages/heritage-list/heritage-list.uvue` + index 入口

**Files:**
- Create: `pages/heritage-list/heritage-list.uvue`
- Modify: `pages.json`, `pages/index/index.uvue`

- [ ] **Step 1: 写名录页**

- 顶部类别筛选 tab：`['全部', '传统技艺', '民俗', '曲艺', '传统音乐', '传统舞蹈', '传统美术', '传统医药', '民间文学', '传统体育']`。当前选中存 `activeCategory = ref<string>('')`（空串 = 全部）。
- `onReady` + 切 tab 时调 `fetchHeritageList(activeCategory.value, 0, 20)`，结果存 `items = ref<HeritageListItem[]>([])`。
- 列表项：缩略图（`item.images.length > 0` 时 `<image>`，否则占位）+ 类别徽章 + 简介截断。`@click` → `navigateTo('/pages/heritage-detail/heritage-detail?markerId=' + item.markerId.toString())`。
- 列表用纵向 `<scroll-view scroll-y>`，列表项内**不放横向 scroll-view**（§23）。
- 分页：滚到底 `@scrolltolower` 时 offset += 20 再拉，追加到 items。
- async 显式 `Promise<void>`（§44）；§48 列表 `v-for` 项复合条件字段访问按需 `!!`。

- [ ] **Step 2: 注册路由**

`pages.json` 加：
```json
{ "path": "pages/heritage-list/heritage-list", "style": { "navigationBarTitleText": "非遗名录" } }
```

- [ ] **Step 3: index 导航簇加入口**

`pages/index/index.uvue` 现有导航簇（routes/tasks/leaderboard 那组）加一个"非遗名录"项，`@click`：
```ts
function openHeritageList() {
  uni.navigateTo({ url: '/pages/heritage-list/heritage-list' })
}
```

- [ ] **Step 4: 编译验证 + 提交**

真机：进非遗名录 → 切类别 tab 列表刷新 → 点条目进详情。
```bash
git add pages/heritage-list/heritage-list.uvue pages.json pages/index/index.uvue
git commit -m "feat(app): 非遗名录页 heritage-list + 首页入口 (P10.3)"
```

---

# Phase P10.4 — 后台内容编辑

## Task 10: `uni-admin/pages/heritage/list.vue` 非遗内容列表

**Files:**
- Create: `uni-admin/pages/heritage/list.vue`
- Modify: `uni-admin/pages.json`

- [ ] **Step 1: 写列表页**

参考 `uni-admin/pages/markers/index.vue`（490 行）。后台 `.js`/`.vue` 可用 `Number()`/三元/后代选择器。
- `created` 调 `uniCloud.importObject('heritage-center').adminList({ offset: 0, limit: 50 })`，渲染表格：markerId、类别、简介截断、状态（draft/published）、操作。
- 顶部"新增非遗内容"按钮 → 跳 `heritage/edit`。
- "同步种子数据"按钮 → 调 `seedDefaults()`（Task 12 实现后启用），成功后刷新。
- 每行"编辑"→ 跳 `heritage/edit?markerId=xxx`；"删除"→ `remove({ _id })` 后刷新。
- 鉴权错误（errCode -1/-2）走 `uni-admin/utils/adminAuth.js`"去登录"恢复入口（与其他后台页一致）。

- [ ] **Step 2: 注册路由 + 提交**

`uni-admin/pages.json` 加 `heritage/list`。左侧菜单加"非遗内容"项。
```bash
git add uni-admin/pages/heritage/list.vue uni-admin/pages.json
git commit -m "feat(admin): 非遗内容列表页 (P10.4)"
```

---

## Task 11: `uni-admin/pages/heritage/edit.vue` 创建/编辑表单

**Files:**
- Create: `uni-admin/pages/heritage/edit.vue`
- Modify: `uni-admin/pages.json`

- [ ] **Step 1: 写表单页**

- `onLoad` 取 query `markerId`：有 → `adminGet({ markerId })` 回填编辑；无 → 新建。
- 字段：关联 marker（新建时从 `admin-center` 拉 marker 列表下拉选；编辑时只读）、类别下拉（9 类）、简介、故事（textarea）、传承人姓名/简介/照片、相关条目（多选 markerId）、状态（draft/published）。
- 图片上传：选图 → 读 base64 → `uniCloud.importObject('photo-center').upload({ fileContent, fileName, folder: 'heritage-media' })` → 拿 `cloudURL` 追加进 `images`。传承人照片同理。
- 保存：新建走 `create(payload)`，编辑走 `update({ _id, ...payload })`。成功后返回 `heritage/list`。

- [ ] **Step 2: 注册路由 + 提交**

`uni-admin/pages.json` 加 `heritage/edit`。
```bash
git add uni-admin/pages/heritage/edit.vue uni-admin/pages.json
git commit -m "feat(admin): 非遗内容创建/编辑表单 (P10.4)"
```

---

# Phase P10.5 — 澳门 / 湖南非遗种子数据

## Task 12: 种子 marker + 种子非遗内容

**Files:**
- Modify: `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.js`（`DEFAULT_SEED_HERITAGE` 填真实内容 + 新增 `DEFAULT_SEED_MARKERS`）
- Modify: `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`（补种子内容测试）
- Modify: `uniCloud-aliyun/cloudfunctions/heritage-center/index.obj.js`（新增 `seedDefaults` 管理方法）

- [ ] **Step 1: 补种子测试**

```js
test('DEFAULT_SEED_MARKERS 与 DEFAULT_SEED_HERITAGE markerId 一一对应', () => {
  const { DEFAULT_SEED_MARKERS, DEFAULT_SEED_HERITAGE } = require('./heritage-service')
  const markerIds = DEFAULT_SEED_MARKERS.map((m) => m.id).sort()
  const heritageIds = DEFAULT_SEED_HERITAGE.map((h) => h.markerId).sort()
  assert.deepStrictEqual(markerIds, heritageIds)
})

test('每条种子非遗都有非空 summary 与 story', () => {
  const { DEFAULT_SEED_HERITAGE } = require('./heritage-service')
  for (const h of DEFAULT_SEED_HERITAGE) {
    assert.ok(h.summary && h.summary.length > 10, `${h.title} summary 太短`)
    assert.ok(h.story && h.story.length > 30, `${h.title} story 太短`)
  }
})

test('种子 marker 坐标落在合理经纬度范围', () => {
  const { DEFAULT_SEED_MARKERS } = require('./heritage-service')
  for (const m of DEFAULT_SEED_MARKERS) {
    assert.ok(m.latitude > 20 && m.latitude < 33, `${m.title} 纬度异常`)
    assert.ok(m.longitude > 109 && m.longitude < 115, `${m.title} 经度异常`)
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`
Expected: FAIL（`DEFAULT_SEED_MARKERS` 未定义 / summary 缺失）

- [ ] **Step 3: 填真实种子数据**

`heritage-service.js` 新增 `DEFAULT_SEED_MARKERS`（markerId 1001-1005 澳门、1101-1105 湖南，真实坐标），并把 `DEFAULT_SEED_HERITAGE` 每条补上真实 `summary`（≤300 字）、`story`（项目历史，含传承脉络）、`category`、`inheritorName`/`inheritorBio`（如有公开传承人则填，否则留空）。`module.exports` 加 `DEFAULT_SEED_MARKERS`。10 条候选：

| markerId | 项目 | 类别 | 关联地点（真实坐标） |
|---|---|---|---|
| 1001 | 鱼行醉龙节 | 民俗 | 澳门三街会馆 |
| 1002 | 澳门神像雕刻 | 传统美术 | 澳门关前正街 |
| 1003 | 凉茶配制 | 传统医药 | 澳门半岛 |
| 1004 | 土生土语话剧 | 曲艺 | 澳门岗顶剧院 |
| 1005 | 道教科仪音乐 | 传统音乐 | 澳门妈阁庙 |
| 1101 | 湘绣 | 传统美术 | 长沙沙坪湘绣小镇 |
| 1102 | 花鼓戏 | 曲艺 | 长沙 |
| 1103 | 滩头年画 | 传统美术 | 邵阳隆回县滩头镇 |
| 1104 | 江永女书 | 民间文学 | 永州江永县 |
| 1105 | 醴陵釉下五彩瓷烧制技艺 | 传统技艺 | 株洲醴陵市 |

> 内容真实性要求：summary/story 必须基于真实非遗资料撰写，不杜撰传承人。坐标用各地点真实经纬度。

- [ ] **Step 4: `heritage-center` 加 `seedDefaults` 方法**

`index.obj.js` 顶部 require 改为同时引入 `DEFAULT_SEED_MARKERS`、`DEFAULT_SEED_HERITAGE`。新增管理方法（幂等 —— 仿 `marker-service.syncDefaultMarkers`）：
```js
async seedDefaults() {
  await this._requireAdmin()
  const now = Date.now()
  const markerCol = db.collection('tourism_markers')
  const { DEFAULT_SEED_MARKERS, DEFAULT_SEED_HERITAGE } = require('./heritage-service')
  let markerWrites = 0
  let heritageWrites = 0
  for (const m of DEFAULT_SEED_MARKERS) {
    const exist = await markerCol.where({ id: m.id }).limit(1).get()
    if (!exist.data || exist.data.length === 0) {
      await markerCol.add({
        id: m.id, title: m.title, latitude: m.latitude, longitude: m.longitude,
        checked: false, checkinCount: 0, checkedBy: [],
        iconPath: '/static/marker_default.png', width: 36, height: 36,
        createdBy: 'system', createdAt: now, updatedAt: now
      })
      markerWrites++
    }
  }
  for (const h of DEFAULT_SEED_HERITAGE) {
    const exist = await col.where({ markerId: h.markerId }).limit(1).get()
    if (!exist.data || exist.data.length === 0) {
      await col.add(buildHeritageDoc(h, now))
      heritageWrites++
    }
  }
  return { errCode: 0, errMsg: '种子同步完成', data: { markerWrites, heritageWrites } }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `node --test uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`
Expected: PASS（11 tests）

- [ ] **Step 6: 部署后触发种子**

部署 `heritage-center` 后，在后台非遗列表页点"同步种子数据"按钮（Task 10 已预留），或用 uniCloud 控制台直接调 `seedDefaults`。触发一次。

- [ ] **Step 7: 提交**

```bash
git add uniCloud-aliyun/cloudfunctions/heritage-center/
git commit -m "feat(cloud): 澳门/湖南非遗种子数据 + seedDefaults (P10.5)"
```

---

# Phase P10.6 — 文档维护

## Task 13: 更新项目文档

**Files:**
- Modify: `uniapp_x_map_checkin_prompt.md`（追加 P10 实施结果章节）
- Modify: `changelog.md`（追加 P10 条目）

- [ ] **Step 1: 写 P10 章节**

仿 P9 章节格式，记录：落地 commits、验收点、新集合/云对象、种子数据清单、marker-panel 入口位置。

- [ ] **Step 2: 提交**

```bash
git add uniapp_x_map_checkin_prompt.md changelog.md
git commit -m "docs: P10 非遗内容深化实施结果 (P10.6)"
```

---

# 真机 / 联调验收清单

编译通过后逐条勾：

1. [ ] 后台触发 `seedDefaults` 后，`tourism_heritage` 有 10 条、`tourism_markers` 新增 10 个澳门/湖南点。
2. [ ] App 地图能看到澳门/湖南的种子点；点开任一 → marker-panel 有"了解非遗详情"按钮。
3. [ ] 点"了解非遗详情" → 进 F1 详情页，显示类别徽章、简介、图片画廊、故事、传承人卡片、相关条目。
4. [ ] 无非遗内容的旧打卡点点"了解非遗详情" → F1 显示"暂无非遗内容"空状态，不崩。
5. [ ] 首页"非遗名录"入口 → F2 名录页列出全部 published 条目；切类别 tab 列表刷新；滚到底分页加载。
6. [ ] F2 点列表项 → 进对应 F1 详情页。
7. [ ] F1 相关条目点击 → 跳到另一条非遗详情。
8. [ ] 后台非遗列表页能看到 10 条；新增一条非遗内容（选 marker、填字段、传图、发布）后 App F2 出现。
9. [ ] 后台编辑已有非遗内容并保存，App F1 刷新后内容更新。
10. [ ] 后台非遗页遇登录/权限错误显示"去登录"恢复入口。
11. [ ] 退出登录返回 index 仍走 `navigateBack`，地图不黑屏（§53 回归）。
12. [ ] `node --test "uniCloud-aliyun/cloudfunctions/**/*.test.js"` 全绿（P10.1 后基线 169；P10.5 补种子测试后 172）。

---

## 部署顺序提醒（uniCloud）

1. 上传 `tourism_heritage.schema.json`（Task 1）。
2. 上传部署 `heritage-center` 云对象，勾选"上传公共模块"（带 `common/auth-util`）。
3. 重新上传部署 `photo-center`（folder 参数）。
4. App 端编译运行；后台 uni-admin 编译运行。
5. 后台触发 `seedDefaults`。

> `.hbuilderx/launch.json` 不要 commit。编译报错贴日志手改，不点 HBuilderX 内置 [AI修复]。
