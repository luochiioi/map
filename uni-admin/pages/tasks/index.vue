<template>
  <view class="tasks-page">
    <text class="page-desc">管理打卡任务（仅管理员）</text>

    <view v-if="tasks.length === 0" class="empty">暂无任务数据</view>
    <view v-for="t in tasks" :key="t._id" class="task-card">
      <view class="task-header">
        <text class="task-name">{{ t.name }}</text>
        <view class="task-status" :class="t.status === 'active' ? 'active' : 'archived'">
          <text>{{ t.status === 'active' ? '进行中' : '已归档' }}</text>
        </view>
      </view>
      <text class="task-desc">{{ t.description || '无描述' }}</text>
      <view class="task-meta">
        <text>目标: {{ t.targetTitle }}</text>
        <text>奖励: {{ t.reward }}</text>
      </view>
      <view class="task-actions">
        <text class="tact" @click="toggleStatus(t)">
          {{ t.status === 'active' ? '归档' : '激活' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue'

const tasks = ref([])
const api = uniCloud.importObject('admin-center')

onShow(() => { fetchTasks() })

async function fetchTasks() {
  try {
    const res = await api.getTasks()
    if (res.errCode === 0) tasks.value = res.data
  } catch (e) { console.error(e) }
}

async function toggleStatus(t) {
  const newStatus = t.status === 'active' ? 'archived' : 'active'
  try {
    await api.updateTask({ _id: t._id, status: newStatus })
    t.status = newStatus
    uni.showToast({ title: newStatus === 'active' ? '已激活' : '已归档', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'error' })
  }
}
</script>

<style>
.tasks-page { padding: 24rpx; }

.page-desc {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 16rpx;
  display: block;
}

.task-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.task-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.task-status {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
}

.task-status.active { background: #e6f9ed; color: #27ae60; }
.task-status.archived { background: #f0f0f0; color: #999; }

.task-desc {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 8rpx;
}

.task-meta {
  display: flex;
  gap: 24rpx;
  font-size: 22rpx;
  color: #aaa;
  margin-bottom: 12rpx;
}

.task-actions {
  border-top: 1rpx solid #f5f5f5;
  padding-top: 12rpx;
}

.tact {
  font-size: 26rpx;
  color: #2ecc71;
}

.empty { text-align: center; color: #999; padding: 80rpx 0; font-size: 26rpx; }
</style>
