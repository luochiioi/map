
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
│   └── marker_checked.png
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
import { ref, computed, onShow, onHide } from 'vue'
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
import { ref, computed, onShow, onHide } from 'vue'
import { useMarkerStore } from '@/stores/useMarkerStore'
import { useLocationStore } from '@/stores/useLocationStore'
import { useTaskStore } from '@/stores/useTaskStore'

const markerStore = useMarkerStore()
const locationStore = useLocationStore()
const taskStore = useTaskStore()

// URL 参数（通过 onLoad 或直接读取）
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
const effectiveRadius = computed(() => 500 + Math.min(locationStore.accuracy * 0.5, 200))
const withinRange = computed(() => distance.value !== null && distance.value <= effectiveRadius.value)

onShow((): void => {
  // 从页面参数获取 marker ID
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const query = currentPage?.$page?.options ?? {}
  markerId.value = parseInt(query.id ?? '0')
  markerTitle.value = decodeURIComponent(query.title ?? '')
  locationStore.startPolling(5000) // 每 5 秒轮询位置
})

onHide((): void => {
  locationStore.stopPolling()
})

async function choosePhoto(): Promise<void> {
  uni.showActionSheet({
    itemList: ['拍照', '从相册选择'],
    success: async (res: any) => {
      const sourceType = res.tapIndex === 0 ? ['camera'] : ['album']
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: sourceType,
        success: async (imgRes: any) => {
          let path: string = imgRes.tempFilePaths[0] as string
          // 压缩 >1MB 的图片
          const fileInfo = await getFileInfoAsync(path)
          if (fileInfo.size > 1024 * 1024) {
            isCompressing.value = true
            path = await compressImageAsync(path)
            isCompressing.value = false
          }
          photoPath.value = path
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
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

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
> **黄金法则（仍有效，5 条）**：
> 1. `UTSJSONObject["prop"]` 用于 JSON 数据；**原生 SDK 回调用 `.prop`**（cast 到 UTSJSONObject → 运行时 `ClassCastException`）
> 2. 直接 `export const/function`（不用 Pinia/defineStore）
> 3. 内联对象 → `const v: T = {...}` 先声明再传入
> 4. 模板中只用本地变量/函数（导入的需本地 wrapper/alias）
> 5. Write 工具写文件（PS Set-Content 截断 UTF-8）
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
