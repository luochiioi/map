<template>
  <view class="task-records-page">
    <AdminHeader
      title="任务记录"
      subtitle="查看用户完成任务后自动发放的积分记录"
      @refresh="reload"
    />

    <view v-if="summary" class="summary-row">
      <view class="summary-card primary">
        <text class="summary-label">任务已发放积分</text>
        <text class="summary-value">{{ summary.taskIssuedPoints }}</text>
        <text class="summary-foot">任务奖励自动发放，无需用户兑换</text>
      </view>
      <view class="summary-card">
        <text class="summary-label">累计获得</text>
        <text class="summary-value">{{ summary.totalEarnedPoints }}</text>
      </view>
    </view>

    <view class="search-bar">
      <input class="search-input" v-model="userIdInput" placeholder="按 userId 筛选" confirm-type="search" @confirm="reload" />
      <button class="btn-search" @click="reload">筛选</button>
      <button class="btn-reset" @click="resetFilters">重置</button>
    </view>

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="loading && list.length === 0" class="notice">正在加载任务记录...</view>

    <text class="page-desc">共 {{ total }} 条任务记录</text>

    <view v-if="!loading && list.length === 0" class="empty">
      暂无任务记录。用户完成任务后，自动发放的任务积分会在这里沉淀。
    </view>

    <view v-for="row in list" :key="row._id" class="record-card">
      <view class="card-head">
        <view>
          <text class="user-name">{{ row.userName || row.userId || '--' }}</text>
          <text class="user-id">UID: {{ row.userId || '--' }}</text>
        </view>
        <text class="status-pill">已发放</text>
      </view>
      <view class="card-body">
        <text class="source-pill">任务</text>
        <text class="source-title">{{ row.sourceTitle || '--' }}</text>
      </view>
      <view class="meta-grid">
        <view class="meta-item">
          <text class="meta-label">积分</text>
          <text class="meta-value points">{{ row.rewardPoints }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">奖励</text>
          <text class="meta-value">{{ row.reward || '--' }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">获得时间</text>
          <text class="meta-value">{{ formatTime(row.earnedAt) }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">发放时间</text>
          <text class="meta-value">{{ formatTime(row.claimedAt || row.earnedAt) }}</text>
        </view>
      </view>
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
const summary = ref(null)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const needsLogin = ref(false)
const userIdInput = ref('')
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

onShow(() => { reload() })

function resetFilters() {
  userIdInput.value = ''
  reload()
}

function reload() {
  offset = 0
  list.value = []
  total.value = 0
  fetchSummary()
  fetchData()
}

async function fetchSummary() {
  try {
    const payload = { source: 'task' }
    if (userIdInput.value.trim().length > 0) payload.userId = userIdInput.value.trim()
    const res = await api.getPointsSummary(payload)
    if (res.errCode !== 0) {
      summary.value = null
      return
    }
    summary.value = res.data || null
  } catch (e) {
    summary.value = null
  }
}

async function fetchData() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const payload = {
      offset,
      limit,
      source: 'task'
    }
    if (userIdInput.value.trim().length > 0) payload.userId = userIdInput.value.trim()
    const res = await api.getRewardRecords(payload)
    if (res.errCode !== 0) throw new Error(res.errMsg || '任务记录加载失败')
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

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style>
.task-records-page { padding: 24rpx; }

.summary-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.summary-card {
  background: #fff;
  border-radius: 14rpx;
  padding: 22rpx 24rpx;
}

.summary-card.primary {
  background: linear-gradient(135deg, #2ecc71 0%, #25a55c 100%);
  color: #fff;
}

.summary-label {
  color: #8a9891;
  display: block;
  font-size: 22rpx;
}

.summary-card.primary .summary-label { color: rgba(255,255,255,0.85); }

.summary-value {
  color: #123322;
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  margin-top: 6rpx;
}

.summary-card.primary .summary-value { color: #fff; }

.summary-foot {
  color: rgba(255,255,255,0.85);
  display: block;
  font-size: 20rpx;
  margin-top: 6rpx;
}

.search-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.search-input {
  flex: 1;
  background: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
  padding: 16rpx 20rpx;
}

.btn-search,
.btn-reset {
  border: none;
  border-radius: 8rpx;
  font-size: 24rpx;
  padding: 8rpx 22rpx;
}

.btn-search {
  background: #2ecc71;
  color: #fff;
}

.btn-reset {
  background: #eef2f3;
  color: #4a5b54;
}

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

.page-desc {
  color: #888;
  display: block;
  font-size: 22rpx;
  margin-bottom: 12rpx;
}

.empty {
  color: #999;
  font-size: 26rpx;
  line-height: 1.7;
  padding: 80rpx 20rpx;
  text-align: center;
}

.record-card {
  background: #fff;
  border-radius: 14rpx;
  margin-bottom: 16rpx;
  padding: 24rpx;
}

.card-head,
.card-body {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.card-body {
  justify-content: flex-start;
  margin-top: 16rpx;
}

.user-name {
  color: #123322;
  display: block;
  font-size: 30rpx;
  font-weight: 700;
}

.user-id {
  color: #8a9891;
  display: block;
  font-size: 22rpx;
  margin-top: 4rpx;
}

.status-pill,
.source-pill {
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  white-space: nowrap;
}

.status-pill,
.source-pill {
  background: #e6f9ed;
  color: #1f7a45;
}

.source-title {
  color: #333;
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 18rpx;
}

.meta-item {
  background: #f8faf9;
  border-radius: 10rpx;
  padding: 14rpx;
}

.meta-label {
  color: #8a9891;
  display: block;
  font-size: 20rpx;
}

.meta-value {
  color: #333;
  display: block;
  font-size: 24rpx;
  margin-top: 4rpx;
  word-break: break-all;
}

.meta-value.points {
  color: #2ecc71;
  font-size: 30rpx;
  font-weight: 700;
}

.load-more {
  color: #2ecc71;
  font-size: 26rpx;
  padding: 24rpx;
  text-align: center;
}
</style>
