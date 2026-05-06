<template>
  <view class="checkins-page">
    <!-- Search -->
    <view class="search-bar">
      <input class="search-input" v-model="searchQuery" placeholder="搜索打卡点名称..." @input="doSearch" />
    </view>

    <!-- List -->
    <view v-if="list.length === 0" class="empty">暂无打卡记录</view>
    <view v-for="m in list" :key="m._id" class="record-card">
      <view class="record-header">
        <text class="record-title">{{ m.title }}</text>
        <text class="record-count">{{ m.checkinCount || 0 }} 人次</text>
      </view>
      <text class="record-coords">{{ (m.latitude||0).toFixed(6) }}, {{ (m.longitude||0).toFixed(6) }}</text>

      <view v-if="m.checkedBy && m.checkedBy.length" class="entries">
        <view v-for="(e, j) in m.checkedBy" :key="j" class="entry">
          <image v-if="e.photoCloudURL" :src="e.photoCloudURL" class="entry-photo" mode="aspectFill" @click="previewPhoto(e.photoCloudURL)" />
          <view class="entry-info">
            <text class="entry-user">{{ e.userId }}</text>
            <text class="entry-time">{{ formatTime(e.checkedAt) }}</text>
            <text v-if="e.note" class="entry-note">{{ e.note }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Load more -->
    <view v-if="hasMore" class="load-more" @click="fetchData">
      <text>加载更多</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue'

const list = ref([])
const searchQuery = ref('')
const hasMore = ref(false)
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

onShow(() => { offset = 0; fetchData() })

async function fetchData() {
  try {
    const res = await api.getCheckins({ offset, limit })
    if (res.errCode === 0) {
      if (offset === 0) list.value = res.data
      else list.value = [...list.value, ...res.data]
      hasMore = res.data.length >= limit
      offset += limit
    }
  } catch (e) { console.error(e) }
}

function doSearch() {
  offset = 0
  fetchData()
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function previewPhoto(url) {
  uni.previewImage({ urls: [url], current: url })
}
</script>

<style>
.checkins-page { padding: 24rpx; }

.search-bar { margin-bottom: 16rpx; }

.search-input {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
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
  align-items: center;
}

.record-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.record-count {
  font-size: 24rpx;
  color: #2ecc71;
}

.record-coords {
  font-size: 22rpx;
  color: #aaa;
  font-family: monospace;
}

.entries {
  margin-top: 12rpx;
}

.entry {
  display: flex;
  padding: 12rpx 0;
  border-top: 1rpx solid #f5f5f5;
  gap: 12rpx;
}

.entry-photo {
  width: 80rpx;
  height: 80rpx;
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
.entry-time { font-size: 22rpx; color: #aaa; }
.entry-note { font-size: 24rpx; color: #666; margin-top: 4rpx; }

.empty { text-align: center; color: #999; padding: 80rpx 0; font-size: 26rpx; }
.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }
</style>
