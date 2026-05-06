<template>
  <view class="markers-page">
    <!-- Toolbar -->
    <view class="toolbar">
      <text class="count-text">共 {{ markers.length }} 个打卡点</text>
      <button class="btn-sm" @click="showImport = !showImport">批量导入</button>
    </view>

    <!-- Batch import panel -->
    <view v-if="showImport" class="import-panel">
      <textarea v-model="importText" placeholder="粘贴 JSON 数组，每项: { title, latitude, longitude }" />
      <button class="btn-primary" @click="doImport">确认导入</button>
    </view>

    <!-- List -->
    <view v-if="markers.length === 0" class="empty">加载中...</view>
    <view v-for="m in markers" :key="m._id" class="marker-card">
      <view class="card-main">
        <view class="card-info">
          <text class="card-title">{{ m.title }}</text>
          <text class="card-coords">{{ formatCoord(m.latitude) }}, {{ formatCoord(m.longitude) }}</text>
          <text class="card-meta">打卡 {{ m.checkinCount || 0 }} 次 · 创建者 {{ m.createdBy || '--' }}</text>
        </view>
        <view class="card-actions">
          <text class="act-btn edit" @click="startEdit(m)">编辑</text>
          <text class="act-btn del" @click="doDelete(m)">删除</text>
        </view>
      </view>
    </view>

    <!-- Load more -->
    <view v-if="hasMore" class="load-more" @click="loadMarkers">
      <text>加载更多</text>
    </view>

    <!-- Edit modal -->
    <view v-if="editing" class="modal-mask" @click="editing = null">
      <view class="modal-box" @click.stop>
        <text class="modal-title">编辑打卡点</text>
        <input class="modal-input" v-model="editForm.title" placeholder="名称" />
        <input class="modal-input" v-model="editForm.latitude" placeholder="纬度" type="number" />
        <input class="modal-input" v-model="editForm.longitude" placeholder="经度" type="number" />
        <view class="modal-btns">
          <button class="btn-cancel" @click="editing = null">取消</button>
          <button class="btn-primary" @click="doUpdate">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue'

const markers = ref([])
const hasMore = ref(false)
const showImport = ref(false)
const importText = ref('')
const editing = ref(null)
const editForm = ref({ title: '', latitude: '', longitude: '' })
let offset = 0
const limit = 20

const api = uniCloud.importObject('admin-center')

onShow(() => { offset = 0; loadMarkers() })

async function loadMarkers() {
  try {
    // Use marker-center.getAll since admin-center doesn't have a direct getAllMarkers
    const markerApi = uniCloud.importObject('marker-center')
    const res = await markerApi.getAll()
    if (res.errCode === 0) {
      markers.value = res.data
      hasMore.value = res.data.length >= limit
    }
  } catch (e) { console.error(e) }
}

function formatCoord(v) { return v ? Number(v).toFixed(6) : '--' }

function startEdit(m) {
  editing.value = m
  editForm.value = {
    title: m.title || '',
    latitude: String(m.latitude || ''),
    longitude: String(m.longitude || '')
  }
}

async function doUpdate() {
  if (!editing.value) return
  try {
    await api.updateMarker({
      _id: editing.value._id,
      title: editForm.value.title,
      latitude: parseFloat(editForm.value.latitude),
      longitude: parseFloat(editForm.value.longitude),
      updatedAt: Date.now()
    })
    uni.showToast({ title: '更新成功', icon: 'success' })
    editing.value = null
    offset = 0
    loadMarkers()
  } catch (e) {
    uni.showToast({ title: '更新失败', icon: 'error' })
  }
}

async function doDelete(m) {
  const res = await uni.showModal({ title: '确认删除', content: `确定删除"${m.title}"？` })
  if (res.confirm) {
    try {
      await api.deleteMarker({ _id: m._id })
      uni.showToast({ title: '已删除', icon: 'success' })
      loadMarkers()
    } catch (e) {
      uni.showToast({ title: '删除失败', icon: 'error' })
    }
  }
}

async function doImport() {
  try {
    const list = JSON.parse(importText.value)
    if (!Array.isArray(list) || list.length === 0) {
      uni.showToast({ title: '请输入有效的 JSON 数组', icon: 'none' })
      return
    }
    await api.batchImport({ list })
    uni.showToast({ title: `成功导入 ${list.length} 个`, icon: 'success' })
    showImport.value = false
    importText.value = ''
    loadMarkers()
  } catch (e) {
    uni.showToast({ title: '导入失败，检查 JSON 格式', icon: 'error' })
  }
}
</script>

<style>
.markers-page { padding: 24rpx; }

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.count-text { font-size: 26rpx; color: #888; }

.btn-sm {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  border: none;
}

.import-panel {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}

.import-panel textarea {
  width: 100%;
  height: 200rpx;
  background: #f8f8f8;
  border-radius: 8rpx;
  padding: 12rpx;
  font-size: 24rpx;
  margin-bottom: 12rpx;
}

.marker-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
}

.card-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-info { flex: 1; }

.card-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.card-coords {
  font-size: 24rpx;
  color: #888;
  font-family: monospace;
}

.card-meta {
  font-size: 22rpx;
  color: #aaa;
  margin-top: 4rpx;
}

.act-btn { font-size: 26rpx; padding: 8rpx 16rpx; }
.act-btn.edit { color: #2ecc71; }
.act-btn.del { color: #ff3b30; }

.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }

.empty { text-align: center; color: #999; padding: 80rpx 0; font-size: 26rpx; }

/* Modal */
.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 999;
}
.modal-box {
  width: 600rpx; background: #fff; border-radius: 16rpx; padding: 32rpx;
}
.modal-title { font-size: 32rpx; font-weight: bold; margin-bottom: 24rpx; display: block; }
.modal-input {
  border: 1rpx solid #e0e0e0; border-radius: 8rpx; padding: 16rpx; font-size: 28rpx; margin-bottom: 16rpx;
}
.modal-btns { display: flex; gap: 16rpx; margin-top: 24rpx; }
.btn-cancel { flex:1; background: #f0f0f0; color: #666; border: none; border-radius: 8rpx; padding: 16rpx; font-size: 28rpx; }
.btn-primary { flex:1; background: #2ecc71; color: #fff; border: none; border-radius: 8rpx; padding: 16rpx; font-size: 28rpx; }
</style>
