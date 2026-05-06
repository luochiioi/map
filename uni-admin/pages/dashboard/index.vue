<template>
  <view class="dashboard">
    <!-- Stats cards -->
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
    </view>

    <!-- Recent checkins -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">最近打卡记录</text>
        <text class="section-action" @click="goToCheckins">查看全部 →</text>
      </view>
      <view v-if="checkins.length === 0" class="empty">暂无打卡记录</view>
      <view v-for="(m, i) in checkins" :key="i" class="checkin-item">
        <view class="checkin-header">
          <text class="checkin-title">{{ m.title }}</text>
          <text class="checkin-count">{{ (m.checkinCount || 0) }} 人次</text>
        </view>
        <view v-if="m.checkedBy && m.checkedBy.length" class="checked-list">
          <view v-for="(entry, j) in m.checkedBy" :key="j" class="checked-entry">
            <text class="entry-user">用户: {{ entry.userId }}</text>
            <text class="entry-time">{{ formatTime(entry.checkedAt) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue'

const dashboard = ref({
  totalUsers: 0,
  totalMarkers: 0,
  totalMarkersWithCheckins: 0,
  totalCheckins: 0
})
const checkins = ref([])

onShow(async () => {
  try {
    const api = uniCloud.importObject('admin-center')
    const res = await api.getDashboard()
    if (res.errCode === 0) dashboard.value = res.data

    const cres = await api.getCheckins({ offset: 0, limit: 10 })
    if (cres.errCode === 0) checkins.value = cres.data
  } catch (e) {
    console.error('Dashboard load failed', e)
  }
})

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goToCheckins() {
  uni.switchTab({ url: '/pages/checkins/index' })
}
</script>

<style>
.dashboard { padding: 24rpx; }

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

.section-action {
  font-size: 24rpx;
  color: #2ecc71;
}

.empty {
  text-align: center;
  color: #999;
  padding: 60rpx 0;
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

.checked-entry {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  padding: 4rpx 0;
}

.entry-user { color: #666; }
.entry-time { color: #aaa; }
</style>
