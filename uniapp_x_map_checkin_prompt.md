
# 地图打卡应用 — uniapp x 重写完整提示词

> **目标**：将现有的 uniapp (Vue 3) 地图打卡应用，用 **uniapp x 架构** 完整重写，编译为 Android 原生应用，确保 GPS 定位、地图交互、拍照打卡等功能在真机上流畅运行。
>
> **原始项目位置**：`C:\Users\Raymond\Desktop\feinibuke\map_visit_demo`
>
> **新项目位置**：`C:\Users\Raymond\Desktop\feinibuke\map_new`

---

## 一、项目概述

### 1.1 原始项目功能清单

| 功能 | 原始实现位置 | 说明 |
|------|------------|------|
| 全屏地图 + 标记点 | `pages/index/index.vue` | 腾讯地图 H5 / 原生地图 |
| 实时 GPS 定位追踪 | `pages/index/index.vue` | `startLocationUpdate` + `onLocationChange` |
| Haversine 距离计算 | `utils/index.js`, `utils/coordinate.js` | 500m 打卡半径，精度差时自适应放宽至 700m |
| WGS-84 ↔ GCJ-02 坐标转换 | `utils/coordinate.js` | 火星坐标转换 |
| 拍照打卡 | `pages/checkin/checkin.vue` | 相机/相册选择，>1MB 自动压缩 |
| 新增打卡点 | `pages/add-marker/add-marker.vue` | 地图中心 / 当前位置 / 手动输入 |
| 打卡点列表 | `pages/tasks/tasks.vue` | 全部/待打卡/已打卡 筛选 |
| 统计页 | `pages/stats/stats.vue` | 完成率进度条、时间线 |
| 任务系统 | `utils/tasks.js` | 6 个预定义任务，绑定特定打卡点 |
| 成就徽章 | `pages/tasks/tasks.vue` | 7 种徽章（计算属性） |
| 本地数据持久化 | `utils/storage.js` | `uni.setStorageSync` |
| 跨页面通信 | `pages/index/index.vue` | `uni.$emit` / `uni.$once` |

### 1.2 原始技术栈

- **框架**：uniapp (Vue 3) — 编译为 H5 / 微信小程序 / App
- **语言**：JavaScript（Option API + Composition API 混用）
- **样式**：SCSS（uni.scss 变量）
- **地图**：腾讯地图（H5）/ 原生 map 组件（App）
- **存储**：localStorage / uni.setStorageSync
- **云端**：uniCloud 阿里云（需完整集成：数据库、云对象、云存储、uni-id 用户认证）

### 1.3 目标技术栈 (uniapp x)

- **框架**：uniapp x — 编译为纯原生 Android 应用
- **语言**：UTS（Uni TypeScript）— TypeScript 的超集，编译为 Kotlin
- **文件格式**：`.uvue` 单文件组件（替代 `.vue`）
- **渲染**：原生渲染（无 WebView，无 JS Bridge）
- **状态管理**：Pinia（替代分散的 localStorage 读写）
- **地图**：原生 `<map>` 组件（编译为 Android MapView）
- **存储**：`uni.setStorageSync` → Android SharedPreferences
- **构建**：HBuilderX 云打包 或 Android Studio

### 1.4 完整产品定位（迭代终局）

> **核心理念**：步行打卡 + 城市文化 + 电子宠物 + 双城剧情 的休闲互动 APP

| 维度 | 内容 |
|------|------|
| **目标用户** | 18-35 岁年轻群体 |
| **核心价值** | 绿色出行、文旅体验、情感陪伴 |
| **双城** | 澳门 + 长沙，双主线并行，最终交汇 |
| **差异化** | 双城联动、剧情故事、自有 IP、文化结合 |
| **参考竞品** | 港澳地区爆款步行打卡 APP（操作逻辑对齐，降低学习成本） |
| **主线故事** | 《一念归期》— 澳门线 + 长沙线 → 交汇结局 |

**三种打卡模式**：

| 模式 | 适用场景 | 核心机制 |
|------|---------|---------|
| 好友异地联动 | 两个人分别在澳门和长沙 | 输入同一组队码，同时到达对应打卡点 → 触发双城联动剧情 |
| NPC 陪伴模式 | 没有好友，单人游玩 | 自定义 NPC 形象，到打卡点触发小游戏 → 激活 NPC → 陪伴体验双城剧情 |
| 单人独立打卡 | 只在一个城市游玩 | 按顺序完成本地打卡点，跨城后继续补完剧情，进度自动保存 |

**出行规则**：

| 城市 | 交通方式 |
|------|---------|
| 澳门 | 仅步行 |
| 长沙 | 步行 + 骑行 |

**剧情触发方式**：

| 方式 | 说明 |
|------|------|
| 实时触发 | AR 形象出现在真实场景中（仅当下显示） |
| 汇总触发 | 完成一段路线后，系统自动生成完整小动画 |

**电子宠物系统**：

| 要素 | 说明 |
|------|------|
| 初始宠物 | 注册即获"奥喵" |
| 资源获取 | 步行步数 → 猫粮、道具、装扮 |
| 升级解锁 | 猫 → 狗等更多形象 |
| 与打卡挂钩 | 宠物等级关联打卡进度，提升使用频率 |

> ⚠️ **本节为迭代终局愿景**。当前阶段（Phase 1）先完成基础地图打卡功能。上述三种模式、剧情系统、AR、电子宠物等属于后续迭代（Phase 2-4），详见第十六章《迭代路线图》。

---

## 二、项目结构（完整目录树）

```
map_new/
├── App.uvue                          # 应用根组件
├── main.uts                          # 入口脚本（创建 App + 注册 Pinia）
├── manifest.json                     # Android 权限、地图 SDK 配置
├── pages.json                        # 页面路由定义
├── uni.scss                          # 全局 SCSS 变量
│
├── pages/
│   ├── index/
│   │   └── index.uvue                # 主地图页（约 400 行）
│   ├── stats/
│   │   └── stats.uvue                # 旅行统计页（约 300 行）
│   ├── checkin/
│   │   └── checkin.uvue              # 拍照打卡页（约 400 行，含云端上传）
│   ├── add-marker/
│   │   └── add-marker.uvue           # 新增打卡点页（约 250 行）
│   ├── tasks/
│   │   └── tasks.uvue                # 任务+列表+成就+迷你地图（约 400 行）
│   ├── task-detail/
│   │   └── task-detail.uvue          # 任务详情页（约 200 行）
│   └── login/
│       └── login.uvue                # 【新增】登录/注册页（约 200 行）
│
├── stores/                           # Pinia 状态管理（6 个 Store）
│   ├── useMarkerStore.uts            # 打卡点 CRUD、打卡操作、筛选、云端同步
│   ├── useLocationStore.uts          # GPS 状态、追踪、距离计算
│   ├── useTaskStore.uts              # 任务定义、进度、奖励
│   ├── useAchievementStore.uts       # 成就徽章（纯计算属性）
│   ├── useMapStore.uts               # 地图视图状态、焦点标记
│   └── useUserStore.uts              # 【新增】用户认证状态、登录/注册
│
├── utils/                            # 工具函数（5 个模块）
│   ├── coordinate.uts               # WGS-84 ↔ GCJ-02 转换 + Haversine
│   ├── storage.uts                  # SharedPreferences 封装层
│   ├── cloudSync.uts               # 【新增】云端数据同步（pull/push/sync）
│   ├── defaults.uts                 # 默认数据（8 个打卡点、6 个任务）
│   └── format.uts                   # 日期/距离/坐标格式化
│
├── types/                            # UTS 类型定义（6 个文件）
│   ├── marker.uts                   # Marker 接口（新增 photoCloudURL 等云端字段）
│   ├── task.uts                     # Task、Reward 接口（新增 userId 字段）
│   ├── achievement.uts              # Achievement 接口
│   ├── location.uts                 # LocationData 接口
│   ├── user.uts                     # 【新增】用户类型（含角色枚举）
│   └── app.uts                      # 通用类型
│
├── components/                       # 可复用 UI 组件（5 个）
│   ├── MapTools.uvue                # 地图覆盖按钮组
│   ├── BottomSheet.uvue             # 标记详情底部弹出
│   ├── BadgeCard.uvue               # 成就徽章卡片
│   ├── ProgressBar.uvue             # 动画进度条
│   └── PhotoPicker.uvue             # 拍照/相册选择 + 云端上传
│
├── static/                           # 静态资源
│   ├── logo.png
│   ├── marker_default.png
│   └── marker_checked.webp
│
├── uniCloud-aliyun/                  # 【保留并增强】云端服务
│   ├── cloudfunctions/
│   │   ├── markers/                  # 打卡点 CRUD（增强：权限校验、打卡业务）
│   │   │   ├── index.js
│   │   │   └── package.json
│   │   ├── photo-upload/             # 【新增】照片云存储上传
│   │   │   ├── index.js
│   │   │   └── package.json
│   │   └── admin/                    # 【新增】后台管理专用接口
│   │       ├── index.js
│   │       └── package.json
│   └── database/
│       ├── tourism_markers.schema.json    # 打卡点（更新：按角色控制权限）
│       ├── tourism_tasks.schema.json      # 任务定义
│       ├── user_tasks.schema.json         # 用户任务进度（新增 userId 索引）
│       ├── rewards.schema.json            # 奖励记录
│       ├── users.schema.json              # 【新增】用户扩展信息
│       └── JQL查询.jql
│
└── uni-admin/                        # 【新增】Web 后台管理项目
    ├── pages/
    │   ├── dashboard/index.vue       # 数据概览仪表盘
    │   ├── markers/                  # 打卡点管理（CRUD + 地图选点）
    │   ├── checkins/                 # 打卡记录查看
    │   ├── users/                    # 用户管理
    │   └── tasks/                    # 任务管理
    ├── pages.json
    └── manifest.json
```

---

## 三、类型定义（types/）

### 3.1 `types/marker.uts`

```typescript
export interface Marker {
  id: number           // 唯一 ID（新标记用 Date.now()）
  _id: string          // 字符串 ID（兼容旧数据）
  title: string        // 打卡点名称
  latitude: number     // GCJ-02 纬度
  longitude: number    // GCJ-02 经度
  checked: boolean     // 是否已打卡
  width: number        // 标记宽度（默认 36）
  height: number       // 标记高度（默认 36）
  iconPath: string     // 标记图标路径（本地静态资源）
  checkedAt?: number   // 打卡时间戳（毫秒）
  photoPath?: string   // 打卡照片路径
  note?: string        // 打卡备注（最多 200 字）
  createdAt: number    // 创建时间戳
}

export interface NewMarkerInput {
  title: string
  latitude: number
  longitude: number
}

export interface MarkerLabel {
  content: string
  color: string
  fontSize: number
  borderRadius: number
  bgColor: string
  padding: number
}
```

### 3.2 `types/location.uts`

```typescript
export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number      // GPS 精度（米），0 表示未知
}

export type AccuracyLevel = 'unknown' | 'good' | 'mid' | 'bad'
// good: < 30m, mid: 30-100m, bad: > 100m
```

### 3.3 `types/task.uts`

```typescript
export type TaskStatus = 'pending' | 'completed'

export interface Task {
  id: string              // 如 'task_001'
  name: string            // 任务名称
  description: string     // 任务描述
  targetTitle: string     // 目标打卡点名称（用于匹配）
  targetMarkerId: number  // 目标打卡点 ID（优先匹配）
  reward: string          // 奖励描述（如 '10 积分'）
  status: TaskStatus
  completedAt: number | null
}

export interface Reward {
  id: string              // 唯一奖励 ID
  taskId: string
  taskName: string
  reward: string
  earnedAt: number
}
```

### 3.4 `types/achievement.uts`

```typescript
export interface Achievement {
  id: string       // 'first' | 'three' | 'five' | 'ten' | 'photo' | 'create' | 'alltask'
  icon: string     // 表情符号
  name: string     // 中文名称
  desc: string     // 解锁描述
  unlocked: boolean
}
```

### 3.5 `types/app.uts`

```typescript
export type FilterMode = 'all' | 'pending' | 'done'

export interface FilterOption {
  key: FilterMode
  label: string
}
```

---

## 四、工具函数（utils/）

### 4.1 `utils/coordinate.uts` — 坐标转换与距离计算

从原始 `utils/coordinate.js` 移植，所有函数保持相同的数学逻辑，但添加 UTS 类型标注：

```typescript
// 核心函数
export function wgs84ToGcj02(lng: number, lat: number): { lng: number; lat: number }
export function gcj02ToWgs84(lng: number, lat: number): { lng: number; lat: number }
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number  // 返回米
export function calculateDistanceWithAccuracy(lat1: number, lng1: number, lat2: number, lng2: number): number

// 内部辅助
function isOutOfChina(lng: number, lat: number): boolean
function transformLat(x: number, y: number): number
function transformLng(x: number, y: number): number
```

### 4.2 `utils/storage.uts` — 持久化封装

封装 `uni.getStorageSync` / `uni.setStorageSync`，提供类型安全的泛型接口：

```typescript
export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = uni.getStorageSync(key)
    if (raw) return raw as T
  } catch (e) { /* 忽略 */ }
  return fallback
}

export function setJSON<T>(key: string, value: T): void {
  uni.setStorageSync(key, value)
}

export function loadMarkers(): Marker[] { return getJSON<Marker[]>('tourism_markers', []) }
export function saveMarkers(markers: Marker[]): void { setJSON('tourism_markers', markers) }
export function loadTasks(): Task[] { return getJSON<Task[]>('task_list', []) }
export function saveTasks(tasks: Task[]): void { setJSON('task_list', tasks) }
export function loadUserTasks(): Record<string, { status: string; completedAt: number }> { ... }
export function saveUserTasks(ut: Record<string, any>): void { ... }
export function loadRewards(): Reward[] { return getJSON<Reward[]>('rewards', []) }
export function saveRewards(rewards: Reward[]): void { setJSON('rewards', rewards) }
```

### 4.3 `utils/defaults.uts` — 默认数据

从原始 `utils/index.js` 的 `getDefaultMarkers()` 和 `utils/tasks.js` 的 `getDefaultTasks()` 移植：

```typescript
import type { Marker } from '@/types/marker'
import type { Task } from '@/types/task'

export function getDefaultMarkers(): Marker[] {
  return [
    { id: 1, _id: '1', title: '北京故宫', latitude: 39.9163, longitude: 116.3972, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
    { id: 2, _id: '2', title: '上海迪士尼', latitude: 31.1465, longitude: 121.6593, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
    { id: 3, _id: '3', title: '长沙岳麓书院', latitude: 28.1836, longitude: 112.9388, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
    { id: 4, _id: '4', title: '澳门大三巴', latitude: 22.1979, longitude: 113.5413, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
    { id: 5, _id: '5', title: '长沙橘子洲', latitude: 28.1968, longitude: 112.9625, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
    { id: 6, _id: '6', title: '广州塔', latitude: 23.1065, longitude: 113.3246, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
    { id: 7, _id: '7', title: '中山大学东校区', latitude: 23.0622, longitude: 113.3894, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
    { id: 8, _id: '8', title: '北京交通大学', latitude: 39.9505, longitude: 116.3474, checked: false, width: 36, height: 36, iconPath: '/static/marker_default.png', createdAt: Date.now() },
  ]
}

export function getDefaultTasks(): Task[] {
  return [
    { id: 'task_001', name: '故宫探索者', description: '打卡北京故宫', targetTitle: '北京故宫', targetMarkerId: 1, reward: '10 积分', status: 'pending', completedAt: null },
    { id: 'task_002', name: '魔都奇遇', description: '打卡上海迪士尼乐园', targetTitle: '上海迪士尼', targetMarkerId: 2, reward: '15 积分', status: 'pending', completedAt: null },
    { id: 'task_003', name: '湖湘文化之旅', description: '打卡长沙岳麓书院', targetTitle: '长沙岳麓书院', targetMarkerId: 3, reward: '12 积分', status: 'pending', completedAt: null },
    { id: 'task_004', name: '澳门印象', description: '打卡澳门大三巴牌坊', targetTitle: '澳门大三巴', targetMarkerId: 4, reward: '12 积分', status: 'pending', completedAt: null },
    { id: 'task_005', name: '橘洲打卡', description: '打卡长沙橘子洲头', targetTitle: '长沙橘子洲', targetMarkerId: 5, reward: '10 积分', status: 'pending', completedAt: null },
    { id: 'task_006', name: '广州塔挑战', description: '登顶广州塔打卡', targetTitle: '广州塔', targetMarkerId: 6, reward: '10 积分', status: 'pending', completedAt: null },
  ]
}
```

### 4.4 `utils/format.uts` — 格式化函数

从原始 `utils/index.js` 的 `formatDateTime()` 和 `formatDistance()` 移植：

```typescript
export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => n < 10 ? '0' + n : String(n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDistance(val: number): string {
  if (val < 1000) return Math.round(val) + 'm'
  // 大于 1000 米显示千米
  return (val / 1000).toFixed(2) + 'km'
}

export function formatCoordinate(val: number | null | undefined, precision: number = 6): string {
  if (val == null) return '--'
  return val.toFixed(precision)
}
```

---

## 五、Pinia 状态管理（stores/）

### 5.1 `stores/useMarkerStore.uts` — 打卡点状态

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Marker, NewMarkerInput } from '@/types/marker'
import { loadMarkers, saveMarkers } from '@/utils/storage'
import { getDefaultMarkers } from '@/utils/defaults'

export const useMarkerStore = defineStore('markers', () => {
  // ===== 状态 =====
  const markers = ref<Marker[]>([])
  const isLoading = ref<boolean>(false)

  // ===== 计算属性 =====
  const checkedMarkers = computed(() => markers.value.filter(m => m.checked))
  const pendingMarkers = computed(() => markers.value.filter(m => !m.checked))
  const totalCount = computed(() => markers.value.length)
  const doneCount = computed(() => checkedMarkers.value.length)
  const completionRate = computed(() =>
    totalCount.value === 0 ? 0 : Math.round((doneCount.value / totalCount.value) * 100)
  )

  // 传递给 <map :markers=""> 的数据，已打卡标记自动添加 ✓ label
  const displayMarkers = computed(() =>
    markers.value.map(m => {
      const base: Record<string, any> = { ...m }
      if (m.checked) {
        base.label = {
          content: '✓',
          color: '#34c759',
          fontSize: 13,
          borderRadius: 10,
          bgColor: '#e6f9ed',
          padding: 4
        }
        base.iconPath = '/static/marker_checked.png'
      }
      return base
    })
  )

  // ===== 操作 =====
  async function loadFromStorage(): Promise<void> {
    isLoading.value = true
    let stored = loadMarkers()
    if (stored.length === 0) {
      stored = getDefaultMarkers()
      saveMarkers(stored)
    }
    markers.value = stored
    isLoading.value = false
  }

  function persist(): void {
    saveMarkers(markers.value)
  }

  async function addMarker(input: NewMarkerInput): Promise<Marker> {
    const marker: Marker = {
      id: Date.now(),
      _id: String(Date.now()),
      title: input.title,
      latitude: input.latitude,
      longitude: input.longitude,
      checked: false,
      width: 36,
      height: 36,
      iconPath: '/static/marker_default.png',
      createdAt: Date.now()
    }
    markers.value.push(marker)
    persist()
    return marker
  }

  async function doCheckIn(markerId: number, photoPath: string | null, note: string | null): Promise<Marker> {
    const idx = markers.value.findIndex(m => m.id === markerId)
    if (idx === -1) throw new Error('Marker not found: ' + markerId)
    markers.value[idx].checked = true
    markers.value[idx].checkedAt = Date.now()
    markers.value[idx].iconPath = '/static/marker_checked.png'
    if (photoPath) markers.value[idx].photoPath = photoPath
    if (note) markers.value[idx].note = note
    persist()
    return markers.value[idx]
  }

  async function deleteMarker(markerId: number): Promise<void> {
    markers.value = markers.value.filter(m => m.id !== markerId)
    persist()
  }

  function findById(id: number): Marker | undefined {
    return markers.value.find(m => m.id === id)
  }

  function findByTitle(title: string): Marker | undefined {
    return markers.value.find(m => m.title === title)
  }

  return {
    markers, isLoading,
    checkedMarkers, pendingMarkers, totalCount, doneCount, completionRate, displayMarkers,
    loadFromStorage, persist, addMarker, doCheckIn, deleteMarker,
    findById, findByTitle
  }
})
```

### 5.2 `stores/useLocationStore.uts` — GPS 定位状态

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LocationData, AccuracyLevel } from '@/types/location'
import { calculateDistance as haversine } from '@/utils/coordinate'

export const useLocationStore = defineStore('location', () => {
  const currentLocation = ref<LocationData | null>(null)
  const accuracy = ref<number>(0)
  const isTracking = ref<boolean>(false)
  let pollTimerId: number = 0

  // ===== 计算属性 =====
  const accuracyLevel = computed<AccuracyLevel>(() => {
    if (accuracy.value <= 0) return 'unknown'
    if (accuracy.value < 30) return 'good'
    if (accuracy.value <= 100) return 'mid'
    return 'bad'
  })

  const accuracyText = computed<string>(() => {
    if (accuracy.value <= 0) return '定位中...'
    const m = Math.round(accuracy.value)
    if (accuracy.value < 30) return `${m}m 精度佳`
    if (accuracy.value <= 100) return `${m}m 精度中`
    return `${m}m 精度差`
  })

  // ===== 操作 =====
  function startTracking(): void {
    isTracking.value = true
    uni.startLocationUpdate({
      type: 'gcj02',
      success: () => {},
      fail: () => {
        // 降级：单次获取
        uni.getLocation({
          type: 'gcj02',
          isHighAccuracy: true,
          highAccuracyExpireTime: 6000,
          success: (res: any) => applyLocation(res)
        })
      }
    })
    uni.onLocationChange((res: any) => applyLocation(res))
  }

  function stopTracking(): void {
    isTracking.value = false
    uni.offLocationChange()
    uni.stopLocationUpdate()
  }

  function applyLocation(res: Record<string, any>): void {
    const acc: number = res.accuracy ?? 0
    accuracy.value = acc
    // 丢弃精度非常差的定位结果（>150m）
    if (acc > 150) return
    currentLocation.value = {
      latitude: res.latitude as number,
      longitude: res.longitude as number,
      accuracy: acc
    }
  }

  function pollLocationOnce(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 6000,
        success: (res: any) => {
          const loc: LocationData = {
            latitude: res.latitude as number,
            longitude: res.longitude as number,
            accuracy: res.accuracy ?? 0
          }
          accuracy.value = loc.accuracy
          currentLocation.value = loc
          resolve(loc)
        },
        fail: (err: any) => reject(err)
      })
    })
  }

  function startPolling(intervalMs: number): void {
    const poll = (): void => {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 6000,
        success: (res: any) => applyLocation(res)
      })
    }
    poll() // 立即执行一次
    pollTimerId = setInterval(poll, intervalMs) as unknown as number
  }

  function stopPolling(): void {
    if (pollTimerId) {
      clearInterval(pollTimerId)
      pollTimerId = 0
    }
  }

  function distanceTo(lat: number, lng: number): number | null {
    if (!currentLocation.value) return null
    return haversine(
      currentLocation.value.latitude,
      currentLocation.value.longitude,
      lat, lng
    )
  }

  return {
    currentLocation, accuracy, isTracking,
    accuracyLevel, accuracyText,
    startTracking, stopTracking, applyLocation,
    pollLocationOnce, startPolling, stopPolling,
    distanceTo
  }
})
```

### 5.3 `stores/useTaskStore.uts` — 任务系统

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, Reward } from '@/types/task'
import type { Marker } from '@/types/marker'
import { getDefaultTasks } from '@/utils/defaults'
import { loadTasks, saveTasks, loadUserTasks, saveUserTasks, loadRewards, saveRewards } from '@/utils/storage'

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const userTasks = ref<Record<string, { status: string; completedAt: number }>>({})
  const rewards = ref<Reward[]>([])

  const completedTaskCount = computed(() => tasks.value.filter(t => t.status === 'completed').length)
  const totalTaskCount = computed(() => tasks.value.length)

  function loadFromStorage(): void {
    let stored = loadTasks()
    if (stored.length === 0) {
      stored = getDefaultTasks()
      saveTasks(stored)
    }
    const ut = loadUserTasks()
    tasks.value = stored.map(t => {
      const progress = ut[t.id]
      if (progress && progress.status === 'completed') {
        return { ...t, status: 'completed' as const, completedAt: progress.completedAt }
      }
      return t
    })
    userTasks.value = ut
    rewards.value = loadRewards()
  }

  function persist(): void {
    saveTasks(tasks.value)
    saveUserTasks(userTasks.value)
    saveRewards(rewards.value)
  }

  // 检查打卡是否完成某个任务
  function checkTaskCompletion(marker: Marker): Task[] {
    const completed: Task[] = []
    tasks.value.forEach(task => {
      if (task.status === 'completed') return
      const match = task.targetMarkerId === marker.id || task.targetTitle === marker.title
      if (!match) return
      task.status = 'completed'
      task.completedAt = Date.now()
      userTasks.value[task.id] = { status: 'completed', completedAt: task.completedAt }
      const reward: Reward = {
        id: `reward_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        taskId: task.id,
        taskName: task.name,
        reward: task.reward,
        earnedAt: task.completedAt
      }
      rewards.value.push(reward)
      completed.push(task)
    })
    if (completed.length > 0) persist()
    return completed
  }

  function findTaskById(id: string): Task | undefined {
    return tasks.value.find(t => t.id === id)
  }

  return {
    tasks, userTasks, rewards,
    completedTaskCount, totalTaskCount,
    loadFromStorage, persist, checkTaskCompletion, findTaskById
  }
})
```

### 5.4 `stores/useAchievementStore.uts` — 成就系统（纯计算）

```typescript
import { defineStore } from 'pinia'
import { computed } from 'vue'
import type { Achievement } from '@/types/achievement'
import { useMarkerStore } from './useMarkerStore'
import { useTaskStore } from './useTaskStore'

export const useAchievementStore = defineStore('achievements', () => {
  function getAchievements(): Achievement[] {
    const markerStore = useMarkerStore()
    const taskStore = useTaskStore()
    const done = markerStore.checkedMarkers
    const photo = done.filter(m => m.photoPath)
    // 注意：totalCount 包含用户自己添加的打卡点；但"创建者"徽章
    // 应只计算用户自主添加的非默认打卡点，这里用 totalCount - 8 近似
    const userCreated = Math.max(0, markerStore.totalCount - 8)

    return [
      { id: 'first',   icon: '🥾', name: '初探者',  desc: '完成首次打卡',    unlocked: done.length >= 1 },
      { id: 'three',   icon: '🗺️', name: '探索者',   desc: '打卡 3 个地点',   unlocked: done.length >= 3 },
      { id: 'five',    icon: '🏔️', name: '冒险家',   desc: '打卡 5 个地点',   unlocked: done.length >= 5 },
      { id: 'ten',     icon: '🌟', name: '传奇旅人', desc: '打卡 10 个地点',  unlocked: done.length >= 10 },
      { id: 'photo',   icon: '📸', name: '摄影师',   desc: '3 次带照片打卡',  unlocked: photo.length >= 3 },
      { id: 'create',  icon: '📍', name: '创建者',   desc: '创建 5 个打卡点', unlocked: userCreated >= 5 },
      { id: 'alltask', icon: '🎯', name: '全勤达人', desc: '完成所有任务',
        unlocked: taskStore.totalTaskCount > 0 && taskStore.completedTaskCount === taskStore.totalTaskCount },
    ]
  }

  const achievements = computed(() => getAchievements())
  const unlockedCount = computed(() => achievements.value.filter(a => a.unlocked).length)

  return { achievements, unlockedCount }
})
```

### 5.5 `stores/useMapStore.uts` — 地图视图状态

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Marker } from '@/types/marker'

export const useMapStore = defineStore('map', () => {
  const latitude = ref<number>(39.9163)         // 当前显示纬度
  const longitude = ref<number>(116.3972)        // 当前显示经度
  const scale = ref<number>(12)                  // 缩放级别 (3-20)
  const activeMarker = ref<Marker | null>(null)  // 当前选中的标记
  const mapCenterLat = ref<number>(39.9163)      // 地图中心纬度
  const mapCenterLng = ref<number>(116.3972)     // 地图中心经度
  const mapContext = ref<any>(null)              // 原生 map 上下文对象
  // 跨页面焦点请求（替代 uni.$emit）
  const focusTarget = ref<Marker | null>(null)

  function setActiveMarker(marker: Marker | null): void {
    activeMarker.value = marker
    if (marker) {
      latitude.value = marker.latitude
      longitude.value = marker.longitude
    }
  }

  function zoomIn(): void {
    if (scale.value < 20) scale.value++
  }

  function zoomOut(): void {
    if (scale.value > 3) scale.value--
  }

  function moveToLocation(lat: number, lng: number, targetScale: number = 16): void {
    latitude.value = lat
    longitude.value = lng
    scale.value = targetScale
  }

  function onRegionChangeEnd(centerLat: number, centerLng: number): void {
    mapCenterLat.value = centerLat
    mapCenterLng.value = centerLng
  }

  // 跨页面聚焦：任务详情页调用，地图页在 onShow 中消费
  function requestFocus(marker: Marker): void {
    focusTarget.value = marker
  }

  function consumeFocus(): Marker | null {
    const m = focusTarget.value
    focusTarget.value = null
    return m
  }

  return {
    latitude, longitude, scale, activeMarker,
    mapCenterLat, mapCenterLng, mapContext, focusTarget,
    setActiveMarker, zoomIn, zoomOut, moveToLocation,
    onRegionChangeEnd, requestFocus, consumeFocus
  }
})
```

---

## 六、页面详细设计

### 6.1 `pages/index/index.uvue` — 主地图页

**功能**：全屏地图 + 标记点 + 定位 + 底部弹出操作

**数据流**：
```
useLocationStore → latitude, longitude, accuracyLevel, accuracyText
useMarkerStore   → displayMarkers (传给 <map :markers="">)
useMapStore      → scale, activeMarker, mapCenter
useTaskStore     → (仅在打卡完成时触发 checkTaskCompletion)

onShow():
  1. markerStore.loadFromStorage()
  2. 检查 mapStore.consumeFocus() → 如有焦点标记，移动地图到该位置
  3. locationStore.startTracking()

onHide():
  locationStore.stopTracking()
```

**模板结构**：
```html
<template>
  <view class="map-page">
    <!-- 顶部定位信息卡片 -->
    <view class="location-card">
      <text class="coordinate">经度: {{ locationStore.currentLocation?.longitude?.toFixed(6) ?? '--' }}</text>
      <text class="coordinate">纬度: {{ locationStore.currentLocation?.latitude?.toFixed(6) ?? '--' }}</text>
      <view class="accuracy-badge" :class="'accuracy-' + locationStore.accuracyLevel">
        <text>{{ locationStore.accuracyText }}</text>
      </view>
      <text class="stats">{{ markerStore.doneCount }}/{{ markerStore.totalCount }}</text>
    </view>

    <!-- 原生地图 -->
    <map
      id="mainMap"
      class="map-component"
      :latitude="mapStore.latitude"
      :longitude="mapStore.longitude"
      :scale="mapStore.scale"
      :markers="markerStore.displayMarkers"
      show-location
      coord-type="gcj02"
      @markertap="onMarkerTap"
      @longpress="onMapLongPress"
      @regionchange="onRegionChange"
    >
      <!-- 地图覆盖按钮组 -->
      <cover-view class="map-tools">
        <!-- 任务入口 -->
        <cover-view class="tool-btn task-btn" @click="goToTasks">
          <cover-image src="/static/icons/task.png"></cover-image>
        </cover-view>
        <!-- 缩放到 16 级查看当前位置 -->
        <cover-view class="tool-btn zoom-in" @click="mapStore.zoomIn()">+</cover-view>
        <!-- 缩小 -->
        <cover-view class="tool-btn zoom-out" @click="mapStore.zoomOut()">−</cover-view>
        <!-- 回到当前位置 -->
        <cover-view class="tool-btn locate-btn" @click="locateCurrent">
          <cover-image src="/static/icons/locate.png"></cover-image>
        </cover-view>
      </cover-view>

      <!-- 浮动新增按钮（在地图中心位置新增） -->
      <cover-view class="floating-add-btn" @click="goToAddMarker">
        <cover-image src="/static/icons/add.png"></cover-image>
        <cover-view class="add-label">在此新增</cover-view>
      </cover-view>

      <!-- 标记详情底部弹出 -->
      <cover-view class="bottom-sheet" v-if="mapStore.activeMarker">
        <cover-view class="sheet-header">
          <cover-view class="sheet-title">{{ mapStore.activeMarker.title }}</cover-view>
          <cover-view class="sheet-close" @click="mapStore.setActiveMarker(null)">✕</cover-view>
        </cover-view>
        <cover-view class="sheet-body">
          <!-- 已完成标记：显示打卡时间、照片、备注 -->
          <template v-if="mapStore.activeMarker.checked">
            <cover-view class="sheet-row">打卡时间：{{ formatDateTime(mapStore.activeMarker.checkedAt!) }}</cover-view>
            <cover-image v-if="mapStore.activeMarker.photoPath" :src="mapStore.activeMarker.photoPath"></cover-image>
            <cover-view v-if="mapStore.activeMarker.note" class="sheet-note">{{ mapStore.activeMarker.note }}</cover-view>
            <cover-view class="sheet-actions">
              <cover-view class="action-btn" @click="viewPhoto(mapStore.activeMarker)">查看照片</cover-view>
              <cover-view class="action-btn danger" @click="deleteCurrentMarker">删除</cover-view>
            </cover-view>
          </template>
          <!-- 未完成标记：显示距离和打卡按钮 -->
          <template v-else>
            <cover-view class="sheet-distance" v-if="distance">
              距离：{{ formatDistance(distance) }}
              <cover-view class="distance-bar">
                <cover-view class="distance-fill" :style="{ width: distanceRatio + '%' }"></cover-view>
              </cover-view>
            </cover-view>
            <cover-view class="sheet-row">未打卡</cover-view>
            <cover-view class="sheet-actions">
              <cover-view class="action-btn primary" @click="goToCheckIn(mapStore.activeMarker! )"
                v-if="canCheckIn">打卡</cover-view>
              <cover-view class="action-btn danger" @click="deleteCurrentMarker">删除</cover-view>
            </cover-view>
          </template>
        </cover-view>
      </cover-view>
    </map>
  </view>
</template>
```

**关键逻辑**：
```typescript
<script setup lang="uts">
import { ref, computed } from 'vue'
import { useMarkerStore } from '@/stores/useMarkerStore'
import { useLocationStore } from '@/stores/useLocationStore'
import { useMapStore } from '@/stores/useMapStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { formatDateTime, formatDistance } from '@/utils/format'

const markerStore = useMarkerStore()
const locationStore = useLocationStore()
const mapStore = useMapStore()
const taskStore = useTaskStore()

// 距离计算
const distance = computed(() => {
  if (!mapStore.activeMarker || !locationStore.currentLocation) return null
  return locationStore.distanceTo(
    mapStore.activeMarker.latitude,
    mapStore.activeMarker.longitude
  )
})

// 打卡半径：500m + 信号差时的自适应放宽（最多放宽 200m）
const effectiveRadius = computed(() => {
  const acc = locationStore.accuracy
  return 500 + Math.min(acc * 0.5, 200)
})

const distanceRatio = computed(() => {
  if (!distance.value) return 0
  return Math.min(100, (distance.value / 500) * 100)
})

const canCheckIn = computed(() => {
  return distance.value !== null && distance.value <= effectiveRadius.value
})

// 生命周期
onShow((): void => {
  markerStore.loadFromStorage()
  taskStore.loadFromStorage()
  locationStore.startTracking()

  // 处理跨页面焦点请求
  const target = mapStore.consumeFocus()
  if (target) {
    mapStore.moveToLocation(target.latitude, target.longitude, 16)
    mapStore.setActiveMarker(target)
  }
})

onHide((): void => {
  locationStore.stopTracking()
})

// 标记点击
function onMarkerTap(e: { detail: { markerId: number } }): void {
  const marker = markerStore.findById(e.detail.markerId)
  if (marker) mapStore.setActiveMarker(marker)
}

// 地图长按 → 跳转到新增页
function onMapLongPress(e: { detail: { latitude: number; longitude: number } }): void {
  uni.navigateTo({
    url: `/pages/add-marker/add-marker?centerLat=${e.detail.latitude}&centerLng=${e.detail.longitude}&currentLat=${locationStore.currentLocation?.latitude ?? ''}&currentLng=${locationStore.currentLocation?.longitude ?? ''}`
  })
}

// 区域变化
function onRegionChange(e: any): void {
  if (e.type === 'end' && e.detail?.centerLocation) {
    mapStore.onRegionChangeEnd(
      e.detail.centerLocation.latitude,
      e.detail.centerLocation.longitude
    )
  }
}

// 页面跳转
function goToAddMarker(): void {
  uni.navigateTo({
    url: `/pages/add-marker/add-marker?centerLat=${mapStore.mapCenterLat}&centerLng=${mapStore.mapCenterLng}&currentLat=${locationStore.currentLocation?.latitude ?? ''}&currentLng=${locationStore.currentLocation?.longitude ?? ''}`
  })
}

function goToCheckIn(marker: Marker): void {
  uni.navigateTo({ url: `/pages/checkin/checkin?id=${marker.id}&title=${encodeURIComponent(marker.title)}` })
}

function goToTasks(): void {
  uni.navigateTo({ url: '/pages/tasks/tasks' })
}

function locateCurrent(): void {
  if (locationStore.currentLocation) {
    mapStore.moveToLocation(
      locationStore.currentLocation.latitude,
      locationStore.currentLocation.longitude
    )
  }
}

function deleteCurrentMarker(): void {
  if (!mapStore.activeMarker) return
  uni.showModal({
    title: '确认删除',
    content: `确定要删除"${mapStore.activeMarker.title}"吗？`,
    success: (res: any) => {
      if (res.confirm) {
        markerStore.deleteMarker(mapStore.activeMarker!.id)
        mapStore.setActiveMarker(null)
      }
    }
  })
}
</script>
```

### 6.2 `pages/stats/stats.uvue` — 统计页

**功能**：完成率展示、进度条、打卡时间线

**数据源**：`useMarkerStore`（纯读取，无写入）

**模板结构**：
```html
<template>
  <view class="stats-page">
    <!-- Hero 面板 -->
    <view class="hero-panel">
      <text class="tag">TRIP INSIGHTS</text>
      <text class="rate">{{ markerStore.completionRate }}%</text>
      <text class="subtitle">{{ markerStore.doneCount }} / {{ markerStore.totalCount }} 已完成</text>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-value">{{ markerStore.totalCount }}</text>
        <text class="stat-label">总打卡点</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ markerStore.doneCount }}</text>
        <text class="stat-label">已打卡</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ markerStore.pendingMarkers.length }}</text>
        <text class="stat-label">待打卡</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ markerStore.completionRate }}%</text>
        <text class="stat-label">完成率</text>
      </view>
    </view>

    <!-- 进度条 -->
    <ProgressBar :value="markerStore.completionRate" />

    <!-- 打卡时间线 -->
    <view class="timeline">
      <text class="section-title">打卡记录</text>
      <view v-if="markerStore.checkedMarkers.length === 0" class="empty">
        还没有打卡记录，快去地图上探索吧！
      </view>
      <view v-for="m in markerStore.checkedMarkers" :key="m.id" class="timeline-item">
        <text class="timeline-title">{{ m.title }}</text>
        <text class="timeline-time">{{ formatDateTime(m.checkedAt!) }}</text>
        <image v-if="m.photoPath" :src="m.photoPath" class="timeline-photo" />
        <text v-if="m.note" class="timeline-note">{{ m.note }}</text>
      </view>
    </view>
  </view>
</template>
```

### 6.3 `pages/checkin/checkin.uvue` — 拍照打卡页

**功能**：拍照/选照片、距离验证、提交打卡

**数据流**：
```
URL 参数: id (markerId), title (markerName)
useLocationStore → startPolling(5000), distanceTo(), accuracy
useMarkerStore   → findById(id), doCheckIn()
useTaskStore     → checkTaskCompletion()
```

**关键逻辑**：
```typescript
<script setup lang="uts">
import { ref, computed } from 'vue'
import { useMarkerStore } from '@/stores/useMarkerStore'
import { useLocationStore } from '@/stores/useLocationStore'
import { useTaskStore } from '@/stores/useTaskStore'

const markerStore = useMarkerStore()
const locationStore = useLocationStore()
const taskStore = useTaskStore()

// URL 参数（uni-app x 5.07：必须用 onLoad，禁止 cast getCurrentPages 为 UTSJSONObject）
// 注意：onLoad 在 uni-app x 中是全局生命周期钩子，不要 import（错误写法："import { onLoad } from '@dcloudio/uni-app'" 会编译报 "找不到名称 onLoad"）

const markerId = ref<number>(0)
const markerTitle = ref<string>('')

const photoPath = ref<string | null>(null)
const note = ref<string>('')
const isCompressing = ref<boolean>(false)

const marker = computed(() => markerStore.findById(markerId.value))
const distance = computed(() => {
  if (!marker.value || !locationStore.currentLocation) return null
  return locationStore.distanceTo(marker.value.latitude, marker.value.longitude)
})
// 与 index 详情面板保持一致（精度差时放宽至 700m）
const effectiveRadius = computed(() => locationStore.getEffectiveCheckinRadius())
const withinRange = computed(() => distance.value !== null && distance.value <= effectiveRadius.value)

onLoad((options: OnLoadOptions): void => {
  const idStr = options['id'] as string | null
  const titleStr = options['title'] as string | null
  markerId.value = idStr != null ? parseInt(idStr) : 0
  markerTitle.value = titleStr != null ? decodeURIComponent(titleStr) : ''
})

onShow((): void => {
  locationStore.startPolling(5000) // 每 5 秒轮询位置
})

onHide((): void => {
  locationStore.stopPolling()
})

async function choosePhoto(): Promise<void> {
  // 5.07 真机：success 回调参数是 *SuccessImpl 类，cast 为 UTSJSONObject 必崩
  // 必须用官方 typed 类型 ShowActionSheetSuccess / ChooseImageSuccess
  uni.showActionSheet({
    itemList: ['拍照', '从相册选择'],
    success: (res: ShowActionSheetSuccess): void => {
      const sourceType: string[] = res.tapIndex == 0 ? ['camera'] : ['album']
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: sourceType,
        success: (imgRes: ChooseImageSuccess): void => {
          if (imgRes.tempFilePaths.length > 0) {
            photoPath.value = imgRes.tempFilePaths[0]
          }
        }
      })
    }
  })
}

async function submitCheckIn(): Promise<void> {
  if (!withinRange.value || !marker.value) return

  try {
    await markerStore.doCheckIn(markerId.value, photoPath.value, note.value || null)
    const completed = taskStore.checkTaskCompletion(marker.value)
    uni.showToast({ title: '打卡成功！', icon: 'success' })
    if (completed.length > 0) {
      setTimeout(() => {
        uni.showToast({ title: `完成任务：${completed[0].name}`, icon: 'none' })
      }, 1000)
    }
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (e) {
    uni.showToast({ title: '打卡失败', icon: 'error' })
  }
}

// Promise 化辅助
function getFileInfoAsync(path: string): Promise<{ size: number }> {
  return new Promise((resolve) => {
    uni.getFileInfo({ filePath: path, success: (res: any) => resolve(res) })
  })
}

function compressImageAsync(path: string): Promise<string> {
  return new Promise((resolve) => {
    uni.compressImage({ src: path, quality: 80, success: (res: any) => resolve(res.tempFilePath) })
  })
}
</script>
```

### 6.4 `pages/add-marker/add-marker.uvue` — 新增打卡点

**功能**：表单输入，三种坐标来源（地图中心 / 当前位置 / 手动输入）

**数据流**：
```
URL 参数: centerLat, centerLng, currentLat, currentLng
useMarkerStore → addMarker()
useLocationStore → pollLocationOnce() (用于刷新当前位置)
```

**关键逻辑**：
```typescript
// 坐标来源切换
const activeSource = ref<'center' | 'current' | 'manual'>('center')

// 表单状态
const formTitle = ref<string>('')
const formLat = ref<string>('')
const formLng = ref<string>('')

// 初始化：默认使用地图中心坐标
onShow((): void => {
  const query = getCurrentPageQuery()
  if (activeSource.value === 'center') {
    formLat.value = query.centerLat ?? ''
    formLng.value = query.centerLng ?? ''
  }
})

// 验证与提交
function submitHandler(): void {
  if (!formTitle.value.trim()) {
    uni.showToast({ title: '请输入地点名称', icon: 'none' })
    return
  }
  const lat = parseFloat(formLat.value)
  const lng = parseFloat(formLng.value)
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    uni.showToast({ title: '坐标格式不正确', icon: 'none' })
    return
  }
  markerStore.addMarker({ title: formTitle.value.trim(), latitude: lat, longitude: lng })
  uni.showToast({ title: '添加成功', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 800)
}
```

### 6.5 `pages/tasks/tasks.uvue` — 任务与足迹（合并原 marker-list）

**功能**：任务列表 + 打卡点列表（全部/待打卡/已打卡筛选）+ 成就徽章 + 迷你足迹地图

**数据源**：
```
useTaskStore       → tasks[], rewards[], completedTaskCount
useMarkerStore     → markers[], checkedMarkers[]
useAchievementStore → achievements[], unlockedCount
```

**模板结构**：
```html
<template>
  <scroll-view class="tasks-page" scroll-y>
    <!-- Hero 面板 -->
    <view class="hero">
      <text>{{ markerStore.doneCount }}/{{ markerStore.totalCount }} 已打卡</text>
      <text>{{ taskStore.completedTaskCount }}/{{ taskStore.totalTaskCount }} 任务</text>
      <text>{{ achievementStore.unlockedCount }}/7 成就</text>
    </view>

    <!-- 成就徽章（横向滚动） -->
    <scroll-view scroll-x class="badge-scroll">
      <BadgeCard v-for="a in achievementStore.achievements" :key="a.id" :achievement="a" />
    </scroll-view>

    <!-- 迷你足迹地图 -->
    <map class="mini-map" :markers="miniMapMarkers" :latitude="miniMapCenter.lat" :longitude="miniMapCenter.lng" />

    <!-- 筛选按钮 -->
    <view class="filter-bar">
      <view v-for="f in filters" :key="f.key" class="filter-chip" :class="{ active: activeFilter === f.key }" @click="activeFilter = f.key">
        {{ f.label }}
      </view>
    </view>

    <!-- 打卡点列表 -->
    <view v-for="item in filteredMarkers" :key="item.id" class="spot-card">
      <view class="spot-status" :class="item.checked ? 'done' : 'pending'"></view>
      <view class="spot-info">
        <text class="spot-name">{{ item.title }}</text>
        <text class="spot-task" v-if="item.linkedTask">{{ item.linkedTask.name }}</text>
        <text class="spot-time" v-if="item.checkedAt">{{ formatDateTime(item.checkedAt) }}</text>
      </view>
      <view class="spot-actions">
        <text class="action-link" @click="focusOnMap(item)">定位</text>
        <text class="action-link danger" @click="deleteSpot(item)">删除</text>
      </view>
    </view>
  </scroll-view>
</template>
```

### 6.6 `pages/task-detail/task-detail.uvue` — 任务详情

**功能**：单个任务的完整信息、关联打卡点状态、跳转打卡

**数据源**：
```
URL 参数: id (taskId)
useTaskStore  → findTaskById(id)
useMarkerStore → findByTitle() / findById()
```

**关键动作**：点击"前往打卡"时调用 `mapStore.requestFocus(marker)` 然后 `uni.navigateBack()`

---

## 七、入口文件

### 7.1 `main.uts`

```typescript
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.uvue'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  return { app, pinia }
}
```

### 7.2 `App.uvue`

```html
<script setup lang="uts">
// uni-app x .uvue 生命周期为全局钩子，不要从 vue 或 @dcloudio/uni-app import。

onLaunch((): void => {
  console.log('App Launch')
})

onShow((): void => {
  console.log('App Show')
})

onHide((): void => {
  console.log('App Hide')
})
</script>

<style>
/* 全局样式 */
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
```

---

## 八、配置文件

### 8.1 `manifest.json`

```json
{
  "name": "地图打卡",
  "appid": "__UNI__XXXXXX",
  "versionName": "1.0.0",
  "versionCode": 100,
  "vueVersion": "3",
  "app": {
    "distribute": {
      "android": {
        "packageName": "com.example.mapvisit",
        "minSdkVersion": 21,
        "targetSdkVersion": 34,
        "abiFilters": ["arm64-v8a", "armeabi-v7a"],
        "permissions": [
          "<uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\"/>",
          "<uses-permission android:name=\"android.permission.ACCESS_COARSE_LOCATION\"/>",
          "<uses-permission android:name=\"android.permission.ACCESS_BACKGROUND_LOCATION\"/>",
          "<uses-permission android:name=\"android.permission.CAMERA\"/>",
          "<uses-permission android:name=\"android.permission.READ_EXTERNAL_STORAGE\"/>",
          "<uses-permission android:name=\"android.permission.WRITE_EXTERNAL_STORAGE\"/>",
          "<uses-permission android:name=\"android.permission.INTERNET\"/>",
          "<uses-permission android:name=\"android.permission.ACCESS_NETWORK_STATE\"/>",
          "<uses-permission android:name=\"android.permission.ACCESS_WIFI_STATE\"/>",
          "<uses-permission android:name=\"android.permission.VIBRATE\"/>"
        ],
        "sdkConfigs": {
          "maps": {
            "qqmap": {
              "key": "SUEBZ-3SOLL-SXMPB-M2BY6-Q7E3K-S5FQ7"
            }
          }
        }
      }
    },
    "splashscreen": {
      "alwaysShowBeforeRender": true,
      "autoclose": true
    },
    "modules": {
      "Maps": {},
      "Geolocation": {}
    }
  }
}
```

### 8.2 `pages.json`

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "地图打卡",
        "navigationStyle": "custom"
      }
    },
    {
      "path": "pages/stats/stats",
      "style": {
        "navigationBarTitleText": "旅行统计",
        "navigationBarBackgroundColor": "#17352f",
        "navigationBarTextStyle": "white"
      }
    },
    {
      "path": "pages/add-marker/add-marker",
      "style": {
        "navigationBarTitleText": "新增地点"
      }
    },
    {
      "path": "pages/checkin/checkin",
      "style": {
        "navigationBarTitleText": "拍照打卡"
      }
    },
    {
      "path": "pages/tasks/tasks",
      "style": {
        "navigationBarTitleText": "打卡与足迹"
      }
    },
    {
      "path": "pages/task-detail/task-detail",
      "style": {
        "navigationBarTitleText": "任务详情"
      }
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "地图打卡",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8"
  }
}
```

---

## 九、可复用组件

### 9.1 `components/MapTools.uvue`
地图覆盖层按钮组：任务入口、缩放 +/-、定位按钮。通过 props 接收回调或直接调用 mapStore。

### 9.2 `components/BottomSheet.uvue`
标记详情底部弹出：显示标记信息、距离、打卡/删除操作按钮。

### 9.3 `components/BadgeCard.uvue`
成就徽章卡片：显示图标、名称、描述，已解锁/未解锁两种状态样式。

### 9.4 `components/ProgressBar.uvue`
带动画的进度条：接收 `value` (0-100)、`color`、`height` props。

### 9.5 `components/PhotoPicker.uvue`
拍照/相册选择组件：圆形预览区域，点击弹出 actionSheet，自动压缩。

---

## 十、实施顺序（含 Git 分支 + 会话断点）

### ⚠️ 每个新会话开始前必做：禁用 gateguard-fact-force hook

> **问题**：`gateguard-fact-force` PreToolUse hook 会在每次工具调用时拦截并要求贴出 4 项事实。
> 会话 1 实际被拦 ~11 次，对类型/工具这种小文件是纯开销。后续会话文件更多，开销更大。

**操作**（会话开始时执行一次）：
```
用 /update-config 临时禁用 gateguard-fact-force hook，
会话结束时再开回来。
```
或手动：在项目 `.claude/settings.json` 中删除或注释该 hook。

---

### Git 仓库

```
远程仓库：git@github.com:luochiioi/map.git
规则：
  - 主干分支不改名（当前是 master 就用 master），每个会话从 master 切出新分支
  - 绝不直接修改 master 分支
  - 每个会话结束后合并到 master（git checkout master && git merge --no-ff <分支名>）
  - 分支命名：setup/project-scaffold、setup/cloud-infra、setup/auth-layer、
    feature/map-page、feature/checkin-flow、feature/tasks-achievements、
    feature/cloud-sync、feature/admin-panel
```

### 会话断点设计

> **原则**：每个会话完成后，master 分支处于可运行状态。下次会话从 master 切出新分支继续。

| 会话 # | 分支名 | 产出 | 结束后 master 状态 |
|--------|--------|------|-----------------|
| 1 | `setup/project-scaffold` | 项目骨架、pages.json、manifest.json、类型定义、工具函数、**7 个页面空占位 .uvue** | 可编译，类型齐全 |
| 2 | `setup/cloud-infra` | uniCloud 服务空间、5 个 DB schema、云对象部署 | 云端可用（从 master 切出） |
| 3 | `setup/auth-layer` | 从 feiyi_Demo3 复制登录/注册/鉴权，App.uvue token 检查 | 可登录/注册（从 master 切出） |
| 4 | `feature/map-page` | 主地图页 + MapTools + BottomSheet + Pinia Stores | 地图可展示标记（从 master 切出） |
| 5 | `feature/checkin-flow` | 打卡页 + 新增页 + 照片上传 | 打卡闭环可走通（从 master 切出） |
| 6 | `feature/tasks-achievements` | 任务页 + 任务详情 + 统计页 + 成就 | 全功能可用（从 master 切出） |
| 7 | `feature/cloud-sync` | 离线队列、云端同步、数据拉取 | 多端数据同步（从 master 切出） |
| 8 | `feature/admin-panel` | uni-admin 后台部署 | 后台可管理（从 master 切出） |

### Phase 1：基础功能（当前阶段）— 详细步骤

### 会话 1 — 项目骨架 + 类型 + 工具（分支：`setup/project-scaffold`）

```
1. 清理 map_new 中的 hello-uniapp-x 演示代码
   - 删除 pages/component/、pages/API/、pages/CSS/、pages/tabBar/、pages/template/ 等演示目录
   - 删除 uni_modules/ 中与地图打卡无关的演示插件（保留需要的）
   - 保留 App.uvue、main.uts、manifest.json、pages.json、uni.scss
   - 删除 store/index.uts 中的演示数据，保留 reactive 结构

2. 配置 manifest.json（Android 权限：GPS + 相机 + 存储、腾讯地图 SDK Key）
   - ⚠️ 需要你提供腾讯地图 Android Key（app-android.distribute.modules.uni-map.tencent.key）
   - 如暂无，先填占位符，后续 HBuilderX 云打包时再替换

3. 配置 pages.json（7 个页面路由）：
   - pages/index/index、pages/stats/stats、pages/checkin/checkin
   - pages/add-marker/add-marker、pages/tasks/tasks
   - pages/task-detail/task-detail、pages/login/login

4. 创建目录结构：pages/、stores/、utils/、types/、components/

5. 类型定义（6 个文件）：
   types/marker.uts → types/location.uts → types/task.uts
   → types/achievement.uts → types/user.uts → types/app.uts

6. 工具函数（5 个文件）：
   utils/coordinate.uts → utils/format.uts → utils/defaults.uts
   → utils/storage.uts → utils/cloudSync.uts

7. ⚠️ 创建 7 个页面的空占位 .uvue 文件（防止 HBuilderX 编译报 pages.json 引用不存在的页面）：
   每个文件最小内容：
   <template><view><text>页面名称</text></view></template>
   <script setup lang="uts"></script>
   <style></style>

   文件列表：
   pages/index/index.uvue、pages/stats/stats.uvue、
   pages/checkin/checkin.uvue、pages/add-marker/add-marker.uvue、
   pages/tasks/tasks.uvue、pages/task-detail/task-detail.uvue、
   pages/login/login.uvue

8. HBuilderX 试编译（Android 真机预览或云打包）→ 确认无编译错误
9. 提交 → 合并到 master
```

**会话 1 结束标准**：HBuilderX 编译通过，类型和工具函数齐全，7 个页面空占位存在。

### 会话 2 — uniCloud 基础设施（分支：`setup/cloud-infra`）

```
1. 在 uniCloud 控制台创建/关联阿里云服务空间
2. 从 feiyi_Demo3 复制 uni_modules/uni-id-common/ 和 uni_modules/uni-config-center/
3. 部署 5 个数据库集合 schema（含权限）
4. 创建并部署 marker-center 云对象（getAll 先公开，其余加鉴权）
5. 创建并部署 photo-center 云对象
6. 创建并部署 admin-center 云对象
7. 用 HBuilderX 内置测试验证各云对象可用
8. 提交 → 合并到 main
```

**会话 2 结束标准**：云端数据库和云对象全部可用，HBuilderX 测试通过。

### 会话 3 — 认证层（分支：`setup/auth-layer`）

```
1. 从 feiyi_Demo3 复制并适配：
   - uniCloud-aliyun/cloudfunctions/user-center/index.obj.js（补充 checkToken）
   - uniCloud-aliyun/cloudfunctions/common/auth-util/index.js
   - user/index.uts（去除电商类型）
   - pages/login/login.uvue（调整配色为主题色）
   - pages/signUp/signUp.uvue（调整配色）

2. 更新 App.uvue：添加 token 检查和 verifyLogin 逻辑
3. 更新 pages.json：注册 login 和 signUp 路由
4. 测试：注册 → 登录 → Token 持久化 → 重启 App Token 仍有效
5. 提交 → 合并到 main
```

**会话 3 结束标准**：用户可注册、登录，Token 正常工作。

### 会话 4 — 主地图页（分支：`feature/map-page`）

```
1. Pinia Stores（5 个）：
   stores/useMarkerStore.uts → stores/useLocationStore.uts → stores/useMapStore.uts

2. UI 组件：MapTools.uvue → BottomSheet.uvue

3. 页面：pages/index/index.uvue（主地图页）
   - 全屏地图 + 标记渲染
   - GPS 定位卡片 + 精度指示
   - 标记点击 → BottomSheet 弹出（距离/打卡状态）
   - 地图工具按钮（缩放/定位/任务入口）
   - 长按地图 → 跳转新增页
   - onShow 时从云端拉取 markers（marker-center.getAll()）

4. 提交 → 合并到 main
```

**会话 4 结束标准**：地图可展示标记，可交互，云端数据拉取正常。

### 会话 5 — 打卡闭环（分支：`feature/checkin-flow`）

```
1. 更新 checkin.uvue：
   - 拍照 → 压缩 → photo-center.upload() → 获取 cloudURL
   - 5 秒轮询 GPS → 距离计算 → 校验是否在范围内
   - marker-center.checkin() → 服务端校验 → 打卡成功

2. 新增页 add-marker.uvue：
   - 三种坐标来源（地图中心/当前位置/手动）
   - marker-center.add() → 云端写入

3. PhotoPicker.uvue 组件（拍照/相册/压缩/上传）
4. 支持离线打卡（本地先写，联网后同步）

5. 提交 → 合并到 main
```

**会话 5 结束标准**：拍照打卡完整闭环可走通（含云端同步）。

### 会话 6 — 任务+成就+统计（分支：`feature/tasks-achievements`）

```
1. Pinia Stores：useTaskStore.uts → useAchievementStore.uts
2. UI 组件：BadgeCard.uvue → ProgressBar.uvue
3. 页面：
   - pages/tasks/tasks.uvue（任务+列表+成就+迷你地图）
   - pages/task-detail/task-detail.uvue（任务详情）
   - pages/stats/stats.uvue（统计页）

4. 打卡时触发任务检查 → 成就重新计算
5. 提交 → 合并到 main
```

**会话 6 结束标准**：全部 6 个页面可用，基础功能完整。

### 会话 7 — 云端同步完善（分支：`feature/cloud-sync`）

```
1. utils/cloudSync.uts：离线队列 + 批量同步
2. App.onShow 时 flushSyncQueue
3. 数据合并策略（本地 vs 云端冲突处理）
4. 多设备测试
5. 提交 → 合并到 main
```

**会话 7 结束标准**：离线打卡 → 联网自动同步，多设备数据一致。

### 会话 8 — 后台管理（分支：`feature/admin-panel`）

```
1. 创建 uni-admin 项目
2. 仪表盘页面
3. 打卡点管理页面
4. 打卡记录查看页面
5. 用户管理页面
6. 部署到 uniCloud 前端网页托管
7. 提交 → 合并到 main
```

**会话 8 结束标准**：管理员可通过浏览器查看和管理数据。

---

### 前端 UI 设计规范

> **强制要求**：每次写 UI 代码前，使用 `frontend-design` skill 确保设计质量。
> 遵循 `C:\Users\Raymond\.claude\rules\web\design-quality.md` 中的反模板政策。

**设计方向**：文旅 + 年轻化 + 温暖陪伴感

| 要素 | 规范 |
|------|------|
| **主色调** | 暖绿 (#2ecc71 → #27ae60) + 暖橙 (#f39c12)，呼应"步行+城市" |
| **辅助色** | 澳门线 — 葡式蓝白 (#1a5599/#ffffff)；长沙线 — 湘绣红金 (#c0392b/#f39c12) |
| **字体** | 标题用圆体/手写风格，正文用思源黑体 |
| **设计品质** | 每页面至少满足 4 项 Required Qualities（详见 design-quality.md） |
| **禁止** | 默认卡片网格、通用渐变 blob、无观点灰色配比、uniform spacing |
| **动画** | 仅 transform/opacity/clip-path（compositor-friendly） |

**每次写前端代码前**：
```
使用 frontend-design skill → 确认设计方向 → 写代码 → 自检 Component Checklist
```

---

## 十一、关键注意事项

### 11.1 原始项目的 JS → UTS 转换要点

| JS 特性 | UTS 替代方案 |
|---------|-------------|
| `let x = null` 无类型 | `let x: number | null = null` |
| `function foo(data)` | `function foo(data: Record<string, any>): void` |
| `console.log(...)` | 保持（UTS 支持） |
| `typeof x === 'undefined'` | `x == null` 或 `x === undefined` |
| 动态 `import()` | 不支持，使用顶层静态 import |
| `eval()` / `new Function()` | 完全不支持 |
| `Array.find()` | 支持 |
| `Array.map()` / `filter()` / `forEach()` | 支持 |
| `Object.keys()` / `Object.values()` | 支持 |
| `JSON.parse()` / `JSON.stringify()` | 支持 |
| `new Date()` / `Date.now()` | 支持 |
| `setTimeout()` / `setInterval()` | 支持（返回 number） |
| `Math.*` | 完全支持 |
| Template literals | 支持 |
| Arrow functions | 支持 |
| `async/await` | 支持 |
| `Promise` | 支持 |

### 11.2 uni-app x 已知限制

1. **地图覆盖层样式**：`cover-view` 内不支持 `backdrop-filter`、`linear-gradient`，需要使用纯色背景
2. **map 组件**：`@regionchange` 事件仅在操作结束后触发一次（`type: 'end'`）
3. **文件路径**：Android 上临时文件路径以 `_doc`、`_cache` 等前缀区分
4. **自定义导航栏**：`navigationStyle: 'custom'` 时需自行处理状态栏高度
5. **SCSS**：大部分 SCSS 特性兼容，但 `::v-deep` 穿透选择器可能不可用
6. **Pinia**：`defineStore` 的 setup 语法需要确保所有返回值有明确类型

### 11.3 Android 特有适配

1. **权限请求**：首次使用 GPS/相机时需调用 `uni.authorize()` 或引导用户到设置
2. **后台定位**：如果需要在后台持续定位，需添加 `ACCESS_BACKGROUND_LOCATION` 权限
3. **地图 SDK Key**：确保腾讯地图 Key 已在腾讯位置服务控制台绑定正确的包名和 SHA1
4. **最低 SDK**：minSdkVersion 21 (Android 5.0) 覆盖绝大多数设备
5. **64 位支持**：Google Play 要求 64 位，因此 `abiFilters` 包含 `arm64-v8a`

### 11.4 Markers 图标

原始项目使用的远程图标 `https://img.icons8.com/color/48/marker.png` 在 uniapp x 原生地图中可能无法加载（需要网络请求且有跨域问题）。解决方案：
- 下载两张本地 PNG 图标放入 `static/` 目录
- 未打卡：`/static/marker_default.png`（红色 Pin 图标）
- 已打卡：`/static/marker_checked.png`（绿色带勾 Pin 图标）
- 标记宽度统一设为 36，高度 36

---

### 11.5 UTS 编译 + 运行时避坑指南（必读）

> **配套文件**：`UTS_COMPILE_PITFALLS.md`（完整版，30+ 条规则 + Phase 1.5 章节）
>
> **🔥 Phase 1.5 教训（2026-05-07，5 个真机崩溃后总结）：**
>
> Kotlin 是**名义类型系统**，不是 TypeScript 的结构类型。三个错误码同根：
> - `error18` 找不到名称 → `(x: any).field` 不允许（any 编译为 Kotlin Any，无成员）
> - `UTS110111101` Object Literal Type 不支持 → 函数签名禁止匿名 `{ a: number }` 类型
> - `error17` Function1<X> ≠ Function1<Y> → 即使字段相同，自定义类型不能替换 SDK 类型
>
> **铁律**：**SDK 要求什么类型，就只能用什么类型**（`LocationObject` / `UniMapMarkerTapEvent` / `GetLocationSuccess` 等）。自己定义的"等价"别名永远过不了 Kotlin 的名义检查。
>
> **Storage / JSON 反序列化必须用泛型**：
> ```ts
> // 错（运行期 ClassCastException）：
> JSON.parse(raw) as Marker[]
> // 对（真正构造 typed 实例）：
> JSON.parse<Marker[]>(raw) ?? []
> ```
>
> **map 组件事件类型对照表**（来源：`@dcloudio/uni-app-x/types/uni/uni-map-tencent-map.d.ts`）：
> - `@markertap` → `UniMapMarkerTapEvent`，`detail.markerId: number | null`
> - `@regionchange` → `UniMapRegionChangeEvent`，detail 只有 `skew/rotate`，**无 centerLocation**！需用 `MapContext.getCenterLocation` 异步取
> - `@longpress` → 通用组件 longpress，**无 detail**！长按取坐标只能用 MapContext
> - `@tap` → `UniMapTapEvent`，`detail.{latitude, longitude}`
>
> **模板字符串禁止 union 类型**：`url: \`?lat=${num ?? ''}\`` 会误报 "uni.navigateTo 拼写错误"，真因是 `${number | string}` 违法。预先 `.toString()`。
>
> ---
>
> **黄金法则（仍有效，6 条）**：
> 1. `UTSJSONObject["prop"]` 用于 JSON 数据；**原生 SDK 回调用 `.prop`**（cast 到 UTSJSONObject → 运行时 `ClassCastException`）
> 2. 直接 `export const/function`（不用 Pinia/defineStore）
> 3. 内联对象 → `const v: T = {...}` 先声明再传入
> 4. 模板中只用本地变量/函数（导入的需本地 wrapper/alias）
> 5. Write 工具写文件（PS Set-Content 截断 UTF-8）
> 6. **页面 url 参数必须用 `onLoad((options: OnLoadOptions))`，禁止 `getCurrentPages() as UTSJSONObject`**（5.07 真机抛 `UniNormalPageImpl cannot be cast to UTSJSONObject`，导致 onShow 整段崩溃 → markerId/title 等 ref 全部失效，表现为"距离过远 / 找不到打卡点"等错觉）
>
> ---
>
> **🆘 5.07 真机崩溃黑名单（2026-05-08 新增，必读）：**
>
> | 写法 | 真机异常 | 改成 |
> |------|---------|------|
> | `(getCurrentPages()[i] as UTSJSONObject)["$page"]` | `UniNormalPageImpl cannot be cast to UTSJSONObject` | `onLoad((options: OnLoadOptions) => options['id'] as string \| null)`（**`onLoad` 是 uni-app x 全局钩子，不要 import**） |
> | `success: (res: any) => (res as UTSJSONObject)["tapIndex"]`（showActionSheet） | `ShowActionSheetSuccessImpl cannot be cast to UTSJSONObject` | `success: (res: ShowActionSheetSuccess) => res.tapIndex` |
> | `success: (res: any) => (res as UTSJSONObject)["tempFilePaths"]`（chooseImage） | `ChooseImageSuccessImpl cannot be cast to UTSJSONObject` | `success: (res: ChooseImageSuccess) => res.tempFilePaths[0]` |
>
> **诊断套路**：真机日志看到 `xxxImpl cannot be cast to UTSJSONObject` → 立即在源码里搜 `as UTSJSONObject`，把对应 success/getCurrentPages 改成官方 typed 类型。这类崩溃在编译期完全静默。
>
> **二级影响**：跨页面距离/状态计算如果依赖 url 参数（marker id 等），onLoad 写法可让首次渲染就有正确数据；旧 onShow + cast 写法会让 `markerId.value` 永远是 0 → marker.value 为 null → distance 计算返回 null → UI 显示"距离过远"假象。多个页面距离判断必须复用同一 `getEffectiveCheckinRadius()` 函数，不要 inline 重写公式。
>
> **何时 `.prop` vs `["prop"]`？** 见 `UTS_COMPILE_PITFALLS.md` 第四章对照表。
>
> **后续所有 .uvue/.uts 文件编写前必须查阅该文档**，先读 `UTS_COMPILE_PITFALLS.md` §Phase 1.5。
>
> **🚨 命名约定（强制，2026-05-07 因 SDK 类型碰撞踩坑后定）：**
>
> 应用业务类型必须避开 SDK 通用类型名。以下是对照表，**新文件 / 重构必须遵守**：
>
> | ❌ 禁用（与 SDK 撞名） | ✅ 必须用 |
> |----------------------|----------|
> | `Marker` | `CheckinMarker` |
> | `Task` | `AppTask` 或 `CheckinTask` |
> | `User` | `AppUser` |
> | `Location` | `LocationData`（已用） |
> | `Region` | `MapRegion` |
> | `Event` | `AppEvent` 或具体名 |
>
> **理由**：腾讯地图、uniCloud、uni-id 等 SDK 各自定义同名类型，在 UTS Kotlin 名义类型下会触发 ClassCastException，且 Vue reactive 包装一层后包装类（`MarkerReactiveObject`）仍被拒。一旦撞名只能重命名，治标的边界转换都无效。
>
> **执行状态（2026-05-07）**：`Marker → CheckinMarker` 已在 app 全量落地（types/stores/utils/pages 共 10 文件）。后续若新增打卡点类型，**直接用 `CheckinMarker`，不要再起名 `Marker`**；其他通用名（Task/User/Region/Event 等）按表执行。
>
> ---
>
> **🔥 `<map :markers>` 反向推导陷阱（2026-05-07 5 轮失败后定，必读）**
>
> 本会话尝试用 SDK 原生 `Marker[]` 给 `<map :markers>` 喂数据，5 种写法全部失败：
>
> | 写法 | 编译 | 运行 |
> |------|------|------|
> | typed `Marker[]`（与 SDK 同名） | ✅ | ❌ ClassCastException |
> | `displayMarkers: UTSJSONObject[]` 兜底 | ✅ | ❌ UTSJSONObject 也被 setMarkers 强转拒 |
> | `.uts` store 内构造 SDK Marker[] | ❌ error17 | — |
> | `.uvue` 内 `: Marker[]` 注解 + cast | ❌ error17 | — |
> | `.uvue` 内单 cast `.map(m => ({...} as Marker))` | ❌ Return type mismatch | — |
>
> **核心结论**：`<map :markers>` 模板绑定会**反向推导**回脚本侧 computed 的返回类型，
> 期望的是 app 命名空间合成的 `uni.UNIC0495C1.Marker[]` typealias，而 cast 出来
> 的是 SDK 真身 `uts.sdk.modules.DCloudUniMapTencent.Marker`。Kotlin 名义类型
> 系统下两者不等价，无论怎么写 cast 都对不上。
>
> **新功能开发期间，禁止用 `<map :markers="reactiveX">` 这种 reactive prop 形式**，
> 直到下面的可行方案至少一种被验证：
>
> 1. **imperative `MapContext` API**：用 `uni.createMapContext('mapId').addMarker({...}, {success, fail})` 命令式调用，绕开 prop 反向推导。
> 2. **模板字面量直写**：`<map :markers="[{id:1, latitude:..., ...} as Marker]">` 直接在模板里写字面量，模板上下文里 prop 期望类型与表达式直接匹配，不走反向推导。
> 3. **借壳第三方 .uvue 命名空间**：把 markers 构造放到 `uni_modules/your-plugin/pages/x.uvue` 里，那里命名空间隔离，SDK Marker 唯一可见（参考 `uni-openLocation`）。
>
> **现状（2026-05-07）**：`pages/index/index.uvue` 和 `pages/tasks/tasks.uvue`
> 的 `<map>` 已**临时移除 `:markers` 绑定**，地图能渲染但看不到打卡点。
> P1 任务：选定上面任一方案恢复打卡点显示。详见 `UTS_COMPILE_PITFALLS.md §F`。
>
> ---
>
> **🎯 P1 终极方案（2026-05-07 收尾，方案 B 实施完毕）**：
>
> 把腾讯地图 `<map>` 渲染 + SDK Marker[] 构造**整体下沉到 uni_modules 子组件**。
> 涉及文件：
>
> - `uni_modules/checkin-map/package.json` — uni_modules 模块清单（uniapp x 必需）
> - `uni_modules/checkin-map/components/checkin-map/checkin-map.uvue` — 包装组件本体
> - `uni_modules/checkin-map/components/checkin-map/marker.png` — 临时 marker 图标（借自 uni-openLocation）
> - `pages/index/index.uvue` — 用 `<checkin-map>` 替代 `<map>`，传普通 `MarkerInput[]` prop
>
> **为什么必须下沉**：app 命名空间（`uni.UNIC0495C1.*`）会**自动合成** `Marker` typealias，与 SDK 真身（`uts.sdk.modules.DCloudUniMapTencent.Marker`）名义类型冲突。在 `pages/`/`stores/` 下任何形式的 `as Marker` cast 都会触发 error17 或运行时静默不渲染。`uni_modules/` 子命名空间不参与该合成，所以 SDK Marker 构造能在那里跑通。
>
> **uni_modules 子组件内必须遵守的代码规范**（每条都对应一次 5.07 编译失败）：
>
> 1. `type SdkMarker = uts.sdk.modules.DCloudUniMapTencent.Marker` — 全限定路径别名
> 2. props 用本地命名类型（MarkerInput），不接 app 业务类型 CheckinMarker
> 3. SDK 类型**只**写在 `as` 后面，不写在 `:` 注解或 `<>` 泛型
> 4. **ref + watchEffect**（不用 computed） — UTS 5.07 computed 推不出复杂数组返回类型
> 5. **forEach + push**（不用 .map） — UTS 把 .map() callback 返回值识别为 Unit
> 6. iconPath 必须指向真实存在的资源 — 缺资源会被腾讯插件静默跳过
>
> **业务页面侧规范**：
>
> ```html
> <!-- 用包装组件,永远不接触 SDK Marker 类型 -->
> <checkin-map :latitude="lat" :longitude="lng" :scale="scale"
>              :markers-data="markersData"
>              @markertap="..." @longpress="..." @regionchange="..." />
> ```
>
> ```ts
> // 业务态 CheckinMarker[] 投影成普通 MarkerInput[](无 SDK 类型),
> // 喂给子组件 prop。MarkerInput 是本地名,与 SDK 不冲突,可安全做完整类型注解。
> type MarkerInput = {
>   id: number, latitude: number, longitude: number,
>   title: string, iconPath: string, width: number, height: number
> }
>
> const markersData = computed((): Array<MarkerInput> => {
>   return markers.value.map((m: CheckinMarker): MarkerInput => {
>     return {...} as MarkerInput
>   })
> })
> ```
>
> **教训总结（5.07 实测,后续会话务必避免）**：
>
> | 死路 | 失败方式 |
> |------|----------|
> | typed `Marker[]`(与 SDK 同名) | 运行时 ClassCastException |
> | `displayMarkers: UTSJSONObject[]` 兜底 | 运行时 setMarkers 强转拒 UTSJSONObject |
> | `.uts` store 内构造 SDK Marker | 编译 error17 |
> | `.uvue` 业务页内任何形式的 `as Marker` | 编译 error17 / Return type mismatch / 运行静默不渲染 |
> | `as SdkMarker` 全限定别名 + `<map :markers>` 业务页 | 编译过,运行静默不渲染 |
> | `.map(m => ({...} as SdkMarker))` 在 uni_modules 内 | UTSArray<Unit> mismatch |
> | iconPath 引用不存在的 png 文件 | 静默无图标 |
>
> 所有路径都已被本项目实测验证。新功能开发前先读 `UTS_COMPILE_PITFALLS.md §F`。

---

## 十二、uniCloud 云端架构

### 12.1 概述

uniCloud 是 DCloud 提供的 Serverless 云服务，本项目使用**阿里云**作为服务商。云端负责：

- **数据库存储**：打卡点、任务、用户数据、奖励记录
- **云存储**：打卡照片（替代本地临时路径，保证跨设备可访问）
- **云对象**：业务逻辑（打卡校验、照片上传、管理后台接口）
- **用户认证**：uni-id 统一登录（支持用户名密码 / 手机验证码）

**数据架构总览**：
```
┌─────────────────┐     HTTP API      ┌─────────────────┐
│   Android App    │ ◄──────────────► │   uniCloud 阿里云 │
│  ─────────────  │                  │  ─────────────── │
│  本地 SharedPrefs│                  │  MongoDB 数据库   │
│  (离线缓存层)     │                  │  + 云存储 (照片)   │
│                 │                  │  + uni-id 认证    │
└─────────────────┘                  └────────┬────────┘
                                              │
                                              │ HTTP API
                                              ▼
                                     ┌─────────────────┐
                                     │   uni-admin      │
                                     │   (Web 后台管理)   │
                                     │  ─────────────── │
                                     │   浏览器访问       │
                                     │   管理员专用       │
                                     └─────────────────┘
```

### 12.2 数据库集合设计（5 个集合）

#### 12.2.1 `tourism_markers` — 打卡点

```json
{
  "bsonType": "object",
  "required": ["title", "latitude", "longitude"],
  "permission": {
    "read": true,
    "create": "auth.uid != null",
    "update": "doc.createdBy == auth.uid || auth.role == 'admin'",
    "delete": "auth.role == 'admin'"
  },
  "properties": {
    "_id": { "description": "云端自动生成的文档ID" },
    "id": { "bsonType": "number", "description": "本地兼容数字ID" },
    "title": { "bsonType": "string", "minLength": 1, "maxLength": 50, "description": "打卡点名称" },
    "latitude": { "bsonType": "double", "description": "纬度（GCJ-02）" },
    "longitude": { "bsonType": "double", "description": "经度（GCJ-02）" },
    "checked": { "bsonType": "bool", "defaultValue": false, "description": "是否已被打卡（全局状态）" },
    "checkinCount": { "bsonType": "int", "defaultValue": 0, "description": "累计打卡人次" },
    "checkedBy": {
      "bsonType": "array",
      "items": {
        "bsonType": "object",
        "properties": {
          "userId": { "bsonType": "string", "description": "打卡用户ID" },
          "checkedAt": { "bsonType": "timestamp", "description": "打卡时间" },
          "photoCloudURL": { "bsonType": "string", "description": "打卡照片云存储URL" },
          "note": { "bsonType": "string", "maxLength": 200 }
        }
      },
      "description": "所有打卡记录（支持多人打卡同一点）"
    },
    "iconPath": { "bsonType": "string", "description": "标记图标" },
    "width": { "bsonType": "number", "defaultValue": 36 },
    "height": { "bsonType": "number", "defaultValue": 36 },
    "createdBy": { "bsonType": "string", "description": "创建者 userId" },
    "createdAt": { "bsonType": "timestamp" },
    "updatedAt": { "bsonType": "timestamp" }
  }
}
```

**关键变化**：
- `checkedBy[]` 替代原来的单一 `checked`/`photoPath`，支持多人打卡
- `createdBy` 记录创建者，实现"用户仅可修改自己创建的"权限控制
- `photoCloudURL` 替代 `photoPath`（本地路径），使用云存储 URL

#### 12.2.2 `tourism_tasks` — 任务定义

```json
{
  "bsonType": "object",
  "required": ["name", "targetTitle", "reward"],
  "permission": {
    "read": true,
    "create": "auth.role == 'admin'",
    "update": "auth.role == 'admin'",
    "delete": "auth.role == 'admin'"
  },
  "properties": {
    "_id": {},
    "id": { "bsonType": "string", "description": "如 task_001" },
    "name": { "bsonType": "string" },
    "description": { "bsonType": "string" },
    "targetTitle": { "bsonType": "string" },
    "targetMarkerId": { "bsonType": "number" },
    "reward": { "bsonType": "string" },
    "status": { "bsonType": "string", "enum": ["active", "archived"], "defaultValue": "active" },
    "createdAt": { "bsonType": "timestamp" }
  }
}
```

#### 12.2.3 `user_tasks` — 用户任务进度

```json
{
  "bsonType": "object",
  "required": ["userId", "taskId", "status"],
  "permission": {
    "read": "auth.uid != null",
    "create": "auth.uid != null",
    "update": "doc.userId == auth.uid",
    "delete": "auth.role == 'admin'"
  },
  "properties": {
    "_id": {},
    "userId": { "bsonType": "string", "description": "uni-id 用户ID" },
    "taskId": { "bsonType": "string", "description": "任务业务ID" },
    "status": { "bsonType": "string", "enum": ["pending", "completed"] },
    "completedAt": { "bsonType": "int", "description": "完成时间戳（毫秒）" }
  }
}
```

#### 12.2.4 `rewards` — 奖励记录

```json
{
  "bsonType": "object",
  "required": ["userId", "taskId", "taskName", "reward"],
  "permission": {
    "read": "auth.uid != null",
    "create": "auth.uid != null",
    "update": "auth.role == 'admin'",
    "delete": "auth.role == 'admin'"
  },
  "properties": {
    "_id": {},
    "userId": { "bsonType": "string" },
    "taskId": { "bsonType": "string" },
    "taskName": { "bsonType": "string" },
    "reward": { "bsonType": "string" },
    "earnedAt": { "bsonType": "int", "description": "获得时间戳（毫秒）" }
  }
}
```

#### 12.2.5 `users` — 用户扩展信息（新增）

```json
{
  "bsonType": "object",
  "required": ["userId"],
  "permission": {
    "read": "auth.uid != null",
    "create": "auth.uid != null",
    "update": "doc.userId == auth.uid || auth.role == 'admin'",
    "delete": "auth.role == 'admin'"
  },
  "properties": {
    "_id": {},
    "userId": { "bsonType": "string", "description": "关联 uni-id 的 uid" },
    "nickname": { "bsonType": "string", "maxLength": 30 },
    "avatar": { "bsonType": "string", "description": "头像云存储URL" },
    "totalCheckins": { "bsonType": "int", "defaultValue": 0 },
    "totalPhotos": { "bsonType": "int", "defaultValue": 0 },
    "totalCreated": { "bsonType": "int", "defaultValue": 0 },
    "createdAt": { "bsonType": "timestamp" }
  }
}
```

### 12.3 云对象设计（遵循 feiyi_Demo3 模式）

> **关键架构决策**：本项目使用**云对象**（`index.obj.js`）而非普通云函数。云对象通过 `_before` 钩子 + `auth-util` 中间件实现统一鉴权，前端通过 `uniCloud.importObject()` 调用。

#### 12.3.0 鉴权中间件（复用 feiyi_Demo3）

`uniCloud-aliyun/cloudfunctions/common/auth-util/index.js` — 从 feiyi_Demo3 直接复制：

```javascript
const uniID = require('../../../../uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common')

module.exports = {
  checkAuth: async function(context) {
    const uniIDIns = uniID.createInstance({ context })
    const token = context.getUniIdToken()
    const payload = await uniIDIns.checkToken(token)
    if (payload.code !== 0) {
      throw payload  // 在 _before 中抛出异常，后续业务函数不再执行
    }
    return payload.uid  // 返回用户 UID
  }
}
```

#### 12.3.1 `marker-center` 云对象 — 打卡点业务（核心）

`uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`：

```javascript
const db = uniCloud.database()
const col = db.collection('tourism_markers')
const colTasks = db.collection('user_tasks')
const colRewards = db.collection('rewards')
const authUtil = require('../common/auth-util')

module.exports = {
  _before: async function() {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      // 仅 getAll 无需登录
    }
  },

  // ===== 公开操作（无需登录）=====

  async getAll() {
    const res = await col.orderBy('createdAt', 'asc').get()
    return { errCode: 0, data: res.data }
  },

  // ===== 需登录操作 =====

  async add(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { title, latitude, longitude } = data
    if (!title || latitude == null || longitude == null) {
      return { errCode: -1, errMsg: '参数不完整' }
    }
    const now = Date.now()
    const res = await col.add({
      id: now,
      title, latitude, longitude,
      checked: false,
      checkinCount: 0,
      checkedBy: [],
      createdBy: this.auth.uid,
      createdAt: now,
      updatedAt: now
    })
    // 更新用户统计数据
    await db.collection('users').where({ userId: this.auth.uid }).update({
      totalCreated: db.command.inc(1)
    })
    return { errCode: 0, data: { id: res.id } }
  },

  // 打卡（含服务端距离校验）
  async checkin(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { markerId, photoCloudURL, note, latitude, longitude } = data

    // 1. 确认打卡点存在
    const markerRes = await col.where({ id: markerId }).get()
    if (!markerRes.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
    const marker = markerRes.data[0]

    // 2. 服务端距离校验（haversine，防作弊）
    if (latitude != null && longitude != null) {
      const dist = haversine(latitude, longitude, marker.latitude, marker.longitude)
      if (dist > 700) return { errCode: -1, errMsg: `距离过远（${Math.round(dist)}m），无法打卡` }
    }

    // 3. 检查是否已打卡（防止重复）
    const alreadyChecked = (marker.checkedBy || []).some(entry => entry.userId === this.auth.uid)
    if (alreadyChecked) return { errCode: -1, errMsg: '您已在此处打过卡' }

    // 4. 更新打卡记录
    const checkedEntry = {
      userId: this.auth.uid,
      checkedAt: Date.now(),
      photoCloudURL: photoCloudURL || null,
      note: note || null
    }
    await col.where({ id: markerId }).update({
      checked: true,
      checkinCount: db.command.inc(1),
      checkedBy: db.command.push([checkedEntry]),
      updatedAt: Date.now()
    })

    // 5. 更新用户统计
    const userUpdate = { totalCheckins: db.command.inc(1) }
    if (photoCloudURL) userUpdate.totalPhotos = db.command.inc(1)
    await db.collection('users').where({ userId: this.auth.uid }).update(userUpdate)

    // 6. 触发任务检查
    const completedTasks = await this._checkTasks(marker)

    return { errCode: 0, errMsg: '打卡成功', data: { completedTasks } }
  },

  // 内部：任务完成检查
  async _checkTasks(marker) {
    const completed = []
    const tasksRes = await db.collection('tourism_tasks')
      .where({ status: 'active' }).get()

    for (const task of tasksRes.data) {
      // 检查用户是否已完成此任务
      const existing = await colTasks.where({
        userId: this.auth.uid,
        taskId: task.id
      }).get()
      if (existing.data.length > 0 && existing.data[0].status === 'completed') continue

      const match = task.targetMarkerId === marker.id || task.targetTitle === marker.title
      if (!match) continue

      const now = Date.now()
      // 写入或更新 user_tasks
      if (existing.data.length > 0) {
        await colTasks.doc(existing.data[0]._id).update({ status: 'completed', completedAt: now })
      } else {
        await colTasks.add({ userId: this.auth.uid, taskId: task.id, status: 'completed', completedAt: now })
      }
      // 写入奖励（去重）
      const rewardExists = await colRewards.where({ userId: this.auth.uid, taskId: task.id }).get()
      if (!rewardExists.data.length) {
        await colRewards.add({ userId: this.auth.uid, taskId: task.id, taskName: task.name, reward: task.reward, earnedAt: now })
      }
      completed.push({ taskId: task.id, taskName: task.name, reward: task.reward })
    }
    return completed
  },

  // 更新打卡点（仅创建者或管理员）
  async update(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { _id, ...updates } = data
    const marker = await col.doc(_id).get()
    if (!marker.data.length) return { errCode: -1, errMsg: '打卡点不存在' }

    // 权限：创建者 或 管理员
    const isOwner = marker.data[0].createdBy === this.auth.uid
    // 管理员检查通过 uni-id role（需额外查询）
    if (!isOwner) return { errCode: -1, errMsg: '无权修改此打卡点' }

    await col.doc(_id).update({ ...updates, updatedAt: Date.now() })
    return { errCode: 0, errMsg: '更新成功' }
  },

  // 删除打卡点（仅创建者或管理员）
  async delete(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { _id } = data
    const marker = await col.doc(_id).get()
    if (!marker.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
    if (marker.data[0].createdBy !== this.auth.uid) {
      return { errCode: -1, errMsg: '无权删除此打卡点' }
    }
    await col.doc(_id).remove()
    return { errCode: 0, errMsg: '删除成功' }
  },

  // 获取用户任务进度
  async getUserTasks() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const res = await colTasks.where({ userId: this.auth.uid }).get()
    return { errCode: 0, data: res.data }
  },

  // 获取用户奖励
  async getRewards() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const res = await colRewards.where({ userId: this.auth.uid }).orderBy('earnedAt', 'desc').get()
    return { errCode: 0, data: res.data }
  }
}

// Haversine 距离计算（服务端）
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (deg) => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
```

**前端调用**（在 `.uvue` 页面中）：
```typescript
const markerApi = uniCloud.importObject('marker-center')

// 获取所有打卡点（无需登录）
const res = await markerApi.getAll() as UTSJSONObject
const errCode = res["errCode"] as number
if (errCode === 0) {
  const rawData = res["data"]
  const jsonStr = JSON.stringify(rawData)
  const markers = JSON.parse<Marker[]>(jsonStr)
}

// 打卡（需登录）
const checkinRes = await markerApi.checkin({
  markerId: 1,
  photoCloudURL: "https://...",
  note: "到此一游",
  latitude: 39.9163,
  longitude: 116.3972
}) as UTSJSONObject
```

#### 12.3.2 `photo-center` 云对象 — 照片上传

`uniCloud-aliyun/cloudfunctions/photo-center/index.obj.js`：

```javascript
const authUtil = require('../common/auth-util')

module.exports = {
  _before: async function() {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
  },

  // 上传照片到云存储（接收 base64）
  async upload(data) {
    const { fileContent, fileName } = data
    if (!fileContent) return { errCode: -1, errMsg: '缺少文件内容' }

    const result = await uniCloud.uploadFile({
      cloudPath: `checkin-photos/${this.auth.uid}/${Date.now()}_${fileName || 'photo.jpg'}`,
      fileContent: Buffer.from(fileContent, 'base64')
    })
    return {
      errCode: 0,
      data: {
        fileID: result.fileID,
        cloudURL: result.fileID  // uniCloud 文件ID 可直接作为访问URL
      }
    }
  },

  // 删除照片
  async delete(data) {
    const { fileID } = data
    if (!fileID) return { errCode: -1, errMsg: '缺少文件ID' }
    await uniCloud.deleteFile({ fileList: [fileID] })
    return { errCode: 0, errMsg: '删除成功' }
  }
}
```

**前端调用**（在打卡页使用）：
```typescript
// 1. 选图后读取文件为 base64
const fs = uni.getFileSystemManager()
const base64Data = fs.readFileSync(tempFilePath, 'base64') as string

// 2. 上传至云存储
const photoApi = uniCloud.importObject('photo-center')
const uploadRes = await photoApi.upload({
  fileContent: base64Data,
  fileName: `checkin_${Date.now()}.jpg`
}) as UTSJSONObject

// 3. 获取 cloudURL 用于打卡
const uploadData = uploadRes["data"] as UTSJSONObject
const cloudURL = uploadData["cloudURL"] as string
```

#### 12.3.3 `admin-center` 云对象 — 后台管理

`uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js`：

```javascript
const db = uniCloud.database()
const authUtil = require('../common/auth-util')

module.exports = {
  _before: async function() {
    this.auth = { uid: null, isAdmin: false }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
    // 查询用户角色（uni-id-users 的 role 字段）
    const userRes = await db.collection('uni-id-users')
      .where({ _id: this.auth.uid, role: 'admin' }).get()
    if (!userRes.data.length) {
      throw { errCode: -2, errMsg: '无管理员权限' }
    }
    this.auth.isAdmin = true
  },

  // 仪表盘
  async getDashboard() {
    const [users, markers, markersWithCheckins] = await Promise.all([
      db.collection('users').count(),
      db.collection('tourism_markers').count(),
      db.collection('tourism_markers')
        .where({ 'checkedBy.0': db.command.exists(true) }).count()
    ])
    // 统计总打卡人次
    const allMarkers = await db.collection('tourism_markers')
      .field({ checkinCount: true }).get()
    const totalCheckins = allMarkers.data.reduce((sum, m) => sum + (m.checkinCount || 0), 0)

    return {
      errCode: 0,
      data: {
        totalUsers: users.total,
        totalMarkers: markers.total,
        totalMarkersWithCheckins: markersWithCheckins.total,
        totalCheckins
      }
    }
  },

  // 用户列表
  async getUsers(data) {
    const { offset = 0, limit = 20 } = data || {}
    const res = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .skip(offset).limit(limit).get()
    return { errCode: 0, data: res.data }
  },

  // 打卡记录（聚合：标记 + 用户）
  async getCheckins(data) {
    const { offset = 0, limit = 20 } = data || {}
    const res = await db.collection('tourism_markers')
      .where({ 'checkedBy.0': db.command.exists(true) })
      .field({ title: true, checkedBy: true, latitude: true, longitude: true })
      .orderBy('updatedAt', 'desc')
      .skip(offset).limit(limit).get()
    return { errCode: 0, data: res.data }
  },

  // 管理：修改任意打卡点
  async updateMarker(data) {
    const { _id, ...updates } = data
    await db.collection('tourism_markers').doc(_id).update({ ...updates, updatedAt: Date.now() })
    return { errCode: 0 }
  },

  // 管理：删除打卡点
  async deleteMarker(data) {
    await db.collection('tourism_markers').doc(data._id).remove()
    return { errCode: 0 }
  },

  // 批量导入
  async batchImport(data) {
    const results = []
    for (const item of data.list) {
      const res = await db.collection('tourism_markers').add(item)
      results.push(res.id)
    }
    return { errCode: 0, data: { ids: results } }
  },

  // 任务管理
  async getTasks() {
    const res = await db.collection('tourism_tasks').get()
    return { errCode: 0, data: res.data }
  },

  async updateTask(data) {
    const { _id, ...updates } = data
    await db.collection('tourism_tasks').doc(_id).update(updates)
    return { errCode: 0 }
  }
}
```

#### 12.3.4 云对象依赖关系（package.json）

每个云对象需声明依赖。以 `marker-center/package.json` 为例：

```json
{
  "name": "marker-center",
  "dependencies": {
    "uni-id-common": "file:../../../uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common"
  },
  "extensions": {
    "uni-cloud-jql": {}
  }
}
```

`admin-center` 同样需依赖 `auth-util` 对应的 `uni-id-common` 路径。

### 12.4 数据同步策略（App ↔ 云端）

```
┌──────────────────────────────────────────────────────────┐
│  App 端同步流程（基于 feiyi_Demo3 App.uvue 模式）          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  App.onLaunch()                                          │
│    ├─ 读取 uni_id_token / uni_id_token_expired           │
│    ├─ Token 不存在或过期 → clearUserInfo() → 游客模式     │
│    ├─ Token 有效 → verifyLogin() (调用 user-center)      │
│    └─ 从云端拉取最新 markers（marker-center.getAll()）     │
│                                                          │
│  App.onShow()  // 从后台切回前台时                        │
│    └─ flushSyncQueue()  // 处理离线期间积累的操作          │
│                                                          │
│  用户打卡流程                                             │
│    ├─ 本地缓存立即更新（乐观 UI）                          │
│    ├─ 上传照片 → photo-center.upload() → 获取 cloudURL    │
│    └─ marker-center.checkin() → 写云端                   │
│                                                          │
│  新增打卡点                                               │
│    ├─ marker-center.add() → 写云端                       │
│    └─ 失败 → 入离线队列                                   │
│                                                          │
│  离线队列（utils/map-storage.js）                          │
│    ├─ enqueueAction() → 写入本地 storage                 │
│    └─ flushSyncQueue() → 遍历队列，逐条重试               │
└──────────────────────────────────────────────────────────┘
```

### 12.5 用户认证（复用 feiyi_Demo3 的 user-center）

#### 12.5.1 已有认证体系（直接复用）

| 组件 | 路径 | 作用 |
|------|------|------|
| `user-center` 云对象 | `uniCloud-aliyun/cloudfunctions/user-center/index.obj.js` | login / sign / checkToken |
| `auth-util` 中间件 | `uniCloud-aliyun/cloudfunctions/common/auth-util/index.js` | checkAuth(context) → uid |
| uni-id 配置 | `uni_modules/uni-config-center/.../uni-id/config.json` | JWT 密钥、过期时间 |
| `uni-id-common` | `uni_modules/uni-id-common/` | createToken / checkToken |
| 用户状态 | `user/index.uts` | reactive 全局状态 + 持久化 |
| 登录页 | `pages/login/login.uvue` | 用户名+密码+验证码 |
| 注册页 | `pages/signUp/signUp.uvue` | 注册新账号 |

#### 12.5.2 uni-id 配置（已在 feiyi_Demo3 配置好）

```json
{
  "passwordSecret": "ABCD_1234_EFGH_5678",
  "tokenSecret": "YOUR_TOKEN_SECRET_888",
  "tokenExpiresIn": 7200,
  "tokenExpiresThreshold": 600,
  "passwordStrength": "medium"
}
```

#### 12.5.3 前端认证流程（已有实现，直接复用）

```typescript
// ===== 登录 =====
// pages/login/login.uvue
const userLogin = uniCloud.importObject('user-center')
const res = await userLogin.login(userName, userPassword) as UTSJSONObject
const errCode = res["errCode"] as number
if (errCode === 0) {
  const resData = res["data"] as UTSJSONObject
  const userData = {
    userId: resData["userId"] as string,
    userName: resData["userName"] as string
  } as UserInfo
  setUserInfo(userData, resData["token"] as string, resData["tokenExpired"] as number)
}

// ===== 注册 =====
// pages/signUp/signUp.uvue
const userSignUp = uniCloud.importObject('user-center')
const result = await userSignUp.sign(userName, userPassword)

// ===== App.uvue 启动时验证 =====
const token = uni.getStorageSync('uni_id_token') as string | null
const tokenExpired = uni.getStorageSync('uni_id_token_expired')
if (token == null || token == "") return  // 未登录，游客模式
if (tokenExpired != null && Date.now() > (tokenExpired as number)) {
  clearUserInfo()  // Token 过期，清除
  return
}
// Token 有效，异步校验
const userApi = uniCloud.importObject('user-center')
await userApi.checkToken()
```

#### 12.5.4 用户状态管理（user/index.uts — 从 feiyi_Demo3 移植）

```typescript
import { reactive } from 'vue'

export type UserInfo = {
  userId: string
  userName: string
}

export const state = reactive({
  userInfo: null as UserInfo | null
})

export function setUserInfo(data: UserInfo, token: string, tokenExpired: number) {
  state.userInfo = data
  uni.setStorageSync('userInfo', data)
  uni.setStorageSync('uni_id_token', token)
  uni.setStorageSync('uni_id_token_expired', tokenExpired)
}

export function clearUserInfo() {
  state.userInfo = null
  uni.removeStorageSync('userInfo')
  uni.removeStorageSync('uni_id_token')
  uni.removeStorageSync('uni_id_token_expired')
}
```

#### 12.5.5 地图打卡项目需新增的内容

在 feiyi_Demo3 认证体系基础上，地图打卡项目需要：

1. **登录页/注册页** — 从 feiyi_Demo3 复制 `pages/login/login.uvue` 和 `pages/signUp/signUp.uvue`，调整样式
2. **user-center 云对象** — 从 feiyi_Demo3 复制，`checkToken()` 补充实现：
   ```javascript
   async checkToken() {
     const token = this.getUniIdToken()
     if (!token) return { errCode: -1, errMsg: 'Token 不存在' }
     const uniIdIns = uniId.createInstance({ context: this })
     const payload = await uniIdIns.checkToken(token)
     return payload.code === 0
       ? { errCode: 0, data: { uid: payload.uid } }
       : { errCode: -1, errMsg: 'Token 已过期' }
   }
   ```
3. **user/index.uts** — 从 feiyi_Demo3 复制（去掉购物车/订单相关类型）
4. **App.uvue** — 参考 feiyi_Demo3 的 onLaunch 添加 token 检查逻辑
5. **创建 `users` 集合记录** — 注册成功后，在 `marker-center` 的 `_after` 或注册时自动创建用户扩展记录

---

## 十三、后台管理系统（uni-admin）

### 13.1 技术方案

使用 **uni-admin** 框架（基于 uni-app + uniCloud），部署到 uniCloud 前端网页托管。管理员通过浏览器访问。

### 13.2 页面详细设计

#### 13.2.1 仪表盘（Dashboard）

```
┌──────────────────────────────────────────────────────┐
│  地图打卡管理系统 - 仪表盘                               │
├──────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐   │
│  │ 总用户  │ │ 总打卡点 │ │ 打卡次数 │ │ 活跃用户    │   │
│  │  128   │ │   56   │ │  3,421  │ │    42      │   │
│  └────────┘ └────────┘ └────────┘ └────────────┘   │
│                                                      │
│  打卡趋势图（近 30 天）                  热门打卡点       │
│  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  📈 折线图            │  │  1. 北京故宫  890次  │  │
│  │                      │  │  2. 上海迪士尼 567次 │  │
│  │                      │  │  3. 广州塔    432次  │  │
│  └──────────────────────┘  └────────────────────┘  │
│                                                      │
│  最近打卡记录                                         │
│  ┌──────────────────────────────────────────────┐  │
│  │ 用户A 在 北京故宫 打卡  2026-05-06 14:32      │  │
│  │ 用户B 在 上海迪士尼 打卡 2026-05-06 13:15     │  │
│  │ 用户C 新增打卡点 "西湖"  2026-05-06 12:01      │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

#### 13.2.2 打卡点管理

```
功能：
- 表格展示所有打卡点（分页、搜索、排序）
- 每行：名称、坐标、创建者、打卡人数、创建时间、操作
- 操作按钮：编辑（弹窗修改名称/坐标/图标）、删除（二次确认）
- 顶部操作栏：新增打卡点（地图选点 + 表单）、批量导入（JSON/CSV）
- 点击打卡人数 → 弹出该点的打卡用户列表（含照片预览）
```

#### 13.2.3 打卡记录

```
功能：
- 所有打卡记录（按时间倒序）
- 筛选：按用户昵称搜索、按打卡点搜索、按日期范围筛选
- 每行：用户名、打卡点、时间、是否有照片、备注
- 点击行 → 展开查看照片大图和完整备注
- 导出按钮：导出筛选结果为 CSV
```

#### 13.2.4 用户管理

```
功能：
- 用户列表（昵称、注册时间、打卡次数、创建标记数、成就数）
- 搜索用户
- 点击用户 → 用户详情页：
  - 基本信息
  - 打卡历史时间线（含照片）
  - 任务完成情况
  - 奖励记录
  - 成就徽章
```

#### 13.2.5 任务管理

```
功能：
- 任务列表（名称、目标打卡点、奖励、状态 active/archived）
- 新增/编辑任务（关联打卡点下拉选择）
- 归档/启用任务
- 查看完成该任务的用户列表
```

---

## 十四、需从 feiyi_Demo3 复用的文件清单

以下文件可以从 `C:/Users/Raymond/Desktop/feinibuke/project/app-dev/feiyi_Demo3` **直接复制或微调**后使用：

### 14.1 认证相关（直接复制）

| 来源路径 (feiyi_Demo3) | 目标路径 (map_new) | 修改内容 |
|------------------------|-------------------|---------|
| `pages/login/login.uvue` | `pages/login/login.uvue` | 修改配色/文案为地图打卡主题 |
| `pages/signUp/signUp.uvue` | `pages/signUp/signUp.uvue` | 修改配色/文案 |
| `user/index.uts` | `user/index.uts` | 删除 CartItem/Order/Product 等电商类型，只保留 UserInfo |
| `uniCloud-aliyun/cloudfunctions/user-center/index.obj.js` | 同路径 | 补充 `checkToken()` 实现（当前为空） |
| `uniCloud-aliyun/cloudfunctions/user-center/package.json` | 同路径 | 无需修改 |
| `uniCloud-aliyun/cloudfunctions/common/auth-util/index.js` | 同路径 | 无需修改 |
| `uniCloud-aliyun/cloudfunctions/common/auth-util/package.json` | 同路径 | 无需修改 |
| `uni_modules/uni-config-center/` | 同路径 | 包含 `uni-id/config.json`，无需修改 |
| `uni_modules/uni-id-common/` | 同路径 | 无需修改 |

### 14.2 需要新增的云对象（按 feiyi_Demo3 模式编写）

| 目标路径 | 说明 |
|---------|------|
| `uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js` | 打卡点 CRUD + 打卡业务（代码见 12.3.1） |
| `uniCloud-aliyun/cloudfunctions/marker-center/package.json` | 依赖 uni-id-common |
| `uniCloud-aliyun/cloudfunctions/photo-center/index.obj.js` | 照片上传/删除（代码见 12.3.2） |
| `uniCloud-aliyun/cloudfunctions/photo-center/package.json` | 依赖 uni-id-common |
| `uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js` | 后台管理（代码见 12.3.3） |
| `uniCloud-aliyun/cloudfunctions/admin-center/package.json` | 依赖 uni-id-common |

### 14.3 App.uvue 启动逻辑（参考 feiyi_Demo3）

```javascript
// App.uvue — 在已有基架上添加 token 检查
import { clearUserInfo } from '@/user/index.uts'

export default {
  onLaunch: function() {
    // ... 已有的字体加载等逻辑 ...

    // ===== Token 检查（从 feiyi_Demo3 移植）=====
    const token = uni.getStorageSync('uni_id_token') as string | null
    const tokenExpired = uni.getStorageSync('uni_id_token_expired')

    if (token == null || token == "") {
      console.log('未登录，游客模式')
      return
    }
    if (tokenExpired != null && Date.now() > (tokenExpired as number)) {
      console.log('Token 已过期，清理中...')
      clearUserInfo()
      return
    }
    // 异步验证 token
    this.verifyLogin()
  },

  onShow: function() {
    // 从后台切回前台时，处理离线操作队列
    // flushSyncQueue().catch(() => {})
  },

  methods: {
    async verifyLogin() {
      try {
        const userApi = uniCloud.importObject('user-center')
        await userApi.checkToken()
      } catch (e) {
        console.log('Token 验证失败', e)
      }
    }
  }
}
```

### 14.4 前端调用云对象的标准模式（UTS）

```typescript
// ===== 模式 1：调用云对象方法 =====
const api = uniCloud.importObject('marker-center')
const res = await api.getAll() as UTSJSONObject

// ===== 模式 2：三板斧解析数据 =====
// 步骤 1: 断言为 UTSJSONObject
// 步骤 2: res["字段名"] 获取字段
// 步骤 3: as 类型 强制转换

const errCode = res["errCode"] as number
if (errCode === 0) {
  const rawData = res["data"]
  const jsonStr = JSON.stringify(rawData)
  const markers = JSON.parse<Marker[]>(jsonStr)
}

// ===== 模式 3：需登录的操作（Token 自动携带）=====
const checkinRes = await api.checkin({
  markerId: 1,
  photoCloudURL: "https://...",
  note: "到此一游",
  latitude: 39.9163,
  longitude: 116.3972
}) as UTSJSONObject

// ===== 模式 4：照片上传 =====
import { readFileSync } from 'fs'  // 或 uni.getFileSystemManager()
const base64Data = uni.getFileSystemManager().readFileSync(tempPath, 'base64') as string
const photoApi = uniCloud.importObject('photo-center')
const uploadRes = await photoApi.upload({
  fileContent: base64Data,
  fileName: `checkin_${Date.now()}.jpg`
}) as UTSJSONObject
const uploadData = uploadRes["data"] as UTSJSONObject
const cloudURL = uploadData["cloudURL"] as string
```

---

## 十五、更新后的验证清单

### 15.0 Phase 1 当前真实状态（2026-05-08，**P1 + P2 真机闭环 ✅**）

P1 主链路已基本打通，但 2026-05-09 真机复测发现仍有收尾问题，当前按“先修 P1，不开新大功能”的策略处理。

已稳定的部分：
- ✅ 地图 marker 图标显示（uni_modules 子组件方案落地，详见 `UTS_COMPILE_PITFALLS.md §F` 终极方案）
- ✅ 打卡点详情面板距离/精度展示同步 GPS 状态
- ✅ 跳转打卡页（`?id=...&title=...` URL 参数 + `onLoad((options))` 接收）
- ✅ checkin 页范围判断与详情面板一致（共用 `getEffectiveCheckinRadius()`）
- ✅ 提交打卡后 marker 图标切换 checked，tasks 页面同步任务/成就

2026-05-09 已补的收尾约定：
- ✅ tasks 页面改为外层 `view` + 内层纵向 `scroll-view`，避免 Android 真机整页不滚动
- ✅ tasks 页面回到与 stats 页一致的单根纵向 `scroll-view`，并显式设置 `direction="vertical"`
- ✅ tasks 页面筛选 chips 改为三个显式按钮，不再用 `v-for` + 联合类型参数；筛选同时作用于任务列表和打卡点列表
- ✅ tasks 页面迷你地图下移到列表后，避免原生 map 吃掉首屏滑动手势
- ✅ 成就徽章横滑区显式设置内容宽度和 item 外包层，避免 flex 内容被压回视口
- ✅ 成就徽章横滑同时写 `scroll-x` 与 `direction="horizontal"`，贴近 uni-app x 真机滚动约定
- ✅ tasks 页面信息架构调整为 `任务 / 成就 / 地点` 三段；成就改网格展示，地点页单独承载打卡点筛选和迷你地图
- ✅ task-detail 增加 `pendingTaskDetailId` 共享 ref + `pendingTaskDetailSnapshot` 快照 + storage 兜底，避免 query/store 任一层失效时显示“任务不存在”
- ✅ 登录 chip 使用直接动态文字类和用户名兜底，避免登录后只显示绿色胶囊不显示用户名
- ✅ 删除确认统一改用 `showActionSheet`，避开 `UniShowModalResult cannot be cast to UTSJSONObject`
- ✅ 本地种子点云端不存在时，checkin 页不再同时弹“打卡成功”和“打卡点不存在”；本地打卡成功优先，云端种子同步列为后续完善项
- ✅ 未登录点击 marker 详情的“打卡”时先提示登录，不再进入 checkin 页，也不再产生本地已打卡状态
- ✅ checkin 页取消 actionSheet 中间层，改成“拍照 / 相册”两个直接按钮调用 `chooseImage`
- ✅ 首页进入 checkin 前记录同 marker 的短时 preflight 距离，减少 GPS 跳变导致的“详情页可打卡、checkin 页距离过远”

P2 主链路已真机验收通过（详见 `UTS_COMPILE_PITFALLS.md §九`）：
- ✅ **登录态打通**：主地图 auth-chip 入口；登录成功 → `setUserInfo` 写 `uni_id_token` → marker-center 云对象 `_before` 通过 `authUtil.checkAuth` 拿到 `this.auth.uid` → checkin/add 真正写入云端
- ✅ **注册闭环**：`uni-id-users` 表写入 nickname/username/password；登录成功后 chip 切换为用户昵称
- ✅ **tasks 页任务列表 + 缩略图**：徽章/任务/缩略图三段式；点击任务进入 task-detail，再点"前往"回主地图聚焦 marker
- ✅ **cloudSync 启动崩溃修复**：`readQueue()` 改用泛型 `JSON.parse<QueueItem[]>()`，离线队列 flush 不再 ClassCastException
- ✅ **假 captcha 移除**：登录/注册去掉 client-side 验证码，只校验用户名+密码

**P3 当前状态与下一轮起点（2026-05-09 更新）**：

1. **uniCloud 后台打卡点管理 + 云端种子点同步**（已基本落地，§13）
   - 目标：管理员能在 uniCloud/uni-admin Web 端看到每个打卡点的名称、经纬度、创建者、打卡人数、打卡用户、打卡时间、照片/备注摘要。
   - 能力：新增打卡点、编辑名称/位置、删除打卡点、查看打卡记录。
   - 必做前置：把默认 8 个本地种子点初始化到 `tourism_markers`，否则 App 本地可打卡但云端 `marker-center.checkin` 会找不到文档。
   - 当前完成：`admin-center` 管理接口、默认 8 个点同步、默认 6 个任务同步、uni-admin 5 个后台页面、后台返回/刷新/加载/错误状态、用户统计修正。

   **2026-05-09 已落地（P3 后台第一轮）**：
   - `admin-center` 新增 `getMarkers`、`getMarkerCheckins`、`createMarker`、`syncDefaultMarkers`，并收紧 `updateMarker` / `deleteMarker` / `batchImport` 只走管理员鉴权。
   - 默认 8 个种子点抽到 `uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js`，`syncDefaultMarkers()` 按数字 `id` 幂等写入 `tourism_markers`。新增文档会带 `createdBy: 'system'`、`checkedBy: []`、`checkinCount: 0`、本地图标路径和尺寸；已存在文档只修复基础点位字段，不清空打卡记录。
   - `uni-admin/pages/markers/index.vue` 改走 `admin-center.getMarkers`，支持搜索、列表、创建者/创建时间/打卡人数展示、新增、编辑、删除、批量导入、同步默认点，以及跳转查看单点记录。
   - `uni-admin/pages/checkins/index.vue` 改为记录视图，展示打卡人、打卡时间、照片 URL/预览、备注；可查看全局记录，也可从打卡点页通过 `admin_checkins_marker_id` storage 查看某个点的记录。
   - `uni-admin/pages/dashboard/index.vue` 适配 `admin-center.getCheckins()` 的记录列表返回结构。
   - 本轮新增测试：`node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js`，覆盖种子点数量/id、云端种子文档形状、创建/编辑白名单、打卡记录展开排序。

   **2026-05-09 已落地（P3 后台联调修复）**：
   - `admin-center.getUsers()` 改为以 `uni-id-users` 为主数据源，并合并自建 `users` 集合中的统计字段，避免仪表盘显示 4 个用户但用户管理页为 0。
   - 用户统计增加双保险：后台可从 `tourism_markers.checkedBy[]` / `createdBy` 反推打卡与创建统计；`marker-center.add/checkin` 后续也会自动创建或递增 `users` 统计文档。
   - `admin-center` 新增 `DEFAULT_SEED_TASKS` / `syncDefaultTasks()`，可在后台任务页一键把本地 6 个默认任务同步到 `tourism_tasks`，状态固定为 `active`。
   - `uni-admin` 新增统一 `AdminHeader`，各后台 tab 页面都有“返回”和“刷新”；页面增加 loading / error / empty 状态，避免接口失败时只显示“连接服务器超时”。
   - 打卡点管理页增强为详情卡片：展示经纬度、创建者、创建/更新时间、图标路径、尺寸、打卡人数，并支持编辑图标路径与尺寸。
   - 注意：种子点同步前已经发生的“本地成功但云端失败”的历史打卡，不会自动出现在后台；后台记录来自 `tourism_markers.checkedBy[]`，需要云端点存在后重新打卡或由客户端离线队列补传。

   **后台复测顺序**：
   - 在 HBuilderX 重新上传 `admin-center`、`marker-center`、`users.schema.json`。
   - 打开 uni-admin，管理员登录后先进入“打卡点”页点击“同步默认点”，再进入“任务”页点击“同步默认任务”。
   - 用 App 登录任一账号重新完成一次云端点打卡，再刷新后台“仪表盘 / 打卡记录 / 用户管理”确认数据增长。
   - 历史本地打卡如果发生在云端点同步前，需要下一轮客户端补传能力才能回填到后台。

2. **P3.1：客户端云端补传与多端同步硬化**（下一轮最高优先级）
   - 目标：让“历史本地已打卡但云端没有记录”的数据可被用户主动补传；让设备 A 打卡后设备 B 能稳定拉到最新 `checkedBy[]`、任务、照片记录。
   - 主要文件：`utils/cloudSync.uts`、`stores/useMarkerStore.uts`、`stores/useTaskStore.uts`、`pages/index/index.uvue`、`pages/checkin/checkin.uvue`、`uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`。
   - 开工前置：先清理 App H5 已知生命周期 import 警告，`.uvue` 页面不要从 `vue` import `onShow/onHide`，避免 Web 调试时 async component loader 报错。
   - 做法：增加“本地 checked 但云端 checkedBy 缺当前用户”的差异检测；补一个 `marker-center.repairCheckin()` 或复用受控 `checkin` 路径；App 启动和首页 `onShow` 后先拉云端、再补传队列、再刷新本地 marker/task 状态。
   - 验收：同步默认点后，用旧账号打开 App，可补传本地已打卡记录；设备 A 打卡后，设备 B 重新进入首页能看到足迹与后台记录一致。

3. **P3.2：后台发布与验收清单固化**（高优先级）
   - 目标：把 uni-admin 从本地 H5 调试状态推进到可访问的前端网页托管，并形成可复测流程。
   - 做法：HBuilderX 内置浏览器先跑通；确认跨域配置；执行发行/上传前端网页托管；记录管理员账号、同步按钮顺序、接口错误排查入口。
   - 验收：外部浏览器访问后台可登录，五个 tab 正常加载，新增/编辑/删除打卡点能反映到 App 地图。

4. **P3.3：离线打卡 e2e 验证**（中优先级）
   - sync_queue 修了 cast bug，但完整链路（断网 → 打卡 → 联网 → flush → 服务端 checkin → marker.checked 同步）没真机走过
   - 容易踩的坑：断网时 `marker-center.checkin` 是直接 throw（被 catch 进 enqueueAction），还是返回 errCode？要看下真机日志

5. **P3.4：照片打卡端到端**（中优先级）
   - photo-center.upload 路径已通，但还没真机拍照 → upload → cloudURL 入 marker.checkedBy[].photoCloudURL → 详情页展示
   - 注意 PITFALLS §四 的 chooseImage 必须用 `ChooseImageSuccess` typed 回调

6. **P3.5：登录态过期 UX**（中优先级）
   - 现象：`App.uvue` 检测 token 过期时只清 storage，主地图不感知
   - 修复：清 storage 后刷新 `userState.userInfo`，首页 chip 切回登录态；打卡入口提示“会话已过期，请重新登录”

7. **照片墙与回顾页**（中优先级）
   - 从 checkin 记录中按时间/地点展示照片，作为 Phase 2 剧情系统前的沉淀页

下一轮详细执行计划见：`docs/superpowers/plans/2026-05-09-cloud-sync-hardening.md`。

**P3 验收前必读**：
- `UTS_COMPILE_PITFALLS.md §F` — uni_modules 子组件方案细则
- `UTS_COMPILE_PITFALLS.md §四` — 5.07 真机崩溃黑名单（onLoad / typed callback / cast UTSJSONObject）
- `UTS_COMPILE_PITFALLS.md §八` — P1 闭环 7 条修复清单
- `UTS_COMPILE_PITFALLS.md §九` — P2 闭环 5 条修复清单 + 法则 6/7/8/9（reactive cast / Math.floor.toString / JSON.parse 泛型 / fake captcha）

- [ ] 所有 UTS 文件通过 HBuilderX 编译检查
- [ ] uniCloud 服务空间创建并关联项目
- [ ] 从 feiyi_Demo3 复制 auth-util、user-center、uni-id 配置
- [ ] user-center 的 `checkToken()` 补充实现
- [ ] 5 个数据库集合 schema 部署成功（含权限配置）
- [ ] marker-center 云对象部署并测试通过（getAll/add/checkin/update/delete）
- [ ] photo-center 云对象部署并测试通过（upload/delete）
- [ ] admin-center 云对象部署并测试通过（getDashboard/getUsers/getCheckins）
- [ ] 用户注册/登录流程正常（复用 feiyi_Demo3 的 user-center）
- [ ] App.uvue 启动 token 检查逻辑正常工作
- [ ] user/index.uts 用户状态管理正常工作
- [ ] Android APK 构建成功
- [ ] 安装到 Android 真机，应用正常启动
- [ ] 登录后首次启动显示默认打卡点（从 marker-center.getAll() 拉取）
- [ ] GPS 权限弹窗正常，授权后定位可用
- [ ] 地图可缩放、拖拽、点击标记弹出底部详情
- [ ] 距离计算准确（500m 内显示"可打卡"）
- [ ] 拍照打卡完整流程：拍照 → 压缩 → photo-center.upload() → marker-center.checkin()
- [ ] 打卡照片存储到云存储（非本地临时路径）
- [ ] 服务端距离校验正常工作（防作弊）
- [ ] 新增打卡点通过 marker-center.add() 同步到云端
- [ ] 任务完成：打卡触发云端任务检查 → 提示完成
- [ ] 成就解锁：满足条件后徽章高亮
- [ ] 统计页数据与打卡记录一致
- [ ] 离线打卡：断网 → 打卡 → 联网 → 自动同步到云端
- [ ] 应用重启后本地数据持久化
- [ ] 应用重启后从云端拉取最新数据（包括其他用户的打卡）
- [ ] 任务详情页 → "前往打卡"→ 跳转地图并定位
- [ ] 删除标记功能正常（权限控制：仅创建者或管理员）
- [ ] GPS 信号弱时自适应放宽打卡半径
- [ ] 照片压缩功能（>1MB 自动压缩）
- [ ] uni-admin 后台部署到前端托管
- [ ] 后台仪表盘数据显示正常
- [ ] 后台打卡点管理：新增/编辑/删除
- [ ] 后台打卡记录查看：筛选/搜索
- [ ] 后台用户管理：查看列表/详情
- [ ] 多设备数据同步：A 设备打卡 → B 设备拉取可见

---

## 十六、迭代路线图（Phase 2-4：差异化功能）

> ⚠️ **以下为未来迭代计划，不在当前 Phase 1 范围内。**
> Phase 1 完成后，基础地图打卡功能已可用。Phase 2-4 逐步加入双城剧情、电子宠物、AR 等差异化功能。

### Phase 2 — 双城打卡 + 剧情系统

| 功能 | 说明 | 依赖 |
|------|------|------|
| 双城数据模型 | markers 新增 `city` 字段（`macau`/`changsha`），任务绑定城市 | DB schema 变更 |
| 双城地图分页 | 首页增加城市切换 Tab（澳门/长沙），各自独立的标记集 | map page 重构 |
| 单人独立打卡模式 | 用户按顺序完成一个城市的打卡点，进度持久化。跨城后继续补完 | task system 已有基础 |
| 剧情章节系统 | `story_chapters` 集合：章节定义、触发条件（完成 N 个打卡点）、解锁顺序 | 新增 DB + 云对象 |
| 剧情触发（汇总型） | 完成一段路线 → 服务端生成小动画（序列帧/简单 Lottie）→ 客户端播放 | 动画资源 |
| 打卡照片回顾 | 照片墙页面：按城市/时间浏览打卡照片 | photo-center 已有基础 |

**数据库新增**：
```
story_chapters — 剧情章节定义（id, city, chapterOrder, title, description, requiredMarkers[], animationURL, unlockCondition）
user_progress — 用户剧情进度（userId, city, currentChapter, completedChapters[], lastCheckinAt）
```

### Phase 3 — 好友联动 + NPC 模式

| 功能 | 说明 | 依赖 |
|------|------|------|
| 组队码系统 | 生成 6 位唯一组队码，两人输入同一码 → 建立双人会话 | 新增 `teams` 集合 |
| 异地联动打卡 | 两人同时（±30 秒窗口）在对应打卡点 → 双城联动触发 | WebSocket 或轮询 |
| 联动剧情 | 双城同时打卡成功 → 解锁专属联动剧情章节 | story_chapters |
| NPC 形象自定义 | 外观选择器（发型、服装、配饰） | 静态资源 |
| 打卡点小游戏 | 到达打卡点 → 触发简单交互（拼图/答题/找茬）→ 激活 NPC | 游戏逻辑模块 |
| NPC 陪伴模式 | NPC 在剧情动画中出现，有对话气泡 | 动画资源 |

**数据库新增**：
```
teams — 组队信息（teamCode, members[{userId, city}], createdAt, status）
mini_games — 小游戏定义（id, markerId, gameType, config, reward）
```

### Phase 4 — 电子宠物 + AR

| 功能 | 说明 | 依赖 |
|------|------|------|
| 步数统计 | 接入 uni.getLocation 连续追踪 + 计步算法，或调用系统计步 API | GPS 已有基础 |
| 宠物系统 | `pets` 集合：宠物定义、等级、外观。用户注册获初始"奥喵" | 新增 DB |
| 步数 → 资源 | 每日步数换算猫粮/道具/装扮。商店兑换 | 新增云对象 |
| 宠物升级 | 累计步数 + 打卡次数 → 升级 → 解锁狗等新形象 | pets 逻辑 |
| AR 实时触发 | 打卡成功时，AR 形象叠加在相机画面中（使用 uni-ar 或 WebView AR） | 设备兼容性 |
| 宠物互动 | 喂食、抚摸、换装（基础 Tamagotchi 式交互） | UI 组件 |

**数据库新增**：
```
pets — 宠物定义（id, name, type, levels[{level, requiredSteps, requiredCheckins, avatar}]）
user_pets — 用户宠物（userId, petId, level, exp, equippedItems[]）
pet_items — 道具/装扮（id, name, type[food/decor/costume], effect, cost）
user_inventory — 用户背包（userId, itemId, count）
```

### Phase 2-4 实施顺序（届时）

```
Phase 2: 双城模型 → 城市切换 → 单人独立模式 → 剧情章节 → 汇总动画 → 照片墙
Phase 3: 组队码 → 异地联动 → 联动剧情 → NPC 自定义 → 小游戏 → NPC 陪伴
Phase 4: 步数统计 → 宠物基础 → 步数换资源 → 宠物升级 → AR 触发 → 宠物互动
```

---

## 附录：原始项目文件完整清单（供参考）

```
map_visit_demo/
├── App.vue
├── main.js
├── manifest.json
├── pages.json
├── uni.scss
├── index.html
├── uni.promisify.adaptor.js
├── pages/
│   ├── index/index.vue           ← 主地图页
│   ├── stats/stats.vue           ← 统计页
│   ├── checkin/checkin.vue       ← 打卡页
│   ├── add-marker/add-marker.vue ← 新增页
│   ├── tasks/tasks.vue           ← 任务+列表
│   ├── task-detail/task-detail.vue ← 任务详情
│   └── marker-list/marker-list.vue ← 旧版列表（未注册，可忽略）
├── utils/
│   ├── index.js                  ← 工具函数（格式+默认数据）
│   ├── storage.js                ← 存储层
│   ├── coordinate.js             ← 坐标转换
│   └── tasks.js                  ← 任务逻辑
├── uniCloud-aliyun/              ← 云对象+数据库（3个新增 + 1个复用 user-center、5个集合）
├── uni_modules/
│   └── uni-id-common/            ← uni-id 认证模块（保留并启用）
└── static/
    └── logo.png
```

---

> **最终交付物**：
> - **App 端**：7 个页面、5 个 Pinia Store、1 个用户状态模块 (user/index.uts)、5 个 UI 组件、5 个工具模块、6 个类型定义文件
> - **云端**：1 个复用云对象 (user-center) + 3 个新增云对象 (marker-center/photo-center/admin-center) + 5 个数据库集合 + 照片云存储
> - **后台**：uni-admin Web 管理系统（5 个功能页面）
> - **架构模式**：遵循 feiyi_Demo3 的 cloud object + auth-util 中间件 + UTSJSONObject 三板斧解析模式
> - 可在 HBuilderX 中编译为 Android APK 并在真机上流畅运行

---

## 2026-05-09 P3.1 打卡同步与地图跳转修复

本次修复聚焦 App 端打卡后的云端一致性：`marker-center.checkin()` 不再通过 `this._checkTasks()` 调内部云对象方法，而是使用独立 helper `checkTasksForMarker(uid, marker)`，避免 uniCloud 云对象运行时 `this` 绑定差异导致打卡成功后弹出 `this._checkTasks is not a function`。

App 登录态统一使用 uni-id 用户 `_id` 作为 `userInfo.userId`，`user-center.login()` 与 `checkToken()` 均返回该 uid。原因是云端 `tourism_markers.checkedBy[].userId` 和 `createdBy` 都来自 `this.auth.uid`；如果客户端继续使用业务编号 `000_004`，地图面板会无法识别“我的打卡”和“他人打卡”。

首页地图在 `onShow` 时会先加载本地缓存，再调用 `syncFromCloud()` 刷新 `checkedBy/checkinCount`，如果存在当前选中的 marker，会用云端新数据重设详情面板。这样从拍照打卡页返回后，底部卡片能显示最新打卡人数和打卡记录，而不是继续显示“还未有人打卡”。

任务详情页的“前往”按钮改为 `requestFocus(marker)` 后 `redirectTo('/pages/index/index')`，失败时 `reLaunch` 兜底，确保用户直接回到主地图并定位到对应打卡点，而不是返回任务与成就页。

主地图首次打开时会尝试 `pollLocationOnce()` 并居中到当前位置；只有当存在任务详情或打卡完成后的 focus target 时，才优先定位到目标打卡点。`useMapStore.moveToLocation()` 同步维护 `latitude/longitude` 和 `mapCenterLat/mapCenterLng`，避免新增点默认仍取旧中心。

下一步建议继续做 P3.2：补全历史本地打卡记录的安全回填接口，按 `markerId + uid` 幂等补写当前用户自己的 `checkedBy` 记录；同时在后台增加“同步诊断”页，展示某个 marker 的本地种子、云端 marker、checkedBy、用户 uid 是否一致，方便真机双账号验收。
---

## 2026-05-09 P3.2 下一轮计划入口

下一轮正式迭代目标为 **P3.2：打卡数据一致性与历史补传**，计划文件位于：

`docs/superpowers/plans/2026-05-09-p3.2-checkin-consistency.md`

执行顺序：

1. 先区分 App 端“当前用户已打卡”和云端“全局已有打卡记录”。
2. 再新增 `marker-center.repairCheckin()`，只允许当前登录用户按 `markerId + uid` 幂等补传自己的历史本地记录。
3. 然后让 `utils/cloudSync.uts` 检测本地已打卡但云端缺当前 uid 的记录，补传后重新拉云端刷新 UI。
4. 最后补后台同步诊断，并做双账号同一景点打卡验收。

---

## 2026-05-09 P3.2 打卡一致性与历史补传已落地

本轮完成 P3.2 的代码侧闭环：

- App 详情面板已区分“当前用户已打卡”和“全局已有打卡记录”。状态、距离提示和打卡按钮使用 `checkedBy[] + 当前 uni-id uid` 判断；全局人数仍使用 `checkinCount`，缺失时回退到 `checkedBy.length`。
- `marker-center.repairCheckin()` 已新增，补传只使用云对象认证得到的 `this.auth.uid`，不信任客户端 `userId`。同一 `markerId + uid` 已存在记录时返回成功但不再次递增 `checkinCount`。
- `utils/cloudSync.uts` 新增 `findRepairableCheckins()` 和 `repairMissingCheckins()`：先拉云端事实，再查找本地 `checked == true` 但云端缺当前 uid 的记录，补传后再重新拉云端刷新本地和 UI。
- 拍照打卡本地记录现在会保存当前 uid、`photoCloudURL`、备注和打卡时间，便于云端点同步后做历史补传。
- uni-admin 仪表盘新增同步诊断，显示云端打卡点数、有记录的点数、云端打卡记录数和 uni-id 用户数；打卡记录页会标出 `repaired: true` 的历史补传记录。
- 已清理 App `.uvue` 页面从 `vue` import `onShow` 的旧坑，页面生命周期继续使用 uni-app x 全局钩子。

本轮自动化验证命令：

```bash
node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js
node --test uniCloud-aliyun/cloudfunctions/marker-center/repair-service.test.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/user-center/index.obj.js
git diff --check
```

真机/服务空间验收仍需在 HBuilderX 中执行：

1. 上传 `marker-center`、`admin-center`，并确认 `repair-service.js` 随 `marker-center` 一起部署。
2. 后台先同步默认点和默认任务，打开仪表盘确认同步诊断数据能加载。
3. 账号 A 对同一景点打卡，账号 B 重新进入首页后应看到全局“已被 1 人打卡”，但 B 自己仍显示“未打卡”且范围内可继续打卡。
4. 账号 B 打卡后，App 和 uni-admin 打卡记录页总数应为 2；如果某条来自历史补传，后台应显示“历史补传”标记。

---

## 2026-05-09 P3.2 复测修复：禁止云端失败后本地假成功

针对真机复测现象“提示已打过卡 + 打卡成功双弹窗、照片短暂显示后消失、后台无记录、可重复打卡/重复完成任务、后台改名 App 不更新”，本轮补充修复：

- `pages/checkin/checkin.uvue` 对 `marker-center.checkin()` 使用 `customUI: true` 并解析 `catch` 中的业务错误；“请先登录 / 您已在此处打过卡 / 距离过远”不再进入本地 `doCheckIn()` 和任务完成链路。
- `syncMarkers(currentUid)` 将 `checked` 重新限定为当前 uid 的个人状态，不再把云端全局 `checked=true` 合并成本机当前用户已打卡。
- 历史补传避免误修复上一版遗留的“别人打卡导致本地 checked=true”脏数据：本地 `checkedBy` 存在但不含当前 uid 时不补传。
- 云端 marker 的标题、坐标、尺寸、创建者等基础字段现在会覆盖本地字段，后台改名后 App 下次同步即可看到新名称。

---

## 2026-05-09 P3.3 下一轮计划入口：打卡记录管理与照片审核

下一轮正式迭代目标为 **P3.3：打卡记录管理与照片审核**。这一轮先不进入路线/剧情系统，优先把“用户已打卡后的记录生命周期”和“后台人工审核照片”补齐。

执行顺序：

1. App 首页/详情面板识别当前用户已打卡时，外层就显示 `已打卡`，主按钮从 `打卡` 改成 `删除打卡`，不再让用户进入拍照页后才被云端拒绝。
2. 新增或扩展 `marker-center` 当前用户删除打卡接口：只允许按 `markerId + this.auth.uid` 删除自己的 `checkedBy[]` 记录，接口幂等，安全递减 `checkinCount`，第一版暂不回滚任务进度。
3. 删除后让 `utils/cloudSync.uts` 重新拉云端刷新 UI，保证 App、云端、后台对当前用户状态和全局人数一致。
4. uni-admin 打卡记录页改为按打卡点分组：一个打卡点卡片展示该点所有打卡记录，不再每条记录重复显示完整打卡点信息。
5. 后台照片审核增强：记录中保留小缩略图，但提供大图预览按钮/弹窗，为后续违规照片删除和人工审核流程预留入口。
6. `AdminHeader` 返回按钮改成左上角图标按钮，不显示“返回”文字。

验收重点：

- 已打卡用户在地图详情面板直接看到 `已打卡` + `删除打卡`。
- 删除只影响当前登录用户自己的打卡记录，不影响其他用户同一景点的记录和照片。
- 双账号同一景点场景下，A 删除后 B 的记录仍在；全局人数、他人足迹、后台记录数一致。
- 后台打卡记录页按 marker 分组展示，能打开较大的照片预览，便于人工审核。

复测重点：

1. 已打过卡时不应再叠加“打卡成功”toast，也不应新增后台记录或重复完成任务。
2. A 打卡后，B 看到全局 1 人但自己的图标/状态仍是未打卡。
3. 后台修改 marker 名称后，App 回首页触发同步，地图面板和列表名称应更新。

---

## 2026-05-09 P3.2 复测修复：同步真实 uid 与地图顶部减负

针对真机复测现象“云端已打卡，但首页详情仍显示未打卡；自己的照片刷新后进入他人足迹”，本轮继续收敛当前用户身份一致性：

- `pages/checkin/checkin.uvue` 在提交打卡前调用 `refreshUserIdFromAuth()`，先把本地 `userInfo.userId` 校正为 uni-id 真实 uid，再写入本地 `checkedBy[]`，避免本地临时记录用业务账号名、云端记录用 `_id` 导致刷新后无法识别“我的打卡”。
- 首页详情面板和 marker store 的 `checkedBy[].userId` 比较统一使用与云端同步逻辑一致的 `==`，降低 UTS/JSON 反序列化后的字符串包装差异风险。
- 首页地图顶部的经纬度、精度、总打卡数量信息条已删除，只保留登录 chip，把地图首屏空间还给地图本身。

复测重点：

1. 打卡成功返回首页后，等待云端刷新，当前景点仍应显示 `已打卡`，自己的照片仍在“我的打卡”，不应进入“他人足迹”。
2. 已打卡景点再次点击时，首页不应再显示可打卡状态；如后续 P3.3 接入删除打卡，主按钮应切换为 `删除打卡`。
3. 首页顶部不再显示经纬度、精度、`x/y 已打卡` 信息条，地图显示区域应明显增加。

---

## 2026-05-09 P3.3 打卡记录管理与照片审核已落地

本轮完成 P3.3 的代码侧闭环：

- App 首页详情面板在当前 uid 已存在于 `checkedBy[]` 时直接显示 `已打卡`，主操作切换为 `删除打卡`；创建者删除点位保留为 `删除点位`，避免和删除自己的打卡记录混淆。
- `marker-center.deleteCheckin()` 新增当前用户删除打卡接口，只接受 `markerId`，服务端只按 `this.auth.uid` 删除自己的 `checkedBy[]` 记录；接口幂等，未找到自己的记录时返回成功但不改数据。
- 删除打卡后 `utils/cloudSync.uts` 调用云对象并重新 `syncFromCloud(uid)`，刷新当前面板，确保 App 的个人状态、全局人数和后台记录来自同一份云端事实。
- 删除第一版只处理 `checkedBy[]` 和 `checkinCount`，暂不回滚 `user_tasks`、`rewards` 或任务完成状态，符合 P3.3 范围。
- uni-admin 打卡记录页改为按打卡点分组：一个点位卡片展示该点所有打卡人、时间、照片和备注，不再每条记录重复完整点位信息。
- 后台照片审核新增大图预览弹窗，列表保留缩略图，并预留“违规删除入口”按钮位，后续可接入删除违规照片/记录。
- `AdminHeader` 返回按钮改为左上角图标按钮，只显示返回图标，不再显示“返回”文字。

本轮自动化验证命令：

```bash
node --test uniCloud-aliyun/cloudfunctions/marker-center/repair-service.test.js
node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/user-center/index.obj.js
git diff --check
```

真机/服务空间验收仍需在 HBuilderX 中执行：

1. 上传 `marker-center`、`admin-center`，并确认 `repair-service.js` 随 `marker-center` 一起部署。
2. 账号 A 和 B 对同一景点打卡，确认后台该点分组下有 2 条记录。
3. 账号 A 在 App 首页详情面板点击 `删除打卡`，确认 A 的面板变回 `未打卡`，全局人数减 1，B 的记录和照片仍保留。
4. 打开 uni-admin 打卡记录页，确认同一 marker 分组记录数、照片预览弹窗和 App 侧人数一致。

---

## 2026-05-09 P3.3 复测修复

复测发现的 6 个问题（与本轮 commit 一同修复）：

1. 详情面板已打卡后看不到"他人足迹"——根因是 `<scroll-view scroll-y>` 内嵌一层 `<scroll-view scroll-x>`，UTS 5.07 真机会被横滑吞掉手势（参 PITFALLS §10.4）。改成单层纵向 `scroll-view direction="vertical"` + 他人足迹 flex-wrap 网格，所有他人照片都能纵向滑动展示，最多 12 张缩略图。
2. App 点击"删除打卡"提示"删除失败，请稍后重试"——根因是 `data["deleted"] as boolean` 在 nullable 上 ClassCastException 被外层 catch 吞掉。修复：先判 null 再 as；同时 toast 透传云端真实 `errMsg`。删除前增加 `refreshUserIdFromAuth()` 防止本地 userId 与云端 uid 不一致。
3. 后台只能删整个打卡点，不能删单条打卡记录——新增 `admin-center.deleteCheckinRecord({ markerId|_id, userId, checkedAt })`，按 `(userId, checkedAt)` 精确匹配 `checkedBy[]` 中一条。helper `createDeleteCheckinRecordPlan()` 在 `marker-service.js`，已加单测覆盖"匹配删除"与"幂等不存在"两路径。
4. 后台记录 entry 不显示打卡人用户名——`admin-center.getCheckins / getMarkerCheckins` 现在并行查 `uni-id-users.field({_id, username, nickname})`，由新 helper `buildUserLookup()` 折成 userId → userName 表，传给 `flattenCheckinRecords / groupCheckinRecordsByMarker`，每条 record 输出 `userName`（nickname → username → uid 兜底）。
5. 每条记录里冗长的 `照片 URL：…` 文案删除——前端 `entry-url` 删除，改用 `entry-uid` 在 nickname 与 _id 不同时小字展示 UID 便于支持。
6. "审核删除入口预留"按钮变成可工作的违规删除——卡片内每行多一个红色 `违规删除` 按钮，大图预览弹窗也接通同一删除接口；删除前 `uni.showModal` 二次确认，删除完成后 `reload()` 刷新分组与统计。删除按钮在请求期间禁用并显示"删除中…"。

本轮自动化校验（全绿）：

```bash
node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js
node --test uniCloud-aliyun/cloudfunctions/marker-center/repair-service.test.js
node --test uni-admin/pages/checkins/checkin-groups.test.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/repair-service.js
node --check uniCloud-aliyun/cloudfunctions/user-center/index.obj.js
```

真机/服务空间验收仍需 HBuilderX 完成：

1. 上传 `admin-center` 与 `marker-center`（包含 repair-service.js 与更新后的 marker-service.js）。
2. 详情面板：已打卡用户能纵向滑动看到全部他人足迹缩略图。
3. App 删除：点 `删除打卡`，toast 与云端 `errMsg` 一致；删除成功后全局人数 -1，B 的记录仍保留。
4. 后台违规删除：对一条非自己的记录点 `违规删除` → 二次确认后该 marker 分组少一条，人数 -1，App 端再刷新也看不到。
5. 大图预览弹窗的"违规删除该记录"按钮等价行为，删除完成后弹窗自动关闭。

---

## 2026-05-09 P3.4 下一轮计划入口：违规照片清理与个人打卡历史

下一轮正式迭代目标为 **P3.4：Record Cleanup & Personal History**，计划文件位于：

`docs/superpowers/plans/2026-05-09-p3.4-record-cleanup-and-personal-history.md`

P3.4 锁定的范围：

1. **云存储物理清理**：新增 `photo-center.deletePhoto(cloudURL)`，admin 违规删除时可选触发；用户自删默认仍只删数组项，需要二次确认才物理删除。
2. **审计日志**：新增 `tourism_audit_logs` 集合，admin 违规删除与用户自删都追加一条；后台新增审计页可按 type 过滤分页。
3. **App 我的打卡页**：新增 `pages/my-checkins/my-checkins.uvue`，通过 `marker-center.getMyCheckins()`（仅当前 uid）拉自己的全部记录，照片网格 + 时间排序 + 点击跳回地图聚焦。
4. 出 P3.4 之外的事（明确不做）：路线/剧情、撤销机制、任务进度回滚、推送通知 —— 留 P4 或独立迭代。

P3.4 验收重点：

- 真机：admin 违规删除带 purgePhoto 后，该 cloudURL 在云存储控制台不再可访问。
- 后台审计页能列两种类型并显示 actor/target uid、marker、photoCloudURL（已物理删除则标 cloud-deleted）。
- App 我的打卡页能纵向滑动，点击跳回地图，删除后人数与详情面板同步刷新。

---

## 2026-05-10 P3.4 已落地（含两件新增小特性 + dashboard 修复）

本轮 6 个 commit（按时间顺序）：

| commit | 主题 |
|--------|-----|
| `36012ed` | feat(checkin): admin record review with username + violation delete（P3.3 follow-up 落盘） |
| `fda9ef2` | fix(admin): render recent checkins with username and photo（dashboard B 方案） |
| `428f506` | feat(admin): cascade delete user with marker / task / reward purge（新增 A） |
| `304abf9` | feat(photo): violation delete optionally purges cloud storage file（P3.4 Task 1） |
| `229542d` | feat(audit): tourism_audit_logs writes from delete paths and admin viewer（P3.4 Task 2） |
| `df8a956` | feat(app): personal checkin history page with photo, focus, delete（P3.4 Task 3） |

设计要点：

- **dashboard 修复（B 方案）**：admin-center 新增 `getRecentCheckins({ limit })` 返回扁平 record 列表，dashboard 切换调用并按 username/time/marker/note/photo 渲染。原因是 P3.3 把 `getCheckins` 改成 marker 分组，dashboard 仍按扁平 record 渲染，导致除 `markerTitle` 外字段全 undefined。
- **后台删除用户**：`admin-center.deleteUser({ _id })` 拒绝删自己 / 最后一个 admin；用纯函数 `createPurgeUserCheckinsPlan(marker, uid)` 描述每个 marker 的 patch；级联删除统计 / user_tasks / rewards / colUsers；toast 显示清理数量。详见 PITFALLS §规则 26。
- **物理删图**：photo-center 新增 `deletePhoto({ cloudURL })`，仅允许 `/checkin-photos/` 命名空间；admin 违规删除接 `purgePhoto` 选项；物理删除失败仅记 `purgeError`，不回滚数据库。详见 PITFALLS §规则 27。
- **审计日志**：`tourism_audit_logs` 集合 + `audit-service.js`（含单测）+ `getAuditLogs({ offset, limit, type? })` + 新审计页 `uni-admin/pages/audit/index.vue`。三种 type：`admin.deleteCheckinRecord` / `admin.deleteUser` / `user.deleteCheckin`。详见 PITFALLS §规则 28。
- **App 我的打卡页**：marker-center 新增 `getMyCheckins`（嵌套字段 where + 服务端 filter）；cloudSync 新增 `pullMyCheckins(): Promise<MyCheckinEntry[]>` 用 `JSON.parse<T[]>()` 真实构造类型；新页用单根纵向 scroll-view，删除走 actionSheet，跳回地图复用 `requestFocus`。详见 PITFALLS §规则 29。

本轮自动化校验（全绿，36 测试用例）：

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

真机/服务空间验收（HBuilderX 双账号）：

1. **部署云函数**：`admin-center`、`marker-center`、`photo-center` 三个目录全部上传。云存储建议预先在控制台创建一张 `tourism_audit_logs` 集合（schema 不强制，留默认）。
2. **dashboard 验收**：仪表盘"最近打卡记录"每条显示用户名、时间、所在 marker、备注、照片缩略图、补传 tag；空数据文案与 P3.3 一致。
3. **删除用户验收**：用户管理页 → 选一个非自己的账号 → 红色"删除"→ 二次确认 → 该用户消失，toast 显示清理数量；该用户在 marker.checkedBy[] 里的所有打卡都被清空，dashboard 总数同步下降；用户自己那一行的按钮显示"本人"且禁用。
4. **物理删图验收**：打卡记录页 → 选一条带照片的违规删除 → 选"确认"（同步物理删图）→ 等 toast"已物理删除照片"→ 在云存储控制台搜原 cloudURL 应已 404；选"仅删记录"则数据库 entry 已删但 cloudURL 仍可访问。
5. **审计日志验收**：仪表盘"审计日志"入口 → 列表按 occurredAt 倒序 → type chip 筛选三种事件 → 每条卡片显示 actor/target 名字、marker、原打卡时间、原因、purge 结果；用户在 App 自删一条打卡 → 审计页"用户·自删"分类多一行。
6. **App 我的打卡验收**：登录 → 顶栏 chip → 选"我的打卡"→ 列表按月分隔 → 单条卡片可纵向滑动到底（不卡住手势）→ 点照片大图预览 → 点"在地图上查看"切回首页并 focus 该 marker → 点"删除打卡"actionSheet 二次确认后云端真的删除，再回到列表已少一条。
7. **双账号联调（A/B）**：A 在 marker_X 打卡 → B 进同 marker → 详情面板"他人足迹"显示 A 的照片 → admin 违规删除 A 这条记录（带 purgePhoto）→ A 端 my-checkins / 首页 / B 端详情面板都看不到该照片，三处人数一致 -1。

---

## 2026-05-10 P3.4 真机验证 hotfix（commit `428b7ae`）

P3.4 真机首次编译/运行后发现并修复的三类问题：

1. **uvue 编译错 — `display: block` 不被支持**：`pages/my-checkins/my-checkins.uvue` 的 `.month-label` 用了 web CSS 的 `display: block`，uvue Android 只接受 `flex|none`。删除即可，`<text>` 默认就有行为。
2. **uvue 编译错 — error 18 `找不到名称 runDelete`**：UTS 5.07 函数提升不稳定，`confirmDelete` 在 actionSheet success 回调里调用了下方声明的 `runDelete`。把 `runDelete` 上移到 `confirmDelete` 之前即可。已加入 PITFALLS §规则 30。
3. **`Method was not found` 不是代码错，是云函数没部署**：`getRecentCheckins` / `deleteUser` / `getMyCheckins` / `deletePhoto` 都已写入源码并 commit，但 HBuilderX 还没把新版本上传到关联的服务空间。修复 = 在 HBuilderX 里右键 `admin-center` / `marker-center` / `photo-center` 三个云函数目录 → "上传部署"。云存储控制台同时新建 `tourism_audit_logs` 集合（schema 留默认）。
4. **后台违规删除 UX 简化**：原"仅删记录 / 同步物理删图"二选一改回单一二次确认 modal —— "取消 / 违规删除"，默认一并物理清照片（如果有），让 admin 不用替后端做"删数据库 vs 删文件"的选择。已加入 PITFALLS §规则 31。

---

## 2026-05-10 P4 下一轮计划入口：主题路线（Themed Routes）系统

下一轮正式迭代目标为 **P4：主题路线 P0**。计划文件位于：

`docs/superpowers/plans/2026-05-10-p4-themed-routes.md`

P4 锁定的范围：

1. **新数据集合**：`tourism_routes`（admin 维护的多 marker 主题路线）+ `user_routes`（用户路线完成记录，`(userId, routeId)` 唯一）。
2. **后台路线管理页**：`uni-admin/pages/routes/index.vue` 含列表 / 新建 / 编辑 / 归档 / 删除；admin-center 新增 `route-service.js` 纯函数 helper（calcRouteProgress / isRouteCompleted）+ 5 个 CRUD 云方法 + 单测。
3. **App 路线列表 + 详情**：`pages/routes/routes.uvue` 拉 active 路线 + 当前 uid 进度；`pages/route-detail/route-detail.uvue` 顺序展示 marker，已打卡标 ✓ 未打卡显示距离。`marker-center.getActiveRoutes()` 公开读，不进 admin 鉴权。
4. **路线完成检测 + reward 发放**：`marker-center.checkin()` 写库后异步检测哪些路线刚刚完成，写 `user_routes` + `rewards`（`(userId, routeId)` 幂等），响应里带 `completedRoutes` 列表给 App 庆祝。新增纯函数 `route-completion.js` + 单测。
5. **首页入口 + my-checkins 路线 tag + 文档**。

P4 明确不做：路线分支剧情、推送通知、照片合集、奖励兑换商城、评论 / 点赞。

P4 验收重点：
- 后台 → 创建一条"湖湘文化之旅" 路线（选 3 个种子 marker） → App 用户 A 打卡 3 个 → checkin 响应携带 `completedRoutes` 弹庆祝；user_routes 多一行；rewards 多一条；删除 → 重新打卡 **不应**重复发奖。
- 用户 B 打完同条路线 → user_routes 两行，互不干扰。
- 后台归档路线 → App 列表不再显示。

P4 工作量预估：5 commits / 1-2 天。每个 task 都要单独 `node --test` + `node --check` 验证后再 commit，避免 P3.4 那种"一气推完才发现编译错"的返工。

## 2026-05-10 P4 Task 1+2 已落地（admin 链路闭环，App 端待完成）

**落地 commits**：
- `523e272` feat(routes): admin-center route CRUD + sanitize/progress helpers
- `7c6dfd6` feat(routes): admin routes management page + dashboard entry

**Task 1（云函数 + 纯函数 helper）**
- 新增 `uniCloud-aliyun/cloudfunctions/admin-center/route-service.js`：
  - `sanitizeRouteCreate / sanitizeRouteUpdate`：白名单 + 长度校验（name ≤30、description ≤200、reward ≤100、coverImage ≤1024、markerIds ≤50 项且去重 + 正整数）。
  - `validateRouteMarkerIds(markerIds, allMarkerIds)` 校验外键存在。
  - `calcRouteProgress / isRouteCompleted` 纯计算，下一轮 marker-center 复刻最小写法（uniCloud 不支持跨 cloudfunction require）。
- 新增 `route-service.test.js` 共 10 例：覆盖 sanitize 边界（空名 / 超长 / markerIds 空 / 非数组 / 0 与字符串 / 状态白名单）、update 局部字段、validateRouteMarkerIds 缺失检测、progress 计算、完成判定。
- `admin-center/index.obj.js` 新增 5 个云方法 `getRoutes / createRoute / updateRoute / deleteRoute / getRouteProgressByUser`。`createRoute / updateRoute` 落库前对照 `tourism_markers.id` 全表校验 markerIds；`getRouteProgressByUser` 走 `'checkedBy.userId': uid` 嵌套字段查询（与 §规则 29 同款索引友好写法）。
- 全套验证 46 测试 + 7 语法检查全绿。

**Task 2（uni-admin 路线管理页）**
- 新增 `uni-admin/pages/routes/index.vue`：列表 + 状态 tab（全部/进行中/已归档）+ 关键词搜索 + 新增/编辑 modal（marker chip 选择器自带 1/2/3 顺序徽章，按勾选顺序作为路线顺序）+ 归档/激活快捷切换 + 删除二次确认（红色 confirmText）。
- `uni-admin/pages.json` 注册 `pages/routes/index`；`pages/dashboard/index.vue` "section-actions" 加"主题路线"入口（navigateTo）。
- 第一版封面图用 cloudURL 输入框承载，admin uploadFile 直传留作后续增强。
- modal 输入框 hotfix：原 `padding: 14rpx 16rpx; font-size: 26rpx` 在 H5 上输完一行字看不全，调整为 `padding: 20rpx; font-size: 28rpx; line-height: 1.6; min-height: 80rpx`（textarea 140rpx）。

**注意：admin 链路是普通 Vue / H5，不触发 uvue 限制。** 这一段落里的 `display: grid` / `position: fixed` / `inset: 0` 等写法在 uvue Android 上都会爆，下轮 Task 3 写 `.uvue` 时不能照抄管理页 CSS。

**P4 剩余 Task（Task 3-5，下次会话推进）**：
- Task 3：`marker-center.getActiveRoutes()` 公开读 + `cloudSync.uts pullActiveRoutes` + `pages/routes/routes.uvue` + `pages/route-detail/route-detail.uvue` + pages.json 注册。**这是 P4 第一次写 .uvue，PITFALLS §规则 23 / §规则 29 / §规则 30 必读**：display 仅 flex/none、scroll-view 不能纵向嵌横向、函数提升不稳（被引用的 async 函数必须先声明）、JSON.parse<T[]>() 边界（不要写 as RouteWithProgress[]）。
- Task 4：`marker-center/route-completion.js` 纯函数 + 单测 + checkin/repairCheckin 写库后异步触发 + `user_routes / rewards` `(userId, routeId)` 幂等写入。注意 marker-center 里要复刻 isRouteCompleted/calcRouteProgress 最小写法（不能 require admin-center），靠测试守住 schema 一致。
- Task 5：首页 actionSheet 加"主题路线" + my-checkins 卡片"属于 X 路线" tag（getMyCheckins 服务端 join routeIds）+ PITFALLS §规则 32（如果新踩坑）+ prompt 加 P4 完整落地段。

**Task 3 真机验收前置**：写完 `routes.uvue` / `route-detail.uvue` 单页后必须先单独跑一次 HBuilderX 编译确认无 error 18 / display 报错，不要堆到 Task 4-5 才发现要回头改。

## 2026-05-10 P4 全部 5 个 Task 落地（admin + App 端 P0 闭环）

**落地 commits**：
- `523e272` Task 1：admin-center route CRUD + 纯函数 helper + 10 例单测
- `7c6dfd6` Task 2：uni-admin 路线管理页 + dashboard 入口
- `6a3c1ab` hotfix：modal 输入框高度 + 文档维护
- `6ccf5c9` Task 3：App 路线列表 + 详情 + cloudSync.pullActiveRoutes
- `2469d7a` Task 4：route-completion 纯函数 + 8 例单测 + checkin/repairCheckin 触发 user_routes / rewards 幂等写入
- *本次 Task 5 commit*：首页 actionSheet 入口 + checkin 完成庆祝 toast + my-checkins 路线 tag + getMyCheckins 服务端 join routes + 文档

**Task 3 落地点**（App 端首次 P4 .uvue）
- `marker-center.getActiveRoutes()`：公开读，未登录进度全 0；按 createdAt desc 返回 active 路线 + 当前 uid 进度。复刻 calcRouteProgress（Task 4 抽到 route-completion.js 后切到共享 helper）。
- `cloudSync.pullActiveRoutes(): Promise<RouteWithProgress[]>` 用 JSON.parse<T[]>() 边界。
- `pages/routes/routes.uvue`：列表 + 进度 pill + 进度条 + 奖励文案，单根 scroll-view（§规则 23），onShow 全局钩子（§规则 16），display 仅 flex/none（§规则 30）。
- `pages/route-detail/route-detail.uvue`：onLoad 读 query.id，按 id 找路线后渲染节点列表（已打卡 ✓ / 待打卡 + "去这里" 按钮 → requestFocus + switchTab 回首页）。markerIds 客户端用 useMarkerStore 做 join 拿 title 与 lat/lng。

**Task 4 落地点**（路线完成检测 + 奖励发放）
- `marker-center/route-completion.js` 纯函数：calcRouteProgress / isRouteCompleted / findNewlyCompletedRoutes / buildUserRouteEntry / buildRouteRewardEntry。语义与 admin-center/route-service.js 完全一致，由两侧测试守 schema。
- `detectAndRecordCompletedRoutes(uid, now)` 共享 helper：拉 active routes + 当前 uid 已记账 routeIds + done marker set → 算出新完成的路线 → 幂等写 user_routes + rewards。子写失败仅 console.log，不阻塞主 checkin（与 §28 审计失败不阻塞同思路）。
- `checkin / repairCheckin` 写库后调用 detect，data 多带 `completedRoutes: [{id, name, reward}]`。
- `getActiveRoutes` 重构使用共享 calcRouteProgress（删掉旧 inline）。
- 新增集合 `user_routes`：`{ userId, routeId, routeName, completedAt, rewardClaimed:false }`，`(userId, routeId)` 由应用层查询防重复。

**Task 5 落地点**（入口 + tag + 文档）
- `pages/index/index.uvue` `goTasks()` 改 actionSheet：`['任务', '主题路线']`（§规则 32：底栏 slot 已满，复合入口走 actionSheet，避免触控热区被挤压）。
- `pages/checkin/checkin.uvue` 打卡成功后解析 `data.completedRoutes`，1.8s 后弹"🎉 路线完成：X"toast（不弹 modal，§10.4 四次调整避坑）。`extractCompletedRoutes` 用 `JSON.parse<CompletedRouteNotice[]>()` 边界（§规则 33：嵌套对象列表禁止 as 假 cast）。
- `marker-center.getMyCheckins` 服务端 join active 路线，返回每条 entry 多带 `routes: [{id, name}]`。归档路线不参与匹配（admin 归档后用户卡片不再显示 tag）。
- `cloudSync.MyCheckinEntry` 类型加 `routes: MyCheckinRouteRef[]`。
- `pages/my-checkins/my-checkins.uvue` 卡片下方渲染"属于 X 路线"小 tag。
- `UTS_COMPILE_PITFALLS.md` 加 §规则 32（actionSheet 复合入口）+ §规则 33（跨页响应嵌套对象 typed parse）。

**P4 真机验收清单**（HBuilderX 部署 admin + 重新打包 App + 双账号联调）
1. 后台 → 主题路线管理 → 新增"湖湘文化之旅"，markerIds = [3, 5, 7]，奖励"20 积分 + 路线徽章"。
2. App 用户 A 登录 → 底部"任务"按钮 → actionSheet 选"主题路线" → 路线卡片显示 0/3 进度条。
3. 用户 A 打卡 marker 3 + 5 → 路线列表卡片自动 2/3，点详情进去看节点 1/2 是 ✓，节点 3 是"去这里"。
4. 用户 A 打卡 marker 7 → checkin 完成 toast 后 1.8s 弹"🎉 路线完成：湖湘文化之旅"toast。
5. 用户 A 打开 my-checkins → marker 3/5/7 卡片下方各有一个绿色"属于 湖湘文化之旅" tag。
6. 用户 A 删除 marker 7 的打卡 → 路线列表回到 2/3；重新打卡 marker 7 → **不再弹路线完成 toast**（user_routes 幂等去重）；rewards 集合不再多一行（仍是 1 行）。
7. 用户 B 完成同条路线 → user_routes 多一行（2 行），互不干扰。
8. 后台把路线归档 → App 路线列表不再显示该路线；my-checkins 卡片的 tag 也消失（active 过滤）。

**已知未做（明确踢出 P4 范围）**
- 路线分支剧情、推送通知、照片合集、奖励兑换商城、评论 / 点赞 —— 留 P5+。
- admin uploadFile 直传封面图（第一版用 cloudURL 输入框承载，admin 可手贴 cloudURL）。
- "我的奖励" 页（rewards 集合已经在写，但还没有专门的 App 页面展示）。

**下一轮（P5）候选起点**：根据真机反馈决定优先级——奖励兑换商城（rewards.rewardClaimed 给前端用）、推送通知（路线完成 push）、或路线推荐（基于位置 / 已完成 markers 推路线）。计划入口在 `docs/superpowers/plans/` 起新文件。

## 2026-05-10 P4 真机编译 hotfix（commit `1da9026`）

**报错**：`pages/route-detail/route-detail.uvue:115 / :144` 报 `Cannot create an instance of an abstract class` 与 `Too many arguments for 'constructor(): Number'`。

**根因**：UTS 5.07 不支持 web JS 的 `Number(value)` 全局函数 —— Number 在 Kotlin 侧被当成 abstract 类、零参 constructor。

**修法**（已落地）：
- `Number(r.id)` → 删掉，r.id 已是 number 类型直接 `===` 比较
- `Number(idStr)` → `parseInt(idStr!!)`
- `Number.isFinite(n)` → `!isNaN(n)`

PITFALLS §规则 34 已登记（同时给出 web JS → UTS 5.07 的转换映射表，含 `Number.isInteger` / `Number.parseFloat` / `String()` 等同源踩坑）。下次写 .uvue / .uts 之前 grep `Number\(` 自检即可。

## 2026-05-10 P4.1 下一轮候选：admin UX 二级入口收纳

P4 主功能验证后，用户对 uni-admin 的两个 UX 调整提出需求（已规划，未实施）：

1. **主题路线入口位置**：从 dashboard `section-actions`（"最近打卡记录"段右上角）移到 `pages/tasks/index.vue` 的"同步默认任务"按钮右侧 —— 把"任务"和"路线"两个**配置型管理页**放一起（语义同源，都是 admin 在维护 App 用户的玩法配置），而不是和"审计日志/查看全部记录"放一起（那两个是**审阅型查询**）。

2. **打卡记录页改造为入口集合**：当前 `uni-admin/pages/checkins/index.vue` 是单一打卡记录列表 + 违规审核入口；改造成"分类按钮卡片墙"，常见入口（打卡记录列表 / 审计日志 / 最近打卡 / 同步诊断 等）每个一张卡片，点击进对应详情页。

详细规划见对应 plan 文档（待新建：`docs/superpowers/plans/2026-05-1X-p4.1-admin-ux-refactor.md`）。

## 2026-05-10 P4.1 已落地（admin UX 二级入口收纳，commit `a2789a6`）

**需求 A — 主题路线入口归位**
- `dashboard/index.vue` `.section-actions` 删 "主题路线" 链接 + 删 `goToRoutes()`。section-actions 仅保留"审阅型查询"（审计日志、查看全部）。
- `tasks/index.vue` 新增 `.toolbar-actions` flex 容器，把"同步默认任务"和"主题路线"两个**配置型管理**入口放一起；新增 `goRoutes()` + `.btn-sm.ghost` 描边样式。

为什么这样归类：dashboard 的 `section-actions` 语义是"审阅型查询"（看记录、看审计），主题路线属于"配置型管理"（admin 在维护 App 用户的玩法配置），跟"任务"同源；放到 `tasks/index.vue` 的 toolbar 里语义最对。

**需求 B 方案 1 — checkins 页顶部 quick-nav chip 行**
- `checkins/index.vue` 在 AdminHeader 之下、搜索栏之上加 `<view class="quick-nav">`，4 个 chip：[📋 打卡记录]（active=当前页）/ [🛡 审计日志] / [📊 同步诊断] / [🕐 最近打卡]。
- 3 个非 active chip 导航：`goAudit()` → `/pages/audit/index`；"同步诊断" + "最近打卡" 都活在 dashboard，复用 `goDashboard()` switchTab 回去。
- 现有打卡记录列表 + 违规审核 + 照片预览 **0 破坏**，dashboard / markers 页对 `/pages/checkins/index` 的 navigateTo 全部保留。

**未升级方案 2 / 3 的边界**：当前 chip 入口共 4 个，方案 1 顶部一行容得下；如果未来增长到 5+ 个或 chip 行折行了，再升级到"入口卡片墙"或"hub + tab 切换"重构。

**未做（明确踢出 P4.1 范围）**
- 同步诊断 / 最近打卡 没有独立页 —— 复用 dashboard switchTab 回到原段。如果未来要给它们独立 deep-link 入口，新建 `/pages/sync-diagnostics/index.vue` + `/pages/recent-checkins/index.vue`。
- chip 没有"已激活路由 = 自动高亮当前 chip"的通用机制——本页 active 是写死的。如果未来 hub 化，需要按 `currentRoute` 动态算 active。

## 2026-05-10 P4 / P4.1 之后下一步迭代候选（暂无正式 plan 文档）

**候选 1：奖励兑换商城（P5-A）— 推荐优先级最高**
P4 已经在 `rewards` 集合里写了 `{ userId, routeId|taskId, reward, source: 'route'|'task', earnedAt, rewardClaimed: false }`，但 App 端**没有任何页面**让用户看到"我有什么奖励 + 怎么兑换"。下一轮做：
- `pages/rewards/rewards.uvue`：我的奖励列表，按 source 分组（路线奖励 / 任务奖励），未兑换的高亮。
- `marker-center.getRewards()` 已有，需要扩展返回 `routeName / taskName` join。
- `marker-center.claimReward({ rewardId })` 新方法：把 `rewardClaimed` 标 true，写审计日志（参 §28）。
- 可选：admin 后台加"奖励管理"页看谁兑了什么。

**候选 2：推送通知（P5-B）—— 依赖 unipush 集成**
路线完成 / 任务完成时 push 用户。需要先做 unipush SDK 集成，工作量较大。

**候选 3：路线推荐（P5-C）—— 智能化但价值不直接**
"基于当前位置 / 已完成 markers 推荐相邻路线"。需要 marker 与 route 的地理近邻索引，工作量中等。

**候选 4：admin uploadFile 直传封面图（P4.2 收尾）**
当前 admin 路线管理页用 cloudURL 输入框承载封面图，admin 要先去云存储手贴 URL。改成 `uniCloud.uploadFile` 直传到 `route-covers/<adminUid>/<ts>_*.jpg` 命名空间（与 photo-center 隔离，参 §规则 27）。工作量小（~50 行）。

**候选 5：admin checkins 入口墙升级到方案 2 / 3**
等 chip 数量增长到 5+ 时再启动。

**建议下次会话先做候选 1**：rewards 是 P4 已经在写但没消费的"半成品数据"——闭环它能让用户立即感知到 P4 的价值。预估 1 day / 4-5 commits。

下一轮 plan 文档入口：`docs/superpowers/plans/2026-05-1X-p5-rewards-claim.md`（待新建）。

## 2026-05-10 下一轮额外目标：首页底栏浮动按钮重构（与 P5-A 同轮迭代）

**用户需求原话**：把首页底栏 4 个按钮改成"登录按钮那样的样式"，放屏幕两边。任务 actionSheet 拆开成"路线"+"任务"两个按钮放左下角。放大/缩小/定位三个按钮按顺序从上到下放右下角。

**目标布局**：
- 删掉 `.bottom-toolbar` 整个白底栏（当前 height: 120rpx 顶在地图下方），地图占满全屏。
- **左下角**：胶囊浮动按钮垂直堆叠 [路线（实心绿） / 任务（白底绿描边）]，样式参考 `.auth-chip`（line 507）。
- **右下角**：圆形浮动按钮垂直堆叠 [+ / − / 定位]（定位蓝色保留 `#1e88e5`）。
- 现有 `.floating-add-btn`（地图中下方"添加打卡点"圆按钮）保留，bottom 从 200rpx 调到 64rpx 与新 stack 底基线对齐。
- `marker-panel`（点 marker 弹的详情面板）显示时，用 `v-if="!activeMarker"` 把左下/右下 stack 隐藏，避免挡住面板里的"去打卡 / 删除"按钮。

**actionSheet 拆解**：
- 原 `goTasks()`（line 404）当前是 `uni.showActionSheet({itemList:['任务','主题路线']...})`。
- 改成两个独立函数 `goTasksOnly()` / `goRoutes()`，分别是直接 `uni.navigateTo`，不再走 actionSheet。

**CSS 草图**（参考 `.auth-chip` 已验证可用的胶囊浮动写法）：
```
.bl-stack { position: absolute; left: 24rpx; bottom: 64rpx;
            display: flex; flex-direction: column; }
.bl-btn { padding: 14rpx 28rpx; border-radius: 999rpx; margin-bottom: 16rpx;
          box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08); }
.bl-btn-route { background-color: #2ecc71; }
.bl-btn-task  { background-color: #ffffff; border: 2rpx solid #2ecc71; }
.bl-btn-text-on  { color: #ffffff; font-size: 26rpx; font-weight: 500; }
.bl-btn-text-off { color: #2ecc71; font-size: 26rpx; font-weight: 500; }

.br-stack { position: absolute; right: 24rpx; bottom: 64rpx;
            display: flex; flex-direction: column; }
.br-btn { width: 88rpx; height: 88rpx; border-radius: 999rpx;
          background-color: #ffffff; margin-bottom: 16rpx;
          box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
          display: flex; align-items: center; justify-content: center; }
.br-btn-locate { background-color: #1e88e5; }
.br-btn-text { font-size: 36rpx; color: #2ecc71; font-weight: 600; }
.br-btn-locate .br-btn-text { color: #ffffff; font-size: 24rpx; font-weight: 500; }
```

**PITFALLS 边界**：
- §规则 30：display 仅 flex|none —— flex-direction: column 允许，gap 不要用，改 margin-bottom（uvue Android 对 gap 支持不完整时的兜底，参 `.auth-chip` 系列也没用 gap）。
- §规则 30 后半：被引用的函数先声明 —— 模板里 `@click="goRoutes"` 引用前 `<script>` 顶部就要有 `function goRoutes()`，习惯位置和 `goAuth` 同高度。
- `position: absolute` + bottom 在 uvue Android 已经被 `.auth-chip` / `.floating-add-btn` 双重验证可用，不需新 PITFALLS 规则。
- 删掉的 CSS：`.bottom-toolbar` / `.bar-btn` / `.bar-label` / `.task-tone` / `.locate-tone`（line 513-538）全部移除；模板里 `<view class="bottom-toolbar">` 整段（line 85-98）移除。

**实施量预估**：约 80-120 行 / 1 commit / 0.5 day，与 P5-A 奖励商城任务（4-5 commits）平行推进，建议作为 P5-A 的 Task 6（最后一项 UI 收尾）或者独立成 P5-B-UI 单 commit。

**真机验收**：
1. 首页地图占满整屏（无白底底栏）。
2. 左下角看到 [路线（绿色实心）] 在上、[任务（白底绿边）] 在下，点击分别跳路线列表 / 任务页。
3. 右下角看到 [+] [−] [定位（蓝色）] 三个圆按钮垂直堆叠，分别工作。
4. 点击地图上某 marker → 弹出 marker-panel，左下/右下 stack 自动隐藏；关闭面板 stack 重现。
5. 浮动 "+" 添加打卡点按钮位置正常（bottom: 64rpx 居中），不与 stack 重叠。
6. iOS / Android 真机底部 safe-area（home indicator）不挡按钮——按钮 bottom 64rpx 已留出余量；如果 iPhone X 系列仍被挡，再加 `padding-bottom: env(safe-area-inset-bottom)` 到 stack 容器。

## 2026-05-10 P5-A + P5-B-UI 已落地（奖励兑换闭环 + 首页浮动按钮）

**落地 commits**：
- `ef8e71a` Task 1：`marker-center/reward-service.js` 纯函数 helper + 7 例单测，覆盖 claimed patch、route/task join、旧 task 行兼容与缺失来源兜底。
- `da7c6f7` Task 2：`marker-center.getRewards()` 服务端 join active routes/tasks；新增 `claimReward({ rewardId })`，按 `_id + this.auth.uid` 校验归属后写 `rewardClaimed/claimedAt`；admin-center 与 marker-center 双侧审计 schema 增加 `user.claimReward`。
- `5cd78ef` Task 3：`utils/cloudSync.uts` 新增 typed `RewardEntry[]` 边界与 `claimReward(rewardId): Promise<boolean>`，`pullRewards()` 使用 `JSON.parse<RewardEntry[]>()`，避免 UTSJSONObject 假 cast。
- `4138619` Task 4/5：新增 `/pages/rewards/rewards` 我的奖励页；首页 auth-chip actionSheet 增加“我的奖励”入口。
- `1773620` Task 6：首页删除 `.bottom-toolbar` 白底栏，改为左下“路线/任务”和右下“+/−/定位”浮动按钮；marker-panel 打开时隐藏两侧 stack 和新增按钮。

**真机验收点**：
1. 部署 `marker-center` 后，用户完成任务或路线，打开首页右上角 auth-chip → “我的奖励”，能看到“共 X 条奖励 · 已兑 Y / 待兑 Z”。
2. 奖励页按“路线奖励 / 任务奖励”分段，卡片展示 routeName/taskName、reward、earnedAt、已兑/待兑 badge。
3. 待兑卡片点“兑换”→ actionSheet 确认 → 调 `marker-center.claimReward`，成功后刷新为已兑；`rewards` 行写入 `rewardClaimed:true`、`claimedAt`，`tourism_audit_logs` 追加 `type='user.claimReward'`。
4. 用户 A 不能兑换用户 B 的 reward：服务端按 `{ _id: rewardId, userId: this.auth.uid }` 查找，查不到返回无权/不存在。
5. 首页地图占满整屏，无底部白栏；左下“路线/任务”分别直达 routes/tasks；右下“+/−/定位”保持原功能。
6. 点击 marker 打开详情面板时，左下/右下 stack 与中间“在此新增”隐藏，避免覆盖面板按钮；关闭面板后恢复。

**验证记录**：
- Node 单测：`node --test` 全套 66 例通过。
- 云函数语法：`node --check` 全套通过。
- 静态自检：`pages/index/index.uvue`、`pages/rewards/rewards.uvue`、`utils/cloudSync.uts` 未命中 `Number\(` / `Number\.` / 非法 `display` / 旧底栏 class。
- HBuilderX CLI：本机 `D:\HBuilderX\cli.exe` 可启动 v5.07，但 `launch app-android --compile true` 与 `lsp lint` 在当前会话均超时无诊断输出；本轮仍需在你的 HBuilderX UI 内做真机编译复验。

## 2026-05-10 P5 真机反馈与 P5.1 下一轮方向

**HBuilderX CLI 反馈**：
- CLI 编译无诊断输出并超时，很可能与 HBuilderX UI 未运行、项目未导入/未打开有关。HBuilderX CLI 不是完全独立的 headless 编译器，后续验证前先打开 HBuilderX，并确认 `map_new` 与需要时的 `uni-admin` 都在项目列表里。

**已确认产品语义**：
- 主题路线完成不要求按顺序打卡；只要路线内全部 marker 都完成打卡，即可触发路线完成与奖励发放。后台 marker chip 的 1/2/3 顺序用于展示路线节点顺序，不是完成判定顺序。
- `users.totalCheckins` 当前更像“累计打卡次数/历史计数”，管理员删除打卡记录后不会自动回退。因此用户管理页看到的打卡次数不等于“当前有效打卡数”。下一轮需要明确拆成两个口径：累计打卡数与有效打卡数，避免 admin 误判。
- 后台目前缺少“用户获得了多少积分/奖励”的聚合视图。`rewards.reward` 仍是字符串文案，下一轮若要做积分统计，应补标准化数值字段或可靠解析 helper。

**真机发现缺陷**：
- App 端 `pages/route-detail/route-detail.uvue` 里“去这里”按钮点击无反应。当前实现是 `requestFocus(local)` 后 `uni.switchTab({ url:'/pages/index/index' })`，但项目没有 tabBar，`switchTab` 不适用。下一轮优先修为 `requestFocus(local)` + 可工作的普通导航链路，并用真机验证从路线详情回首页聚焦 marker。

**P5.1 推荐迭代范围**：
1. 修复路线详情“去这里”导航。
2. 后台用户管理统计口径重构：显示“有效打卡数”和“累计打卡数”，删除记录后有效数能变化。
3. 后台增加用户积分/奖励聚合：按 userId 汇总 rewards，展示总积分、待兑/已兑、路线奖励/任务奖励数量。
4. 如本轮顺手触碰 rewards schema，补 `rewardPoints` 规范化字段；否则先用 helper 从 `reward` 文案解析整数积分并写单测守住。

## 2026-05-10 P5.1 已落地（真机反馈修复 + 后台统计/积分增强）

**落地 commits**：
- `7cb9a40` Task 1：修复 `pages/route-detail/route-detail.uvue` “去这里”导航，保留 `requestFocus(local)`，有页面栈时走 `uni.navigateBack()`，无可返回页面时 `uni.reLaunch({ url:'/pages/index/index' })`，不再对非 tabBar 项目调用 `switchTab`。
- `be5ba59` Task 2/3：后台用户统计拆口径，新增 admin-center active checkins 聚合与 rewards 积分聚合；用户管理页展示“有效打卡 / 累计打卡”以及“总积分 / 待兑 / 已兑”；新写入 route/task rewards 带 `rewardPoints`，旧数据仍通过 `parseRewardPoints(reward)` 解析。

**统计口径定义**：
- `totalCheckins`：累计打卡数，来自 `users` 用户扩展表的历史累计计数；管理员删除打卡记录后不回退。
- `activeCheckins`：当前有效打卡数，服务端从 `tourism_markers.checkedBy[]` 按 userId 实时聚合；管理员删除 checkedBy 记录后会随之下降。
- `totalRewardPoints`：用户所有 rewards 的积分合计，优先读 `rewardPoints`，旧行从 `reward` 文案解析首个整数（如 `20 积分` / `20 points`）。
- `pendingRewardPoints` / `claimedRewardPoints`：按 `rewardClaimed === true` 拆分待兑与已兑积分；`pendingCount` / `claimedCount` 同理统计奖励条数。
- `routeRewardCount` / `taskRewardCount`：`source === 'route'` 或有 `routeId` 的计入路线奖励，其余兼容旧 task 行计入任务奖励。

**真机 / 后台验收点**：
1. 路线详情点击“去这里”后回到首页地图，并由首页现有 `consumeFocus()` 打开/聚焦对应 marker；若路线详情是冷启动栈顶，也能 `reLaunch` 回首页后消费 focus。
2. 后台用户管理列表显示“有效打卡 X / 累计 Y”，详情弹层分别显示“有效打卡”和“累计打卡”。
3. 管理员删除某用户某条 checkedBy 打卡记录后，重新进入用户管理页：该用户 `activeCheckins` 下降，`totalCheckins` 保持历史累计值。
4. 用户管理列表/详情显示积分汇总，至少可见总积分、待兑积分、已兑积分；旧 rewards 文案行也能被积分解析 helper 统计。
5. 新完成的任务奖励 / 路线奖励写入 `rewards.rewardPoints`，并继续保留旧字段 `reward`、`source`、`rewardClaimed` 兼容 App 我的奖励页。

**验证记录**：
- RED：新增 helper 测试后先看到 6 个预期失败（缺 `deriveActiveCheckinsFromMarkers`、admin `reward-service`、`parseRewardPoints/buildTaskRewardEntry`、route reward `rewardPoints`）。
- GREEN：`node --test` 全套 72 例通过（包含新增 `admin-center/reward-service.test.js`）。
- 云函数语法：`node --check` 覆盖 13 个 `index.obj.js` / `*-service.js` 文件通过。
- UTS 静态自检：Task 1 后扫描 `.uvue/.uts` 未发现新增非法 `Number(` / `Number.` 调用或非法 `display`；命中仅为 route-detail 既有 PITFALLS 注释。
- HBuilderX UI 真机编译仍需在本机打开 HBuilderX、确认 `map_new` 与需要时的 `uni-admin` 已导入/打开后复验；CLI 超时不作为代码失败依据。

## 2026-05-11 P5.2 下一轮计划入口（真机反馈修复与奖励记录）

**计划文档**：`docs/superpowers/plans/2026-05-11-p5.2-feedback-fixes.md`

**用户新增反馈归档**：
1. 后台新增的打卡点在 App 地图能显示图标/标题/位置，但直接点击图标只显示标题，不弹 marker-panel；从任务页定位到该点可以打开详情并正常打卡，打卡后详情内容也正常。下一轮优先检查 `markertap.detail.markerId`、`checkin-map` SDK marker id、`findById()` 的 number/string/id 边界。
2. `pages/my-checkins/my-checkins.uvue` “在地图上查看”当前无反应，根因同类：App 无 tabBar 却使用 `switchTab`。应统一改为 focus payload + `reLaunch('/pages/index/index')`。
3. `pages/route-detail/route-detail.uvue` “去这里”当前可能返回主题路线页，因为 `navigateBack()` 只回上一页。产品期望是回首页地图并打开对应 marker-panel，下一轮要改成统一跨页聚焦 helper。
4. uni-admin 未登录时会停留在后台页错误态，没有“去登录”按钮；下一轮给后台各页加登录恢复 CTA。
5. 地图缩小时 marker 图标尺寸不变，遮挡地图内容。下一轮按 `scale` 分档输出 marker width/height；图标图片替换位置是 `static/marker_default.png` 与 `static/marker_checked.webp`，文件名不变可直接替换，文件名变更需同步 `stores/useMarkerStore.uts` 常量。
6. 用户兑换路线奖励后，后台用户管理只能看到路线/任务奖励计数，没有明细记录页。下一轮新增后台“奖励记录”页，入口放在打卡记录 quick-nav / dashboard，查询 `rewards` 集合展示用户、来源、积分、待兑/已兑、获得/兑换时间。

**下一轮建议 commits**：
- Task 1：`fix app map focus navigation`
- Task 2：`fix cloud marker tap detail panel`
- Task 3：`add admin login recovery actions`
- Task 4：`tune map marker icon scaling`
- Task 5：`add admin reward records page`
- Task 6：`document p5.2 feedback fixes`

**下一次会话提示词**：直接复制 `docs/superpowers/plans/2026-05-11-p5.2-feedback-fixes.md` 第 3 节“下一次迭代 AI 提示词”。
# 2026-05-11 P5.2 已落地（真机反馈修复与奖励记录后台页）

**落地 commits**：
- `ce7d8ec` Task 1：统一 App 跨页地图聚焦链路。`stores/useMapStore.uts` 新增 storage-backed focus payload；我的打卡、路线详情、任务/点位入口统一 `reLaunch('/pages/index/index')`，由首页消费 payload 后同步云端并打开 marker-panel。
- `87284ec` Task 2：修复后台新增 marker 点击不弹详情。新增 `utils/marker-id-service.js` + node:test，首页 `onMarkerTap` 归一化 markerId 后再 `findById`。
- `3552025` Task 3：后台未登录/无权限错误恢复入口。新增 `uni-admin/utils/adminAuth.js`，dashboard / markers / checkins / users / tasks / routes / audit 出现登录权限错误时展示“去登录”。
- `5a4f690` Task 4：地图 marker 图标按 scale 分档缩放。scale <= 10 输出 22px，11-13 输出 28px，14-16 输出 34px，>=17 输出 40px。
- `6361626` Task 5：后台奖励记录页。`admin-center.getRewardRecords({ offset, limit, status?, source?, userId? })` 返回归一化奖励记录；`uni-admin/pages/rewards/index.vue` 展示用户、来源、积分、待兑/已兑、获得/兑换时间。

**验收点**：
1. 我的打卡页“在地图上查看”、路线详情“去这里”、任务/点位入口都应回到首页地图并打开对应 marker-panel。
2. 后台新增“长城打卡点”后，App 首页地图直接点击图标应弹详情；关闭后再次点击仍可弹；打卡后再次点击仍可弹。
3. 后台任一主要页面遇到“请先登录 / 未登录 / 无管理员权限 / token”类错误，应显示“去登录”，点击进入 `/pages/login/index`。
4. 地图缩小时 marker 图标随 scale 变小，减少遮挡；放大到高 zoom 后恢复可点尺寸。
5. 后台“奖励记录”页可按状态、来源、userId 筛选，展示用户、路线/任务来源、积分、待兑/已兑、获得时间、兑换时间。

**Marker 图标替换说明**：
- 未打卡图标：`static/marker_default.png`
- 已打卡图标：`static/marker_checked.webp`
- 只替换视觉文件且文件名不变时，不需要改代码。
- 如果改文件名，需要同步修改 `stores/useMarkerStore.uts` 里的 `DEFAULT_MARKER_ICON` / `CHECKED_MARKER_ICON` 常量。


## 2026-05-11 P5.2 hotfix note: native map marker id boundary

Runtime feedback: after admin-created markers synced successfully, tapping the marker could log `marker tap id not found 215432543`, show `Marker syncing, try again`, and leave the map blank or stuck. Root cause: admin-created business marker ids are timestamp-sized, but native Android map `Marker.id` / `markertap.detail.markerId` is SDK-bound and can be truncated or boxed differently.

Fix direction: keep `CheckinMarker.id` as the real business id, but render native map DTOs with small SDK ids from `sdkMarkerIdForIndex(index)`. `onMarkerTap` maps the SDK id back through `findBySdkMarkerId()` before opening marker-panel. Acceptance point: admin-created markers can be tapped directly, reopened after closing, and reopened after checkin without showing the syncing fallback.


## 2026-05-11 P5.2 hotfix note: focus navigation and task reward semantics

**Commit:** `5417deb fix focus navigation and task rewards`

**Fixes:**
- App focus navigation now writes the same focus payload but calls `returnToIndexForFocus()`: if `/pages/index/index` already exists in the page stack, it uses `navigateBack({ delta })`; otherwise it falls back to `reLaunch`. This targets the white native-map surface seen after entering "????" and tapping "??????".
- App startup token verification no longer calls `syncMarkers(userId)` before the homepage has loaded. The homepage owns marker sync, reducing the repeated 2-3 sync bursts during focus flows.
- Task rewards are now treated as auto-issued points. New task reward rows are written with `rewardClaimed:true` and `claimedAt:earnedAt`; legacy task rows without `source` are also normalized as task/claimed in App/Admin reads.
- Admin reward records `source=task` filter now includes legacy task reward rows without `source:'task'`, so route/task filters match the semantics used by the list display.

**Acceptance points:**
1. From App "????" -> "??????", the app should return to the existing homepage map and open the marker panel without a white map surface.
2. From tasks/task-detail/route-detail -> marker focus, the app should return to homepage map with fewer repeated sync logs.
3. Admin rewards page: ?? shows route + task; ?? shows route only; ?? shows task including legacy task rows.
4. Task rewards should display as already issued/claimed and should not require user redemption; route rewards remain redeemable.

**Next plan:** `docs/superpowers/plans/2026-05-11-p5.3-points-wallet-and-ux.md`.
