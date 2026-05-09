<template>
  <view class="login-page">
    <view class="login-card">
      <text class="title">地图打卡管理后台</text>
      <text class="subtitle">请使用已设置 role=admin 的账号登录</text>

      <input class="input" v-model="userName" placeholder="用户名" />
      <input class="input" v-model="password" placeholder="密码" password />

      <button class="login-btn" :loading="loading" @click="login">登录</button>
      <text v-if="errorText" class="error">{{ errorText }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const userName = ref('admin')
const password = ref('admin')
const loading = ref(false)
const errorText = ref('')

async function login() {
  if (!userName.value || !password.value) {
    errorText.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  errorText.value = ''
  try {
    const api = uniCloud.importObject('user-center')
    const res = await api.login(userName.value, password.value)
    if (res.errCode !== 0) {
      throw new Error(res.errMsg || '登录失败')
    }

    const data = res.data || {}
    uni.setStorageSync('uni_id_token', data.token)
    uni.setStorageSync('uni_id_token_expired', data.tokenExpired)
    uni.setStorageSync('admin_user_info', {
      userId: data.userId,
      userName: data.userName
    })

    uni.showToast({ title: '登录成功', icon: 'success' })
    uni.switchTab({ url: '/pages/markers/index' })
  } catch (e) {
    errorText.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #eef8ef, #f7faf3);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.login-card {
  width: 640rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx;
  box-shadow: 0 18rpx 60rpx rgba(45, 118, 76, 0.12);
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #1d3b2a;
  margin-bottom: 12rpx;
}

.subtitle {
  display: block;
  font-size: 24rpx;
  color: #7a8b80;
  margin-bottom: 40rpx;
}

.input {
  background: #f6f8f6;
  border-radius: 14rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  margin-bottom: 20rpx;
}

.login-btn {
  background: #2ecc71;
  color: #fff;
  border-radius: 14rpx;
  font-size: 30rpx;
  margin-top: 12rpx;
}

.error {
  display: block;
  color: #ff3b30;
  font-size: 24rpx;
  margin-top: 20rpx;
}
</style>
