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

### E.5 cover-view 在 `<map>` 上的布局陷阱(Android 原生 overlay)

`<map>` 在 Android 是原生 MapView,`<cover-view>` 是唯一能在它上面渲染 UI 的元素——但 cover-view 是**独立的原生 overlay 层**,布局规则比普通 view 严格得多。

**踩过的坑(2026-05-07,4 个工具按钮全部不可见)**:
```html
<!-- 错:flex 容器无显式尺寸 → Android 原生层无法 measure → 整个容器塌成 0×0 -->
<cover-view class="map-tools">  <!-- position:absolute + flex:column 但无 width/height -->
  <cover-view class="tool-btn">
    <cover-view class="tool-label">＋</cover-view>  <!-- 第三层嵌套,measure 不稳 -->
  </cover-view>
  ...
</cover-view>
```

**修复(扁平化 + 独立绝对定位)**:
```html
<!-- 对:每个 cover-view 直接是 <map> 的子节点,各自带独立 top 值 -->
<cover-view class="tool-btn tool-pos-1" @click="...">＋</cover-view>
<cover-view class="tool-btn tool-pos-2" @click="...">－</cover-view>
```

**cover-view 在 map 上的硬规则**:
1. **嵌套不超过 2 层**(cover-view 包 cover-view 是上限,不要再深)
2. **文字直接写在 cover-view 里**,不要再套一个 cover-view 当 label
3. **flex 布局不可靠**——优先用 `position: absolute` + 各自独立 top/right
4. **必须有显式尺寸**(width/height 或 left+right+top+bottom 全集)
5. **box-shadow / border-radius** 大部分能渲染,但**不要假定 100% 兼容**
6. **如果一个 cover-view "莫名不见"**,先检查它的父链上有没有"无尺寸的 flex 容器"——这是 #1 元凶

**单字符 unicode > emoji**:`任 ＋ － ⊙` 在原生 cover-view 渲染最稳。emoji(📍🎯)有 hit-test 区域 bug 案例,小心使用。

---

### F. SDK 类型重名碰撞 — typed `Marker[]` 不能直接传给 `<map :markers>`

**真机 logcat(2026-05-07,导致空白页 + ANR 卡死)**:
```
java.lang.ClassCastException:
  uni.UNIC0495C1.Marker cannot be cast to uts.sdk.modules.DCloudUniMapTencent.Marker
  at uts.sdk.modules.DCloudUniMapTencent.TencentMap.setMarkers(index.kt:1064)
```

**根因**:我们 `types/marker.uts` 定义的 `Marker` 编译成 `uni.UNIC0495C1.Marker`,腾讯地图插件**自己也有一个 Marker 类**`uts.sdk.modules.DCloudUniMapTencent.Marker`。Kotlin 名义类型系统下,这两个**同名不同 namespace**的类不能互换——`<map :markers>` watcher 把我们的 Marker[] 传给插件 `setMarkers`,插件逐个 `as Marker` 失败 → 异常 → 反复重试 → ANR。

**为什么更早发现不了**:Phase 1.5 修 `loadMarkers` 之前,markers 装的是 UTSJSONObject(假 cast),插件碰巧能消化。Phase 1.5 让 markers 真正 typed 之后,反而被插件拒收。**修了一个 bug 暴露了下一层 bug**,这是 Phase 1.5 链式发现的延续。

**解法 — 边界上转成 UTSJSONObject[]**:
```ts
// stores/useMarkerStore.uts
export const displayMarkers = computed<UTSJSONObject[]>(() => {
  const result: UTSJSONObject[] = []
  markers.value.forEach(m => {
    const mm = {} as UTSJSONObject
    mm["id"] = m.id
    mm["latitude"] = m.latitude
    mm["longitude"] = m.longitude
    mm["title"] = m.title
    mm["iconPath"] = m.iconPath
    mm["width"] = m.width
    mm["height"] = m.height
    result.push(mm)
  })
  return result
})
```

模板:`<map :markers="displayMarkers" />`(不再用 `markers`)。
应用内部逻辑(findById、filter、m.checked)继续用 typed `markers`——业务态留在自己的 namespace 里。

**通用规则**:
1. **app 的 type 名不要和已知 SDK type 重合**(Marker/Task/User/Location 等通用名优先重命名为 `CheckinMarker` / `AppTask` / `AppUser` / `LocationData`)
2. **SDK prop 边界:UTSJSONObject 兜底也未必管用**——后续 logcat 显示腾讯插件的 setMarkers 即使收到 UTSJSONObject 也直接 `as Marker` 拒绝(`io.dcloud.uts.UTSJSONObject cannot be cast to ...Marker`)。**真正的解法是给 SDK 类型预留命名空间**,即应用层主动重命名,让 SDK type 名在 UTS 文件中唯一可见
3. **诊断顺序**:看到"莫名空白 + 卡死"时,先看 logcat 全栈,再看代码。Vue 渲染失败默认静默,只有 logcat 暴露真因
4. **Vue reactive 给响应式对象加包装名 `XxxReactiveObject`**——所以即使我们的 typed Marker 通过了第一层检查,Vue 包装后还是 "MarkerReactiveObject" 不是 "Marker",仍会被 SDK 名义检查拒。**重命名是唯一治本路径**

**重命名的实际改动量**(参考):
- `types/marker.uts` (类型 export)
- `stores/useMarkerStore.uts` + 4 个其他 stores
- `utils/storage.uts` + `utils/defaults.uts` + `utils/cloudSync.uts`
- 6 个 `.uvue` 页面的 import + 类型注解

机械式重命名,risk 低,~15 min。一次做完,以后写 `const m: Marker = ...` 自动指向 SDK 的 Marker。

---

### G. fail 回调可以保留 `any`(唯一安全场景)

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
