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

### F. SDK 类型重名碰撞 — `<map :markers>` 反向推导导致 error17 ⚠️ 未解决(2026-05-07,5 轮失败)

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
