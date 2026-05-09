<template>
  <view class="checkins-page">
    <AdminHeader
      title="打卡记录"
      subtitle="查看所有云端打卡人、时间、照片和备注"
      @refresh="reload"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <view v-if="loading && list.length === 0" class="notice">正在加载打卡记录...</view>

    <view v-if="selectedMarkerId" class="filter-card">
      <view>
        <text class="filter-title">当前打卡点：{{ selectedMarkerTitle || markerInfo.title || selectedMarkerId }}</text>
        <text class="filter-meta">共 {{ total }} 条云端打卡记录</text>
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

    <view v-for="record in list" :key="record.markerDocId + '-' + record.userId + '-' + record.checkedAt" class="record-card">
      <view class="record-header">
        <view>
          <text class="record-title">{{ record.markerTitle }}</text>
          <text class="record-coords">{{ formatCoord(record.latitude) }}, {{ formatCoord(record.longitude) }}</text>
        </view>
        <text class="record-time">{{ formatTime(record.checkedAt) }}</text>
      </view>

      <view class="entry">
        <image
          v-if="record.photoCloudURL"
          :src="record.photoCloudURL"
          class="entry-photo"
          mode="aspectFill"
          @click="previewPhoto(record.photoCloudURL)"
        />
        <view class="entry-info">
          <text class="entry-user">打卡人：{{ record.userId || '--' }}</text>
          <text v-if="record.repaired" class="entry-repaired">历史补传</text>
          <text class="entry-time">打卡时间：{{ formatTime(record.checkedAt) }}</text>
          <text v-if="record.photoCloudURL" class="entry-url">照片 URL：{{ record.photoCloudURL }}</text>
          <text v-if="record.note" class="entry-note">备注：{{ record.note }}</text>
          <text v-else class="entry-note muted">备注：--</text>
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

const list = ref([])
const searchQuery = ref('')
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const selectedMarkerId = ref(null)
const selectedMarkerTitle = ref('')
const markerInfo = ref({})
const total = ref(0)
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

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
  fetchData()
}

async function fetchData() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  try {
    const res = selectedMarkerId.value
      ? await api.getMarkerCheckins({ markerId: selectedMarkerId.value, offset, limit })
      : await api.getCheckins({ offset, limit, keyword: searchQuery.value })
    if (res.errCode !== 0) throw new Error(res.errMsg || '打卡记录加载失败')
    const data = res.data || {}
    const records = data.list || []
    list.value = offset === 0 ? records : [...list.value, ...records]
    total.value = data.total || list.value.length
    markerInfo.value = data.marker || {}
    hasMore.value = list.value.length < total.value
    offset += limit
  } catch (e) {
    errorText.value = e.message || '连接服务器失败，请确认 admin-center 已上传'
  } finally {
    loading.value = false
  }
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

function previewPhoto(url) {
  uni.previewImage({ urls: [url], current: url })
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

.record-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
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

.record-coords {
  font-size: 22rpx;
  color: #aaa;
  font-family: monospace;
}

.entry {
  display: flex;
  padding-top: 12rpx;
  border-top: 1rpx solid #f5f5f5;
  gap: 12rpx;
}

.entry-photo {
  width: 96rpx;
  height: 96rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}

.entry-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.entry-user { font-size: 26rpx; color: #333; }
.entry-repaired { font-size: 22rpx; color: #9a6b00; background: #fff7d6; border-radius: 999rpx; padding: 4rpx 12rpx; align-self: flex-start; }
.entry-time { font-size: 22rpx; color: #aaa; }
.entry-url { font-size: 22rpx; color: #1677ff; word-break: break-all; }
.entry-note { font-size: 24rpx; color: #666; margin-top: 4rpx; }
.entry-note.muted { color: #aaa; }

.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }
.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }
</style>
