const db = uniCloud.database()
const col = db.collection('tourism_markers')
const colTasks = db.collection('user_tasks')
const colRewards = db.collection('rewards')
const colUserProfiles = db.collection('users')
const authUtil = require('auth-util')
const { createRepairCheckinPlan } = require('./repair-service')

module.exports = {
  _before: async function() {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      // 仅 getAll 无需登录
    }
  },

  // ===== 公开操作（无需登录）=====

  async getAll() {
    const res = await col.orderBy('createdAt', 'asc').get()
    return { errCode: 0, data: res.data }
  },

  // ===== 需登录操作 =====

  async add(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { title, latitude, longitude } = data
    if (!title || latitude == null || longitude == null) {
      return { errCode: -1, errMsg: '参数不完整' }
    }
    const now = Date.now()
    const res = await col.add({
      id: now,
      title, latitude, longitude,
      iconPath: '/static/marker_default.png',
      checked: false,
      checkinCount: 0,
      checkedBy: [],
      createdBy: this.auth.uid,
      createdAt: now,
      updatedAt: now
    })
    await incrementUserStats(this.auth.uid, { totalCreated: 1 })
    return { errCode: 0, data: { id: res.id } }
  },

  async checkin(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { markerId, photoCloudURL, note, latitude, longitude } = data

    const markerRes = await col.where({ id: markerId }).get()
    if (!markerRes.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
    const marker = markerRes.data[0]

    if (latitude != null && longitude != null) {
      const dist = haversine(latitude, longitude, marker.latitude, marker.longitude)
      if (dist > 700) return { errCode: -1, errMsg: `距离过远（${Math.round(dist)}m），无法打卡` }
    }

    const alreadyChecked = (marker.checkedBy || []).some(entry => entry.userId === this.auth.uid)
    if (alreadyChecked) return { errCode: -1, errMsg: '您已在此处打过卡' }

    const checkedEntry = {
      userId: this.auth.uid,
      checkedAt: Date.now(),
      photoCloudURL: photoCloudURL || null,
      note: note || null
    }
    await col.where({ id: markerId }).update({
      checked: true,
      checkinCount: db.command.inc(1),
      checkedBy: db.command.push([checkedEntry]),
      updatedAt: Date.now()
    })

    await incrementUserStats(this.auth.uid, {
      totalCheckins: 1,
      totalPhotos: photoCloudURL ? 1 : 0
    })

    const completedTasks = await checkTasksForMarker(this.auth.uid, marker)

    return { errCode: 0, errMsg: '打卡成功', data: { completedTasks } }
  },

  async repairCheckin(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const markerId = Number(payload.markerId)
    if (!markerId) return { errCode: -1, errMsg: '缺少打卡点 ID' }

    const markerRes = await col.where({ id: markerId }).limit(1).get()
    if (!markerRes.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
    const marker = markerRes.data[0]

    const now = Date.now()
    const plan = createRepairCheckinPlan(marker, payload, this.auth.uid, now)
    if (!plan.shouldRepair) {
      return { errCode: 0, errMsg: '记录已存在', data: { repaired: false, existed: true } }
    }

    await col.doc(marker._id).update({
      checked: true,
      checkinCount: db.command.inc(1),
      checkedBy: db.command.push([plan.entry]),
      updatedAt: now
    })

    await incrementUserStats(this.auth.uid, {
      totalCheckins: 1,
      totalPhotos: plan.entry.photoCloudURL ? 1 : 0
    })

    const completedTasks = await checkTasksForMarker(this.auth.uid, marker)
    return { errCode: 0, errMsg: '补传成功', data: { repaired: true, completedTasks } }
  },

  async _checkTasks(marker) {
    return checkTasksForMarker(this.auth.uid, marker)
  },

  async update(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { _id, ...updates } = data
    const marker = await col.doc(_id).get()
    if (!marker.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
    const isOwner = marker.data[0].createdBy === this.auth.uid
    if (!isOwner) return { errCode: -1, errMsg: '无权修改此打卡点' }
    await col.doc(_id).update({ ...updates, updatedAt: Date.now() })
    return { errCode: 0, errMsg: '更新成功' }
  },

  async delete(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const { _id } = data
    const marker = await col.doc(_id).get()
    if (!marker.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
    if (marker.data[0].createdBy !== this.auth.uid) {
      return { errCode: -1, errMsg: '无权删除此打卡点' }
    }
    await col.doc(_id).remove()
    return { errCode: 0, errMsg: '删除成功' }
  },

  async getUserTasks() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const res = await colTasks.where({ userId: this.auth.uid }).get()
    return { errCode: 0, data: res.data }
  },

  async getRewards() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const res = await colRewards.where({ userId: this.auth.uid }).orderBy('earnedAt', 'desc').get()
    return { errCode: 0, data: res.data }
  }
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (deg) => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function incrementUserStats(userId, increments) {
  const existing = await colUserProfiles.where({ userId }).limit(1).get()
  const now = Date.now()
  if (!existing.data.length) {
    await colUserProfiles.add({
      userId,
      totalCheckins: Number(increments.totalCheckins || 0),
      totalPhotos: Number(increments.totalPhotos || 0),
      totalCreated: Number(increments.totalCreated || 0),
      createdAt: now,
      updatedAt: now
    })
    return
  }

  const updates = { updatedAt: now }
  if (increments.totalCheckins) updates.totalCheckins = db.command.inc(increments.totalCheckins)
  if (increments.totalPhotos) updates.totalPhotos = db.command.inc(increments.totalPhotos)
  if (increments.totalCreated) updates.totalCreated = db.command.inc(increments.totalCreated)
  await colUserProfiles.doc(existing.data[0]._id).update(updates)
}

async function checkTasksForMarker(userId, marker) {
  const completed = []
  const tasksRes = await db.collection('tourism_tasks')
    .where({ status: 'active' }).get()

  for (const task of tasksRes.data) {
    const existing = await colTasks.where({
      userId,
      taskId: task.id
    }).get()
    if (existing.data.length > 0 && existing.data[0].status === 'completed') continue

    const match = task.targetMarkerId === marker.id || task.targetTitle === marker.title
    if (!match) continue

    const now = Date.now()
    if (existing.data.length > 0) {
      await colTasks.doc(existing.data[0]._id).update({ status: 'completed', completedAt: now })
    } else {
      await colTasks.add({ userId, taskId: task.id, status: 'completed', completedAt: now })
    }
    const rewardExists = await colRewards.where({ userId, taskId: task.id }).get()
    if (!rewardExists.data.length) {
      await colRewards.add({ userId, taskId: task.id, taskName: task.name, reward: task.reward, earnedAt: now })
    }
    completed.push({ taskId: task.id, taskName: task.name, reward: task.reward })
  }
  return completed
}
