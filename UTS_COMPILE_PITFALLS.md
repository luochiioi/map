# UTS 编译避坑指南 — uni-app x 地图打卡项目

> **本文档来自 Phase 1（会话 1-8）Android 真机编译实战验证（截至第 10+ 轮修复，25+ 编译错误）。后续各 Phase 及迭代写代码前务必遵守。**

---

## 零、黄金法则（先读这个！）

| # | 法则 | 理由 |
|---|------|------|
| **1** | **永远用 `UTSJSONObject` + `["prop"]`，不用 `Record<string, T>`** | UTS 的 `Record` = Kotlin `Map`，不支持 `.prop` 和展开运算符 |
| **2** | **永远用直接 `export const/function`，不用 `defineStore`** | UTS 不支持 Pinia 模块，且泛型/闭包/any 均不可靠 |
| **3** | **永远用 `as any as Type` 双 cast 跨越类型屏障** | UTS 类型系统严格，单层 `as` 经常不够 |
| **4** | **所有函数引用必须 lambda 包装** | `{ fn: fn }` 触发 "Function invocation expected" |
| **5** | **用 Write 工具写文件，永远不用 PowerShell** | PS `Set-Content` 截断 UTF-8 多字节字符 |

---

## 一、CSS 层（`.uvue` 原生渲染）

| # | 规则 | 错误示例 | 正确写法 |
|---|------|---------|---------|
| 1 | 禁止 `vh` 单位 | `min-height: 100vh` | 删除，用 `flex: 1` 撑满 |
| 2 | `display` 仅 `flex`/`none` | `display: block` | 删除 |
| 3 | 仅 class 选择器（无后代/标签） | `.parent text {}` | 给 `<text>` 加独立 class |
| 4 | 禁止 `gap` | `gap: 16rpx` | 子元素 `margin-right` |
| 5 | `font-weight` 仅 normal/bold/400-700 | `font-weight: 300` | `font-weight: 400` |
| 6 | 禁止 `backdrop-filter` | `backdrop-filter: blur(10px)` | 删除 |
| 7 | 禁止 `calc()` 含 `var()` | `calc(20rpx + var(--h))` | 固定 px 值 |
| 8 | PowerShell 编码陷阱 | `Set-Content` 截断中文 | **只用 Write 工具写 .uvue** |

---

## 二、UTS 语言层（核心！）

| # | 规则 | 错误示例 | 正确写法 |
|---|------|---------|---------|
| **1** | **禁止内联对象字面量类型** | `Promise<{ size: number }>` | named type 或 `UTSJSONObject` |
| **2** | **`\|\|`/`&&` 仅布尔操作数** | `note \|\| null` | `note != '' ? note : null` |
| **3** | **`!` 仅布尔操作数** | `if (!marker)` | `if (marker == null)` |
| **4** | **`if (nullable)` 不工作** | `if (photoPath)` | `if (photoPath != null)` |
| **5** | **可空类型必须 `?.` 或 `!!.`** | `cloudMarker.id` | `cloudMarker?.id` |
| **6** | **无 `undefined` 关键字** | `let x = undefined` | boolean flag: `let inited = false` |
| **7** | **`null` 不可赋值 `any`** | `let x: any = null` | `let x: UTSJSONObject\|null = null` |
| **8** | **无 `unknown` 关键字** | `x as unknown as T` | `x as any as T` |
| **9** | **`ref<any>(null)` 不可用** | `ref<any>(null)` | `ref<UTSJSONObject\|null>(null)` |
| **10** | **`String(n)` 不接受 number** | `String(Date.now())` | `'' + Date.now()` |
| **9** | **禁止泛型 `defineProps<T>()`** | `defineProps<{a:Type}>()` | `defineProps({a:{type,required}})` |
| **10** | **禁止泛型 `defineEmits<T>()`** | `defineEmits<(e)=>void>()` | `defineEmits(['name'])` |
| **11** | **Pinia 模块不可用** | `from 'pinia'` | `from './pinia-shim'` |
| **12** | **`Record<string,any>` = Kotlin Map** | 不可 `.prop` 访问或展开运算符 | 参数：`UTSJSONObject` + `["prop"]` 访问；创建：`JSON.parse(JSON.stringify(x))` |
| **13** | **`as any` 不绕过属性检查** | 类型外属性 `.prop`/`["prop"]` 均失败 | 删除该逻辑或扩展类型定义 |
| **14** | **`Array.from()` 不可用** | `Array.from(map.values())` | 手动 `forEach` + `push` |
| **15** | **内联对象不匹配命名类型** | `setSafeArea({ top: 1 })` | `const v: T = {...}` 再传入 |
| **16** | **函数不提升（hoisting）** | 定义在调用之后 | 定义移到调用之前 |
| **17** | **返回对象中所有函数必须 lambda 包装** | `{ fn: fn }` 触发 "Function invocation expected" | `{ fn: ():void => { fn() } }` |
| **18** | **避免 `.then()/.catch()` 链** | Promise 回调类型推断失败 | async/await 或 fire-and-forget |

---

## 三、组件与架构层

| # | 规则 |
|---|------|
| 1 | `cover-view` 必须在 `<map>` 内，不可提取为独立组件 |
| 2 | 所有 `defineProps`/`defineEmits` 用 option 语法 |
| 3 | Store 从 `./pinia-shim` 导入 `defineStore` |
| 4 | 用 Write 工具写文件（UTF-8），不用 PS `Set-Content` |
| 5 | 返回对象中所有函数（含非 async）必须 `()=>{fn()}` 包装 |
| 6 | `Record<string,any>` 参数改用 `UTSJSONObject` + `["prop"]` |
| 7 | 函数定义在调用之前（UTS 不提升） |

---

## 四、常见编译错误速查

| 错误关键词 | 含义 | 解决 |
|-----------|------|------|
| `UTS110111120` | 条件非布尔 | 改用 `!= null` 或显式 `=== true` |
| `UTS110111101` | 内联对象字面量类型 | 改为 named type 或 `UTSJSONObject` |
| `找不到名称 "xxx"` (变量) | import 缺失 | 检查 import |
| `找不到名称 "xxx"` (函数) | hoisting 问题 | 移到调用前 |
| `找不到名称 "undefined"` | UTS 无 undefined | boolean flag |
| `找不到名称 "xxx"` (闭包内) | 闭包无法捕获外层局部函数 | 改用 computed 或重构 |
| `Cannot infer type` | 泛型失败 | 去掉泛型 |
| `Function invocation ... expected` | 函数引用作为属性值 | 包在 lambda 中 |
| `Only safe (?.) or non-null (!!.)` | 可空非安全访问 | 加 `?.` 或 `!!.` |
| `Return type mismatch` | 返回类型不匹配 | 检查签名或加 `as any` |
| `Condition type mismatch` | 非布尔条件 | `if (x != null)` |
| `Null cannot be a value` | null→any | 改用 `UTSJSONObject\|null` |
| `Initializer type mismatch` | Record/Map/UTSJSONObject 混淆 | 用 JSON.parse 转换 |
| `Smart cast impossible` | 闭包变量修改 | 避免闭包内修改外部变量 |
| `None of the following candidates` | 函数调用参数不匹配 | 检查 `String()`/`Array.from()` 支持 |
| `property value not supported` | CSS 属性值 | 参考第一章 |
| `Element is missing end tag` | 标签未闭合/编码损坏 | Write 重写文件 |
| `Selector is not supported` | CSS 选择器 | 纯 class 选择器 |
| `cannot be invoked as a function` | 不支持的方法 | 改用手动循环 |
| `Argument type mismatch` | 内联对象不匹配命名类型 | 显式声明 `const v: T` |

---

## 五、工作流建议

1. 用 Write 工具写文件，避免 PS/CMD 编码问题
2. 写完一个页面就编译一次，逐个排查
3. 以 Android 真机编译为准，web 预览仅用于调试
4. 遇到编译错误先查本文档
