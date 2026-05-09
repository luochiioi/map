<template>
  <view class="markers-page">
    <AdminHeader
      title="打卡点管理"
      subtitle="新增、编辑、删除和同步云端打卡点"
      @refresh="reload"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <view v-if="loading && markers.length === 0" class="notice">正在加载打卡点...</view>

    <view class="summary-grid">
      <view class="summary-card">
        <text class="summary-value">{{ total }}</text>
        <text class="summary-label">云端打卡点</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ checkedMarkerTotal }}</text>
        <text class="summary-label">已有打卡</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ checkinTotal }}</text>
        <text class="summary-label">打卡人次</text>
      </view>
    </view>

    <view class="toolbar">
      <view class="toolbar-actions">
        <button class="btn-sm" @click="openCreate">新增打卡点</button>
        <button class="btn-sm ghost" @click="syncDefaults">同步默认点</button>
        <button class="btn-sm ghost" @click="showImport = !showImport">批量导入</button>
      </view>
    </view>

    <view class="search-bar">
      <input class="search-input" v-model="keyword" placeholder="搜索打卡点名称" confirm-type="search" @confirm="reload" />
      <button class="btn-search" @click="reload">搜索</button>
    </view>

    <view v-if="showImport" class="import-panel">
      <text class="panel-title">批量导入 JSON</text>
      <textarea v-model="importText" placeholder='例如：[{"title":"测试点","latitude":39.9,"longitude":116.3}]' />
      <button class="btn-primary" @click="doImport">确认导入</button>
    </view>

    <view v-if="!loading && markers.length === 0" class="empty">
      暂无打卡点。请先点击“同步默认点”，让本地 8 个种子点写入 tourism_markers。
    </view>

    <view v-for="m in markers" :key="m._id" class="marker-card">
      <view class="card-main">
        <view class="card-info">
          <view class="title-row">
            <text class="card-title">{{ m.title }}</text>
            <text class="badge" :class="(m.checkinCount || 0) > 0 ? 'active' : ''">
              {{ (m.checkinCount || 0) > 0 ? '已有记录' : '未打卡' }}
            </text>
          </view>
          <text class="card-coords">{{ formatCoord(m.latitude) }}, {{ formatCoord(m.longitude) }}</text>
          <text class="card-meta">创建者：{{ m.createdBy || '--' }} · 创建于：{{ formatTime(m.createdAt) }}</text>
          <text class="card-meta">更新于：{{ formatTime(m.updatedAt) }} · 云端 ID：{{ m.id }}</text>
          <text class="card-meta">图标：{{ m.iconPath || '--' }} · 尺寸：{{ m.width || '--' }} x {{ m.height || '--' }}</text>
          <text class="card-meta strong">打卡人数 / 记录数：{{ m.checkinCount || 0 }}</text>
        </view>
        <view class="card-actions">
          <text class="act-btn record" @click="viewCheckins(m)">查看记录</text>
          <text class="act-btn edit" @click="startEdit(m)">编辑</text>
          <text class="act-btn del" @click="doDelete(m)">删除</text>
        </view>
      </view>
    </view>

    <view v-if="hasMore" class="load-more" @click="loadMarkers">
      <text>{{ loading ? '加载中...' : '加载更多' }}</text>
    </view>

    <view v-if="editing" class="modal-mask" @click="editing = null">
      <view class="modal-box" @click.stop>
        <text class="modal-title">{{ editing._id ? '编辑打卡点' : '新增打卡点' }}</text>
        <input class="modal-input" v-model="editForm.title" placeholder="名称" />
        <input class="modal-input" v-model="editForm.latitude" placeholder="纬度" type="number" />
        <input class="modal-input" v-model="editForm.longitude" placeholder="经度" type="number" />
        <input class="modal-input" v-model="editForm.iconPath" placeholder="图标路径，留空使用默认图标" />
        <view class="modal-row">
          <input class="modal-input half" v-model="editForm.width" placeholder="宽" type="number" />
          <input class="modal-input half" v-model="editForm.height" placeholder="高" type="number" />
        </view>
        <view class="modal-btns">
          <button class="btn-cancel" @click="editing = null">取消</button>
          <button class="btn-primary" @click="saveMarker">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'

const markers = ref([])
const total = ref(0)
const checkedMarkerTotal = ref(0)
const checkinTotal = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const showImport = ref(false)
const importText = ref('')
const keyword = ref('')
const editing = ref(null)
const editForm = ref({ title: '', latitude: '', longitude: '', iconPath: '', width: '', height: '' })
let offset = 0
const limit = 20

const api = uniCloud.importObject('admin-center')

onShow(() => { reload() })

function reload() {
  offset = 0
  markers.value = []
  total.value = 0
  loadMarkers()
}

async function loadMarkers() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  try {
    const res = await api.getMarkers({ offset, limit, keyword: keyword.value })
    if (res.errCode !== 0) throw new Error(res.errMsg || '打卡点加载失败')
    const data = res.data || {}
    const list = data.list || []
    markers.value = offset === 0 ? list : [...markers.value, ...list]
    total.value = data.total || list.length
    hasMore.value = markers.value.length < total.value
    offset += limit
    recalcSummary()
  } catch (e) {
    errorText.value = e.message || '连接服务器失败，请确认 admin-center 已上传'
  } finally {
    loading.value = false
  }
}

function recalcSummary() {
  checkedMarkerTotal.value = markers.value.filter(item => (item.checkinCount || 0) > 0).length
  checkinTotal.value = markers.value.reduce((sum, item) => sum + Number(item.checkinCount || 0), 0)
}

function formatCoord(v) {
  return v == null ? '--' : Number(v).toFixed(6)
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openCreate() {
  editing.value = { _id: '' }
  editForm.value = { title: '', latitude: '', longitude: '', iconPath: '', width: '36', height: '36' }
}

function startEdit(m) {
  editing.value = m
  editForm.value = {
    title: m.title || '',
    latitude: String(m.latitude || ''),
    longitude: String(m.longitude || ''),
    iconPath: m.iconPath || '',
    width: String(m.width || ''),
    height: String(m.height || '')
  }
}

async function saveMarker() {
  if (!editing.value) return
  try {
    const payload = {
      title: editForm.value.title,
      latitude: parseFloat(editForm.value.latitude),
      longitude: parseFloat(editForm.value.longitude),
      iconPath: editForm.value.iconPath,
      width: editForm.value.width,
      height: editForm.value.height
    }
    const res = editing.value._id
      ? await api.updateMarker({ _id: editing.value._id, ...payload })
      : await api.createMarker(payload)
    if (res.errCode !== 0) throw new Error(res.errMsg || '保存失败')
    uni.showToast({ title: '保存成功', icon: 'success' })
    editing.value = null
    reload()
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
  }
}

async function doDelete(m) {
  const res = await uni.showModal({ title: '确认删除', content: `确定删除"${m.title}"？已有打卡记录也会一并删除。` })
  if (!res.confirm) return
  try {
    const delRes = await api.deleteMarker({ _id: m._id })
    if (delRes.errCode !== 0) throw new Error(delRes.errMsg || '删除失败')
    uni.showToast({ title: '已删除', icon: 'success' })
    reload()
  } catch (e) {
    uni.showToast({ title: e.message || '删除失败', icon: 'none' })
  }
}

async function syncDefaults() {
  try {
    const res = await api.syncDefaultMarkers()
    if (res.errCode !== 0) throw new Error(res.errMsg || '同步失败')
    const data = res.data || {}
    uni.showToast({ title: `新增 ${data.created.length}，更新 ${data.updated.length}`, icon: 'none' })
    reload()
  } catch (e) {
    uni.showToast({ title: e.message || '同步失败', icon: 'none' })
  }
}

function viewCheckins(m) {
  uni.setStorageSync('admin_checkins_marker_id', m.id)
  uni.setStorageSync('admin_checkins_marker_title', m.title)
  uni.switchTab({ url: '/pages/checkins/index' })
}

async function doImport() {
  try {
    const list = JSON.parse(importText.value)
    if (!Array.isArray(list) || list.length === 0) {
      uni.showToast({ title: '请输入有效的 JSON 数组', icon: 'none' })
      return
    }
    const res = await api.batchImport({ list })
    if (res.errCode !== 0) throw new Error(res.errMsg || '导入失败')
    uni.showToast({ title: `成功导入 ${list.length} 个`, icon: 'success' })
    showImport.value = false
    importText.value = ''
    reload()
  } catch (e) {
    uni.showToast({ title: e.message || '导入失败，检查 JSON 格式', icon: 'none' })
  }
}
</script>

<style>
.markers-page { padding: 24rpx; }

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

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.summary-card {
  background: #fff;
  border-radius: 14rpx;
  padding: 22rpx 12rpx;
  text-align: center;
}

.summary-value {
  display: block;
  color: #2ecc71;
  font-size: 38rpx;
  font-weight: 700;
}

.summary-label {
  color: #8a9a90;
  font-size: 22rpx;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16rpx;
}

.toolbar-actions { display: flex; gap: 10rpx; flex-wrap: wrap; justify-content: flex-end; }

.btn-sm {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  border: none;
}

.btn-sm.ghost {
  background: #ecf9f1;
  color: #2e9f5f;
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
  padding: 14rpx 18rpx;
  font-size: 26rpx;
}

.btn-search {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 8rpx;
  border: none;
}

.import-panel {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}

.panel-title {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 12rpx;
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
  align-items: flex-start;
  gap: 16rpx;
}

.card-info { flex: 1; }

.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.badge {
  background: #f4f4f4;
  color: #999;
  border-radius: 999rpx;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
}

.badge.active {
  background: #e6f9ed;
  color: #27ae60;
}

.card-coords {
  display: block;
  font-size: 24rpx;
  color: #666;
  font-family: monospace;
  margin-bottom: 6rpx;
}

.card-meta {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.card-meta.strong { color: #2e9f5f; }

.card-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.act-btn { font-size: 26rpx; padding: 8rpx 16rpx; }
.act-btn.record { color: #1677ff; }
.act-btn.edit { color: #2ecc71; }
.act-btn.del { color: #ff3b30; }

.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }
.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }

.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 999;
}

.modal-box {
  width: 640rpx; background: #fff; border-radius: 16rpx; padding: 32rpx;
}

.modal-title { font-size: 32rpx; font-weight: bold; margin-bottom: 24rpx; display: block; }

.modal-input {
  border: 1rpx solid #e0e0e0; border-radius: 8rpx; padding: 16rpx; font-size: 28rpx; margin-bottom: 16rpx;
}

.modal-row { display: flex; gap: 12rpx; }
.modal-input.half { flex: 1; }

.modal-btns { display: flex; gap: 16rpx; margin-top: 24rpx; }
.btn-cancel { flex:1; background: #f0f0f0; color: #666; border: none; border-radius: 8rpx; padding: 16rpx; font-size: 28rpx; }
.btn-primary { flex:1; background: #2ecc71; color: #fff; border: none; border-radius: 8rpx; padding: 16rpx; font-size: 28rpx; }
</style>
