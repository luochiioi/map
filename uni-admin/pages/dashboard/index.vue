<template>
  <view class="dashboard">
    <AdminHeader
      title="仪表盘"
      subtitle="总览云端用户、打卡点、任务和打卡记录"
      @refresh="loadDashboard"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <view v-if="loading" class="notice">正在加载云端数据...</view>

    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-value">{{ dashboard.totalUsers }}</text>
        <text class="stat-label">总用户</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ dashboard.totalMarkers }}</text>
        <text class="stat-label">总打卡点</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ dashboard.totalMarkersWithCheckins }}</text>
        <text class="stat-label">已打卡点</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ dashboard.totalCheckins }}</text>
        <text class="stat-label">总打卡人次</text>
      </view>
      <view class="stat-card wide">
        <text class="stat-value">{{ dashboard.totalTasks || 0 }}</text>
        <text class="stat-label">云端任务</text>
      </view>
    </view>

    <view class="section diagnostics-section">
      <view class="section-header">
        <text class="section-title">同步诊断</text>
      </view>
      <view class="diagnostics-grid">
        <view class="diag-item">
          <text class="diag-value">{{ diagnostics.markerTotal }}</text>
          <text class="diag-label">云端打卡点</text>
        </view>
        <view class="diag-item">
          <text class="diag-value">{{ diagnostics.markerWithCheckins }}</text>
          <text class="diag-label">有记录的点</text>
        </view>
        <view class="diag-item">
          <text class="diag-value">{{ diagnostics.checkinTotal }}</text>
          <text class="diag-label">云端记录</text>
        </view>
        <view class="diag-item">
          <text class="diag-value">{{ diagnostics.userTotal }}</text>
          <text class="diag-label">uni-id 用户</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">最近打卡记录</text>
        <view class="section-actions">
          <text class="section-action" @click="goToAudit">审计日志</text>
          <text class="section-action" @click="goToCheckins">查看全部 ›</text>
        </view>
      </view>
      <view v-if="!loading && checkins.length === 0" class="empty">
        暂无云端打卡记录。若之前是在默认点同步前完成的本地打卡，需要同步默认点后重新打卡，或让客户端补传后才会出现在这里。
      </view>
      <view v-for="(record, i) in checkins" :key="record.markerDocId + '_' + record.userId + '_' + record.checkedAt + '_' + i" class="checkin-item">
        <view class="checkin-header">
          <text class="checkin-title">{{ record.markerTitle || '--' }}</text>
          <text class="checkin-count">{{ formatTime(record.checkedAt) }}</text>
        </view>
        <view class="checkin-body">
          <image
            v-if="record.photoCloudURL"
            :src="record.photoCloudURL"
            class="checkin-photo"
            mode="aspectFill"
          />
          <view class="checkin-meta">
            <text class="entry-user">{{ record.userName || record.userId || '匿名' }}</text>
            <text class="entry-note">{{ record.note ? record.note : '--' }}</text>
            <text v-if="record.repaired" class="entry-tag">补传</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'

const dashboard = ref({
  totalUsers: 0,
  totalMarkers: 0,
  totalMarkersWithCheckins: 0,
  totalCheckins: 0,
  totalTasks: 0
})
const diagnostics = ref({
  markerTotal: 0,
  markerWithCheckins: 0,
  checkinTotal: 0,
  userTotal: 0
})
const checkins = ref([])
const loading = ref(false)
const errorText = ref('')
const api = uniCloud.importObject('admin-center')

onShow(() => { loadDashboard() })

async function loadDashboard() {
  loading.value = true
  errorText.value = ''
  try {
    const res = await api.getDashboard()
    if (res.errCode !== 0) throw new Error(res.errMsg || '仪表盘加载失败')
    dashboard.value = res.data || dashboard.value

    const dres = await api.getSyncDiagnostics()
    if (dres.errCode !== 0) throw new Error(dres.errMsg || '同步诊断加载失败')
    diagnostics.value = dres.data || diagnostics.value

    const cres = await api.getRecentCheckins({ limit: 10 })
    if (cres.errCode !== 0) throw new Error(cres.errMsg || '打卡记录加载失败')
    checkins.value = (cres.data && cres.data.list) || []
  } catch (e) {
    errorText.value = e.message || '连接服务器失败，请确认云对象已上传并已登录管理员账号'
  } finally {
    loading.value = false
  }
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goToCheckins() {
  uni.switchTab({ url: '/pages/checkins/index' })
}

function goToAudit() {
  uni.navigateTo({ url: '/pages/audit/index' })
}
</script>

<style>
.dashboard { padding: 24rpx; }

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

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.stat-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-card.wide { grid-column: span 2; }

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #2ecc71;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.diagnostics-section {
  margin-bottom: 24rpx;
}

.diagnostics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
}

.diag-item {
  background: #f8faf9;
  border-radius: 12rpx;
  padding: 18rpx;
}

.diag-value {
  display: block;
  color: #1677ff;
  font-size: 34rpx;
  font-weight: 700;
}

.diag-label {
  color: #789086;
  font-size: 22rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.section-actions {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.section-action {
  font-size: 24rpx;
  color: #2ecc71;
}

.empty {
  text-align: center;
  color: #999;
  line-height: 1.7;
  padding: 60rpx 20rpx;
  font-size: 26rpx;
}

.checkin-item {
  border-bottom: 1rpx solid #f0f0f0;
  padding: 16rpx 0;
}

.checkin-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.checkin-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.checkin-count {
  font-size: 24rpx;
  color: #2ecc71;
}

.checkin-body {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 4rpx 0;
}

.checkin-photo {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  background-color: #eef0f2;
  flex-shrink: 0;
}

.checkin-meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  flex: 1;
  min-width: 0;
}

.entry-user {
  font-size: 24rpx;
  color: #444;
  font-weight: 500;
}

.entry-note {
  font-size: 22rpx;
  color: #888;
  line-height: 1.5;
  word-break: break-all;
}

.entry-tag {
  align-self: flex-start;
  background: #fff7e6;
  color: #d48806;
  font-size: 18rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  margin-top: 4rpx;
}
</style>
