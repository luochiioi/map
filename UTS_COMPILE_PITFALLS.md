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

### F. SDK 类型重名碰撞 — `<map :markers>` 反向推导导致 error17 ✅ 已解决(方案 B：uni_modules 子组件下沉，2026-05-07 落地，2026-05-08 完整真机闭环)

**真机 logcat(2026-05-07,导致空白页 + ANR 卡死)**:
```
java.lang.ClassCastException:
  uni.UNIC0495C1.Marker cannot be cast to uts.sdk.modules.DCloudUniMapTencent.Marker
  at uts.sdk.modules.DCloudUniMapTencent.TencentMap.setMarkers(index.kt:1064)
```

**根因**:我们 `types/marker.uts` 定义的 `Marker` 编译成 `uni.UNIC0495C1.Marker`,腾讯地图插件**自己也有一个 Marker 类**`uts.sdk.modules.DCloudUniMapTencent.Marker`。Kotlin 名义类型系统下,这两个**同名不同 namespace**的类不能互换——`<map :markers>` watcher 把我们的 Marker[] 传给插件 `setMarkers`,插件逐个 `as Marker` 失败 → 异常 → 反复重试 → ANR。

**为什么更早发现不了**:Phase 1.5 修 `loadMarkers` 之前,markers 装的是 UTSJSONObject(假 cast),插件碰巧能消化。Phase 1.5 让 markers 真正 typed 之后,反而被插件拒收。**修了一个 bug 暴露了下一层 bug**,这是 Phase 1.5 链式发现的延续。

**❌ 失败的中间方案 — 边界上转成 UTSJSONObject[]**(已废弃):
```ts
export const displayMarkers = computed<UTSJSONObject[]>(() => { ... })  // ❌ 仍 ClassCastException
```
真机 logcat 反馈:`io.dcloud.uts.UTSJSONObject cannot be cast to ...Marker`。
**插件 setMarkers 内部对每一项都做 `as Marker` 强转,UTSJSONObject 也不放过。** 所以这条路彻底走不通。

**✅ 终极解法 — 直接构造 SDK 自己的 `Marker[]`**:
```ts
// stores/useMarkerStore.uts
// 重命名为 CheckinMarker 之后,本文件内 `Marker` 唯一指向 SDK 的
// uts.sdk.modules.DCloudUniMapTencent.Marker(uniapp x 自动注入,无需 import)
export const displayMarkers = computed<Marker[]>(() => {
  const result: Marker[] = []
  markers.value.forEach(m => {
    result.push({
      id: m.id, latitude: m.latitude, longitude: m.longitude,
      title: m.title, iconPath: m.iconPath, width: m.width, height: m.height
    } as Marker)  // ← 直接断言 SDK Marker,字面量构造
  })
  return result
})
```

参考:`uni_modules/uni-openLocation/pages/openLocation/openLocation.uvue` 同款写法
(`{ id, latitude, longitude, iconPath, width, height } as Marker`)。

模板:`<map :markers="displayMarkers" />`。每个 `<map>` 实例都得通过这条边界,
**不要直接绑 `markers.value` 或它的 `.slice()` ——那是 `CheckinMarker[]`**,
Vue 包装一层后类名变成 `CheckinMarkerReactiveObject`,仍被插件 cast 拒。
缩略地图等场景需要单独导出 SDK Marker 版本的 computed(本仓库的 `miniMapMarkers`)。

应用内部逻辑(findById、filter、m.checked)继续用 typed `markers: CheckinMarker[]`
——业务态留在自己的 namespace 里。

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

**修复执行记录(2026-05-07)**: 方案 A 已落地,app 类型已统一重命名为 `CheckinMarker`。涉及文件:
- `types/marker.uts` (`export type CheckinMarker`)
- `stores/useMarkerStore.uts`、`stores/useMapStore.uts`、`stores/useTaskStore.uts`、`stores/useAchievementStore.uts`
- `utils/storage.uts`、`utils/defaults.uts`、`utils/cloudSync.uts`
- `pages/index/index.uvue`、`pages/tasks/tasks.uvue`

`uni_modules/uni-openLocation/...` 是第三方插件示例,使用的是 SDK 自己的 `Marker`(不同 namespace),不动。

**修复执行记录(2026-05-07,补丁 #2)**: UTSJSONObject 边界方案被真机 logcat 证伪
(`UTSJSONObject cannot be cast to ...Marker`)。改为直接构造 SDK `Marker[]`:
- `displayMarkers: Marker[]`(SDK 原生),用 `{...} as Marker` 字面量构造
- 新增 `miniMapMarkers = displayMarkers.value.slice(0, 20)` 给 tasks.uvue 缩略地图用,
  替换原本直接绑 `markers.value.slice()` 的写法(后者 = 被拒的 CheckinMarkerReactiveObject)
- **教训**:UTSJSONObject 不是万能兜底。某些 SDK(腾讯地图)对 prop 做强类型断言,
  只能给它正主。重命名让出名字 → 用名字构造 → 才闭环。

**修复执行记录(2026-05-07,补丁 #3 — 必须放 `.uvue`)**: 补丁 #2 把 `displayMarkers`
的构造写在 `stores/useMarkerStore.uts` 里,触发 UTS 编译器 error17:

```
参数类型不匹配：实际类型为 'uts.sdk.modules.DCloudUniMapTencent.Marker'，
预期类型为 'uni.UNIC0495C1.Marker'。
at stores/useMarkerStore.uts:39:9   } as Marker)
```

**根因**: `.uts` 文件里 `Marker` 这个名字会被 UTS 编译器在两个位置解析到**不同**的
namespace —— `result: Marker[]` 解析到 `uni.UNIC0495C1.Marker`(app 命名空间下的
某个自动合成 alias),而 `} as Marker` 解析到 `uts.sdk.modules.DCloudUniMapTencent.Marker`
(SDK 真身)。两种 Marker 在 Kotlin 名义类型下是不同的类,`result.push(... as Marker)`
触发参数类型不匹配。

**⚠️ `.uvue` 文件并不能完全规避**: 实测 `.uvue` 文件里 `computed<Marker[]>` 或
`const result: Marker[] = []` 这种**类型注解**位置仍会把 `Marker` 解析到
`uni.UNIC0495C1.Marker`(app 合成 alias),而同文件里 `} as Marker` cast 解析到
SDK 真身,触发同样的 error17。.uvue 优势仅限于"宿主 `<map>` 锚定 SDK Marker",
但脚本里独立的注解位置仍是歧义的。

**真正的规避手段:不要在 SDK 类型上写"类型注解",全用 `as` cast**

对照 `uni_modules/uni-openLocation/pages/openLocation/openLocation.uvue` 同款写法:
```ts
const markers = ref([] as Marker[])              // ✅ cast,不是 : Marker[]
markers.value = [{ ... } as Marker] as Marker[]  // ✅ 双 cast
```

我们最终采用的版本(也 work):
```ts
const displayMarkers = computed(() => {           // ❌ 别写 computed<Marker[]>
  const result = [] as Marker[]                   // ✅ cast,不是 : Marker[] = []
  markers.value.forEach((m: CheckinMarker) => {   // CheckinMarker 是我们自己的,不冲突
    result.push({ ... } as Marker)                // ✅ as 同一边
  })
  return result
})
```

口诀: **SDK 类型只写在 `as` 后面,绝不写在冒号 `:` 后面或 `<>` 泛型参数里。**

**最终落点**:
- `stores/useMarkerStore.uts` **不导出** `displayMarkers` / `miniMapMarkers`,
  只暴露业务态 `markers: CheckinMarker[]`
- `pages/index/index.uvue` 内部声明 `const displayMarkers = computed<Marker[]>(...)`
- `pages/tasks/tasks.uvue` 内部声明 `const miniMapMarkers = computed<Marker[]>(...)`
- 模板侧绑定不变:`<map :markers="displayMarkers">` 和 `<map :markers="miniMapMarkers">`

**通用规则补充**:
> SDK boundary computed 必须写在 `.uvue` 里,不能写在 `.uts` store 里。
> store 只暴露业务态(typed CheckinMarker[]),SDK shape 转换在页面边界完成。
> 这等同于"DTO at the boundary"模式 —— 业务态和外部接口态在不同文件分层。

---

**修复执行记录(2026-05-07,补丁 #4 — 仍然失败)**:

按补丁 #3 的口诀"SDK 类型只写在 as 后面"改完后,把 `displayMarkers` 写成
单 cast 形式 `markers.value.map((m) => ({...} as Marker))`,期望让 `.map()`
推断结果数组类型为 SDK Marker[]。结果编译器报新错误:

```
Return type mismatch: expected 'uni.UNIC0495C1.Marker',
                     actual   'uts.sdk.modules.DCloudUniMapTencent.Marker'.
at pages/index/index.uvue:90:5  } as Marker)))
```

**新发现 — 模板反向推导**:
`<map :markers="displayMarkers" />` 模板绑定会**把 prop 期待类型反向推导回脚本侧
computed 的返回类型**。腾讯地图插件的 `<map>` 组件 `:markers` prop 在 app 命名空间
里被合成为 `uni.UNIC0495C1.Marker[]`(typealias),编译器拿这个去校验我们 computed
的返回值,而我们 `as Marker` cast 出来的是 SDK 真身 `uts.sdk.modules.DCloudUniMapTencent.Marker`,
两者在 Kotlin 名义类型下不等价 → return type mismatch。

**所以补丁 #2/#3 的"`as Marker`"路线在脚本侧根本无法满足模板的反向推导**。

---

**本会话尝试 5 种写法,全部失败**:

| 编号 | 形式 | 编译 | 运行 |
|------|------|------|------|
| 1 | `Marker[]` (与 SDK 同名) | ✅ | ❌ ClassCastException(我们的 Marker → SDK Marker 失败) |
| 2 | 重命名 `CheckinMarker` + `displayMarkers: UTSJSONObject[]` | ✅ | ❌ ClassCastException(UTSJSONObject → SDK Marker 仍失败) |
| 3 | `.uts store` 内 `computed<Marker[]>` 构造 SDK Marker | ❌ error17 | — |
| 4 | `.uvue` 内 `: Marker[]` 注解 + `as Marker` cast | ❌ error17 | — |
| 5 | `.uvue` 内单 cast `.map(m => ({...} as Marker))` | ❌ Return type mismatch | — |

**核心结论**:
> 在 `<map :markers>` reactive prop 路径上,UTS 5.07 编译器对 SDK Marker 的
> 名义类型识别**无法被 cast 路径满足**。脚本侧任何形式构造 SDK `Marker[]`
> 都会和模板反向推导出来的"app namespace 合成 alias"对不上。
> 这是 UTS 编译器/uniapp x 类型系统的实际限制,不是我们写法的问题。

---

**未来会话 P1 候选方案**(本会话已暂停 `<map :markers>` 绑定,先保证 app 编译启动):

1. **imperative API**: 改用 `MapContext.addMarker(marker, callback)` 命令式调用,
   绕开 reactive prop 类型检查通道。需研究 SDK 是否暴露 setMarkers 方法以及参数签名。

2. **模板字面量**: `<map :markers="[{id:1, ...} as Marker]">` 直接在模板字面量里写,
   编译期可能不走反向推导(因为模板字面量自己就是表达式上下文,prop 期望类型直接锚定)。
   动态化用 `v-if` 切换不同模板;或者用 `<map-marker>` 子组件迭代(如果 SDK 支持)。

3. **uniapp x 升级**: 留意 5.07 后续版本是否修复 error17 在反向推导路径的 bug。

4. **uni-openLocation 借壳**: 把 displayMarkers 写在第三方 `.uvue` 文件的 namespace 里
   (类似 `uni_modules/uni-openLocation/pages/openLocation.uvue`),那里命名空间隔离
   不同,SDK Marker 唯一可见。但代价是把业务页面拆到 uni_modules 下,工程结构难看。

5. **跳过腾讯地图,改用其他 map 实现**: 高德/百度/原生 web map iframe,代价是失去
   uniapp 提供的统一封装。

---

**不建议尝试的死路**(已被本会话证伪):
- ❌ `Marker[]` 类型注解(任何位置)
- ❌ `computed<Marker[]>(...)` 显式泛型
- ❌ `result: Marker[] = []` 变量类型注解
- ❌ `[] as Marker[]` cast(单独使用 — 与内部元素 cast 解析到不同 namespace)
- ❌ `UTSJSONObject[]` 边界(运行时被 setMarkers 强转拒)
- ❌ `.map(m => ({...} as Marker))` 单 cast(模板反向推导仍报 mismatch)
- ❌ `as SdkMarker` 别名 + 字面量数组 + `:markers="..."` 在 app 页面里(编译过,运行静默不渲染)
- ❌ `.map()` callback 无论 arrow shorthand 还是 explicit return,UTS 都会
  把 callback 返回类型识别成 `Unit`,触发 `UTSArray<Unit>` mismatch
- ❌ 静态资源不存在的 iconPath(腾讯插件静默跳过该 marker,不报错也不渲染)

---

### 终极方案 #5(在 uni_modules 子组件内使用 ref + watchEffect + forEach + push)

经过 4 轮失败,确认必须满足三个独立条件**同时**成立:

1. **命名空间隔离**: SDK Marker 构造代码必须放在 `uni_modules/<module>/components/`
   下的 `.uvue` 文件里,不能放在 `pages/*.uvue` 或 `stores/*.uts`。
   原因:app 命名空间会自动合成 `uni.UNIC0495C1.Marker` typealias 与 SDK
   Marker 同名冲突,uni_modules 子命名空间不参与该合成。

2. **ref + watchEffect, NOT computed**: UTS 5.07 在 computed 上对返回数组
   类型推导彻底坏掉,必须用 ref([] as SdkMarker[]) 初始化 + watchEffect
   异步填充。这正是 `uni_modules/uni-openLocation/pages/openLocation/openLocation.uvue`
   的写法。

3. **forEach + push, NOT .map()**: UTS 编译器把 `.map()` callback 的返回值
   认成 `Unit`,导致 `UTSArray<Unit>` 与 `UTSArray<Marker>` 不匹配。
   只能 `arr.push({...} as SdkMarker)` 单值循环。

最终代码模板(参考 `uni_modules/checkin-map/components/checkin-map/checkin-map.uvue`):

```ts
// 必须在 uni_modules 命名空间下
type SdkMarker = uts.sdk.modules.DCloudUniMapTencent.Marker
type MarkerInput = { id: number, latitude: number, ... }  // 本地名,与 SDK 不重

const props = defineProps({
  markersData: { type: Array as PropType<Array<MarkerInput>>, default: (): Array<MarkerInput> => [] }
})

const renderedMarkers = ref([] as SdkMarker[])

watchEffect(() => {
  const arr = [] as SdkMarker[]
  props.markersData.forEach((m: MarkerInput) => {
    arr.push({
      id: m.id, latitude: m.latitude, longitude: m.longitude,
      title: m.title, iconPath: m.iconPath, width: m.width, height: m.height
    } as SdkMarker)
  })
  renderedMarkers.value = arr
})
```

业务页面(`pages/index/index.uvue`)只用 `<checkin-map :markers-data="..." />`,
**永远不接触 SDK Marker 类型**。业务态(`CheckinMarker[]`)→ MarkerInput 投影
在业务页里完成,SDK 边界由 uni_modules 组件内部完成。

---

### 关键代码规范(从 5 轮失败提炼)

| # | 规则 | 原因 |
|---|------|------|
| 1 | 业务类型不与 SDK 类型同名 | `Marker` 撞名 → ClassCastException |
| 2 | SDK Marker 构造只能在 uni_modules `.uvue` 里 | app 命名空间合成 alias 冲突 |
| 3 | 用全限定路径别名 `type SdkMarker = uts.sdk.modules....Marker` | 不直写 `Marker`,避免名字解析歧义 |
| 4 | SDK 类型只在 `as` 后面出现 | 类型注解位置触发 namespace 合成 |
| 5 | ref + watchEffect, 不要 computed | UTS computed 推不出复杂数组返回类型 |
| 6 | forEach + push, 不要 .map() | UTS 把 .map() callback 返回认成 Unit |
| 7 | iconPath 必须指向真实存在的资源 | 资源缺失 → setMarkers 静默跳过该 marker |
| 8 | uni_modules 子组件 props 用本地命名 (MarkerInput),不接 CheckinMarker | 维持 namespace 隔离 |

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
| **4** | **页面 url 参数必须用 `onLoad`，不要 cast `getCurrentPages()`** | `(pages[pages.length-1] as UTSJSONObject)["$page"]` 真机抛 `UniNormalPageImpl cannot be cast to UTSJSONObject`（5.07） | **`onLoad` 在 uni-app x 中是全局生命周期钩子，不要 import**（`import { onLoad } from '@dcloudio/uni-app'` 在 .uvue 里编译报 `找不到名称"onLoad"`）。直接 `onLoad((options: OnLoadOptions): void => { const id = options['id'] as string \| null })`。参见 `uni_modules/uni-openLocation/.../openLocation.uvue:349` |
| **5** | **`showActionSheet` / `chooseImage` 等 success 回调必须用官方 typed 类型，不要 cast 成 UTSJSONObject** | `success: (res: any) => { (res as UTSJSONObject)["tapIndex"] }` 抛 `ShowActionSheetSuccessImpl cannot be cast to UTSJSONObject` | `success: (res: ShowActionSheetSuccess) => res.tapIndex` / `success: (res: ChooseImageSuccess) => res.tempFilePaths[0]` |

### 如何区分 "用 UTSJSONObject" vs "用 .prop"？

| 数据类型 | 访问方式 | 示例 |
|---------|---------|------|
| `uni.getStorageSync` 返回值 | `UTSJSONObject` + `["prop"]` | `(data as UTSJSONObject)["key"]` |
| **页面 url 参数（query）** | **`onLoad((options: OnLoadOptions))`** | `options['id'] as string \| null` — 不要走 `getCurrentPages` |
| `uni.getLocation` success 回调参数 | `.prop` | `res.latitude` |
| `uni.onLocationChange` 回调参数 | `.prop` | `res.accuracy` |
| `map @regionchange` 事件对象 | `.prop` | `e.detail.centerLocation` |
| `map @markertap` 事件对象 | `.prop` | `e.detail.markerId` |
| `uni.chooseImage` success 回调 | `.prop`（类型 `ChooseImageSuccess`） | `res.tempFilePaths[0]` |
| `uni.showActionSheet` success 回调 | `.prop`（类型 `ShowActionSheetSuccess`） | `res.tapIndex` |
| `uni.showModal` success 回调 | `UTSJSONObject` + `["prop"]` | `(res as UTSJSONObject)["confirm"]` |

> ⚠️ **5.07 真机崩溃来源（2026-05-08）**：`getCurrentPages()[i] as UTSJSONObject` 在 5.06 旧版本可能成功 cast，**5.07 起强制类型校验**抛 `ClassCastException: UniNormalPageImpl cannot be cast to UTSJSONObject`，整段 `onShow` 崩溃 → `markerId.value` 等状态全部失效 → 出现"距离过远 / 找不到 marker"等假象。**任何页面读 url 参数一律用 `onLoad`**。同理 `showActionSheet` / `chooseImage` 的 `success` 参数也是 `*SuccessImpl` 类，cast 必崩，必须用官方 typed 类型。

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

---

## 七、2026-05-07 Marker 图标显示收尾补充

### 7.1 跨命名空间 DTO 不能直接传给 `uni_modules` 组件

**现象**

页面编译通过，但真机启动时崩溃：

```text
java.lang.ClassCastException:
  uni.UNIC0495C1.MarkerInput__1 cannot be cast to uni.UNIC0495C1.MarkerInput
```

**触发方式**

- `pages/index/index.uvue` 或 `pages/tasks/tasks.uvue` 中定义本地 `type MarkerInput = { ... }`
- 通过 props 把 `Array<MarkerInput>` 直接传给 `uni_modules/checkin-map`
- `uni_modules` 内部再按自己的 `MarkerInput` 遍历

**根因**

UTS 编译到 Kotlin 后，`pages/*.uvue` 里的 `MarkerInput` 和 `uni_modules/*/*.uvue` 里的 `MarkerInput` 即使字段完全相同，也仍然是两个不同的名义类型。
所以“对象数组跨命名空间透传，再在另一侧按本地 type 接收”会在运行时触发 `ClassCastException`。

**错误示例**

```ts
// pages/index/index.uvue
const markersData = computed((): Array<MarkerInput> => ...)
<checkin-map :markers-data="markersData" />

// uni_modules/checkin-map/checkin-map.uvue
markersData: { type: Array as PropType<Array<MarkerInput>>, ... }
props.markersData.forEach((m: MarkerInput) => ...)
```

**最终可用方案：字符串边界**

页面层先序列化：

```ts
const markersJson = computed((): string => {
  const arr = markers.value.map((m: CheckinMarker): MarkerInput => {
    return {
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.title,
      iconPath: m.iconPath,
      width: m.width,
      height: m.height
    } as MarkerInput
  })
  return JSON.stringify(arr)
})
```

`uni_modules` 内部只接收 `String`，再在本命名空间解析：

```ts
const props = defineProps({
  markersJson: { type: String, default: '[]' }
})

watchEffect(() => {
  const arr = [] as SdkMarker[]
  const parsed = JSON.parse<Array<MarkerInput>>(props.markersJson)
  const safeMarkers = parsed != null ? parsed : [] as Array<MarkerInput>
  safeMarkers.forEach((m: MarkerInput) => {
    arr.push({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.title,
      iconPath: m.iconPath,
      width: m.width,
      height: m.height
    } as SdkMarker)
  })
  renderedMarkers.value = arr
})
```

**规则沉淀**

1. 页面层 DTO 传进 `uni_modules` 组件时，优先走 `String(JSON)` 边界。
2. 不要把“字段一样的匿名对象数组”直接作为跨命名空间 props 传递。
3. `uni_modules` 内部需要的本地类型，必须在本模块内重新解析或重新构造。
4. 看到 `Xxx__1 cannot be cast to Xxx`，优先怀疑 UTS/Kotlin 名义类型冲突。

### 7.2 Marker 图标资源路径要和仓库真实文件完全一致

本项目当前真实资源为：

```text
/static/marker_default.png
/static/marker_checked.webp
```

不是 `marker_checked.png`。

排查图标不显示时，优先检查：

1. 文件是否真的存在于 `static/`
2. 代码里的扩展名是否完全一致
3. 历史本地缓存的 marker 数据是否还保存着旧路径

当前项目做法：`loadFromStorage()` 时统一纠正历史 `iconPath`，避免老缓存继续引用失效资源。

---

## 八、P1 闭环（2026-05-08）

P1（地图渲染 + 打卡链路）真机闭环通过。本会话补齐的关键修复（每条都对应一次真机崩溃或交互断裂）：

| # | 问题 | 修复 | 落点 |
|---|------|------|------|
| 1 | `getCurrentPages()[i] as UTSJSONObject` 在 5.07 抛 `UniNormalPageImpl cannot be cast to UTSJSONObject`，导致 `onShow` 整段崩溃 → markerId 永远 0 | 改用 `onLoad((options: OnLoadOptions))`（**uniapp x 全局钩子，不要 import**） | `pages/checkin/checkin.uvue` / `pages/task-detail/task-detail.uvue` |
| 2 | `showActionSheet`/`chooseImage` success 回调 `as UTSJSONObject` 抛 `*SuccessImpl cannot be cast to UTSJSONObject`，无法选图 | 用官方 typed 类型 `ShowActionSheetSuccess` / `ChooseImageSuccess`，直接 `.tapIndex` / `.tempFilePaths` | `pages/checkin/checkin.uvue` |
| 3 | 详情页 60m 可打卡，跳进 checkin 显示距离过远 | 两处 `effectiveRadius` 公式不一致；checkin 改调用 `getEffectiveCheckinRadius()`，与 index 共用 | `pages/checkin/checkin.uvue` |
| 4 | `index.uvue` 跳 checkin 没传 url 参数（`url: '/pages/checkin/checkin'`），改 onLoad 后 markerId 全是 0 | 跳转改 `?id=${marker.id.toString()}&title=${encodeURIComponent(marker.title)}`，删冗余 `setStorageSync`；模板字符串里的 `number` 必须先 `.toString()` 否则 union 类型编译报错（§C） | `pages/index/index.uvue` |
| 5 | `onLoad` 错误 import 自 `@dcloudio/uni-app` → 5.07 编译报 `找不到名称"onLoad"` | uniapp x 中 `onLoad`/`onShow`/`onHide`/`onUnload` 是**全局生命周期钩子**，不要 import；参考 `uni_modules/uni-openLocation/.../openLocation.uvue:349` | `pages/checkin/checkin.uvue` / `pages/task-detail/task-detail.uvue` |
| 6 | `decodeURIComponent` 在 UTS 签名是 `string \| null`，外层 `!= null` 判空后仍被 Kotlin 视作 nullable | 收尾兜底 `decodeURIComponent(s) ?? ''` | `pages/checkin/checkin.uvue` |
| 7 | `index.uvue` 模板用 `accuracyLevel` 但 script 没 import — 之前编译先在 checkin 报错就中止，掩盖了这个潜伏 bug | 在 `useLocationStore` 的 import 列表里加 `accuracyLevel` | `pages/index/index.uvue` |

**P1 已通过的真机验收**：marker 图标渲染、详情面板距离显示、打卡按钮跳转、checkin 范围/精度判断、actionSheet 弹出、相册/相机选图、提交打卡、marker 图标切换为 checked、tasks 页同步状态。

**已知 P2 起点**：`marker-center.checkin` 服务端返回 `请先登录`（`this.auth.uid == null`） — 需登录态打通：检查 App.uvue 启动时的 `uni-id` token 校验、user-center 配置、user 状态 store 与云对象 `_before` 校验链路；同时把 `pages/tasks/tasks.uvue` 的 `<map>` 也接到 `<checkin-map>` 包装组件、显示打卡点缩略。

---

## 九、P2 闭环（2026-05-08）

P2（登录态打通 + tasks 缩略图 + task-detail 路由）真机闭环通过。本阶段补齐的关键修复（每条都对应一次真机异常或硬性 bug）：

| # | 问题 | 修复 | 落点 |
|---|------|------|------|
| 1 | 主地图 / 打卡页没有任何登录入口；`marker-center.checkin` 返回"请先登录"时静默 toast，用户无路可走 | index 顶栏加 `auth-chip`（reactive `state.userInfo` 驱动文案/颜色）；checkin 页拿到 `errMsg === '请先登录'` 时改用 `showModal('需要登录')` 引导跳登录页 | `pages/index/index.uvue` / `pages/checkin/checkin.uvue` |
| 2 | `reactive({ userInfo: x })` 不带类型断言时 UTS 5.07 推断成泛型 `Map<K,V>`，访问 `.userInfo` 报 error18 "找不到名称 userInfo" + "Not enough information to infer type argument for 'K'" | 仿照 `store/index.uts:45` 写法：`type AuthState = { userInfo: UserInfo \| null }` + `reactive({...} as AuthState)` | `user/index.uts` |
| 3 | 登录页"验证码错误"误报 — `parseInt(captcha) !== parseInt(code)` 在 UTS 比 JS 严格（更接近 Kotlin `String.toInt`），且后续发现 `Math.floor(...).toString()` 在 UTS Kotlin 下产出 `"123456.0"` 而非 `"123456"` | **彻底移除假 captcha**（client 生成 + toast 显示，零安全价值）；登录/注册只校验用户名+密码 | `pages/login/login.uvue` / `pages/signUp/signUp.uvue` |
| 4 | `cloudSync.readQueue()` 用 `JSON.parse(raw) as QueueItem[]` 假 cast → 启动时 `flushSyncQueue` 抛 `ClassCastException: UTSJSONObject cannot be cast to QueueItem` | 改用泛型 `JSON.parse<QueueItem[]>(raw)` 真实构造 typed 实例（与 `utils/storage.uts` 同款） | `utils/cloudSync.uts` |
| 5 | tasks 页有"成就徽章 + 缩略地图 + 打卡点列表"但**缺任务列表 section** → `task-detail` 路由注册了却进不去 | 在徽章和缩略图之间插入「任务列表」section，每条任务可点击 → `navigateTo('/pages/task-detail/task-detail?id=${t.id}')` | `pages/tasks/tasks.uvue` |

### 9.1 新增黄金法则（提取自本阶段）

**法则 6：`reactive({...})` 必须带 `as XxxState` 类型断言**

```ts
// ❌ UTS 5.07 推不出 K，访问 state.userInfo 报 error18
export const state = reactive({
  userInfo: processedUserInfo
})

// ✅ 显式断言成具名类型
type AuthState = { userInfo: UserInfo | null }
export const state = reactive({
  userInfo: processedUserInfo
} as AuthState)
```

**法则 7：UTS `Math.floor(x).toString()` ≠ JS `Math.floor(x).toString()`**

UTS 的 `number` 在 Kotlin 是 `Double`：

```ts
// ❌ Kotlin Double.toString() = "123456.0"，模板插值后用户看到 "你的验证码是123456.0"
this.code = Math.floor(Math.random() * 900000 + 100000).toString()

// ✅ .toFixed(0) 强制整数格式输出 "123456"
this.code = Math.floor(Math.random() * 900000 + 100000).toFixed(0)
```

同理 `Math.round / Math.ceil` 等任何返回 `number` 的表达式，要拼到字符串时都得检查是否会带 `.0`。`'sync_' + Math.floor(...)` 这种隐式 `+` 拼接里也藏过同样的坑。

**法则 8：`JSON.parse(raw) as T[]` = 假 cast，访问成员必崩**

```ts
// ❌ 编译过，运行时 ClassCastException: UTSJSONObject cannot be cast to T
const items = JSON.parse(raw) as QueueItem[]
items[0].action  // ← 在这里炸

// ✅ 泛型 JSON.parse<T>() 真实构造 typed 实例
const items = JSON.parse<QueueItem[]>(raw)
items[0].action  // ← 安全
```

适用范围：所有从 `uni.getStorageSync` / cloud function 响应 / `request` 返回值反序列化的对象。`as` 在 Kotlin 不做转换，只做断言；真正的反序列化必须走泛型。

**法则 9：客户端生成 + 客户端比对的 captcha 应该直接删掉**

零安全价值，且通常会暴露 UTS 的 number→string、v-model 同步、字符串比较语义等 N 个边界 bug。真要登录验证码就走云端（短信/邮件 + 服务端校验），UI 上别留这种装饰物。

### 9.2 P2 已通过的真机验收

- ✅ 主地图右上 auth-chip：未登录显示"登录"，点击跳 login 页
- ✅ 注册新账号 → uni-id-users 表写入 nickname/username/password
- ✅ 登录成功 → `setUserInfo` 写 `uni_id_token`/`uni_id_token_expired`/`userInfo` → 返回主地图，chip 切换为用户昵称
- ✅ 打卡链路：检查 token 有效 → marker-center.checkin 通过 → tourism_markers.checkedBy 增加该用户记录
- ✅ 创建打卡点：marker-center.add 写入云端，tourism_markers 表新增文档（含 id=Date.now()、createdBy=uid、createdAt）
- ✅ tasks 页任务列表 → 点击进入 task-detail → "前往" 回到地图聚焦该 marker
- ✅ App 启动不再因 sync_queue 旧数据 ClassCastException 崩溃

### 9.3 已知 P3 候选（下一会话起点）

| 项 | 说明 |
|----|------|
| **iconPath 远程 URL → 本地路径统一化** | 当前云端 `tourism_markers.iconPath` 部分是 `https://img.icons8.com/...`，腾讯地图插件对远程图片偶发静默不渲染（PITFALLS §F #7）；建议客户端入库时强制改成 `/static/marker_default.png` |
| **多设备数据同步真机验证** | 设备 A 打卡 → 设备 B 拉取，看 marker.checked 是否同步到 UI；目前只单机测过 |
| **登录态过期处理** | 当前 token 过期后 `App.uvue` 会清 storage 但不引导用户重新登录；可在 chip / checkin 模态里加"会话已过期"提示 |
| **离线打卡端到端验证** | sync_queue 修了 ClassCastException，但还没真机走过"断网打卡 → 联网 flush"完整路径 |
| **后台管理 (uni-admin)** | tourism_markers / users / rewards 后台 dashboard 仍未搭建，参考 §13 |
| **照片上传链路** | photo-center.upload 路径已通，但实际真机录入还没拍过带照片的打卡（包括压缩、cloudURL 入库） |

---

## 十、P3 闭环（2026-05-08）

P3（详情面板重做 + bug 批量修复）编译闭环。本阶段的关键修复（每条都对应一次真机或编译异常）：

| # | 问题 | 修复 | 落点 |
|---|------|------|------|
| 1 | tasks 页 `filteredMarkers` 的 `pending` 分支错返回 `checkedMarkers.value`，"待打卡"过滤显示已打卡列表 | 改为 `pendingMarkers.value`，import 补 `pendingMarkers` | `pages/tasks/tasks.uvue` |
| 2 | stats 页时间线 `'' + m.checkedAt` 直显裸 timestamp（已 import `formatDateTime` 但未用） | 用 `fmtTime(m.checkedAt!!)` 走格式化（套法则 10 wrapper） | `pages/stats/stats.uvue` |
| 3 | 云端 `tourism_markers.iconPath` 残留 `https://img.icons8.com/...` 远程 URL，腾讯地图插件偶发不渲染 | 三层防御：服务端 add 写入默认值 / cloudSync 入口归一化 / store 终点基于 checked 重写 | `marker-center/index.obj.js` + `utils/cloudSync.uts` + `stores/useMarkerStore.uts` |
| 4 | task-detail 缺"完成时间"行（已 import `formatDateTime` 未用） | 模板新增 `v-if` 条件行 + wrapper `fmtTime` | `pages/task-detail/task-detail.uvue` |
| 5 | checkin 完成 navigateBack 后主地图仍停在原位 | doSubmit 内 `requestFocus(updatedMarker)` → 主地图 onShow 走 `consumeFocus` 自动 moveToLocation + setActiveMarker | `pages/checkin/checkin.uvue` |
| 6 | 详情面板缺：他人足迹、自己照片预览、打卡数、创建者权限化删除 | β 方案：扩 `CheckinMarker` 加 `checkedBy: CheckinEntry[] \| null` + `checkinCount: number \| null`；cloudSync 切换 typed `JSON.parse<CheckinMarker>()` 真实构造嵌套数组；index 模板大改含 5 个新 computed | `types/marker.uts` + `utils/cloudSync.uts` + `pages/index/index.uvue` |
| 7 | β 改完后 `useMarkerStore.uts:13` `computed(() => filter(m => m.checked))` 报 `Parenthesized expression cannot be empty at col 39` | 5 个 computed 全部加显式 callback 类型注解 + filter/find/findIndex callback 加 `(m: CheckinMarker): boolean =>` | `stores/useMarkerStore.uts` |
| 8 | 模板 `{{ formatDateTime(...) }}` 报 `找不到名称"invoke"` + `Function invocation expected` | 把 `formatDateTime` 包进 setup 作用域的本地函数 `fmtTime`，模板调 `fmtTime(...)` | `pages/index/index.uvue` + `pages/stats/stats.uvue` + `pages/task-detail/task-detail.uvue` |

### 10.1 新增黄金法则（提取自本阶段）

**法则 10：模板不能直接调 import 的独立函数 → 包成 setup 本地 wrapper**

UTS 5.07 把 .uvue 编译成 Kotlin 时，模板 AST 转换走独立 resolver，**未注入 `<script setup>` 顶层 import 的函数符号**。结果：

```ts
// ❌ 模板报 "找不到名称 invoke" + "Function invocation 'formatDateTime(...)' expected"
import { formatDateTime } from '@/utils/format'
// template:  {{ formatDateTime(ts) }}

// ✅ wrap 进 setup 作用域
import { formatDateTime } from '@/utils/format'
function fmtTime(ts: number): string {
  return formatDateTime(ts)
}
// template:  {{ fmtTime(ts) }}
```

适用范围：所有 `{{ utilFn(x) }}` / `:src="utilFn(x)"` 等模板表达式调 import 函数的位置。computed 不能替代 — computed 不接受 v-for 循环里的动态实参（`v-for="e in list"` 中的 `fmtTime(e.checkedAt)`）。

**法则 11：computed callback 必须显式标注返回类型 + 内部 callback 也要标注**

UTS 5.07 类型推断链路超过 2 层时**断链**，错误指针错放在最外层 `(` 上，报 `Parenthesized expression cannot be empty`。触发条件：被消费的 reactive 类型字段含嵌套对象 / 数组（如 `CheckinEntry[] | null`）。

```ts
// ❌ 类型推断断 → "Parenthesized expression cannot be empty at col 39"
export const checkedMarkers = computed(() => markers.value.filter(m => m.checked))

// ✅ 双层显式注解：computed 回调 + filter 回调
export const checkedMarkers = computed((): CheckinMarker[] =>
  markers.value.filter((m: CheckinMarker): boolean => m.checked)
)
```

适用范围：所有导出的 store 派生 ref（`computed`），以及 `.find / .findIndex / .filter / .map` callback。即使 TS/JS 不需要也要写 — 这是"类型推断失败 → 错误指针错放"的防御。

**法则 12：嵌套类型对象一律走 `JSON.parse<T>()` 真实构造，禁用 `as T`**

法则 8 的强化版。法则 8 说"`as` 假 cast 会运行时崩"，本阶段实际兑现：

```ts
// ❌ as 是 type erasure，nested 数组访问运行时 ClassCastException
const cloudMarker = JSON.parse(jsonStr) as CheckinMarker
cloudMarker.checkedBy[0].photoCloudURL  // ← UTSJSONObject cannot be cast to CheckinEntry

// ✅ 泛型 JSON.parse<T>() 递归构造嵌套 typed 实例
const cloudMarker = JSON.parse<CheckinMarker>(jsonStr)
cloudMarker.checkedBy[0].photoCloudURL  // ← 安全
```

判定：被解析对象**含数组字段或嵌套对象字段**时永远走泛型；只有纯扁平基本类型（string/number/bool）才能侥幸用 `as`。

### 10.2 P3 真机验收清单（编译通过后逐条勾）

- [ ] tasks 页 → 切到"待打卡"chip → 只显示未 checked 的 marker
- [ ] stats 页时间线 → 渲染 `2026-XX-XX HH:mm` 格式（非裸数字）
- [ ] task-detail（任意已完成任务）→ 状态区域有"完成时间"行
- [ ] 主地图详情面板顶部状态徽章（已打卡 / 未打卡）
- [ ] 自己创建的 marker → 显示"由我创建" pill + 删除按钮
- [ ] 他人创建的 marker → 删除按钮**不显示**
- [ ] 自己打过卡的 marker → 详情面板显示"我的打卡"卡片（照片 + 备注 + 时间）
- [ ] 有他人打过卡的 marker → 显示"他人足迹"横滑照片墙
- [ ] checkin 完成 navigateBack → 主地图自动 zoom 到刚打卡的点 + 详情面板自动打开
- [ ] 主地图 marker 图标全部用本地静态图（无 https://img.icons8.com 漏渲）

### 10.3 已知 P4 候选（下一会话起点）

| 项 | 说明 |
|----|------|
| **多设备数据同步真机验证** | β 已让 cloud `checkedBy[]` 完整拉回，需双设备真机验证：A 打卡 → B onShow 拉取 → 看 B 端详情面板是否显示 A 的足迹 |
| **离线打卡 e2e 验证** | sync_queue 修复后未真机走过完整闭环 |
| **照片打卡端到端真机** | photo-center.upload 路径完整，但需真机拍照 → upload → cloudURL 入 marker.checkedBy[].photoCloudURL → 详情面板他人足迹展示 |
| **add-marker 页 UI 美化 + 实时坐标预览** | C4 候选 |
| **tasks 任务列表的过滤 chips** | C1 候选 |
| **stats 时间线分组（今日/本周/本月）** | C2 候选 |
| **后台管理 uni-admin** | 已进入 P3 第一轮：后台页面、种子点/任务同步、用户统计已落地；下一步是 HBuilderX 发布与客户端补传联调 |

### 10.4 2026-05-09 P1 收尾补充

| 问题 | 根因 | 当前约定 |
|------|------|----------|
| tasks 页面整体不滚动 | 顶层直接用 `scroll-view` + `100vh` 在 Android 真机上高度计算不稳定 | 页面外层用普通 `view` 固定 `height: 100%`，内部 `scroll-view` 单独设置 `height: 100%` |
| 成就徽章不能横滑 | 横向 `scroll-view` 的内容宽度没有显式大于容器宽度，flex 子项被压回视口内 | 横滑内容层设置固定宽度，徽章外包一层固定宽度 item |
| task-detail 显示“任务不存在” | 真机上页面 query 可能未及时进 `taskId`，store 加载时机也会影响 computed | 任务列表跳转前写 `pending_task_detail_id`，详情页 `onShow` 加载 store 后用该 key 兜底 |
| 未登录仍可进入 checkin 并本地打卡 | 登录校验只在云端提交阶段发生，本地 `doCheckIn()` 仍会把 marker 改成 checked | 首页 `doCheckin()` 先检查 `userState.userInfo`，未登录只提示/引导登录，不进入 checkin 页 |
| `showModal` 回调误写 `ShowModalSuccess` | UTS 5.07 当前全局类型里没有该名称，`.confirm` 成员也无法解析 | 沿用本项目稳定写法：`success: (res: any) => { const r = res as UTSJSONObject; r['confirm'] }` |
| `showActionSheet` 选图链路仍不稳 | 5.07 真机对 `ShowActionSheetSuccessImpl` 类型边界敏感，历史代码曾发生 cast 崩溃 | checkin 页改成“拍照 / 相册”两个按钮，直接调用 `uni.chooseImage`，绕开 actionSheet 中间层 |
| 首页显示可打卡，进入 checkin 后偶发“距离过远” | 页面跳转后 GPS 重新采样可能短时漂移，两页虽共用半径但读到的位置不同 | 首页跳转前记录同 marker 的短时 preflight 距离，checkin 页仅在同一 marker 且 2 分钟内允许兜底 |

2026-05-09 二次调整：

- `tasks.uvue` 不再把原生迷你地图放在筛选 chips 前面。原生 map 组件在 Android 上容易吞掉滑动手势，P1 阶段把 filter bar 放到上半部分固定可见，marker 列表在内层 `scroll-view` 中滚动，迷你地图下移到列表后。
- `task-detail.uvue` 不只依赖 URL query / storage。`useTaskStore.uts` 新增 `pendingTaskDetailId` 与 `requestTaskDetail(id)`，任务列表点击时先写共享 ref，再 navigate；详情页按 URL → shared ref → storage 的顺序恢复 id。

2026-05-09 三次调整：

- `tasks.uvue` 回到与 `stats.uvue` 一致的单根纵向 `scroll-view`，并显式设置 `direction="vertical"`；横向徽章 `scroll-view` 同时写 `scroll-x` 与 `direction="horizontal"`。
- 筛选 chips 不再用 `v-for` + 联合类型参数，改为三个显式按钮和 `setFilterAll / setFilterPending / setFilterDone`。筛选同时作用于任务列表和打卡点列表，避免用户点了但首屏任务区不变化。
- `task-detail.uvue` 增加完整任务快照兜底：`requestTaskDetail(id)` 会把当前 `Task` 写入 `pendingTaskDetailSnapshot` 和 `pending_task_detail_snapshot`。详情页 `findTaskById()` 失败时仍能展示快照，避免“任务不存在”。
- 登录 chip 文字不再依赖父子选择器 `.auth-chip-on .auth-chip-text`，改用直接动态类 `auth-chip-text-on/off`；`setUserInfo()` 也会把空 `userName` 兜底成 `userId`。
- `computed` 里调用的本地函数必须先声明再使用。UTS 5.07 对函数提升不稳定，`filteredTasks` 在 `isTaskDone` 前面声明会编译报 `找不到名称 "isTaskDone"`。

2026-05-09 四次调整：

- `uni.showModal` 的 `success` 返回值是 `uts.sdk.modules.DCloudUniModal.UniShowModalResult`，不能 `as UTSJSONObject`。本项目业务确认动作统一改用 `uni.showActionSheet` + `ShowActionSheetSuccess.tapIndex`，避免删除时 `ClassCastException`。
- 本地种子打卡点可能还没有云端 `tourism_markers` 文档，`marker-center.checkin` 会返回“打卡点不存在”。P1 阶段不再把这个云端错误提示给用户；本地存在的 marker 继续完成打卡，云端同步问题留到“种子点云端初始化/修复脚本”处理。
- `tasks.uvue` 信息架构改为 `任务 / 成就 / 地点` 三段。成就用网格，不再和地点列表堆在同一段，也减少横向滚动依赖。
- `deleteMarker()` 先尝试调用 `marker-center.delete({_id})`，无权限或云端不存在时记录日志但不阻塞本地删除。

---

## 十一、P3 后台管理与种子同步（2026-05-09）

本轮主要改云对象与 `uni-admin` Vue 后台，不直接触碰 App 端 UTS 页面，但仍沿用前面几条边界原则：云端返回的嵌套对象到 App 端仍必须用 `JSON.parse<T>()`；App 原生回调仍禁止假转 `UTSJSONObject`；后台管理能力必须放在管理员云对象里，不能复用公开接口做写操作。

### 11.1 种子点同步落点

- 默认 8 个本地点已在 `uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js` 中维护为 `DEFAULT_SEED_MARKERS`，与 `utils/defaults.uts` 的 id/title/经纬度保持一致。
- `admin-center.syncDefaultMarkers()` 按 `id` 幂等同步到 `tourism_markers`：不存在则新增完整云端文档；已存在则只更新名称、经纬度、本地图标路径和尺寸，不重置 `checkedBy` / `checkinCount` / `createdAt`。
- 种子点 `createdBy` 固定为 `system`，`iconPath` 固定为 `/static/marker_default.png`，避免腾讯地图插件加载远程 URL 的静默不渲染问题。

### 11.2 后台接口安全约定

- `admin-center._before()` 会先校验 uni-id token，再检查 `uni-id-users` 当前用户是否具备管理员身份；兼容 `role: 'admin'`、`role: ['admin']`、`permission: ['admin']`。
- 后台新增/编辑统一走 `sanitizeMarkerCreate()` / `sanitizeMarkerUpdate()` 白名单，只允许写入名称、经纬度、图标和尺寸。`checkedBy`、`checkinCount`、`createdBy`、`createdAt` 等受保护字段会被忽略或由服务端生成。
- `uni-admin/pages/markers/index.vue` 已改为调用 `admin-center.getMarkers/createMarker/updateMarker/deleteMarker/syncDefaultMarkers`，不再用公开的 `marker-center.getAll()` 做后台管理。
- `uni-admin/pages/checkins/index.vue` 使用 `admin-center.getCheckins()` 查看全局记录，或通过 `admin_checkins_marker_id` storage 从打卡点页跳转到 `getMarkerCheckins()` 查看单点记录。

### 11.3 后台联调补充

- `uni-admin` 是 Vue3/H5 后台，不是 uni-app x 页面。页面生命周期必须从 `@dcloudio/uni-app` import，例如 `import { onShow } from '@dcloudio/uni-app'`；从 `vue` import `onShow/onHide` 会导致 H5 async component loader 报 `does not provide an export named 'onShow'`，页面表现为“连接服务器超时”。
- 用户管理页以 `uni-id-users` 为主表；自建 `users` 集合只作为统计补充。否则会出现仪表盘 `totalUsers` 正常、用户页列表为 0 的错位。后台还会从 `tourism_markers.checkedBy[]` / `createdBy` 反推统计，避免早期 `users` 文档缺失时每个用户统计都为 0。
- `marker-center.add/checkin` 更新用户统计前要确保 `users` 文档存在；只写 `where({ userId }).update(...)` 在没有文档时会静默更新 0 条。
- 任务后台没有数据时，先点“同步默认任务”。`syncDefaultTasks()` 与本地 6 个默认任务保持一致，并按 `id` 幂等更新 `tourism_tasks`，不会写用户任务进度。
- 后台打卡记录来自 `tourism_markers.checkedBy[]`。如果用户在云端种子点创建前已经完成本地打卡，当时 `marker-center.checkin` 返回过“打卡点不存在”，这批历史本地记录不会自动出现在后台；需要同步默认点后重新打卡，或让客户端离线队列补传。
- H5 开发模式首次进入每个页面会按需编译，短暂慢加载是 dev server 行为；本轮后台页面只加显式 loading/error/empty 状态，不把开发模式懒编译当成生产性能问题。

### 11.4 本轮验证命令

```bash
node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
```

这些命令只能证明云端 helper 行为和 JS 语法正确；uniCloud 部署、管理员 token、`uni-admin` 页面真实联调仍需在 HBuilderX/关联服务空间中验证。

### 11.5 下一轮 P3.1 代码规范重点

- **客户端补传只补“当前用户自己的记录”**：不要从 App 端构造或上传别人的 `checkedBy[]`，补传 payload 只能包含 `markerId`、当前用户备注/照片/时间和可验证位置。最终写库仍必须由云对象根据 `this.auth.uid` 生成 `userId`。
- **不要直接把云端 marker 对象假 cast 成 `CheckinMarker`**：云端 `checkedBy[]` 是嵌套数组，App 端进入 UTS 类型世界前继续用 `JSON.stringify` + `JSON.parse<CheckinMarker>()` 或集中转换函数，不能 `as CheckinMarker`。
- **补传和拉取要分阶段**：先 `marker-center.getAll()` 拉云端事实，再比较本地差异，再调用补传接口，最后重新拉一次云端刷新 UI。不要在一个循环里边改本地、边发云端、边触发 UI。
- **离线队列仍用普通 JSON 结构**：`sync_queue` 存储项只能包含简单字段，不能塞 class 实例、函数、Map 或 UTSJSONObject。读取仍使用 `JSON.parse<QueueItem[]>()`。
- **后台 H5 与 App UTS 生命周期不要混用**：`uni-admin` 页面从 `@dcloudio/uni-app` import `onShow`；App `.uvue` 页面生命周期继续遵守 uni-app x 全局钩子约定。
- **历史本地打卡回填要有幂等保护**：云对象需按 `markerId + uid` 判断是否已存在记录，已存在则返回成功或“已存在但无需重复写”，不要二次递增 `checkinCount`。

### 11.6 P3.1 推荐实施顺序

1. 先在 HBuilderX 部署并复测当前后台：`admin-center`、`marker-center`、`users.schema.json`、uni-admin H5。
2. 再做客户端补传接口：优先新增 `marker-center.repairCheckin()`，权限与幂等逻辑由服务端兜住。
3. 然后改 `utils/cloudSync.uts`：拉云端 markers → 找本地已打卡但云端缺当前用户记录的点 → 入队/补传 → 重拉云端。
4. 最后做真机双设备验收：A 打卡、B 拉取、后台刷新，三端数字一致后再进入照片墙/回顾页。

---

## 2026-05-09 P3.1 新增规则：打卡同步链路

### 规则 13：云对象内部业务逻辑不要依赖 `this._method()`

`marker-center.checkin()` 曾在写入 `tourism_markers.checkedBy[]` 后调用 `this._checkTasks(marker)`。在 uniCloud 云对象本地/云端运行环境中，内部方法不一定能按普通 JS 对象方法保持可调用绑定，真机表现为打卡已成功但随后弹出 `this._checkTasks is not a function`。

推荐写法是把可复用业务逻辑抽成模块级 helper，并显式传入 `uid`：

```js
const completedTasks = await checkTasksForMarker(this.auth.uid, marker)

async function checkTasksForMarker(userId, marker) {
  // 只依赖入参，不依赖 this.auth
}
```

### 规则 14：客户端用户 ID 必须与云端 `this.auth.uid` 保持一致

云端写入 `checkedBy[].userId`、`createdBy`、`user_tasks.userId` 时使用的是 uni-id token 解析出的 `_id`。App 端 `userInfo.userId` 不能再使用展示编号或业务编号，例如 `000_004`，否则会出现这些错位：

- 地图详情面板无法识别“我的打卡”。
- `otherCheckins` 误把自己的记录当成他人记录，或完全不显示。
- `isOwner` 判断失败，自己创建的点不显示删除/创建者状态。

`user-center.login()` 和 `user-center.checkToken()` 应返回 `resUserInfo._id` 作为 `userId`，业务编号可以额外放在 `accountId`，但不要参与权限和打卡匹配。

### 规则 15：打卡完成后 UI 必须重新拉云端事实

本地 `doCheckIn()` 只能保证当前设备即时反馈，不能代表云端 `checkedBy/checkinCount` 已经被所有端看到。拍照打卡页返回主地图后，应由首页 `onShow` 调用 `syncFromCloud()`，再用 `findById(markerId)` 刷新 `activeMarker`。

不要把 checkin 页里刚构造的本地 marker 直接当成最终面板数据；它通常缺少云端追加的 `photoCloudURL`、`checkedAt`、`checkedBy[]` 和最新 `checkinCount`。

### 规则 16：`.uvue` 页面生命周期仍使用 uni-app x 全局钩子

App 端 `.uvue` 页面不要从 `vue` import `onShow/onHide`。5.07 Web/H5 调试会报 `does not provide an export named 'onShow'/'onHide'`，真机侧也容易出现编译/运行时差异。

```ts
// 不推荐
import { ref, onShow, onHide } from 'vue'

// 推荐
import { ref } from 'vue'
onShow((): void => {})
onHide((): void => {})
```

`uni-admin` 是 Vue3/H5 后台项目，若页面需要生命周期，则从 `@dcloudio/uni-app` import；App `.uvue` 与后台 `.vue` 不要混用规则。

### 规则 17：历史补传必须先拉云端事实，再按当前 uid 做差异

P3.2 落地了 `repairMissingCheckins(uid)`。顺序必须保持为：

1. `syncMarkers()` 拉取云端 `checkedBy[] / checkinCount`。
2. 对比本地 `checked == true` 的历史记录和云端 `checkedBy[]`。
3. 只补传云端缺少当前 uid 的 marker。
4. 补传后再 `syncMarkers()` 一次刷新 UI。

不要从 App 端上传完整 `checkedBy[]`，也不要上传客户端传来的 `userId`。`marker-center.repairCheckin()` 必须只使用 `this.auth.uid` 生成 `checkedBy[].userId`，并按 `markerId + uid` 判断已存在记录，避免重复递增 `checkinCount`。

### 规则 18：本地 checked 只是历史痕迹，不等于当前用户云端状态

同一景点允许多人打卡后，`marker.checked == true` 只能说明“本机历史上完成过一次本地打卡”或“云端全局已有打卡”。App 当前用户是否已打卡必须用：

```ts
function isCheckedByUser(marker: CheckinMarker, uid: string): boolean {
  const list = marker.checkedBy
  if (list == null) return false
  return list.some((entry: CheckinEntry): boolean => entry.userId === uid)
}
```

详情面板状态、打卡按钮、我的打卡卡片都应看当前 uid；总人数、他人足迹和后台统计才看 `checkinCount` 或 `checkedBy.length`。

### 规则 19：云对象业务失败不能进入本地成功链路

P3.2 复测发现：`marker-center.checkin()` 返回“您已在此处打过卡”这类业务失败时，App 端可能进入 `catch`，同时 uniCloud 默认 UI 弹出业务错误；如果 `catch` 无条件 `enqueueAction()` 并继续执行本地 `doCheckIn()`，就会出现两个弹窗叠加、后台无记录但本地显示成功、任务重复完成、几秒后云端刷新又把本地状态冲掉。

修正规则：

- 打卡页导入云对象时使用 `{ customUI: true } as UniCloudImportObjectOptions`，避免默认错误弹窗和业务 toast 叠加。
- `catch` 中必须解析错误信息；“请先登录 / 已在此处打过卡 / 距离过远”等业务失败直接停止，不进入本地成功链路。
- 只有真实网络/云对象不可达，或明确允许离线队列的场景，才进入 `enqueueAction('checkin', payload)`。

### 规则 20：云端 marker 基础字段必须覆盖本地字段

后台修改 marker 名称后，App 端 `syncMarkers()` 不能只合并 `checkedBy/checkinCount`。云端应作为 marker 基础信息的事实来源，同步时至少覆盖：

```ts
local._id = cloudMarker._id
local.title = cloudMarker.title
local.latitude = cloudMarker.latitude
local.longitude = cloudMarker.longitude
local.width = cloudMarker.width
local.height = cloudMarker.height
local.createdBy = cloudMarker.createdBy
local.createdAt = cloudMarker.createdAt
```

同时仍要保留本机专属的 `photoPath`，因为云端不会持有本地临时文件路径。

### 规则 21：删除打卡也必须只信任云端 uid，并在删除后重拉云端事实

P3.3 新增 `marker-center.deleteCheckin()`。删除打卡和补传/打卡一样，不能信任客户端传来的 `userId`，也不要让 App 上传完整 `checkedBy[]`。客户端只传：

```ts
const payload = JSON.parse('{}') as UTSJSONObject
payload["markerId"] = markerId
await markerApi.deleteCheckin(payload)
```

云对象内部必须用 `this.auth.uid` 过滤当前用户自己的记录：

```js
const checkedBy = marker.checkedBy.filter(entry => entry.userId !== this.auth.uid)
await col.doc(marker._id).update({
  checked: checkedBy.length > 0,
  checkinCount: checkedBy.length,
  checkedBy,
  updatedAt: Date.now()
})
```

删除后 App 不要手动猜测本地 `checkedBy/checkinCount`。应调用云端删除接口后立刻 `syncFromCloud(uid)`，再用 `findById(markerId)` 刷新详情面板。这样 A 删除自己的打卡时，B 在同一景点的记录、照片和全局人数不会被误删或误算。

P3.3 第一版不回滚任务进度；如后续要撤销 `user_tasks/rewards`，必须单独设计并测试，因为“删除一次记录”不等于“撤销所有由该记录触发的奖励”。

### 规则 22：后台打卡记录优先按 marker 分组，照片审核用显式预览入口

`uni-admin` 是 Vue3/H5 后台，不受 App UTS 的 `<cover-view>` 和地图 SDK 类型限制。P3.3 打卡记录页按 marker 分组展示，云对象返回：

```js
{
  markerId,
  markerTitle,
  recordCount,
  latestCheckedAt,
  records: [...]
}
```

前端列表保留缩略图，但审核大图必须通过独立按钮/弹窗打开，避免把长 URL 或大图直接塞进每条记录卡片造成页面噪音。后续违规照片删除入口应接在该弹窗动作区，而不是复用公开 App 接口做后台管理写操作。

### 规则 23：UTS 5.07 详情面板严禁纵向 scroll-view 内嵌横向 scroll-view

P3.3 复测在 Android 真机上发现：详情面板已打卡时，`<scroll-view scroll-y>` 内部嵌一个 `<scroll-view scroll-x>` 来展示"他人足迹"，会出现纵向滑动手势完全失效，并且只能看到我的打卡卡片，下面的他人足迹永远滚不出来。

根因：

- UTS 5.07 Android 原生 scroll-view 嵌套时，内层横向 scroll-view 会优先吃掉手势，纵向滑动事件无法冒泡到外层。
- 没有显式 `direction` 时，编译器选择的方向与运行时实际方向有概率不一致（参规则 §10.4）。

强制写法：

```vue
<scroll-view scroll-y direction="vertical" class="panel-body">
  <view class="other-checkins" v-if="visibleOtherCheckinsWithPhoto.length > 0">
    <text class="section-label">{{ otherFootprintLabel }}</text>
    <view class="other-grid">
      <view v-for="e in visibleOtherCheckinsWithPhoto" class="other-card">
        ...
      </view>
    </view>
  </view>
</scroll-view>
```

`.other-grid` 用 `display: flex; flex-direction: row; flex-wrap: wrap;`，让他人足迹照片纵向自然排列在外层纵向 scroll-view 里。如果一定要横滑展示，应放在外层 scroll-view 之外，独立分区。

### 规则 24：UTS as Boolean / as String / as Number 在 nullable 上不安全

P3.3 复测发现：App 删除打卡几乎总是显示"删除失败，请稍后重试"。复盘代码：

```ts
const data = rawData as UTSJSONObject
const deleted = data["deleted"] as boolean   // ← 这里
return deleted
```

`data["deleted"]` 是 `Any | null`。`as boolean` 在 null 上抛 ClassCastException，被外层 try/catch 兜成"删除失败"，UI 完全屏蔽了真实错误。

正确写法：先判 null 再 as：

```ts
const rawDeleted = data["deleted"]
if (rawDeleted == null) return false
return rawDeleted as boolean
```

同时，UI catch 应把云端 `errMsg` 透传到 toast，而不是统一回退到本地兜底文案——否则"请先登录 / 距离过远 / 该用户没有打卡记录"等业务错误全部被当成"网络异常"。

```ts
} catch (e) {
  const err = e as Error
  const msg = err.message
  uni.showToast({ title: msg.length > 0 ? msg : '删除失败，请稍后重试', icon: 'none' })
}
```

### 规则 25：后台违规删除入口必须走 admin-center，不能复用 marker-center 的当前用户接口

`marker-center.deleteCheckin()` 在 P3.3 设计里只信任 `this.auth.uid`，只删自己的记录——这是给 App 用户用的安全闸门。后台审核要"删除别人的记录"，必须通过 `admin-center._before()` 的管理员校验门禁后，由 `admin-center.deleteCheckinRecord()` 执行。

前端用 `(userId, checkedAt)` 这对自然主键是因为 `checkedBy[]` 嵌套数组里的 entry 没有独立 doc `_id`：

```js
function createDeleteCheckinRecordPlan(marker, target) {
  // 只删第一条 (userId, checkedAt) 完全匹配的 entry，幂等
}
```

云对象层一定要：

- 校验 admin 身份在 `_before`，不放行任何匿名 / 普通用户 token
- 不允许客户端传 `checkedBy[]` 整体覆盖；只接受定位字段
- 第一版不回滚 `user_tasks`/`rewards`，与 P3.3 规则 21 一致
- 后续 P3.4 接入物理删除照片与审计日志时，物理删除失败不回滚数据库删除，仅记 `purgeError` 字段

### 规则 26：删除用户必须服务端事务式级联清理，禁止前端遍历调用多接口

后台 "删除用户" 不能在 vue 页面里串 5 次 `await api.xxx()`：删一半遇到网络中断或权限抖动会留下孤儿 — 用户已删但 `tourism_markers.checkedBy[]` / `users` / `user_tasks` / `rewards` 残留，从此显示成 "已离职打卡人" 或干脆撑爆 dashboard 计数。

正解：**所有级联清理收口到 `admin-center.deleteUser({ _id })` 一个调用**，服务端按固定顺序执行：

1. 安全栅栏：拒绝删除当前登录管理员（`this.auth.uid`），拒绝删除唯一剩余 admin。
2. `tourism_markers` 全表扫描，对每个 marker 跑纯函数 `createPurgeUserCheckinsPlan(marker, uid)` 计算 patch，仅 `shouldUpdate: true` 才落库。
3. `users`（colUserProfiles，统计文档）按 `userId` 全删。
4. `user_tasks`、`rewards` 按 `userId` 全删。
5. 最后 `colUsers.doc(_id).remove()`。

`createPurgeUserCheckinsPlan` 与 P3.3 的 `createDeleteCheckinRecordPlan` 区别在于：本计划允许同一 uid 多条记录一次性删干净（防御性处理），而单条删除只删第一条匹配。两者都是纯函数 + 单测覆盖，写库副作用集中在 `index.obj.js`。

返回值携带各表清理数量，供前端 toast 显示 "已清理 X 条打卡 / Y 条任务 / Z 条奖励"，让审计动作有可见回执。

### 规则 27：物理删图必须有命名空间白名单 + 不回滚数据库

P3.4 引入 `photo-center.deletePhoto(cloudURL)` 的物理删图链路。两条死规则：

1. **命名空间白名单**：所有物理删图必须经过 `photo-service.isAllowedCloudURL(url)`，只允许包含 `/checkin-photos/` 前缀的 URL，且拒绝路径穿越（含 `..`）、超长 (> 1024) 与非字符串入参。任何"我自己写云端 fileID"的入口都不能绕开这道闸。
2. **物理删除失败不回滚数据库**：`admin-center.deleteCheckinRecord({ purgePhoto: true })` 在数据库 `checkedBy[]` 已经更新成功后才异步调用物理删图。若 `deletePhoto` 返回 `{ deleted: false, errMsg }`，仅把 `purgeError` 写进响应（与审计日志），数据库 entry 保持已删。这是因为"用户审核已生效"的语义比"云存储一致性"优先；残留文件可以异步清理工具兜底，但 UI 不能回滚违规判定。

`uniCloud.importObject('photo-center')` 在云函数内部调用另一个云函数时，鉴权上下文（`auth.uid`）会随之透传——所以 `photo-center._before` 仍可强制要求登录。但**不要**在 photo-center 内部按 uid 限制"只能删自己的文件"：admin 违规清理的就是别人的文件，命名空间校验已经够强。

### 规则 28：审计日志写失败仅 console.log，绝不阻塞主流程

`tourism_audit_logs` 是只追加的审计沉淀，不参与任何业务判定。`admin-center.deleteCheckinRecord` / `deleteUser` 与 `marker-center.deleteCheckin` 在主流程成功后调用 `appendAuditLog(...)` / `appendUserDeleteAudit(...)`，内部 try/catch 捕获后只 `console.log`，**不要 throw 也不要把审计失败计入响应 errCode**。

理由：审计本身一旦成为可用性单点，反而会让"删除"流程因为日志服务抖动而失败，触发用户重试 → 二次幂等问题；这是分布式系统里典型的"审计反向放大事故"。

跨 cloudfunction 的事实：`marker-center` 不能 `require('../admin-center/audit-service')`——uniCloud 不支持跨函数 require。`marker-center/index.obj.js` 内部复刻最小写入逻辑（与 `audit-service.buildAuditLogEntry` 的字段集对齐），由 `admin-center/audit-service.test.js` 的 schema 测试守住一致性。

### 规则 29：UTS 5.07 个人历史页用嵌套字段 where + JSON.parse<T[]>() 边界

`marker-center.getMyCheckins` 走 `col.where({ 'checkedBy.userId': uid })`：mongo / uniCloud 的 dot-notation 嵌套字段查询，比"全表扫 + JS filter"更省并能利用索引。返回每行仍是 marker 全 doc，由服务端再 filter `entry.userId === uid` 后扁平化。

App 端 `cloudSync.uts pullMyCheckins(): Promise<MyCheckinEntry[]>` 必须用：

```ts
const jsonStr = JSON.stringify(raw)
const parsed = JSON.parse<MyCheckinEntry[]>(jsonStr)
```

不要写 `as MyCheckinEntry[]` —— 这是 PITFALLS §九 法则 8 / §Phase 1.5/D 反复强调的 ClassCastException 来源。`JSON.parse<T>()` 是泛型解析，会真实构造 typed 实例；`as` 只是 Kotlin 名义类型断言，访问数组成员（如 `entry.checkedAt`）会运行期炸。

页面层面：`pages/my-checkins/my-checkins.uvue` 顶层是单根 `<scroll-view scroll-y direction="vertical">`，内部全用普通 `view`——绝不嵌套任何 scroll-view（参 §10.4 / §规则 23 手势冲突）。删除走 `uni.showActionSheet` + `tapIndex`，**不要**用 `uni.showModal`（§10.4 四次调整：5.07 `UniShowModalResult` cast 崩）。`onShow` / `onHide` 也必须用 uni-app x 全局钩子，**不要**从 `vue` import（§规则 16）。

### 规则 30：uvue Android `display` 只支持 `flex` 与 `none`，函数提升必须先声明

P3.4 真机验证后 hotfix 复盘的两条死规则，与 §10.4 三次调整呼应但更具体：

**`display` 属性白名单**：uvue Android 只接受 `display: flex` 与 `display: none`。来自 web CSS 的 `block` / `inline-block` / `inline` / `grid` / `table` 全部编译时报错：
```
[plugin:uni:app-uvue-css] ERROR: property value `block` is not supported for `display`
(supported values are: `flex`|`none`)
```
- `<text>` 默认就能换行/独占一行的视觉效果，不需要 `display: block`。
- 想要"块状盒子"直接用 `<view>`，本身就是 flex 容器。
- 想要"水平排列子元素"在父级写 `display: flex; flex-direction: row`，子元素不需要写任何 display。

**函数被引用前必须声明**：UTS 5.07 编译到 Kotlin 时，setup 作用域里的函数提升不稳定，被回调引用的 async 函数必须**词法上**先于引用点声明。否则 error 18：
```
error: 找不到名称 "runDelete"
```
P3.3 在 PITFALLS §10.4 三次调整里第一次记录，P3.4 真机验证又踩一次（actionSheet success 回调里调用了下方声明的 runDelete）—— 这条规则要内化为肌肉记忆：

```ts
// 错（5.07 真机崩 / 编译报 error 18）
function confirmDelete(entry) {
  uni.showActionSheet({
    success: () => { runDelete(entry) }   // ← 找不到 runDelete
  })
}
async function runDelete(entry) { /* ... */ }

// 对：被引用的先声明
async function runDelete(entry) { /* ... */ }
function confirmDelete(entry) {
  uni.showActionSheet({
    success: () => { runDelete(entry) }
  })
}
```

### 规则 31：违规审核 UX 不要让管理员替后端做选择

P3.4 第一版给后台违规删除做了"仅删记录 / 同步物理删图"双 modal，让管理员在删除时还要决定"这次删数据库还是删数据库 + 文件"。这违反"产品语义优先于实现细节"原则——审核员的语义只有"删 / 不删"，"删什么"是后端事务一致性的事。

修正后的标准模式（对齐 B 站 / 微博 / 知乎审核台）：
- 单一二次确认 modal："取消 / 违规删除"两个按钮（注意 `confirmText` 用红色 `#d93026`）。
- "违规删除"= 数据库 entry 删 + 云存储照片同步物理清理（如果记录有照片）。
- 失败时仅记 `purgeError` 进 `tourism_audit_logs`，不向 admin 暴露重试选项；运维通过审计页定期巡检即可。
- 想保留照片做后续争议复核？依赖 audit log 里的 cloudURL 字段，不依赖文件本体（**审计 = 后悔药**，不要让用户实例选）。

### 11.6 P3.3 / P3.4 复测验证命令

```bash
node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js
node --test uniCloud-aliyun/cloudfunctions/admin-center/audit-service.test.js
node --test uniCloud-aliyun/cloudfunctions/marker-center/repair-service.test.js
node --test uniCloud-aliyun/cloudfunctions/photo-center/photo-service.test.js
node --test uni-admin/pages/checkins/checkin-groups.test.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/audit-service.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/repair-service.js
node --check uniCloud-aliyun/cloudfunctions/photo-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/photo-center/photo-service.js
node --check uniCloud-aliyun/cloudfunctions/user-center/index.obj.js
```

下一轮 P3.4 计划入口：`docs/superpowers/plans/2026-05-09-p3.4-record-cleanup-and-personal-history.md`。

## 十二、P4 主题路线进度面包屑（2026-05-10）

**已落地（admin 链路，不触发 uvue 限制）**：
- `523e272` admin-center route CRUD + 纯函数 helper + 10 例单测
- `7c6dfd6` uni-admin 路线管理页 + dashboard 入口

**App 端（.uvue / .uts）尚未开始**。下轮 Task 3 起将首次在 P4 写 `.uvue`，必须按以下既有规则写代码，本轮没有新增的运行期/编译期规则：

- **§规则 16**：路线列表页 `routes.uvue` / 详情页 `route-detail.uvue` 的 `onShow` / `onHide` 必须用 uni-app x 全局钩子，**不要从 vue import**。
- **§规则 23**：路线详情页若有"已打卡 marker 网格"，**不要**在外层 scroll-view 里嵌横向 scroll-view。用 `display: flex; flex-direction: row; flex-wrap: wrap` 让网格自然换行。
- **§规则 29**：`cloudSync.uts pullActiveRoutes()` 解析云端响应必须用 `JSON.parse<RouteWithProgress[]>(JSON.stringify(raw))`，不要写 `as RouteWithProgress[]`（参 §Phase 1.5/D / §九 法则 8 的 ClassCastException 来源）。
- **§规则 30**：`display` 仅 `flex|none`；admin Vue 页里的 `display: grid` / `position: fixed` / `inset: 0` 等写法在 uvue Android 上会爆，**不能照抄管理页 CSS**。函数提升不稳：被回调引用的 async 函数（如 `runCompleteRouteCelebrate` 之于 `confirmCompleteRoute`）必须**词法上**先声明、再被引用。
- **§规则 14**：路线完成检测里写 `user_routes` 的 `userId` 必须取 `this.auth.uid`，不能信客户端传值。

**§规则 28 (跨 cloudfunction require) 提醒**：Task 4 的 `marker-center/route-completion.js` 不能 `require('../admin-center/route-service')`。需要在 marker-center 内复刻 `isRouteCompleted` / `calcRouteProgress` 最小写法，并由 `admin-center/route-service.test.js` + `marker-center/route-completion.test.js` 双侧测试守住 schema 一致。

**§规则 32 占位**：如果 Task 3-5 真机验证踩出新坑（如 actionSheet 多入口冲突、scroll-view 嵌套滑动失效新场景、tag 容器换行异常等），在此 §十二 之后追加 §规则 32。本轮无新规则。

### 规则 32：复合操作入口用 actionSheet 而不是新增底栏按钮

P4 Task 5 给主地图加"主题路线"入口时，底部工具栏已经被 4 个 slot（任务 / 缩小 / 放大 / 定位）占满。再加一个按钮会挤压触控热区，且 uvue Android 上 flex 子元素超过容器宽度会出现"最后一个被切掉"现象（参 §10.4 / §规则 23 的同源根因：layout 不会折行）。

正解：把"任务"按钮改成 actionSheet 入口：
```ts
function goTasks(): void {
  uni.showActionSheet({
    itemList: ['任务', '主题路线'],
    success: (res: ShowActionSheetSuccess): void => {
      if (res.tapIndex == 0) uni.navigateTo({ url: '/pages/tasks/tasks' })
      if (res.tapIndex == 1) uni.navigateTo({ url: '/pages/routes/routes' })
    }
  })
}
```

收益：
1. 底栏 slot 数量不变，不破坏触控热区与视觉节奏。
2. 未来增加"奖励兑换" / "我的徽章"等同类入口时，只需 itemList 多加一项，不动模板。
3. actionSheet 5.07 真机稳定（与 §10.4 四次调整里 `showModal` ClassCastException 不同源），可以放心承担次级导航。

**反模式**：在底栏挤新按钮、把"路线"塞进登录态 actionSheet 里（未登录用户也应该能看路线）、为单一新页面新建 tabBar 项（tabBar 只装真正的 4-5 个一级目的地）。

### 规则 33：跨页响应载荷必须用 JSON.parse<T[]>() 解嵌套对象列表

P4 Task 5 的 checkin.uvue 里有这一段：
```ts
const completedRoutes = extractCompletedRoutes(checkinResult!!)

function extractCompletedRoutes(res: UTSJSONObject): CompletedRouteNotice[] {
  const rawList = (res["data"] as UTSJSONObject)["completedRoutes"]
  if (rawList == null) return []
  // 必须 JSON.parse<T[]>()，不能 as CompletedRouteNotice[]
  const jsonStr = JSON.stringify(rawList)
  const parsed = JSON.parse<CompletedRouteNotice[]>(jsonStr)
  return parsed ?? []
}
```

**根因**（与 §九 法则 8 / §Phase 1.5/D 同源）：marker-center.checkin 的 `data.completedRoutes` 在 UTS 边界是 `Any`，强转 `as CompletedRouteNotice[]` 后访问 `.name / .reward` 属性时会触发 `ClassCastException: UTSJSONObject cannot be cast to CompletedRouteNotice`。

**唯一安全写法**：先 `JSON.stringify(raw)` 再 `JSON.parse<T[]>(jsonStr)`，泛型 parse 会真实构造 typed 实例。同款模式已在 `cloudSync.pullActiveRoutes` / `cloudSync.pullMyCheckins` / `storage.uts` 等 5 处使用。

**P4 Task 5 落地证据**：
- `pages/checkin/checkin.uvue` 弹"路线完成"toast 走的就是这条边界
- `utils/cloudSync.uts` 新增 `MyCheckinEntry.routes: MyCheckinRouteRef[]`，my-checkins 卡片渲染"属于 X 路线"小 tag 之前必须经过同款解析
- `pages/route-detail/route-detail.uvue` 通过 `pullActiveRoutes` 拿到的 `progress.doneMarkerIds` 也是嵌套 number[]，必须 typed parse

**反模式**：
1. `as Foo[]` —— 编译过但运行炸
2. `(res as UTSJSONObject)["data"] as Foo[]` —— 同上
3. 用 `for (const item of arr)` 遍历未 typed parse 的数组 —— 访问 `.id / .name` 属性时随机崩

### 规则 34：UTS 5.07 禁止 `Number(value)` / `Number.isFinite()`，用 parseInt / parseFloat / isNaN

P4 Task 3 的 `pages/route-detail/route-detail.uvue` 真机编译报错：
```
error: Cannot create an instance of an abstract class.
  if (Number(r.id) === routeId.value && found == null) {
       ^
error: Too many arguments for 'constructor(): Number'.
  const n = Number(idStr)
                  ^
```

**根因**：UTS 5.07 把 web JS 的 `Number(value)` 全局函数映射到 Kotlin 的 `Number` 类，并且这个类被声明为 abstract + 零参 constructor。任何 `Number(...)` 调用形式都会被编译器解析成"实例化抽象类"+"参数过多"双错。

**正解**：
| Web JS 写法 | UTS 5.07 替代 |
|---|---|
| `Number(str)` 把字符串转 int | `parseInt(str)` |
| `Number(str)` 把字符串转 float | `parseFloat(str)` |
| `Number.isFinite(n)` 检查数字有限 | `!isNaN(n)` |
| `Number.isInteger(n)` | 自己写 `n === Math.floor(n) && !isNaN(n)` |
| `Number(num)` 已经是 number 类型 | 直接用，**不需要任何转换** |

**同款审计**：写 .uvue / .uts 之前 grep `Number\(` 检查全仓库；admin .vue / cloudfunctions .js 不受影响（H5/Node 是真 JS 引擎，原生支持 Number 全局函数）。

**P4 Task 3 落地证据**：
- `pages/route-detail/route-detail.uvue` 真机编译失败，hotfix commit `1da9026` 把 `Number(r.id)` 删掉（r.id 已是 number），`Number(idStr)` 改为 `parseInt(idStr!!)`，`Number.isFinite(n)` 改为 `!isNaN(n)`。
- `cloudSync.uts` 里没有 Number() 调用（只用了 `as number` 类型断言，那是另一回事 OK 的）。

**反模式**：
1. `Number(stringValue)` —— 编译炸
2. `Number.isFinite(n)` / `Number.isInteger(n)` / `Number.parseFloat(s)` —— Number 静态成员在 UTS 里也不可用，统统换全局 `parseInt` / `parseFloat` / `isNaN`
3. 想"保险一点"双重转换 `parseInt(String(n))` —— 多此一举且 `String()` 在 5.07 同样有概率被解析成抽象类 constructor。直接用 `n.toString()` 实例方法

### 规则 35：首页地图浮动按钮必须和 marker-panel 互斥，避免覆盖可点击区

P5-B-UI 把原 `.bottom-toolbar` 白底栏拆成左下/右下两组 `position:absolute` 浮动按钮后，按钮本身不会再参与页面流式布局，因此 marker 详情面板弹出时如果不隐藏这些按钮，会压住面板底部的“打卡 / 删除”操作区。

标准写法：
- 左下 `.bl-stack`、右下 `.br-stack`、地图内 `.floating-add-btn` 都加 `v-if="activeMarker == null"`。
- stack 容器只能 `display:flex; flex-direction:column`，不要用 `gap`，子按钮用 `margin-bottom`。
- `.floating-add-btn` 的 `bottom` 与 stack 基线统一为 `64rpx`；如果未来 iOS home indicator 遮挡，再单独补 safe-area padding。
- 底栏相关 class 必须整段删除：`.bottom-toolbar` / `.bar-btn` / `.bar-label` / `.task-tone` / `.locate-tone`，避免旧样式残留把页面重新撑高。

这条不是 Kotlin 类型错误，而是 uni-app x 原生布局的可点击区风险：浮动层视觉上“看起来没问题”，真机触控时却会抢占 marker-panel 的按钮区域。

### 规则 36：CLI 编译依赖 HBuilderX 会话与项目导入状态；非 tabBar 页面不要用 switchTab

HBuilderX 5.07 CLI 的 `launch app-android --compile true` 不是独立 headless 编译器，它会连接正在运行的 HBuilderX 实例。若 HBuilderX 没打开、项目没导入项目列表，或同时需要验证 `map_new` 与 `uni-admin` 两个工程但只打开了其中一个，CLI 可能卡住或超时且没有诊断输出。

操作建议：
- 先打开 HBuilderX UI，并确保 `C:\Users\Raymond\Desktop\feinibuke\map_new` 已在项目列表中。
- 如果本轮还涉及后台管理，同步打开 `C:\Users\Raymond\Desktop\feinibuke\map_new\uni-admin`。
- CLI 可以作为辅助，但最终仍以 HBuilderX UI 的 Android 真机编译结果为准。
- 失败时优先看 HBuilderX 控制台/运行日志，不要把 CLI 超时当成代码编译失败。

同轮真机反馈还确认：`pages/route-detail/route-detail.uvue` 的“去这里”按钮当前 `requestFocus(local)` 后调用 `uni.switchTab({ url:'/pages/index/index' })`，但项目 `pages.json` 没有配置 tabBar，因此 `switchTab` 对首页不是正确导航 API，表现为点击无反应。非 tabBar 页面返回首页应改用本项目已验证的普通页面导航链路，例如 `uni.navigateBack()` 到上一层，或在无法确定栈时 `uni.reLaunch({ url:'/pages/index/index' })`，并保留 `requestFocus(local)` 让首页 `consumeFocus()` 聚焦 marker。

### 规则 37：App 跨页打开地图 marker 不要只靠 navigateBack；用持久化 focus payload + reLaunch 首页

P5.1 把路线详情“去这里”从 `switchTab` 改成 `navigateBack()` 后，真机反馈暴露了第二层问题：如果路线详情是从 `/pages/routes/routes` 进入的，`navigateBack()` 只会回到主题路线页，不会回到首页地图；`pages/my-checkins/my-checkins.uvue` 里“在地图上查看”仍然使用 `switchTab({ url:'/pages/index/index' })`，在无 tabBar 的 App 项目里同样无效。

**产品语义**：所有“在地图上查看 / 去这里 / 定位到打卡点”入口都应该回到 `/pages/index/index`，并直接打开 marker-panel，而不是回到调用页的上一层。

**标准模式**：
- 在 `stores/useMapStore.uts` 中维护统一 focus payload：`{ markerId, latitude, longitude, title }`。
- `requestFocusByMarker()` / `requestFocusById()` 同时写内存 ref 与 `uni.setStorageSync('pending_map_focus', JSON.stringify(payload))`；storage 兜底可以覆盖 `reLaunch` 后页面实例重建的情况。
- 跨页入口统一 `uni.reLaunch({ url:'/pages/index/index' })`，不要用 `switchTab`，也不要在目标不是首页时用 `navigateBack`。
- 首页 `onShow` 先 `consumeFocusPayload()`，必要时先 `syncFromCloud(uid)`，再 `moveToLocation(payload.latitude, payload.longitude, 16)` + `setActiveMarker(findById(payload.markerId))`。
- 保留旧 `requestFocus(marker)` 只做兼容；新增入口不要继续扩散旧 API。

**反模式**：
1. App 无 tabBar 仍调用 `uni.switchTab({ url:'/pages/index/index' })` —— 点击无反应或失败回调被忽略。
2. 从二级页 `navigateBack()` —— 只能回上一页，无法保证回首页地图。
3. 只写内存 focusTarget 后 `reLaunch` —— 页面/模块实例重建时可能丢 focus；storage payload 更稳。
# 2026-05-11 P5.2 补充：跨页聚焦导航已统一落地

App 侧没有 tabBar，所有“在地图上查看 / 去这里 / 定位到打卡点”的跨页入口都必须写入 `pending_map_focus` payload，然后 `uni.reLaunch({ url: '/pages/index/index' })`。首页 `pages/index/index.uvue` 在 `onShow` 统一 `consumeFocusPayload()`，必要时先 `syncFromCloud(uid)`，再 `moveToLocation()` 和 `setActiveMarker()`。

反模式：`switchTab('/pages/index/index')`、从二级页 `navigateBack()` 期望一定回首页、只写内存 focusTarget 不写 storage。


### Rule 38: Do not pass business marker ids directly to native map Marker.id

Android map marker ids must stay in a small SDK-safe integer range. App business marker ids can be timestamp-sized values, especially admin-created markers. Passing those ids directly into `<map :markers>` can make `markertap.detail.markerId` come back truncated or boxed differently, for example a real timestamp id becomes `215432543`; `findById()` then misses and the page falls into the "syncing" fallback.

Standard pattern:
- `CheckinMarker.id` remains the business id used by cloud data, checkins, routes, tasks, and focus payloads.
- The page builds map marker DTOs with `id: sdkMarkerIdForIndex(index)` where sdk id is `index + 1`.
- `onMarkerTap` treats `detail.markerId` as an SDK id only, then maps it back with `findBySdkMarkerId(sdkMarkerId)` to get the real `CheckinMarker`.
- Do not call `findById(detail.markerId)` for native map tap events.

This is an SDK boundary rule, not a data sync rule. If cloud sync logs say local/cloud counts match but tapping a cloud-created marker logs `marker tap id not found <large-or-truncated-number>`, check this boundary first.


### Rule 39: Focus navigation should reuse an existing index page before reLaunch

When a secondary page needs to focus a map marker on `/pages/index/index`, first write the focus payload, then call `returnToIndexForFocus()`. That helper scans `getCurrentPages()` for an existing index page and uses `uni.navigateBack({ delta })` when possible. Only use `uni.reLaunch({ url: '/pages/index/index' })` when no index page exists in the stack.

Reason: Android native map can briefly render a white surface when the index page is destroyed and recreated by `reLaunch`, especially while markers are also being refreshed. Reusing the existing index page keeps the map instance stable and reduces duplicate cloud sync work.

Anti-patterns:
- `requestFocusById(...)` followed by unconditional `uni.reLaunch({ url: '/pages/index/index' })` from pages that were opened from the homepage.
- Running marker sync in `App.uvue` token verification and again in `pages/index/index.uvue` onShow. Let the index page own marker sync so startup/focus flows do not triple-load.
