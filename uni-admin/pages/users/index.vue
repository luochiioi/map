<template>
  <view class="users-page">
    <text class="page-desc">共 {{ users.length }} 个用户</text>

    <view v-if="users.length === 0" class="empty">暂无用户数据</view>
    <view v-for="u in users" :key="u._id" class="user-card" @click="selectUser(u)">
      <view class="user-avatar">
        <text class="avatar-text">{{ (u.nickname || '?')[0] }}</text>
      </view>
      <view class="user-info">
        <text class="user-name">{{ u.nickname || u.userId || '未知' }}</text>
        <text class="user-id">ID: {{ u.userId }}</text>
        <view class="user-stats">
          <text class="ustat">打卡 {{ u.totalCheckins || 0 }} 次</text>
          <text class="ustat">照片 {{ u.totalPhotos || 0 }} 张</text>
          <text class="ustat">创建 {{ u.totalCreated || 0 }} 个</text>
        </view>
      </view>
      <text class="arrow">→</text>
    </view>

    <view v-if="hasMore" class="load-more" @click="fetchUsers">
      <text>加载更多</text>
    </view>

    <!-- User detail modal -->
    <view v-if="selected" class="modal-mask" @click="selected = null">
      <view class="modal-box" @click.stop>
        <text class="modal-title">{{ selected.nickname || selected.userId }}</text>
        <view class="detail-grid">
          <view class="detail-item">
            <text class="detail-val">{{ selected.totalCheckins || 0 }}</text>
            <text class="detail-lbl">总打卡</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.totalPhotos || 0 }}</text>
            <text class="detail-lbl">照片数</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.totalCreated || 0 }}</text>
            <text class="detail-lbl">创建打卡点</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue'

const users = ref([])
const selected = ref(null)
const hasMore = ref(false)
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

onShow(() => { offset = 0; fetchUsers() })

async function fetchUsers() {
  try {
    const res = await api.getUsers({ offset, limit })
    if (res.errCode === 0) {
      if (offset === 0) users.value = res.data
      else users.value = [...users.value, ...res.data]
      hasMore = res.data.length >= limit
      offset += limit
    }
  } catch (e) { console.error(e) }
}

function selectUser(u) {
  selected.value = u
}
</script>

<style>
.users-page { padding: 24rpx; }

.page-desc {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 16rpx;
  display: block;
}

.user-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.user-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background: #e6f9ed;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #2ecc71;
}

.user-info { flex: 1; }

.user-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.user-id {
  font-size: 22rpx;
  color: #aaa;
}

.user-stats {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.ustat {
  font-size: 22rpx;
  color: #666;
}

.arrow {
  font-size: 32rpx;
  color: #ccc;
}

.empty { text-align: center; color: #999; padding: 80rpx 0; font-size: 26rpx; }
.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }

/* Modal */
.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 999;
}
.modal-box {
  width: 600rpx; background: #fff; border-radius: 16rpx; padding: 32rpx;
}
.modal-title { font-size: 34rpx; font-weight: bold; margin-bottom: 24rpx; display: block; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16rpx; }
.detail-item { text-align: center; }
.detail-val { font-size: 40rpx; font-weight: bold; color: #2ecc71; }
.detail-lbl { font-size: 22rpx; color: #999; }
</style>
