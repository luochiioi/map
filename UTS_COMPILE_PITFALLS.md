# UTS 编译避坑指南 — uni-app x 地图打卡项目

> **本文档来自 Phase 1（会话 1-8）Android 真机编译实战验证。所有条目均在编译中触发过错误并已修复。后续各 Phase 及迭代写代码前务必遵守。**

---

## 一、CSS 层（`.uvue` 原生渲染）

| # | 规则 | 说明 | 错误示例 | 正确写法 |
|---|------|------|---------|---------|
| 1 | **禁止 `vh` 单位** | 原生渲染不支持 viewport 单位 | `min-height: 100vh` | 删除该行，用 `flex: 1` 撑满；或固定 px |
| 2 | **`display` 仅 `flex`/`none`** | 无 `block`/`inline`/`grid`/`inline-block` | `display: block` | 删除该行 |
| 3 | **仅 class 选择器** | 禁止后代选择器、标签选择器、属性选择器 | `.parent text {}` | 给 `<text>` 加独立 class：`.parent-text {}` |
| 4 | **禁止 `gap`** | flex gap 在 uvue 原生中不支持 | `gap: 16rpx` | 子元素加 `margin-right: 16rpx`，末子 `margin-right: 0` |
| 5 | **`font-weight` 有限值** | 仅 `normal`、`bold`、`400`、`500`、`600`、`700` | `font-weight: 300` | `font-weight: 400` |
| 6 | **禁止 `backdrop-filter`** | 原生无此 CSS 特性 | `backdrop-filter: blur(10px)` | 删除该行 |
| 7 | **禁止 `calc()` 含 `var()`** | 仅支持简单 `calc(px + px)` | `calc(20rpx + var(--h))` | 固定值如 `88rpx` |
| 8 | **禁止 `::v-deep`** | 穿透选择器不兼容 | `::v-deep .child {}` | 避免使用 |
| 9 | **PowerShell 编码陷阱** | `Set-Content` 默认 UTF-16 编码，会**截断多字节中文** | — | **只用 Write 工具写文件，不要用 PS 编辑 .uvue** |

---

## 二、UTS 语言层

| # | 规则 | 说明 | 错误示例 | 正确写法 |
|---|------|------|---------|---------|
| 1 | **禁止内联对象字面量类型** | 函数参数/返回值中 `{ key: Type }` 非法 | `Promise<{ size: number }>` | 定义 named type 或使用 `UTSJSONObject` |
| 2 | **`\|\|`/`&&` 仅布尔操作数** | 不可用短路运算符取非布尔值 | `note \|\| null` | `note != '' ? note : null` |
| 3 | **`!` 仅布尔操作数** | 不可对对象/数字/字符串取反 | `if (!marker)` | `if (marker == null)` |
| 4 | **可空类型必须安全访问** | 可能为 null 的变量属性访问必须用 `?.` 或 `!!.` | `cloudMarker.id` | `cloudMarker?.id` 或 `cloudMarker!!.id` |
| 5 | **`JSON.parse<T>()` 返回可空** | UTS 编译器认为 parse 返回 `T?`，需判空 | `JSON.parse<T>(s).prop` | `(JSON.parse(s) as T).prop` 且先判 null |
| 6 | **禁止泛型 `defineProps<T>()`** | UTS 无法推断类型参数，编译失败 | `defineProps<{ a: Type }>()` | `defineProps({ a: { type: X, required: true } })` |
| 7 | **禁止泛型 `defineEmits<T>()`** | 同上 | `defineEmits<(e,...)=>void>()` | `defineEmits(['eventName'])` |
| 8 | **`withDefaults` 不兼容** | 泛型问题同上 | `withDefaults(defineProps<T>(), {})` | 直接在 `defineProps` 中写 `default:` |
| 9 | **模板中 props 属性不解构** | option-style props 模板中不可直接 `.prop` | `{{ achievement.name }}` | 用 `computed` 暴露简单字符串/数字变量到模板 |
| 10 | **模板中不可内联复杂对象字面量** | `:class="{ a: expr }"` 类型推断失败 | `:class="{ a: true, b: !expr }"` | 用 `computed` 计算为字符串 |
| 11 | **`setTimeout` 在 Promise 中** | executor 须返回 void，setTimeout 返回 number | `new Promise(r => setTimeout(r,ms))` | `new Promise(r => { setTimeout(() => { r() }, ms) })` |
| 12 | **Pinia 模块不可用** | uniapp x 不内置 npm pinia 包 | `import { defineStore } from 'pinia'` | 本地 shim: `from './pinia-shim'` |
| 13 | **`as any` 完全不绕过属性检查** | `.prop` 和 `["prop"]` 均不可用于类型外属性 | `(x as any).unknownProp` | 无法访问类型定义之外的属性，删除该逻辑或扩展类型定义 |
| 14 | **`Array.from()` 不可用** | UTS 不支持 `Array.from(iterable)` | `Array.from(map.values())` | 手动 `forEach` + `push` 构建数组 |
| 15 | **内联对象字面量不匹配命名类型** | `func({ a: 1 })` 匿名类型 ≠ `T` 即使结构相同 | `setSafeArea({ top: 1 })` | 先声明 `const v: T = { ... }` 再传入 |

---

## 三、组件与架构层

| # | 规则 | 说明 |
|---|------|------|
| 1 | **`cover-view` 必须在 `<map>` 内** | 地图覆盖按钮/弹出层必须是 `<map>` 的直接子元素，不可提取为独立组件 |
| 2 | **子组件用 option-style defineProps** | 所有 `defineProps` 和 `defineEmits` 使用 option 语法，禁止泛型语法 |
| 3 | **Store 用本地 Pinia shim** | 项目中已创建 `stores/pinia-shim.uts`，所有 Store 从该文件导入 `defineStore` |
| 4 | **文件编码** | 所有 `.uvue`/`.uts` 文件用 Write 工具写入（确保 UTF-8），避免 PowerShell `Set-Content` |
| 5 | **`as any` 不能绕过属性名检查** | `(obj as any).unknownProp` 仍会报"找不到名称"，必须用 bracket 语法 `(obj as any)["unknownProp"]` |
| 6 | **`Array.from()` 不可用** | UTS 不支持 `Array.from(iterable)`，需手动 `forEach` + `push` 构建数组 |

---

## 四、常见编译错误速查

| 错误码/关键词 | 含义 | 解决 |
|-------------|------|------|
| `UTS110111120` | 条件非布尔类型 | 检查 `if`/`&&`/`\|\|`/`!`，改用显式布尔比较 |
| `UTS110111101` | 内联对象字面量类型 | 定义了 `{ key: Type }`，改为 named type 或 `UTSJSONObject` |
| `找不到名称 "xxx"` (变量) | 作用域内未定义变量/模块 | 检查 import、变量拼写、或用 computed |
| `找不到名称 "xxx"` (属性) | `as any` 不绕过属性名检查 | 用 bracket 访问：`(obj as any)["xxx"]` |
| `Cannot infer type` | 泛型类型推断失败 | 去掉泛型，使用显式类型标注 |
| `Only safe (?.) or non-null (!!.)` | 可空变量非安全访问 | 加 `?.` 或 `!!.` |
| `Return type mismatch` | 返回类型不匹配 | 检查 return 语句类型与函数签名一致 |
| `property value not supported` | CSS 属性值不合法 | 参考第一章 CSS 规则 |
| `Element is missing end tag` | 标签未闭合 | 检查 UTF-8 是否被截断，用 Write 重写文件 |
| `Selector is not supported` | CSS 选择器不合法 | 改为纯 class 选择器 |
| `cannot be invoked as a function` | 调用了 UTS 不支持的方法 | 检查 `Array.from`/迭代器等，改用手动循环 |

---

## 五、工作流建议

1. **写 `.uvue` 文件**：全部用 Write 工具直接写入，避免经过 PowerShell/CMD
2. **写完一个页面就编译一次**：不要攒到所有页面写完再编译，逐个排查
3. **先 Android 真机编译**：web 预览仅用于调试，最终编译以 Android 真机为准
4. **遇到编译错误先查本文档**：90% 的问题已在此记录
