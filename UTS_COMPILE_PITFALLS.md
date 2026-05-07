# UTS 编译避坑指南 — uni-app x 地图打卡项目

> **Phase 1 实战验证（12+ 轮修复，30+ 编译错误）。所有条目均触发过真实编译错误并已修复。**

---

## 零、黄金法则（先读！）

| # | 法则 | 理由 |
|---|------|------|
| **1** | **永远用 `UTSJSONObject` + `["prop"]`** | `Record` = Kotlin `Map`；`any` 无 `.prop` 访问 |
| **2** | **永远直接 `export const/function`** | 不要 Pinia/defineStore/兼容层 — 所有都会在 UTS 中崩溃 |
| **3** | **永远 `as any as Type` 双 cast** | 单层 `as` 经常不够 |
| **4** | **模板中只用本地变量/函数** | 导入的 ref/fn 不可在模板中直接使用 |
| **5** | **用 Write 工具写文件** | PS `Set-Content` 截断 UTF-8 |

---

## 一、CSS 层

| # | 规则 | 错误示例 | 正确写法 |
|---|------|---------|---------|
| 1 | 禁止 `vh` | `min-height: 100vh` | `flex: 1` 或固定 px |
| 2 | `display` 仅 `flex`/`none` | `display: block` | 删除 |
| 3 | 仅 class 选择器 | `.parent text {}` | 给 `<text>` 加独立 class |
| 4 | 禁止 `gap` | `gap: 16rpx` | 子元素 `margin-right` |
| 5 | `font-weight` 有限值 | `font-weight: 300` | `font-weight: 400` |
| 6 | 禁止 `backdrop-filter` | `backdrop-filter: blur()` | 删除 |
| 7 | 禁止 `calc(var())` | `calc(20rpx + var(--h))` | 固定 px |
| 8 | **PS 编码陷阱** | `Set-Content` 截断中文 | **只用 Write 工具** |

---

## 二、UTS 语言层

| # | 规则 | 错误示例 | 正确写法 |
|---|------|---------|---------|
| 1 | 禁止内联对象字面量类型 | `Promise<{ size: number }>` | named type 或 `UTSJSONObject` |
| 2 | `\|\|`/`&&` 仅布尔 | `note \|\| null` | `note != '' ? note : null` |
| 3 | `!` 仅布尔 | `if (!marker)` | `if (marker == null)` |
| 4 | `if (nullable)` 不工作 | `if (photoPath)` | `if (photoPath != null)` |
| 5 | 可空必须 `?.` 或 `!!.` | `cloudMarker.id` | `cloudMarker!!.id` |
| 6 | 无 `undefined` | `let x = undefined` | boolean flag |
| 7 | `null` 不可赋值 `any` | `let x: any = null` | `UTSJSONObject\|null` |
| 8 | 无 `unknown` | `x as unknown as T` | `x as any as T` |
| 9 | `ref<any>(null)` 不可 | `ref<any>(null)` | `ref<UTSJSONObject\|null>(null)` |
| 10 | `String(n)` 不接受 number | `String(Date.now())` | `'' + Date.now()` |
| 11 | **`any` 无 `.prop` 访问** | `(x as any).prop` | `(x as UTSJSONObject)["prop"]` |
| 12 | **`any[]` 的 `[0]` = `String.get(0)`** | `(arr as any)[0]` | `(arr as string[])[0]` |
| 13 | 禁止泛型 `defineProps<T>()` | `defineProps<{a:Type}>()` | `defineProps({a:{type,required}})` |
| 14 | 禁止泛型 `defineEmits<T>()` | `defineEmits<(e)=>void>()` | `defineEmits(['name'])` |
| 15 | `Record<string,T>` = Map | `.prop` 不可用 | `UTSJSONObject` + `["prop"]` |
| 16 | 内联对象不匹配命名类型 | `func({ top: 1 })` | `const v: T = {...}` 再传入 |
| 17 | 函数不提升 | 定义在调用后 | 移到调用前 |
| 18 | **async 不可做 callback** | `success: async (res) =>` | `success: (res) =>` 同步 |
| 19 | `setTimeout(fn)` → fn 必须 `: void` | `setTimeout(() => go(), 100)` | `setTimeout((): void => { go() }, 100)` |

---

## 三、模板层（新增 — 全部来自实战）

| # | 规则 | 说明 |
|---|------|------|
| **1** | **导入的 ref/computed 模板中不可用** | `import { accuracyText }` → 模板 `{{ accuracyText }}` 报"找不到名称"。必须 import alias 到本地变量 |
| **2** | **导入的函数模板中不可调用** | `@click="zoomIn()"` 报 "Function invocation expected"。必须创建本地 wrapper `function doZoomIn() { zoomIn() }` |
| **3** | **模板中不调用导入的格式化函数** | `{{ formatDistance(x) }}` 报"找不到名称 invoke"。用 inline 表达式或预计算 |
| **4** | **`v-if` 后仍需 `!!.`** | `v-if="m != null"` 后 `{{ m.title }}` 仍报可空错误。需 `{{ m!!.title }}` |
| **5** | **`@click` 参数类型是 `Any?`** | `@click="fn(f.key)"` → fn 参数类型需 `any` |
| **6** | **不能 `@click="ref = value"`** | `@click="activeFilter = f.key"` 类型不匹配。需 wrapper `function setFilter(v) { ref.value = v }` |
| **7** | **`:class` 对象字面量可失败** | `:class="{ a: expr }"` 类型推断失败 → 用 computed 返回字符串 |

---

## 四、架构层

| # | 规则 | 说明 |
|---|------|------|
| **1** | **不用任何 Store 包装器** | 不用 `defineStore`/pinia-shim/compat 层。直接 `export const/function` |
| **2** | **页面直接 import store exports** | `import { addMarker } from '@/stores/useMarkerStore'` |
| **3** | `cover-view` 必须在 `<map>` 内 | 不可提取为独立组件 |
| **4** | `defineProps`/`defineEmits` option 语法 | 禁止泛型语法 |
| **5** | Write 工具写文件 | 避免 PS `Set-Content` |

---

## 五、常见编译错误速查

| 错误关键词 | 含义 | 解决 |
|-----------|------|------|
| `找不到名称 "xxx"` (模板中) | 导入的 ref/fn 模板不可用 | 创建本地 wrapper/alias |
| `找不到名称 "invoke"` | 模板中调用导入函数 | inline 表达式或本地 wrapper |
| `Function invocation ... expected` | 模板中调用导入函数 或 函数引用作为属性值 | lambda 包装或本地 wrapper |
| `找不到名称` (闭包内) | 闭包无法捕获外层函数 | 改用 computed 或重构 |
| `找不到名称 "confirm"` (callback) | `res.confirm` on `any` | `(res as UTSJSONObject)["confirm"]` |
| `找不到名称 "undefined"` | UTS 无 undefined | boolean flag |
| `Only safe (?.) or non-null (!!.)` | 可空非安全访问 | `!!.` 或 `?.` |
| `Condition type mismatch` | 非布尔条件 | `!= null` |
| `Null cannot be a value` | null→any | `UTSJSONObject\|null` |
| `Assignment type mismatch` | any→具体类型 | `as any as Type` |
| `Smart cast impossible` | 闭包变量修改 | 避免闭包内修改外部变量 |
| `Return type mismatch` | 返回类型不匹配 | `as any` |
| `Argument type mismatch` | 参数类型不匹配 | 显式 `const v: T` 或 `as any as T` |
| `Cannot infer type` | 泛型失败 | 去掉泛型 |
| `None of the following candidates` | API 不支持或参数错误 | 检查 `String()`/`Array.from()` |
| `property value not supported` | CSS 属性值 | 参考第一章 |
| `Element is missing end tag` | 编码损坏 | Write 重写 |
| `Selector is not supported` | CSS 选择器 | 纯 class |
| `cannot be invoked as a function` | 不支持的方法 | 手动循环 |

---

## 六、工作流建议

1. 用 Write 工具写文件，避免 PS/CMD 编码问题
2. 写完一个页面就编译一次
3. 以 Android 真机编译为准
4. 模板中只用本地变量/函数；导入的 ref/fn 创建本地 alias/wrapper
5. 遇到编译错误先查本文档
