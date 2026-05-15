<template>
  <view class="audit-page">
    <AdminHeader
      title="审计日志"
      subtitle="记录管理员违规删除、用户自删与级联用户删除"
      @refresh="reload"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="loading && list.length === 0" class="notice">正在加载审计日志...</view>

    <view class="filter-bar">
      <text
        v-for="opt in typeOptions"
        :key="opt.value || 'all'"
        class="filter-chip"
        :class="{ 'filter-chip-active': filterType === opt.value }"
        @click="setFilter(opt.value)"
      >
        {{ opt.label }}
      </text>
    </view>

    <text class="page-desc">共 {{ total }} 条审计记录</text>

    <view v-if="!loading && list.length === 0" class="empty">
      暂无审计日志。当管理员违规删除打卡 / 删除用户，或用户自删打卡时会在此沉淀。
    </view>

    <view v-for="row in list" :key="row._id" class="audit-card">
      <view class="card-head">
        <text class="card-type" :class="typeClass(row.type)">{{ typeLabel(row.type) }}</text>
        <text class="card-time">{{ formatTime(row.occurredAt) }}</text>
      </view>
      <text class="card-row">操作人：{{ row.actorName || row.actorUid || '--' }}</text>
      <text class="card-row">目标：{{ row.targetName || row.targetUid || '--' }}</text>
      <text v-if="row.markerTitle" class="card-row">打卡点：{{ row.markerTitle }}<text v-if="row.markerId != null"> · #{{ row.markerId }}</text></text>
      <text v-if="row.checkedAt" class="card-row">原打卡时间：{{ formatTime(row.checkedAt) }}</text>
      <text v-if="row.reason" class="card-row">原因：{{ row.reason }}</text>
    </view>

    <view v-if="hasMore" class="load-more" @click="fetchData">
      <text>{{ loading ? '加载中...' : '加载更多' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'
import { getErrorMessage, goAdminLogin, isAuthError } from '@/utils/adminAuth.js'

const list = ref([])
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const needsLogin = ref(false)
const filterType = ref('')
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

const typeOptions = [
  { value: '', label: '全部' },
  { value: 'admin.deleteCheckinRecord', label: '管理员·删记录' },
  { value: 'admin.deleteUser', label: '管理员·删用户' },
  { value: 'user.deleteCheckin', label: '用户·自删' }
]

onShow(() => { reload() })

function setFilter(value) {
  if (filterType.value === value) return
  filterType.value = value
  reload()
}

function reload() {
  offset = 0
  list.value = []
  total.value = 0
  fetchData()
}

async function fetchData() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const res = await api.getAuditLogs({
      offset,
      limit,
      type: filterType.value || undefined
    })
    if (res.errCode !== 0) throw new Error(res.errMsg || '审计日志加载失败')
    const data = res.data || {}
    const rows = data.list || []
    list.value = offset === 0 ? rows : [...list.value, ...rows]
    total.value = data.total || list.value.length
    hasMore.value = list.value.length < total.value
    offset += limit
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = getErrorMessage(e, '连接服务器失败，请确认 admin-center 已上传')
  } finally {
    loading.value = false
  }
}

function goLogin() {
  goAdminLogin()
}

function typeLabel(t) {
  if (t === 'admin.deleteCheckinRecord') return '管理员·删记录'
  if (t === 'admin.deleteUser') return '管理员·删用户'
  if (t === 'user.deleteCheckin') return '用户·自删'
  return t || '--'
}

function typeClass(t) {
  if (t === 'admin.deleteCheckinRecord') return 'type-admin-record'
  if (t === 'admin.deleteUser') return 'type-admin-user'
  if (t === 'user.deleteCheckin') return 'type-user'
  return ''
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style>
.audit-page { padding: 24rpx; }

.notice {
  background: #eef9f2;
  border-radius: 12rpx;
  color: #2e9f5f;
  font-size: 24rpx;
  margin-bottom: 16rpx;
  padding: 18rpx 20rpx;
}

.notice.error {
  background: #fff1f0;
  color: #d93026;
}

.login-cta {
  background: #2ecc71;
  border: none;
  border-radius: 999rpx;
  color: #fff;
  font-size: 24rpx;
  margin: 0 0 16rpx 0;
  padding: 12rpx 28rpx;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.filter-chip {
  background: #fff;
  border: 1rpx solid #d9e2dc;
  color: #4a5b54;
  border-radius: 999rpx;
  padding: 6rpx 18rpx;
  font-size: 22rpx;
}

.filter-chip-active {
  background: #2ecc71;
  color: #fff;
  border-color: #2ecc71;
}

.page-desc {
  font-size: 22rpx;
  color: #888;
  margin-bottom: 12rpx;
  display: block;
}

.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }
.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }

.audit-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.card-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4rpx;
}

.card-type {
  font-size: 22rpx;
  font-weight: 500;
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  background: #eef2f7;
  color: #4a5b80;
}
.card-type.type-admin-record { background: #fff2f1; color: #d93026; }
.card-type.type-admin-user   { background: #fff7e6; color: #d48806; }
.card-type.type-user         { background: #e6f9ed; color: #1f7a45; }

.card-time { font-size: 22rpx; color: #aaa; }
.card-row  { font-size: 24rpx; color: #555; }

</style>
