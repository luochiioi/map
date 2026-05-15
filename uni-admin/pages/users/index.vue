<template>
  <view class="users-page">
    <AdminHeader
      title="用户管理"
      subtitle="读取 uni-id-users，并合并用户统计信息"
      @refresh="reload"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="loading && users.length === 0" class="notice">正在加载用户...</view>

    <text class="page-desc">共 {{ total }} 个用户</text>

    <view v-if="!loading && users.length === 0" class="empty">
      暂无用户数据。若仪表盘有用户但这里没有，请重新上传 admin-center 云对象。
    </view>

    <view v-for="u in users" :key="u._id" class="user-card" @click="selectUser(u)">
      <view class="user-avatar">
        <text class="avatar-text">{{ firstLetter(u.nickname || u.userId) }}</text>
      </view>
      <view class="user-info">
        <view class="name-row">
          <text class="user-name">{{ u.nickname || u.userId || '未知' }}</text>
          <text v-if="isAdmin(u.role)" class="role-badge">admin</text>
          <text v-if="isSelf(u)" class="self-badge">本人</text>
        </view>
        <text class="user-id">账号: {{ u.userId }} · UID: {{ u.uid }}</text>
        <text class="user-id">创建时间: {{ formatTime(u.createdAt) }}</text>
        <view class="user-stats">
          <text class="ustat">有效打卡 {{ u.activeCheckins || 0 }} / 累计 {{ u.totalCheckins || 0 }}</text>
          <text class="ustat reward-stat">已发放 {{ u.claimedRewardPoints || 0 }} / 待领取路线 {{ u.pendingRewardPoints || 0 }} / 累计 {{ u.totalRewardPoints || 0 }}</text>
        </view>
      </view>
      <view
        class="del-btn"
        :class="{ 'del-btn-disabled': isSelf(u) || deleting }"
        @click.stop="confirmDelete(u)"
      >
        <text class="del-btn-text">{{ isSelf(u) ? '本人' : '删除' }}</text>
      </view>
    </view>

    <view v-if="hasMore" class="load-more" @click="fetchUsers">
      <text>{{ loading ? '加载中...' : '加载更多' }}</text>
    </view>

    <view v-if="selected" class="modal-mask" @click="selected = null">
      <view class="modal-box" @click.stop>
        <text class="modal-title">{{ selected.nickname || selected.userId }}</text>
        <text class="modal-sub">UID: {{ selected.uid }}</text>
        <text class="modal-sub">角色: {{ formatRole(selected.role) }}</text>
        <view class="detail-grid">
          <view class="detail-item">
            <text class="detail-val">{{ selected.activeCheckins || 0 }}</text>
            <text class="detail-lbl">有效打卡</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.totalCheckins || 0 }}</text>
            <text class="detail-lbl">累计打卡</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.claimedRewardPoints || 0 }}</text>
            <text class="detail-lbl">已发放积分</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.pendingRewardPoints || 0 }}</text>
            <text class="detail-lbl">待领取路线积分</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.totalRewardPoints || 0 }}</text>
            <text class="detail-lbl">累计获得积分</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.routeRewardCount || 0 }}</text>
            <text class="detail-lbl">路线奖励</text>
          </view>
          <view class="detail-item">
            <text class="detail-val">{{ selected.taskRewardCount || 0 }}</text>
            <text class="detail-lbl">任务奖励</text>
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
import { getErrorMessage, goAdminLogin, isAuthError } from '@/utils/adminAuth.js'

const users = ref([])
const total = ref(0)
const selected = ref(null)
const hasMore = ref(false)
const loading = ref(false)
const deleting = ref(false)
const currentUid = ref('')
const errorText = ref('')
const needsLogin = ref(false)
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

onShow(() => {
  refreshCurrentUid()
  reload()
})

function refreshCurrentUid() {
  try {
    const info = uniCloud.getCurrentUserInfo()
    currentUid.value = String((info && info.uid) || '')
  } catch (e) {
    currentUid.value = ''
  }
}

function isSelf(u) {
  if (!u || !currentUid.value) return false
  return String(u._id || u.uid || '') === currentUid.value
}

function confirmDelete(u) {
  if (!u || isSelf(u) || deleting.value) return
  const name = u.nickname || u.userId || u._id
  uni.showModal({
    title: '删除用户',
    content: `确认删除 ${name}？将一并清理打卡记录、统计、任务进度与奖励，且不可恢复。`,
    confirmText: '删除',
    confirmColor: '#d93026',
    success: (res) => {
      if (res.confirm) runDelete(u)
    }
  })
}

async function runDelete(u) {
  if (!u || deleting.value) return
  deleting.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const res = await api.deleteUser({ _id: u._id })
    if (res.errCode !== 0) throw new Error(res.errMsg || '删除失败')
    const d = res.data || {}
    const summary = `已清理 ${d.checkinsRemoved || 0} 条打卡 / ${d.userTasksRemoved || 0} 条任务 / ${d.rewardsRemoved || 0} 条奖励`
    uni.showToast({ title: summary, icon: 'none', duration: 2500 })
    if (selected.value && selected.value._id === u._id) selected.value = null
    reload()
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = getErrorMessage(e, '删除失败')
    uni.showToast({ title: errorText.value, icon: 'none' })
  } finally {
    deleting.value = false
  }
}

function reload() {
  offset = 0
  users.value = []
  total.value = 0
  fetchUsers()
}

async function fetchUsers() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const res = await api.getUsers({ offset, limit })
    if (res.errCode !== 0) throw new Error(res.errMsg || '用户加载失败')
    const data = res.data || {}
    const list = data.list || []
    users.value = offset === 0 ? list : [...users.value, ...list]
    total.value = data.total || users.value.length
    hasMore.value = users.value.length < total.value
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

function firstLetter(value) {
  const text = String(value || '?')
  return text.substring(0, 1).toUpperCase()
}

function isAdmin(role) {
  return role === 'admin' || (Array.isArray(role) && role.includes('admin'))
}

function formatRole(role) {
  if (Array.isArray(role)) return role.join(', ')
  return role || '--'
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function selectUser(u) {
  selected.value = u
}
</script>

<style>
.users-page { padding: 24rpx; }

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

.name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.user-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.role-badge {
  background: #e6f9ed;
  color: #27ae60;
  border-radius: 999rpx;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
}

.self-badge {
  background: #eef2f7;
  color: #6477a6;
  border-radius: 999rpx;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
}

.user-id {
  display: block;
  font-size: 22rpx;
  color: #aaa;
  margin-top: 4rpx;
}

.user-stats {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
  flex-wrap: wrap;
}

.ustat {
  font-size: 22rpx;
  color: #666;
}

.reward-stat {
  color: #2e9f5f;
}

.del-btn {
  background: #ffeceb;
  border-radius: 8rpx;
  padding: 10rpx 20rpx;
  margin-left: 12rpx;
}

.del-btn-disabled {
  background: #f0f0f0;
  opacity: 0.6;
}

.del-btn-text {
  color: #d93026;
  font-size: 24rpx;
  font-weight: 500;
}

.del-btn-disabled .del-btn-text {
  color: #999;
}

.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }
.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }

.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 999;
}
.modal-box {
  width: 600rpx; background: #fff; border-radius: 16rpx; padding: 32rpx;
}
.modal-title { font-size: 34rpx; font-weight: bold; margin-bottom: 8rpx; display: block; }
.modal-sub { display: block; color: #888; font-size: 24rpx; margin-bottom: 8rpx; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16rpx; margin-top: 24rpx; }
.detail-item { text-align: center; }
.detail-val { font-size: 40rpx; font-weight: bold; color: #2ecc71; }
.detail-lbl { font-size: 22rpx; color: #999; }
</style>
