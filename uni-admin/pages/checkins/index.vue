<template>
  <view class="checkins-page">
    <AdminHeader
      title="打卡记录"
      subtitle="查看所有云端打卡人、时间和备注"
      @refresh="reload"
    />

    <view class="quick-nav">
      <view class="quick-chip quick-chip-active">
        <text class="quick-chip-text">📋 打卡记录</text>
      </view>
      <view class="quick-chip" @click="goAudit">
        <text class="quick-chip-text">🛡 审计日志</text>
      </view>
      <view class="quick-chip" @click="goRewards">
        <text class="quick-chip-text">奖励记录</text>
      </view>
      <view class="quick-chip" @click="goTaskRecords">
        <text class="quick-chip-text">任务记录</text>
      </view>
      <view class="quick-chip" @click="goDashboard">
        <text class="quick-chip-text">📊 同步诊断</text>
      </view>
      <view class="quick-chip" @click="goDashboard">
        <text class="quick-chip-text">🕐 最近打卡</text>
      </view>
    </view>

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="loading && list.length === 0" class="notice">正在加载打卡记录...</view>

    <view v-if="selectedMarkerId" class="filter-card">
      <view>
        <text class="filter-title">当前打卡点：{{ selectedMarkerTitle || markerInfo.title || selectedMarkerId }}</text>
        <text class="filter-meta">共 {{ totalRecordCount }} 条云端打卡记录</text>
      </view>
      <text class="clear-filter" @click="clearMarkerFilter">查看全部</text>
    </view>

    <view v-else class="search-bar">
      <input class="search-input" v-model="searchQuery" placeholder="搜索打卡点名称..." confirm-type="search" @confirm="reload" />
      <button class="btn-search" @click="reload">搜索</button>
    </view>

    <view v-if="!loading && list.length === 0" class="empty">
      暂无云端打卡记录。请确认：1. 已同步默认点；2. App 当前连接的是同一个服务空间；3. 打卡发生在云端点存在之后。
    </view>

    <view v-for="group in list" :key="group.markerDocId + '-' + group.markerId" class="marker-group-card">
      <view class="record-header">
        <view>
          <text class="record-title">{{ group.markerTitle }}</text>
          <text class="record-coords">{{ formatCoord(group.latitude) }}, {{ formatCoord(group.longitude) }}</text>
        </view>
        <view class="group-meta">
          <text class="group-count">{{ group.recordCount }} 条记录</text>
          <text class="record-time">{{ formatTime(group.latestCheckedAt) }}</text>
        </view>
      </view>

      <view v-for="record in group.records" :key="recordKey(record)" class="entry">
        <view class="entry-info">
          <text class="entry-user">打卡人：{{ record.userName || record.userId || '--' }}</text>
          <text v-if="record.userName && record.userId && record.userName !== record.userId" class="entry-uid">UID：{{ record.userId }}</text>
          <text v-if="record.repaired" class="entry-repaired">历史补传</text>
          <text class="entry-time">打卡时间：{{ formatTime(record.checkedAt) }}</text>
          <text v-if="record.note" class="entry-note">备注：{{ record.note }}</text>
          <text v-else class="entry-note muted">备注：--</text>
        </view>
        <view class="entry-actions">
          <button class="btn-delete" :disabled="deletingKey === recordKey(record)" @click="confirmDeleteRecord(record, group)">
            {{ deletingKey === recordKey(record) ? '删除中…' : '违规删除' }}
          </button>
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
import { mergeCheckinGroups, normalizeCheckinGroups } from './checkin-groups.mjs'
import { getErrorMessage, goAdminLogin, isAuthError } from '@/utils/adminAuth.js'

const list = ref([])
const searchQuery = ref('')
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const needsLogin = ref(false)
const selectedMarkerId = ref(null)
const selectedMarkerTitle = ref('')
const markerInfo = ref({})
const total = ref(0)
const totalRecordCount = ref(0)
const deletingKey = ref('')
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

function goAudit() {
  uni.navigateTo({ url: '/pages/audit/index' })
}

function goRewards() {
  uni.navigateTo({ url: '/pages/rewards/index' })
}

function goTaskRecords() {
  uni.navigateTo({ url: '/pages/task-records/index' })
}

// "同步诊断" 与 "最近打卡" 都活在 dashboard。tabBar 切回去比新建独立页便宜，
// 同源功能不重复，未来真要拆独立详情页再升级。
function goDashboard() {
  uni.switchTab({ url: '/pages/dashboard/index' })
}

function recordKey(record) {
  return [record.markerDocId || '', record.markerId || '', record.userId || '', record.checkedAt || 0].join('|')
}

onShow(() => {
  const storedMarkerId = uni.getStorageSync('admin_checkins_marker_id')
  const storedTitle = uni.getStorageSync('admin_checkins_marker_title')
  selectedMarkerId.value = storedMarkerId || null
  selectedMarkerTitle.value = storedTitle || ''
  reload()
})

function reload() {
  offset = 0
  list.value = []
  total.value = 0
  totalRecordCount.value = 0
  fetchData()
}

async function fetchData() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const res = selectedMarkerId.value
      ? await api.getMarkerCheckins({ markerId: selectedMarkerId.value, offset, limit })
      : await api.getCheckins({ offset, limit, keyword: searchQuery.value })
    if (res.errCode !== 0) throw new Error(res.errMsg || '打卡记录加载失败')
    const data = res.data || {}
    const rawItems = data.list || []
    const groupedResponse = rawItems.some(item => Array.isArray(item && item.records))
    const groups = normalizeCheckinGroups(rawItems)
    list.value = offset === 0 ? groups : mergeCheckinGroups(list.value, groups)
    total.value = groupedResponse ? (data.total || list.value.length) : list.value.length
    totalRecordCount.value = data.totalRecords || (groupedResponse
      ? list.value.reduce((sum, item) => sum + (item.recordCount || 0), 0)
      : (data.total || list.value.reduce((sum, item) => sum + (item.recordCount || 0), 0)))
    markerInfo.value = data.marker || {}
    hasMore.value = groupedResponse ? list.value.length < total.value : rawItems.length === limit
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

function clearMarkerFilter() {
  uni.removeStorageSync('admin_checkins_marker_id')
  uni.removeStorageSync('admin_checkins_marker_title')
  selectedMarkerId.value = null
  selectedMarkerTitle.value = ''
  markerInfo.value = {}
  reload()
}

function formatCoord(v) {
  return v == null ? '--' : Number(v).toFixed(6)
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 互联网产品标准审核 UX：单一明确的二次确认，"取消 / 违规删除"两个动作。
function confirmDeleteRecord(record, group) {
  const userLabel = record.userName || record.userId || '该用户'
  uni.showModal({
    title: '确认违规删除',
    content: `将删除 ${userLabel} 在「${group.markerTitle || '该打卡点'}」的这条打卡记录。\n此操作不可撤销，且第一版不会回滚任务进度。`,
    confirmText: '违规删除',
    confirmColor: '#d93026',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) doDeleteRecord(record, group)
    }
  })
}

async function doDeleteRecord(record, group) {
  const key = recordKey(record)
  deletingKey.value = key
  try {
    const res = await api.deleteCheckinRecord({
      _id: record.markerDocId || (group && group.markerDocId) || undefined,
      markerId: record.markerId != null ? record.markerId : (group && group.markerId),
      userId: record.userId,
      checkedAt: record.checkedAt
    })
    if (res.errCode !== 0) throw new Error(res.errMsg || '删除失败')
    const data = res.data || {}
    const msg = data.deleted ? '已删除该打卡记录' : '记录不存在或已被删除'
    uni.showToast({ title: msg, icon: 'none', duration: 2500 })
    reload()
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = needsLogin.value ? getErrorMessage(e, '删除失败') : errorText.value
    uni.showToast({ title: getErrorMessage(e, '删除失败'), icon: 'none' })
  } finally {
    deletingKey.value = ''
  }
}
</script>

<style>
.checkins-page { padding: 24rpx; }

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

.filter-card {
  background: #ecf9f1;
  border-radius: 14rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.filter-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f7a45;
}

.filter-meta {
  display: block;
  font-size: 22rpx;
  color: #609c77;
  margin-top: 6rpx;
}

.clear-filter {
  font-size: 24rpx;
  color: #1677ff;
  white-space: nowrap;
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
  padding: 16rpx 20rpx;
  font-size: 28rpx;
}

.btn-search {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 8rpx;
  border: none;
}

.marker-group-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.record-header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.record-title {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.record-time {
  font-size: 22rpx;
  color: #2ecc71;
  white-space: nowrap;
}

.group-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
}

.group-count {
  font-size: 24rpx;
  color: #123322;
  font-weight: 600;
}

.record-coords {
  font-size: 22rpx;
  color: #aaa;
  font-family: monospace;
}

.entry {
  display: flex;
  padding-top: 12rpx;
  margin-top: 12rpx;
  border-top: 1rpx solid #f5f5f5;
  gap: 12rpx;
  align-items: flex-start;
}

.entry-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.entry-user { font-size: 26rpx; color: #333; }
.entry-uid { font-size: 22rpx; color: #aaa; font-family: monospace; }
.entry-repaired { font-size: 22rpx; color: #9a6b00; background: #fff7d6; border-radius: 999rpx; padding: 4rpx 12rpx; align-self: flex-start; }
.entry-time { font-size: 22rpx; color: #aaa; }
.entry-note { font-size: 24rpx; color: #666; margin-top: 4rpx; }
.entry-note.muted { color: #aaa; }

.entry-actions {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  flex-shrink: 0;
}

.btn-delete {
  margin: 0;
  padding: 0 18rpx;
  height: 56rpx;
  line-height: 56rpx;
  background: #fff2f1;
  color: #d93026;
  border: 1rpx solid #ffd5d2;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.btn-delete[disabled] {
  background: #f5f5f5;
  color: #aaa;
  border-color: #eee;
}

.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }
.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }

.quick-nav {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 16rpx 24rpx 8rpx 24rpx;
}

.quick-chip {
  background: #fff;
  border: 1rpx solid #e0e3e8;
  border-radius: 999rpx;
  padding: 10rpx 22rpx;
}

.quick-chip-active {
  background: #2ecc71;
  border-color: #2ecc71;
}

.quick-chip-text {
  font-size: 24rpx;
  color: #555;
}

.quick-chip-active .quick-chip-text {
  color: #ffffff;
  font-weight: 500;
}
</style>
