<template>
  <view class="edit-page">
    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="pageLoading" class="notice">正在加载...</view>

    <view v-if="!pageLoading" class="form-card">
      <!-- 关联打卡点 -->
      <view class="form-item">
        <text class="form-label">关联打卡点 *</text>
        <view v-if="isEditMode" class="readonly-field">
          <text class="readonly-text">{{ markerTitle || ('打卡点 ID：' + form.markerId) }}</text>
        </view>
        <picker
          v-else
          mode="selector"
          :range="markerOptions"
          range-key="label"
          :value="selectedMarkerIndex"
          @change="onMarkerChange"
        >
          <view class="picker-view">
            <text>{{ selectedMarkerIndex >= 0 ? markerOptions[selectedMarkerIndex].label : '请选择打卡点' }}</text>
          </view>
        </picker>
      </view>

      <!-- 类别 -->
      <view class="form-item">
        <text class="form-label">类别 *</text>
        <picker
          mode="selector"
          :range="CATEGORIES"
          :value="categoryIndex"
          @change="onCategoryChange"
        >
          <view class="picker-view">
            <text>{{ categoryIndex >= 0 ? CATEGORIES[categoryIndex] : '请选择类别' }}</text>
          </view>
        </picker>
      </view>

      <!-- 简介 -->
      <view class="form-item">
        <text class="form-label">简介</text>
        <input class="form-input" v-model="form.summary" placeholder="请输入项目简介（300字以内）" maxlength="300" />
      </view>

      <!-- 历史故事 -->
      <view class="form-item">
        <text class="form-label">历史故事</text>
        <textarea class="form-textarea" v-model="form.story" placeholder="请输入历史故事（5000字以内）" maxlength="5000" />
      </view>

      <!-- 传承人姓名 -->
      <view class="form-item">
        <text class="form-label">传承人姓名</text>
        <input class="form-input" v-model="form.inheritorName" placeholder="请输入传承人姓名" maxlength="50" />
      </view>

      <!-- 传承人简介 -->
      <view class="form-item">
        <text class="form-label">传承人简介</text>
        <textarea class="form-textarea" v-model="form.inheritorBio" placeholder="请输入传承人简介（500字以内）" maxlength="500" />
      </view>

      <!-- 传承人照片 -->
      <view class="form-item">
        <text class="form-label">传承人照片</text>
        <view v-if="form.inheritorPhoto" class="img-preview-row">
          <image class="img-preview" :src="form.inheritorPhoto" mode="aspectFill" />
          <text class="img-remove" @click="form.inheritorPhoto = ''">移除</text>
        </view>
        <button
          v-if="!form.inheritorPhoto"
          class="btn-upload"
          :disabled="uploadingInheritor"
          @click="pickInheritorPhoto"
        >{{ uploadingInheritor ? '上传中...' : '选择传承人照片' }}</button>
      </view>

      <!-- 项目图片 -->
      <view class="form-item">
        <text class="form-label">项目图片</text>
        <view v-for="(url, idx) in form.images" :key="idx" class="img-preview-row">
          <image class="img-preview" :src="url" mode="aspectFill" />
          <text class="img-remove" @click="removeImage(idx)">移除</text>
        </view>
        <button
          class="btn-upload"
          :disabled="uploadingImages"
          @click="pickProjectImage"
        >{{ uploadingImages ? '上传中...' : '添加图片' }}</button>
      </view>

      <!-- 相关条目 -->
      <view class="form-item">
        <text class="form-label">相关条目（markerId）</text>
        <view class="related-list">
          <view v-for="(rid, idx) in form.relatedMarkerIds" :key="idx" class="related-tag">
            <text class="related-tag-text">{{ relatedMarkerLabel(rid) }}</text>
            <text class="related-tag-remove" @click="removeRelated(idx)">×</text>
          </view>
        </view>
        <view class="related-add-row">
          <picker
            mode="selector"
            :range="relatedPickerOptions"
            range-key="label"
            :value="-1"
            @change="onAddRelated"
          >
            <view class="picker-view small">
              <text>+ 添加相关条目</text>
            </view>
          </picker>
        </view>
      </view>

      <!-- 状态 -->
      <view class="form-item">
        <text class="form-label">状态</text>
        <picker
          mode="selector"
          :range="STATUS_OPTIONS"
          range-key="label"
          :value="statusIndex"
          @change="onStatusChange"
        >
          <view class="picker-view">
            <text>{{ STATUS_OPTIONS[statusIndex].label }}</text>
          </view>
        </picker>
      </view>

      <!-- 操作按钮 -->
      <view class="form-actions">
        <button class="btn-cancel" @click="goBack">取消</button>
        <button class="btn-save" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getErrorMessage, goAdminLogin, isAuthError } from '@/utils/adminAuth.js'

const CATEGORIES = [
  '传统技艺', '民俗', '曲艺', '传统音乐', '传统舞蹈',
  '传统美术', '传统医药', '民间文学', '传统体育', '传统戏剧'
]

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' }
]

// --- State ---
const pageLoading = ref(false)
const errorText = ref('')
const needsLogin = ref(false)
const saving = ref(false)
const uploadingInheritor = ref(false)
const uploadingImages = ref(false)

const isEditMode = ref(false)
const editId = ref('')
const markerTitle = ref('')

const form = ref({
  markerId: 0,
  category: '',
  summary: '',
  story: '',
  inheritorName: '',
  inheritorBio: '',
  inheritorPhoto: '',
  images: [],
  relatedMarkerIds: [],
  status: 'draft'
})

const markerOptions = ref([]) // [{ label, value }]
const selectedMarkerIndex = ref(-1)

const categoryIndex = computed(() => {
  const idx = CATEGORIES.indexOf(form.value.category)
  return idx >= 0 ? idx : -1
})

const statusIndex = computed(() => {
  const idx = STATUS_OPTIONS.findIndex(o => o.value === form.value.status)
  return idx >= 0 ? idx : 0
})

const relatedPickerOptions = computed(() => {
  return markerOptions.value.filter(
    o => o.value !== form.value.markerId && !form.value.relatedMarkerIds.includes(o.value)
  )
})

// --- Cloud objects ---
const heritageApi = uniCloud.importObject('heritage-center')
const adminApi = uniCloud.importObject('admin-center')
const photoApi = uniCloud.importObject('photo-center')

// --- Lifecycle ---
onLoad(async (query) => {
  await loadMarkers()
  if (query && query.markerId) {
    isEditMode.value = true
    const mid = Number(query.markerId)
    form.value.markerId = mid
    await loadHeritage(mid)
  }
})

// --- Data loading ---
async function loadMarkers() {
  try {
    const res = await adminApi.getMarkers({ offset: 0, limit: 100, keyword: '' })
    if (res.errCode !== 0) throw new Error(res.errMsg || '打卡点加载失败')
    const list = (res.data && res.data.list) || []
    markerOptions.value = list.map(m => ({ label: m.title + ' (ID:' + m.id + ')', value: m.id }))
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = getErrorMessage(e, '打卡点列表加载失败，请检查 admin-center 是否已上传')
  }
}

async function loadHeritage(mid) {
  pageLoading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const res = await heritageApi.adminGet({ markerId: mid })
    if (res.errCode !== 0) throw new Error(res.errMsg || '非遗内容加载失败')
    const detail = res.data
    if (detail) {
      editId.value = detail._id || ''
      form.value = {
        markerId: detail.markerId || mid,
        category: detail.category || '',
        summary: detail.summary || '',
        story: detail.story || '',
        inheritorName: detail.inheritorName || '',
        inheritorBio: detail.inheritorBio || '',
        inheritorPhoto: detail.inheritorPhoto || '',
        images: Array.isArray(detail.images) ? detail.images.slice() : [],
        relatedMarkerIds: Array.isArray(detail.relatedMarkerIds) ? detail.relatedMarkerIds.slice() : [],
        status: detail.status || 'draft'
      }
      const found = markerOptions.value.find(o => o.value === mid)
      markerTitle.value = found ? found.label : ('打卡点 ID：' + mid)
    } else {
      // No existing heritage for this marker — fall through to create mode
      form.value.markerId = mid
      const found = markerOptions.value.find(o => o.value === mid)
      markerTitle.value = found ? found.label : ('打卡点 ID：' + mid)
    }
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = getErrorMessage(e, '非遗内容加载失败')
  } finally {
    pageLoading.value = false
  }
}

// --- Form event handlers ---
function onMarkerChange(e) {
  const idx = Number(e.detail.value)
  selectedMarkerIndex.value = idx
  form.value.markerId = markerOptions.value[idx].value
}

function onCategoryChange(e) {
  form.value.category = CATEGORIES[Number(e.detail.value)]
}

function onStatusChange(e) {
  form.value.status = STATUS_OPTIONS[Number(e.detail.value)].value
}

// --- Related markers ---
function relatedMarkerLabel(rid) {
  const found = markerOptions.value.find(o => o.value === rid)
  return found ? found.label : ('ID:' + rid)
}

function onAddRelated(e) {
  const idx = Number(e.detail.value)
  const opt = relatedPickerOptions.value[idx]
  if (!opt) return
  if (!form.value.relatedMarkerIds.includes(opt.value)) {
    form.value.relatedMarkerIds = [...form.value.relatedMarkerIds, opt.value]
  }
}

function removeRelated(idx) {
  const arr = form.value.relatedMarkerIds.slice()
  arr.splice(idx, 1)
  form.value.relatedMarkerIds = arr
}

// --- Image upload helpers ---
function readFileAsBase64(filePath) {
  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: res => resolve(res.data),
      fail: err => reject(new Error(err.errMsg || '读取文件失败'))
    })
  })
}

function getFileName(filePath) {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || ('img_' + Date.now() + '.jpg')
}

async function pickInheritorPhoto() {
  try {
    const chooseRes = await new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: err => reject(new Error(err.errMsg || '选图失败'))
      })
    })
    const filePath = chooseRes.tempFilePaths[0]
    uploadingInheritor.value = true
    const base64 = await readFileAsBase64(filePath)
    const fileName = getFileName(filePath)
    const upRes = await photoApi.upload({ fileContent: base64, fileName, folder: 'heritage-media' })
    if (upRes.errCode !== 0) throw new Error(upRes.errMsg || '上传失败')
    form.value.inheritorPhoto = upRes.data.cloudURL
  } catch (e) {
    needsLogin.value = isAuthError(e)
    uni.showToast({ title: getErrorMessage(e, '上传传承人照片失败'), icon: 'none' })
  } finally {
    uploadingInheritor.value = false
  }
}

async function pickProjectImage() {
  try {
    const chooseRes = await new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: err => reject(new Error(err.errMsg || '选图失败'))
      })
    })
    const filePath = chooseRes.tempFilePaths[0]
    uploadingImages.value = true
    const base64 = await readFileAsBase64(filePath)
    const fileName = getFileName(filePath)
    const upRes = await photoApi.upload({ fileContent: base64, fileName, folder: 'heritage-media' })
    if (upRes.errCode !== 0) throw new Error(upRes.errMsg || '上传失败')
    form.value.images = [...form.value.images, upRes.data.cloudURL]
  } catch (e) {
    needsLogin.value = isAuthError(e)
    uni.showToast({ title: getErrorMessage(e, '上传图片失败'), icon: 'none' })
  } finally {
    uploadingImages.value = false
  }
}

function removeImage(idx) {
  const arr = form.value.images.slice()
  arr.splice(idx, 1)
  form.value.images = arr
}

// --- Save ---
async function save() {
  if (!form.value.markerId) {
    uni.showToast({ title: '请选择关联打卡点', icon: 'none' })
    return
  }
  if (!form.value.category) {
    uni.showToast({ title: '请选择类别', icon: 'none' })
    return
  }

  saving.value = true
  errorText.value = ''
  needsLogin.value = false

  try {
    let res
    if (isEditMode.value && editId.value) {
      res = await heritageApi.update({
        _id: editId.value,
        category: form.value.category,
        summary: form.value.summary,
        story: form.value.story,
        inheritorName: form.value.inheritorName,
        inheritorBio: form.value.inheritorBio,
        inheritorPhoto: form.value.inheritorPhoto,
        images: form.value.images,
        relatedMarkerIds: form.value.relatedMarkerIds,
        status: form.value.status
      })
    } else {
      res = await heritageApi.create({
        markerId: form.value.markerId,
        category: form.value.category,
        summary: form.value.summary,
        story: form.value.story,
        inheritorName: form.value.inheritorName,
        inheritorBio: form.value.inheritorBio,
        inheritorPhoto: form.value.inheritorPhoto,
        images: form.value.images,
        relatedMarkerIds: form.value.relatedMarkerIds,
        status: form.value.status
      })
    }
    if (res.errCode !== 0) throw new Error(res.errMsg || '保存失败')
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => { uni.navigateBack() }, 800)
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = getErrorMessage(e, '保存失败')
    uni.showToast({ title: getErrorMessage(e, '保存失败'), icon: 'none' })
  } finally {
    saving.value = false
  }
}

function goBack() {
  uni.navigateBack()
}

function goLogin() {
  goAdminLogin()
}
</script>

<style>
.edit-page { padding: 24rpx; }

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

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
}

.form-item {
  margin-bottom: 28rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #555;
  font-weight: 600;
  margin-bottom: 10rpx;
}

.form-input {
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  padding: 16rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
}

.form-textarea {
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  padding: 16rpx;
  font-size: 28rpx;
  width: 100%;
  min-height: 160rpx;
  box-sizing: border-box;
}

.picker-view {
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  padding: 16rpx;
  font-size: 28rpx;
  color: #333;
  background: #fafafa;
}

.picker-view.small {
  font-size: 24rpx;
  padding: 12rpx 16rpx;
}

.readonly-field {
  background: #f4f4f4;
  border-radius: 8rpx;
  padding: 16rpx;
}

.readonly-text {
  font-size: 28rpx;
  color: #888;
}

.img-preview-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.img-preview {
  width: 120rpx;
  height: 120rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
}

.img-remove {
  font-size: 24rpx;
  color: #ff3b30;
  padding: 8rpx 16rpx;
}

.btn-upload {
  background: #ecf9f1;
  color: #2e9f5f;
  font-size: 24rpx;
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  border: 1rpx dashed #2ecc71;
  margin-top: 4rpx;
}

.btn-upload[disabled] {
  opacity: 0.5;
}

.related-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.related-tag {
  display: flex;
  align-items: center;
  background: #e8f0fe;
  border-radius: 999rpx;
  padding: 6rpx 16rpx;
  gap: 8rpx;
}

.related-tag-text {
  font-size: 22rpx;
  color: #1a73e8;
}

.related-tag-remove {
  font-size: 26rpx;
  color: #1a73e8;
  font-weight: bold;
}

.related-add-row {
  margin-top: 4rpx;
}

.form-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;
}

.btn-cancel {
  flex: 1;
  background: #f0f0f0;
  color: #666;
  border: none;
  border-radius: 8rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

.btn-save {
  flex: 2;
  background: #2ecc71;
  color: #fff;
  border: none;
  border-radius: 8rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

.btn-save[disabled] {
  opacity: 0.6;
}
</style>
