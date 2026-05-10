const db = uniCloud.database()
const col = db.collection('tourism_markers')
const colTasks = db.collection('user_tasks')
const colRewards = db.collection('rewards')
const colUserProfiles = db.collection('users')
const colAuditLogs = db.collection('tourism_audit_logs')
const colRoutes = db.collection('tourism_routes')
const colUserRoutes = db.collection('user_routes')
const authUtil = require('auth-util')
const { createRepairCheckinPlan, createDeleteCheckinPlan } = require('./repair-service')
const {
  calcRouteProgress,
  findNewlyCompletedRoutes,
  buildUserRouteEntry,
  buildRouteRewardEntry
} = require('./route-completion')

// 拉当前 uid 在所有 marker 中的"已打卡 markerId 集合"。
// 嵌套字段查询 'checkedBy.userId': uid 复用 §规则 29 的索引友好写法。
async function getUserDoneMarkerIds(uid) {
  if (!uid) return []
  const id = String(uid)
  const res = await col
    .where({ 'checkedBy.userId': id })
    .field({ id: true, checkedBy: true })
    .get()
  return (res.data || [])
    .filter(marker => (marker.checkedBy || []).some(entry => String(entry && entry.userId || '') === id))
    .map(marker => Number(marker.id))
}

// checkin / repairCheckin 写库成功后调用：找新完成的路线 → 幂等写入
// user_routes + rewards → 返回 completedRoutes 给客户端弹庆祝 modal。
// 任何子步骤失败仅 console.log，不影响主 checkin 响应（与 §规则 28 审计
// 失败不阻塞主流程同思路：路线奖励是辅助语义，主流程是打卡本身）。
async function detectAndRecordCompletedRoutes(uid, now) {
  if (!uid) return []
  try {
    const [routesRes, userRoutesRes, doneMarkerIds] = await Promise.all([
      colRoutes.where({ status: 'active' }).get(),
      colUserRoutes.where({ userId: String(uid) }).field({ routeId: true }).get(),
      getUserDoneMarkerIds(uid)
    ])
    const routes = routesRes.data || []
    const alreadyCompletedRouteIds = (userRoutesRes.data || []).map(row => Number(row.routeId))
    const newly = findNewlyCompletedRoutes(routes, doneMarkerIds, alreadyCompletedRouteIds)

    const completedRoutes = []
    for (const route of newly) {
      try {
        await colUserRoutes.add(buildUserRouteEntry(uid, route, now))
        await colRewards.add(buildRouteRewardEntry(uid, route, now))
        completedRoutes.push({
          id: Number(route.id),
          name: String(route.name || ''),
          reward: String(route.reward || '')
        })
      } catch (e) {
        console.log('[routes] record completion failed', route && route.id, e && e.message ? e.message : e)
      }
    }
    return completedRoutes
  } catch (e) {
    console.log('[routes] detectAndRecordCompletedRoutes failed', e && e.message ? e.message : e)
    return []
  }
}

// 仅记录用户自删事件；admin-center.audit-service 持有规范化 helper，本文件
// 不跨 cloudfunction require，只复刻最小写法保持表结构一致（参见
// admin-center/audit-service.js 的 buildAuditLogEntry）。
async function appendUserDeleteAudit(input) {
  try {
    const occurredAt = Date.now()
    await colAuditLogs.add({
      type: 'user.deleteCheckin',
      actorUid: String(input.actorUid || ''),
      targetUid: String(input.actorUid || ''),
      markerId: input.markerId != null ? Number(input.markerId) : null,
      markerTitle: String(input.markerTitle || ''),
      photoCloudURL: input.photoCloudURL ? String(input.photoCloudURL) : null,
      checkedAt: input.checkedAt != null ? Number(input.checkedAt) : null,
      reason: '',
      purgePhoto: false,
      purgeError: '',
      occurredAt
    })
  } catch (e) {
    console.log('[audit] user.deleteCheckin append failed', e && e.message ? e.message : e)
  }
}

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

  async whoami() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    return { errCode: 0, data: { uid: this.auth.uid } }
  },

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
    const completedRoutes = await detectAndRecordCompletedRoutes(this.auth.uid, Date.now())

    return { errCode: 0, errMsg: '打卡成功', data: { completedTasks, completedRoutes } }
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
    const completedRoutes = await detectAndRecordCompletedRoutes(this.auth.uid, now)
    return { errCode: 0, errMsg: '补传成功', data: { repaired: true, completedTasks, completedRoutes } }
  },

  async deleteCheckin(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const markerId = Number(payload.markerId)
    if (!markerId) return { errCode: -1, errMsg: '缺少打卡点 ID' }

    const markerRes = await col.where({ id: markerId }).limit(1).get()
    if (!markerRes.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
    const marker = markerRes.data[0]

    // 抓取自己这一条 entry 的 photoCloudURL / checkedAt 用于审计；
    // createDeleteCheckinPlan 之后 checkedBy 里就没这条了。
    const myEntry = (marker.checkedBy || []).find(entry =>
      entry && String(entry.userId || '') === String(this.auth.uid)
    )

    const plan = createDeleteCheckinPlan(marker, this.auth.uid)
    if (!plan.shouldDelete) {
      return { errCode: 0, errMsg: '记录不存在', data: { deleted: false, existed: false } }
    }

    await col.doc(marker._id).update({
      checked: plan.checked,
      checkinCount: plan.checkinCount,
      checkedBy: plan.checkedBy,
      updatedAt: Date.now()
    })

    await appendUserDeleteAudit({
      actorUid: this.auth.uid,
      markerId: marker.id,
      markerTitle: marker.title,
      photoCloudURL: myEntry && myEntry.photoCloudURL ? myEntry.photoCloudURL : null,
      checkedAt: myEntry && myEntry.checkedAt != null ? myEntry.checkedAt : null
    })

    return {
      errCode: 0,
      errMsg: '删除打卡成功',
      data: {
        deleted: true,
        removedCount: plan.removedCount,
        checkinCount: plan.checkinCount
      }
    }
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

  // P3.4 个人打卡历史：仅返回 this.auth.uid 自己在 checkedBy[] 里的切片，
  // 不暴露其他用户。每行扁平为 marker 基础信息 + 自己的 entry 字段，按
  // checkedAt 降序，方便 App 我的打卡页直接渲染卡片列表。
  async getMyCheckins() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const uid = String(this.auth.uid)
    const res = await col
      .where({ 'checkedBy.userId': uid })
      .field({ id: true, title: true, latitude: true, longitude: true, iconPath: true, width: true, height: true, checkedBy: true, checkinCount: true })
      .get()
    const list = []
    ;(res.data || []).forEach(marker => {
      const entries = (marker.checkedBy || []).filter(entry => entry && String(entry.userId || '') === uid)
      entries.forEach(entry => {
        list.push({
          markerDocId: marker._id || '',
          markerId: marker.id,
          markerTitle: marker.title,
          latitude: marker.latitude,
          longitude: marker.longitude,
          iconPath: marker.iconPath || '/static/marker_default.png',
          checkedAt: entry.checkedAt || 0,
          photoCloudURL: entry.photoCloudURL || null,
          note: entry.note || null,
          repaired: entry.repaired === true
        })
      })
    })
    list.sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0))
    return { errCode: 0, data: list }
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
  },

  // P4 主题路线公开读：列出所有 active 路线 + 当前 uid 的进度；不强制登录
  // （未登录时进度全 0，登录后实时显示 done/total）。放在 marker-center 而
  // 不是 admin-center，避免 admin 鉴权门挡掉 App 端普通用户拉路线列表。
  async getActiveRoutes() {
    const routesRes = await colRoutes
      .where({ status: 'active' })
      .orderBy('createdAt', 'desc')
      .get()
    const routes = routesRes.data || []

    const userCheckedMarkerIds = await getUserDoneMarkerIds(this.auth.uid)

    const list = routes.map(route => ({
      _id: route._id,
      id: route.id,
      name: route.name,
      description: route.description || '',
      coverImage: route.coverImage || null,
      markerIds: Array.isArray(route.markerIds) ? route.markerIds.map(Number) : [],
      reward: route.reward || '',
      status: route.status,
      progress: calcRouteProgress(route, userCheckedMarkerIds)
    }))

    return { errCode: 0, data: list }
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
