# UTS 开发避坑指南 — uni-app x 地图打卡项目

> **Phase 1 实战验证（17+ 轮编译修复 + 5 个运行时错误）。所有条目均触发过真实错误并已修复。**

---

## ⚡ Phase 1.5 新增（2026-05-07，最新）

### A. UTS 类型系统三连击（修一个暴露下一个）

任何遇到 `error18 / UTS110111101 / error17` 的代码都属于这一族问题。它们是**同一个根因**——UTS 编译到 Kotlin,而 Kotlin 是**名义类型系统(nominal typing)**,不是 TypeScript 的结构类型。理解一次,永远不再踩。

| 错误码 | 触发场景 | 真因 | 解法 |
|--------|---------|------|------|
| **error18** `找不到名称 "xxx"` | `(e: any).detail` / `(res: any).latitude` | `any` 编译为 Kotlin `Any`,无成员访问 | 用具名类型(`UniMapMarkerTapEvent` / `GetLocationSuccess` / `LocationObject`) |
| **UTS110111101** `Object Literal Type 不支持` | `(res: { lat: number, lng: number })` | Kotlin 不能为匿名类型生成 data class | 改用顶部 `type X = {...}` 别名,或直接用 SDK 类型 |
| **error17** `Function1<X, Unit> ≠ Function1<Y, Unit>` | 自定义 `type CenterLoc = { latitude, longitude }` 传给要求 `LocationObject` 的回调 | Kotlin 名义类型:即使字段相同,不同类不互通 | **必须用 SDK 提供的具名类型**,自定义别名无效 |

**黄金法则**:**一旦原生 API 要求某类型,绝不试图"自己造一个等价的"**。SDK 给你 `LocationObject`,就只能用 `LocationObject`。

### B. 原生事件类型对照表(map 组件)

`@longpress` 在 map 上**没有坐标 detail** —— 它是通用组件 longpress,不是 map 特有事件。下表来源:`@dcloudio/uni-app-x/types/uni/uni-map-tencent-map.d.ts`

| 模板事件 | 官方类型 | detail 字段 |
|---------|---------|------------|
| `@markertap` | `UniMapMarkerTapEvent` | `{ markerId: number \| null }` |
| `@tap` | `UniMapTapEvent` | `{ latitude, longitude }` (都可能为 null) |
| `@regionchange` | `UniMapRegionChangeEvent` | `{ skew, rotate }` ⚠️ **无 centerLocation** |
| `@callouttap` | `UniMapCalloutTapEvent` | `{ markerId }` |
| `@anchorpointtap` | `UniMapAnchorPointTapEvent` | `{ latitude, longitude }` |
| `@poitap` | `UniMapPoiTapEvent` | `{ latitude, longitude, name }` |
| `@longpress` | (通用 longpress) | ⚠️ **无 detail** |

**需要 map 当前可视中心时,用 `MapContext.getCenterLocation`(异步):**

```ts
const ctx = uni.createMapContext('mainMap')
if (ctx == null) return
ctx.getCenterLocation({
  success: (res: LocationObject): void => {
    // res.latitude, res.longitude
  }
})
```

### C. 模板字符串不允许混合 union 类型

`uni.navigateTo({ url: \`...?x=${maybeNumber ?? ''}\` })` 编译时会报"**uni.navigateTo 拼写错误**"——这是误导性消息,真因是 `${number | string}` 在 UTS 中违法。

```ts
// 错:UTS 拒绝 ${number | string}
const lat = currentLocation.value?.latitude ?? ''  // type: number | ''
url: `?lat=${lat}`  // ← 编译失败,误报"uni.navigateTo 拼写错误"

// 对:每个插值预先转 string
const lat = currentLocation.value != null ? currentLocation.value.latitude.toString() : ''
url: `?lat=${lat}`
```

### D. Storage 反序列化:`as T[]` 是假转换(2026-05-07 真机崩溃来源)

```ts
// 错(编译通过,运行期 ClassCastException):
const arr = JSON.parse(raw) as Marker[]  // arr 实际是 UTSJSONObject[]
markers.value = arr
markers.value[0].title  // ← ClassCastException: UTSJSONObject cannot be cast to Marker

// 对(uni-app x 泛型解析,真正构造 typed 实例):
const arr = JSON.parse<Marker[]>(raw)
return arr ?? []
```

**所有边界返回的 JSON 都适用**:`getStorageSync` / `JSON.parse` / cloud function 响应 / `request` 返回。Kotlin 的 `as` 不做转换,只做断言。`as` 失败 = 运行期炸。

### E. fail 回调可以保留 `any`(唯一安全场景)

```ts
fail: (err: any): void => { reject(err) }  // ✅ 不访问成员,只透传
```

`any` 在 UTS 唯一安全的用法是**不访问成员、只做透传**(`reject(err)` / `JSON.stringify(err)` / `console.error(err)`)。一旦写 `err.errCode`,立即 error18。

---

## 零、黄金法则（先读！）

| # | 法则 | 理由 |
|---|------|------|
| **1** | **永远用 `UTSJSONObject` + `["prop"]` 访问 JSON 数据** | `Record` = Kotlin `Map`；`any` 无 `.prop` 访问 |
| **2** | **但原生 SDK 回调永远用 `.prop`，绝不 cast 到 UTSJSONObject** | `GetLocationSuccess`/`UniMapEvent` 等原生对象 cast 到 UTSJSONObject 会运行时 `ClassCastException` |
| **3** | **永远直接 `export const/function`** | Pinia/defineStore/compat 层全部在 UTS 中崩溃 |
| **4** | **模板中只用本地变量/函数** | 导入的 ref/fn 模板中不可用 |
| **5** | **用 Write 工具写文件** | PS `Set-Content` 截断 UTF-8 |

---

## 一、CSS 层

同之前版本（略）

## 二、UTS 语言层（核心 19 条）

同之前版本（略）

## 三、模板层（7 条）

同之前版本（略）

## 四、运行时层（新增 — 编译通过但运行崩溃）

| # | 规则 | 错误示例 | 正确写法 |
|---|------|---------|---------|
| **1** | **原生 API 回调参数是类型化对象，不是 UTSJSONObject** | `uni.onLocationChange((res: any) => applyLocation(res as UTSJSONObject))` | `uni.onLocationChange((res: any) => applyLocation(res))` 直接用 `res.latitude` |
| **2** | **`<map :markers="">` 需要原始 Marker 数组，不要 JSON 转换** | `JSON.parse(JSON.stringify(marker))` 产生 UTSJSONObject | 直接传 `markers.value`（Ref<Marker[]>） |
| **3** | **`uni.showModal` 的 `res.confirm` 需 bracket 访问** | `res.confirm`（`res` 是 `any`） | `(res as UTSJSONObject)["confirm"]` |

### 如何区分 "用 UTSJSONObject" vs "用 .prop"？

| 数据类型 | 访问方式 | 示例 |
|---------|---------|------|
| `uni.getStorageSync` 返回值 | `UTSJSONObject` + `["prop"]` | `(data as UTSJSONObject)["key"]` |
| `getCurrentPages()[].$page.options` | `UTSJSONObject` + `["prop"]` | `pg["options"]` |
| `uni.getLocation` success 回调参数 | `.prop` | `res.latitude` |
| `uni.onLocationChange` 回调参数 | `.prop` | `res.accuracy` |
| `map @regionchange` 事件对象 | `.prop` | `e.detail.centerLocation` |
| `map @markertap` 事件对象 | `.prop` | `e.detail.markerId` |
| `uni.chooseImage` success 回调 | `.prop` | `res.tempFilePaths[0]` |
| `uni.showActionSheet` success 回调 | `.prop` | `res.tapIndex` |
| `uni.showModal` success 回调 | `UTSJSONObject` + `["prop"]` | `(res as UTSJSONObject)["confirm"]` |

---

## 五、架构层

| # | 规则 |
|---|------|
| 1 | 不用任何 Store 包装器 — 直接 `export const/function` |
| 2 | 页面直接 import store exports |
| 3 | `cover-view` 必须在 `<map>` 内 |
| 4 | `defineProps`/`defineEmits` 用 option 语法 |
| 5 | Write 工具写文件 |

---

## 六、常见错误速查

| 错误 | 类型 | 解决 |
|------|------|------|
| `ClassCastException: Xxx cannot be cast to UTSJSONObject` | **运行时** | 原生回调参数用 `.prop` 访问，不要 cast 到 UTSJSONObject |
| `UTSJSONObject cannot be cast to Marker` | **运行时** | 不要 JSON.parse/stringify 转换 Marker；直接传原始数组 |
| `找不到名称 "xxx"` (模板) | 编译 | 创建本地 wrapper/alias |
| `Function invocation ... expected` | 编译 | lambda 包装 或 本地 wrapper |
| `找不到名称 "confirm"` | 编译 | `(res as UTSJSONObject)["confirm"]` |
| `找不到名称 "invoke"` | 编译 | 模板中不能调用导入函数，用本地 wrapper |
| `Condition type mismatch` | 编译 | `if (x != null)` |
| `Null cannot be a value` | 编译 | `UTSJSONObject\|null` 或 boolean flag |
| `Only safe (?.) or non-null (!!.)` | 编译 | `!!.` 或 `?.` |
