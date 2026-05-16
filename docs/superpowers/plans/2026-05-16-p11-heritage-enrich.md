# P11 非遗内容富化与发现增强 Implementation Plan（2026-05-16）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务实现。Steps 用 checkbox（`- [ ]`）跟踪。
>
> 设计文档：`docs/superpowers/specs/2026-05-16-p11-heritage-enrich-design.md`。严格遵守 `UTS_COMPILE_PITFALLS.md §规则 41-§规则 56`。

**Goal:** 给非遗条目加视频内容（F1）、给名录页与后台加名称/传承人搜索（F2），并补上 P10 遗留的 `title` 字段缺口。

**Architecture:** 不新增集合/云对象。`tourism_heritage` schema 加 3 个可选字段（`title`/`videoUrl`/`videoCover`）；`heritage-center` 的 `list`/`adminList` 加 `keyword` 过滤、`seedDefaults` 给老文档补 `title`；App 端详情页加 `<video>`、名录页加搜索框；后台 `edit.vue` 加 title 输入与视频直传、`list.vue` 加搜索框。

**Tech Stack:** uni-app x / UTS 5.07、uniCloud 云对象（`index.obj.js`）、`node:test`、uni-admin（Vue3 `<script setup>` 后台）。

**P11 起点 commit:** `34693df`。分支 `dev`。

---

## Pitfalls 合规速查（改每个 .uvue/.uts 前 grep 自检）

- §41 CSS `top/bottom/left/right` 无 `calc()/env()`
- §44 `async function` 显式 `Promise<T>`
- §45 `<script setup>` 被引用函数声明在引用方之前
- §46 云对象内联 `const api = uniCloud.importObject(...)`
- §47 `JSON.parse<T>()` 后判 null
- §48 模板 `v-if` 复合条件字段加 `!!`
- §49 emoji 不承载核心信息
- §52 跨云 `JSON.parse<T>` 前注入服务端不返的 non-optional 字段
- §53 返回 index 用 `navigateBack`
- §56 `utils/*Cloud.uts` 云调用必须 try/catch
- 客户端 `.uvue/.uts` 禁用 `Number()`、`switchTab`、`showModal`；服务端 `.js`、uni-admin `.vue` 可用

---

## File Structure

**修改 — 云端：**
- `uniCloud-aliyun/database/tourism_heritage.schema.json` — 加 `title`/`videoUrl`/`videoCover`
- `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.js` — 字段 + `buildHeritageQuery`
- `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js` — 补测试
- `uniCloud-aliyun/cloudfunctions/heritage-center/index.obj.js` — `list`/`adminList` keyword + `seedDefaults` 补 title

**修改 — App 端：**
- `types/heritage.uts` — 加字段
- `utils/heritageCloud.uts` — 字段默认值 + `fetchHeritageList` 加 keyword
- `pages/heritage-detail/heritage-detail.uvue` — 标题 + `<video>`
- `pages/heritage-list/heritage-list.uvue` — 搜索框 + 标题显示

**修改 — 后台：**
- `uni-admin/pages/heritage/edit.vue` — title 输入 + 视频直传 + 封面上传
- `uni-admin/pages/heritage/list.vue` — 搜索框

**修改 — 文档：**
- `uniapp_x_map_checkin_prompt.md`、`changelog.md`

---

# Phase P11.1 — 云端数据层

## Task 1: schema 加 3 个字段

**Files:** Modify `uniCloud-aliyun/database/tourism_heritage.schema.json`

- [ ] **Step 1:** 在 `properties` 内 `category` 之后加 `title`，`relatedMarkerIds` 之后加 `videoUrl`/`videoCover`：

```json
"title": { "bsonType": "string", "maxLength": 80, "description": "非遗项目名称（F2搜索主字段）" },
```
```json
"videoUrl": { "bsonType": "string", "description": "非遗视频云存储URL（客户端直传）" },
"videoCover": { "bsonType": "string", "description": "视频封面图云存储URL" },
```

三字段均可选，`required` 不变。

- [ ] **Step 2:** 提交
```bash
git add uniCloud-aliyun/database/tourism_heritage.schema.json
git commit -m "feat(cloud): tourism_heritage 加 title/videoUrl/videoCover 字段 (P11.1)"
```

---

## Task 2: heritage-service 加字段 + buildHeritageQuery（TDD）

**Files:**
- Modify `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.js`
- Test `uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`

- [ ] **Step 1: 补失败测试** —— 在 `heritage-service.test.js` 末尾追加：

```js
test('buildHeritageDoc 写入 title/videoUrl/videoCover', () => {
  const doc = buildHeritageDoc({ markerId: 5, category: '民俗', title: '醉龙', videoUrl: 'v.mp4', videoCover: 'c.jpg' }, 1700000000000)
  assert.strictEqual(doc.title, '醉龙')
  assert.strictEqual(doc.videoUrl, 'v.mp4')
  assert.strictEqual(doc.videoCover, 'c.jpg')
})

test('buildHeritageDoc 缺字段时三字段为空串', () => {
  const doc = buildHeritageDoc({ markerId: 5, category: '民俗' }, 1700000000000)
  assert.strictEqual(doc.title, '')
  assert.strictEqual(doc.videoUrl, '')
  assert.strictEqual(doc.videoCover, '')
})

test('normalizeHeritageDetail 补齐 title/videoUrl/videoCover', () => {
  const n = normalizeHeritageDetail({ markerId: 1, category: '曲艺' })
  assert.strictEqual(n.title, '')
  assert.strictEqual(n.videoUrl, '')
  assert.strictEqual(n.videoCover, '')
})

test('buildHeritageUpdate 保留 title/videoUrl/videoCover、仍拒 _id/markerId', () => {
  const u = buildHeritageUpdate({ title: 'T', videoUrl: 'v', videoCover: 'c', _id: 'x', markerId: 9 }, 1700000000000)
  assert.strictEqual(u.title, 'T')
  assert.strictEqual(u.videoUrl, 'v')
  assert.strictEqual(u.videoCover, 'c')
  assert.strictEqual(u._id, undefined)
  assert.strictEqual(u.markerId, undefined)
})

test('每条种子非遗都有非空 title', () => {
  for (const h of DEFAULT_SEED_HERITAGE) {
    assert.ok(h.title && h.title.length > 0, `种子缺 title: markerId ${h.markerId}`)
  }
})

test('buildHeritageQuery 空输入返回空对象', () => {
  const { buildHeritageQuery } = require('./heritage-service')
  assert.deepStrictEqual(buildHeritageQuery(null), {})
  assert.deepStrictEqual(buildHeritageQuery({}), {})
})

test('buildHeritageQuery 保留合法 category、丢弃非法 category', () => {
  const { buildHeritageQuery } = require('./heritage-service')
  assert.strictEqual(buildHeritageQuery({ category: '民俗' }).category, '民俗')
  assert.strictEqual(buildHeritageQuery({ category: '不存在' }).category, undefined)
})

test('buildHeritageQuery keyword trim 后为空则丢弃', () => {
  const { buildHeritageQuery } = require('./heritage-service')
  assert.strictEqual(buildHeritageQuery({ keyword: '   ' }).keyword, undefined)
})

test('buildHeritageQuery 转义正则元字符', () => {
  const { buildHeritageQuery } = require('./heritage-service')
  assert.strictEqual(buildHeritageQuery({ keyword: 'a.b*c' }).keyword, 'a\\.b\\*c')
})
```

- [ ] **Step 2: 运行确认失败**
Run: `node --test uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`
Expected: FAIL（`buildHeritageQuery` 未导出 / title 字段缺失）

- [ ] **Step 3: 改 heritage-service.js**

`HERITAGE_UPDATE_WHITELIST` 改为（加 `title`/`videoUrl`/`videoCover`）：
```js
const HERITAGE_UPDATE_WHITELIST = [
  'title', 'category', 'summary', 'story', 'images',
  'inheritorName', 'inheritorBio', 'inheritorPhoto',
  'relatedMarkerIds', 'status', 'videoUrl', 'videoCover'
]
```

`toStr` 之后加正则转义助手：
```js
const REGEX_META = /[.*+?^${}()|[\]\\]/g
function escapeRegExp(s) {
  return (typeof s === 'string' ? s : '').replace(REGEX_META, '\\$&')
}
```

`buildHeritageDoc` 的 return 对象内 `category` 之后加 `title`，`status` 之后加 `videoUrl`/`videoCover`：
```js
    category: data.category,
    title: toStr(data.title),
```
```js
    status: data.status === 'published' ? 'published' : 'draft',
    videoUrl: toStr(data.videoUrl),
    videoCover: toStr(data.videoCover),
```

`normalizeHeritageDetail` 的 return 对象同样加（`category` 后加 `title`，`status` 后加 `videoUrl`/`videoCover`）：
```js
    category: toStr(doc && doc.category),
    title: toStr(doc && doc.title),
```
```js
    status: (doc && doc.status === 'published') ? 'published' : 'draft',
    videoUrl: toStr(doc && doc.videoUrl),
    videoCover: toStr(doc && doc.videoCover)
```
（注意 `relatedMarkerIds` 行末逗号补上，再接 `status`。）

`buildHeritageUpdate` 不改——`title`/`videoUrl`/`videoCover` 是字符串字段，走默认 `out[key] = data[key]` 分支。

新增纯函数 `buildHeritageQuery`（放在 `normalizeHeritageDetail` 之后）：
```js
// F2 搜索：把 { category, keyword } 规范化为查询描述对象。
// category 非法则丢弃；keyword trim 后为空则丢弃，否则转义正则元字符。
function buildHeritageQuery(input) {
  const f = input || {}
  const out = {}
  if (typeof f.category === 'string' && CATEGORY_ENUM.includes(f.category)) {
    out.category = f.category
  }
  const kw = (typeof f.keyword === 'string' ? f.keyword : '').trim()
  if (kw.length > 0) {
    out.keyword = escapeRegExp(kw)
  }
  return out
}
```

`module.exports` 加 `buildHeritageQuery`：
```js
module.exports = {
  CATEGORY_ENUM,
  HERITAGE_UPDATE_WHITELIST,
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  buildHeritageQuery,
  DEFAULT_SEED_MARKERS,
  DEFAULT_SEED_HERITAGE
}
```

> 种子数据：`DEFAULT_SEED_HERITAGE` 每条已带 `title`，`buildHeritageDoc` 现在会写入它，无需改种子。

- [ ] **Step 4: 运行确认通过**
Run: `node --test uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js`
Expected: PASS（11 + 9 = 20 tests）

- [ ] **Step 5: 提交**
```bash
git add uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.js uniCloud-aliyun/cloudfunctions/heritage-center/heritage-service.test.js
git commit -m "feat(cloud): heritage-service 加 title/视频字段 + buildHeritageQuery (P11.1)"
```

---

## Task 3: heritage-center 云对象 list/adminList keyword + seedDefaults 补 title

**Files:** Modify `uniCloud-aliyun/cloudfunctions/heritage-center/index.obj.js`

- [ ] **Step 1:** 顶部 require 加 `buildHeritageQuery`：
```js
const {
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  buildHeritageQuery,
  CATEGORY_ENUM,
  DEFAULT_SEED_MARKERS,
  DEFAULT_SEED_HERITAGE
} = require('./heritage-service')
```

- [ ] **Step 2:** `list` 方法替换为（加 keyword OR 匹配 title/inheritorName）：
```js
  async list(data) {
    const q = buildHeritageQuery(data)
    const offset = Number((data && data.offset) || 0)
    const limit = Math.min(Number((data && data.limit) || 20), 50)
    const conds = [{ status: 'published' }]
    if (q.category) { conds.push({ category: q.category }) }
    if (q.keyword) {
      const re = new db.RegExp({ regexp: q.keyword, options: 'i' })
      conds.push(db.command.or([{ title: re }, { inheritorName: re }]))
    }
    const where = conds.length === 1 ? conds[0] : db.command.and(conds)
    const res = await col.where(where).skip(offset).limit(limit).get()
    const items = (res.data || []).map((d) => normalizeHeritageDetail(d))
    return { errCode: 0, errMsg: '', data: { items, offset, limit } }
  },
```

- [ ] **Step 3:** `adminList` 方法替换为（加 keyword）：
```js
  async adminList(data) {
    await requireAdmin(this)
    const q = buildHeritageQuery(data)
    const offset = Number((data && data.offset) || 0)
    const limit = Math.min(Number((data && data.limit) || 50), 100)
    let query = col
    if (q.keyword) {
      const re = new db.RegExp({ regexp: q.keyword, options: 'i' })
      query = col.where(db.command.or([{ title: re }, { inheritorName: re }]))
    }
    const res = await query.skip(offset).limit(limit).get()
    return { errCode: 0, errMsg: '', data: (res.data || []).map((d) => normalizeHeritageDetail(d)) }
  },
```

- [ ] **Step 4:** `seedDefaults` 的非遗 `for` 循环 + `return` 替换为（已存在文档若缺 title 则补写）：
```js
    let titleBackfills = 0
    for (const h of DEFAULT_SEED_HERITAGE) {
      const exist = await col.where({ markerId: h.markerId }).limit(1).get()
      if (!exist.data || exist.data.length === 0) {
        await col.add(buildHeritageDoc(h, now))
        heritageWrites++
      } else {
        const doc = exist.data[0]
        if (!doc.title || doc.title.length === 0) {
          await col.doc(doc._id).update({ title: h.title, updatedAt: now })
          titleBackfills++
        }
      }
    }
    return { errCode: 0, errMsg: '种子同步完成', data: { markerWrites, heritageWrites, titleBackfills } }
```

- [ ] **Step 5: 提交**
```bash
git add uniCloud-aliyun/cloudfunctions/heritage-center/index.obj.js
git commit -m "feat(cloud): heritage-center list/adminList 加 keyword + seedDefaults 补 title (P11.1)"
```

- [ ] **Step 6: 全量云端测试**
Run: `node --test "uniCloud-aliyun/cloudfunctions/**/*.test.js"`
Expected: PASS（P10 基线 172 → 181）

---

# Phase P11.2 — App 端

## Task 4: types/heritage.uts 加字段

**Files:** Modify `types/heritage.uts`

- [ ] **Step 1:** 整个文件替换为：
```ts
export type HeritageDetail = {
  _id: string
  markerId: number
  title: string
  category: string
  summary: string
  story: string
  images: string[]
  inheritorName: string
  inheritorBio: string
  inheritorPhoto: string
  relatedMarkerIds: number[]
  status: string
  videoUrl: string
  videoCover: string
}

export type HeritageListItem = {
  _id: string
  markerId: number
  title: string
  category: string
  summary: string
  images: string[]
}
```

- [ ] **Step 2: 提交**
```bash
git add types/heritage.uts
git commit -m "feat(app): heritage 类型加 title/视频字段 (P11.2)"
```

---

## Task 5: utils/heritageCloud.uts 字段默认值 + keyword

**Files:** Modify `utils/heritageCloud.uts`

- [ ] **Step 1:** `injectHeritageDefaults` 加三字段：
```ts
function injectHeritageDefaults(raw: UTSJSONObject): void {
  if (raw['title'] == null) { raw['title'] = '' }
  if (raw['summary'] == null) { raw['summary'] = '' }
  if (raw['story'] == null) { raw['story'] = '' }
  if (raw['images'] == null) { raw['images'] = [] as string[] }
  if (raw['inheritorName'] == null) { raw['inheritorName'] = '' }
  if (raw['inheritorBio'] == null) { raw['inheritorBio'] = '' }
  if (raw['inheritorPhoto'] == null) { raw['inheritorPhoto'] = '' }
  if (raw['relatedMarkerIds'] == null) { raw['relatedMarkerIds'] = [] as number[] }
  if (raw['_id'] == null) { raw['_id'] = '' }
  if (raw['status'] == null) { raw['status'] = 'published' }
  if (raw['videoUrl'] == null) { raw['videoUrl'] = '' }
  if (raw['videoCover'] == null) { raw['videoCover'] = '' }
}
```

- [ ] **Step 2:** `fetchHeritageList` 签名加 `keyword`，并在列表项注入 `title`：
```ts
export async function fetchHeritageList(category: string, keyword: string, offset: number, limit: number): Promise<HeritageListItem[]> {
  try {
    const heritageApi = uniCloud.importObject('heritage-center', { customUI: true } as UniCloudImportObjectOptions)
    const res = await heritageApi.list({ category: category, keyword: keyword, offset: offset, limit: limit } as UTSJSONObject) as UTSJSONObject
    const dataField = res['data']
    if (dataField == null) return [] as HeritageListItem[]
    const dataObj = dataField as UTSJSONObject
    const itemsField = dataObj['items']
    if (itemsField == null) return [] as HeritageListItem[]
    const arr = itemsField as UTSJSONObject[]
    const out: HeritageListItem[] = []
    for (let i = 0; i < arr.length; i++) {
      const rawObj = arr[i]
      if (rawObj['title'] == null) { rawObj['title'] = '' }
      if (rawObj['summary'] == null) { rawObj['summary'] = '' }
      if (rawObj['images'] == null) { rawObj['images'] = [] as string[] }
      if (rawObj['_id'] == null) { rawObj['_id'] = '' }
      const parsed = JSON.parse<HeritageListItem>(JSON.stringify(rawObj))
      if (parsed != null) { out.push(parsed) }
    }
    return out
  } catch (e) {
    console.error('[heritageCloud] fetchHeritageList failed', e)
    return [] as HeritageListItem[]
  }
}
```
（`fetchHeritageDetail` 不改——`injectHeritageDefaults` 已覆盖新字段。）

- [ ] **Step 3: 提交**
```bash
git add utils/heritageCloud.uts
git commit -m "feat(app): heritageCloud 补字段默认值 + fetchHeritageList 加 keyword (P11.2)"
```

---

## Task 6: heritage-detail.uvue 标题 + 视频

**Files:** Modify `pages/heritage-detail/heritage-detail.uvue`

- [ ] **Step 1:** `hero` 块内 `cat-badge` 之前加标题（仅 `title` 非空时显示）：
```html
      <view class="hero">
        <text v-if="detail!!.title.length > 0" class="hero-title">{{ detail!!.title }}</text>
        <view class="cat-badge">
          <text class="cat-badge-text">{{ detail!!.category }}</text>
        </view>
        <text class="hero-summary">{{ detail!!.summary }}</text>
      </view>
```

- [ ] **Step 2:** 图片画廊块之后、`非遗故事` section 之前加视频块：
```html
      <!-- 视频（仅有 videoUrl 时渲染） -->
      <view v-if="detail!!.videoUrl.length > 0" class="section">
        <text class="section-title">非遗视频</text>
        <video
          class="heritage-video"
          :src="detail!!.videoUrl"
          :poster="detail!!.videoCover"
          :controls="true"
          :show-center-play-btn="true"
          object-fit="contain"
        ></video>
      </view>
```

- [ ] **Step 3:** `<style>` 内 `.cat-badge` 之前加标题样式，`.gallery-img` 之后加视频样式：
```css
.hero-title { font-size: 36rpx; font-weight: 700; color: #1a1a1a; margin-bottom: 14rpx; }
```
```css
.heritage-video { width: 654rpx; height: 380rpx; border-radius: 16rpx; background-color: #000000; }
```

- [ ] **Step 4: HBuilderX 编译验证** —— 运行到 Android 真机，确认 `<video>` 组件编译通过、无 UTS 报错。报错贴日志手改。

- [ ] **Step 5: 提交**
```bash
git add pages/heritage-detail/heritage-detail.uvue
git commit -m "feat(app): 非遗详情页加标题与视频播放 (P11.2)"
```

---

## Task 7: heritage-list.uvue 搜索框 + 标题显示

**Files:** Modify `pages/heritage-list/heritage-list.uvue`

- [ ] **Step 1:** 模板 `tab-bar` 之前加搜索框：
```html
    <!-- 搜索框 -->
    <view class="search-bar">
      <input
        class="search-input"
        v-model="keyword"
        type="text"
        placeholder="搜索非遗名称或传承人"
        confirm-type="search"
        @confirm="onSearchConfirm"
      />
      <view v-if="keyword.length > 0" class="search-clear" @click="clearSearch">
        <text class="search-clear-text">清除</text>
      </view>
    </view>
```

- [ ] **Step 2:** 列表项 `card-body` 内 `cat-badge` 之前加标题：
```html
        <view class="card-body">
          <text v-if="item.title.length > 0" class="card-title">{{ item.title }}</text>
          <view class="cat-badge">
            <text class="cat-badge-text">{{ item.category }}</text>
          </view>
          <text class="card-summary">{{ item.summary }}</text>
        </view>
```

- [ ] **Step 3:** `<script setup>` —— `activeCategory` 之后加 `keyword` ref；`loadList` 内 fetch 调用加 `keyword.value`；`selectCategory` 之后加 `onSearchConfirm`/`clearSearch`（§45：两函数引用 `loadList`，`loadList` 已先声明，OK）：
```ts
const activeCategory = ref<string>('')
const keyword = ref<string>('')
const items = ref<HeritageListItem[]>([])
```
`loadList` 内的 fetch 调用改为：
```ts
  const result = await fetchHeritageList(activeCategory.value, keyword.value, pageOffset, 20)
```
`selectCategory` 之后加：
```ts
function onSearchConfirm(): void {
  loadList(true)
}

function clearSearch(): void {
  keyword.value = ''
  loadList(true)
}
```

- [ ] **Step 4:** `<style>` 内 `.page` 之后加搜索框样式，`.card-body` 之后加标题样式：
```css
.search-bar { width: 750rpx; flex-shrink: 0; background-color: #ffffff; padding: 16rpx 24rpx; display: flex; flex-direction: row; align-items: center; }
.search-input { flex: 1; height: 64rpx; background-color: #f0f2f5; border-radius: 999rpx; padding: 0 28rpx; font-size: 26rpx; color: #1a1a1a; }
.search-clear { padding: 0 16rpx 0 20rpx; }
.search-clear-text { font-size: 24rpx; color: #1a73e8; }
```
```css
.card-title { font-size: 28rpx; font-weight: 600; color: #1a1a1a; margin-bottom: 8rpx; }
```

- [ ] **Step 5: HBuilderX 编译验证** —— 运行到真机，无 UTS 报错。

- [ ] **Step 6: 提交**
```bash
git add pages/heritage-list/heritage-list.uvue
git commit -m "feat(app): 非遗名录页加搜索框与标题显示 (P11.2)"
```

---

# Phase P11.3 — 后台 uni-admin

## Task 8: edit.vue 加 title 输入 + 视频上传

**Files:** Modify `uni-admin/pages/heritage/edit.vue`

- [ ] **Step 1:** 模板 `关联打卡点` form-item 之后、`类别` form-item 之前加标题输入：
```html
      <!-- 名称 -->
      <view class="form-item">
        <text class="form-label">名称 *</text>
        <input class="form-input" v-model="form.title" placeholder="请输入非遗项目名称（80字以内）" maxlength="80" />
      </view>
```

- [ ] **Step 2:** 模板 `项目图片` form-item 之后、`相关条目` form-item 之前加视频区：
```html
      <!-- 介绍视频 -->
      <view class="form-item">
        <text class="form-label">介绍视频</text>
        <view v-if="form.videoUrl" class="video-preview-row">
          <video class="video-preview" :src="form.videoUrl" controls></video>
          <text class="img-remove" @click="form.videoUrl = ''">移除视频</text>
        </view>
        <button
          v-if="!form.videoUrl"
          class="btn-upload"
          :disabled="uploadingVideo"
          @click="pickVideo"
        >{{ uploadingVideo ? '上传中...' : '选择视频（直传云存储）' }}</button>
      </view>

      <!-- 视频封面 -->
      <view class="form-item">
        <text class="form-label">视频封面</text>
        <view v-if="form.videoCover" class="img-preview-row">
          <image class="img-preview" :src="form.videoCover" mode="aspectFill" />
          <text class="img-remove" @click="form.videoCover = ''">移除</text>
        </view>
        <button
          v-if="!form.videoCover"
          class="btn-upload"
          :disabled="uploadingCover"
          @click="pickVideoCover"
        >{{ uploadingCover ? '上传中...' : '选择封面图' }}</button>
      </view>
```

- [ ] **Step 3:** `<script setup>` 状态区加上传标志，`form` 加三字段：
```js
const uploadingVideo = ref(false)
const uploadingCover = ref(false)
```
`form` 初始值：
```js
const form = ref({
  markerId: 0,
  title: '',
  category: '',
  summary: '',
  story: '',
  inheritorName: '',
  inheritorBio: '',
  inheritorPhoto: '',
  images: [],
  relatedMarkerIds: [],
  status: 'draft',
  videoUrl: '',
  videoCover: ''
})
```

- [ ] **Step 4:** `loadHeritage` 内 `form.value = {...}` 回填对象加三字段：
```js
      form.value = {
        markerId: detail.markerId || mid,
        title: detail.title || '',
        category: detail.category || '',
        summary: detail.summary || '',
        story: detail.story || '',
        inheritorName: detail.inheritorName || '',
        inheritorBio: detail.inheritorBio || '',
        inheritorPhoto: detail.inheritorPhoto || '',
        images: Array.isArray(detail.images) ? detail.images.slice() : [],
        relatedMarkerIds: Array.isArray(detail.relatedMarkerIds) ? detail.relatedMarkerIds.slice() : [],
        status: detail.status || 'draft',
        videoUrl: detail.videoUrl || '',
        videoCover: detail.videoCover || ''
      }
```

- [ ] **Step 5:** `pickProjectImage` 之后加视频/封面上传函数：
```js
async function pickVideo() {
  try {
    const chooseRes = await new Promise((resolve, reject) => {
      uni.chooseVideo({
        sourceType: ['album'],
        success: resolve,
        fail: err => reject(new Error(err.errMsg || '选视频失败'))
      })
    })
    uploadingVideo.value = true
    const filePath = chooseRes.tempFilePath
    const cloudPath = 'heritage-video/' + Date.now() + '_' + getFileName(filePath)
    const upRes = await uniCloud.uploadFile({ filePath, cloudPath })
    if (!upRes || !upRes.fileID) throw new Error('视频上传未返回地址')
    form.value.videoUrl = upRes.fileID
  } catch (e) {
    needsLogin.value = isAuthError(e)
    uni.showToast({ title: getErrorMessage(e, '上传视频失败'), icon: 'none' })
  } finally {
    uploadingVideo.value = false
  }
}

async function pickVideoCover() {
  try {
    const chooseRes = await new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: err => reject(new Error(err.errMsg || '选图失败'))
      })
    })
    const filePath = chooseRes.tempFilePaths[0]
    uploadingCover.value = true
    const base64 = await readFileAsBase64(filePath)
    const fileName = getFileName(filePath)
    const upRes = await photoApi.upload({ fileContent: base64, fileName, folder: 'heritage-media' })
    if (upRes.errCode !== 0) throw new Error(upRes.errMsg || '上传失败')
    form.value.videoCover = upRes.data.cloudURL
  } catch (e) {
    needsLogin.value = isAuthError(e)
    uni.showToast({ title: getErrorMessage(e, '上传封面失败'), icon: 'none' })
  } finally {
    uploadingCover.value = false
  }
}
```

- [ ] **Step 6:** `save()` —— 加 title 必填校验，`create`/`update` 两个 payload 加 `title`/`videoUrl`/`videoCover`：

`save()` 开头 `category` 校验之后加：
```js
  if (!form.value.title) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
```
`update` payload（`_id` 之后）与 `create` payload（`markerId` 之后）都加一行：
```js
        title: form.value.title,
```
两个 payload 的 `status: form.value.status` 改为加上视频字段：
```js
        status: form.value.status,
        videoUrl: form.value.videoUrl,
        videoCover: form.value.videoCover
```

- [ ] **Step 7:** `<style>` 末尾 `.btn-save[disabled]` 之后加视频预览样式：
```css
.video-preview-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.video-preview {
  width: 320rpx;
  height: 200rpx;
  border-radius: 8rpx;
  background: #000;
}
```

- [ ] **Step 8: 提交**
```bash
git add uni-admin/pages/heritage/edit.vue
git commit -m "feat(admin): 非遗编辑表单加名称输入与视频直传 (P11.3)"
```

---

## Task 9: list.vue 加搜索框

**Files:** Modify `uni-admin/pages/heritage/list.vue`

- [ ] **Step 1:** 模板 `toolbar` 之前加搜索栏：
```html
    <view class="search-row">
      <input
        class="search-input"
        v-model="keyword"
        type="text"
        placeholder="搜索名称或传承人"
        confirm-type="search"
        @confirm="doSearch"
      />
      <button class="btn-sm" @click="doSearch">搜索</button>
      <button v-if="keyword" class="btn-sm ghost" @click="clearSearch">清除</button>
    </view>
```

- [ ] **Step 2:** `<script setup>` —— `needsLogin` 之后加 `keyword` ref；`loadItems` 内 `adminList` 调用加 keyword；`reload` 之后加搜索函数：
```js
const keyword = ref('')
```
`loadItems` 内：
```js
    const res = await api.adminList({ offset, limit, keyword: keyword.value })
```
`reload` 函数之后加：
```js
function doSearch() {
  reload()
}

function clearSearch() {
  keyword.value = ''
  reload()
}
```

- [ ] **Step 3:** `<style>` 内 `.toolbar` 之前加搜索栏样式：
```css
.search-row {
  display: flex;
  gap: 10rpx;
  align-items: center;
  margin-bottom: 12rpx;
}

.search-input {
  flex: 1;
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  font-size: 24rpx;
  background: #fff;
}
```

- [ ] **Step 4: 提交**
```bash
git add uni-admin/pages/heritage/list.vue
git commit -m "feat(admin): 非遗列表页加名称/传承人搜索 (P11.3)"
```

---

# Phase P11.4 — 文档维护

## Task 10: 更新项目文档

**Files:** Modify `uniapp_x_map_checkin_prompt.md`、`changelog.md`

- [ ] **Step 1:** `uniapp_x_map_checkin_prompt.md` 末尾追加「2026-05-16 P11 非遗内容富化与发现增强」章节，仿 P10 格式，记录：落地 commits、新增字段（`title`/`videoUrl`/`videoCover`）、`buildHeritageQuery`、视频直传方案、F2 搜索覆盖范围、`seedDefaults` title 补写、Node 测试数（181）。

- [ ] **Step 2:** `changelog.md` 追加 P11 条目。

- [ ] **Step 3: 提交**
```bash
git add uniapp_x_map_checkin_prompt.md changelog.md
git commit -m "docs: P11 非遗内容富化与发现增强实施结果 (P11.4)"
```

---

# 真机 / 联调验收清单

部署后逐条勾（部署顺序：① 上传 `tourism_heritage` schema；② 上传部署 `heritage-center`；③ App / uni-admin 编译运行；④ 后台触发 `seedDefaults` 补 title）：

1. [ ] 后台触发 `seedDefaults` → 返回 `titleBackfills` 计数；线上原 10 条非遗文档拿到 `title`。
2. [ ] App 非遗名录页：列表项显示标题；搜索"湘绣"/传承人关键词 → 列表过滤；清除恢复全部。
3. [ ] App 详情页：显示标题；有视频的条目显示 `<video>` 可播放；无视频条目不渲染播放器。
4. [ ] 后台编辑页：名称输入必填校验生效；选视频直传成功、`videoUrl` 写入；封面图上传成功。
5. [ ] 后台列表页：搜索名称/传承人过滤生效。
6. [ ] 旧打卡点（无非遗）点"了解非遗详情"仍显示空状态、不崩。
7. [ ] 退出登录返回 index 仍走 `navigateBack`，地图不黑屏（§53 回归）。
8. [ ] `node --test "uniCloud-aliyun/cloudfunctions/**/*.test.js"` 全绿（181 例）。

> `.hbuilderx/launch.json` 不 commit。编译报错贴日志手改，不点 HBuilderX 内置 [AI修复]。
> 视频直传 / `<video>` 真机若踩坑，追加 `UTS_COMPILE_PITFALLS.md §规则 57+`。
