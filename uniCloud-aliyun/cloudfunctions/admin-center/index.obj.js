const db = uniCloud.database()
const authUtil = require('auth-util')
const {
  DEFAULT_SEED_MARKERS,
  DEFAULT_SEED_TASKS,
  buildSeedMarker,
  buildSeedUpdate,
  buildSeedTask,
  buildSeedTaskUpdate,
  sanitizeMarkerCreate,
  sanitizeMarkerUpdate,
  buildUserLookup,
  flattenCheckinRecords,
  groupCheckinRecordsByMarker,
  createDeleteCheckinRecordPlan,
  createPurgeUserCheckinsPlan,
  deriveActiveCheckinsFromMarkers,
  normalizeAdminUsers,
  buildSyncDiagnostics
} = require('./marker-service')
const {
  aggregateRewardStatsByUser,
  filterRewardRecords,
  normalizeRewardRecords,
  buildAdminPointsSummary
} = require('./reward-service')
const { buildAuditLogEntry, ALLOWED_TYPES: AUDIT_TYPES } = require('./audit-service')
const {
  ROUTE_STATUSES,
  sanitizeRouteCreate,
  sanitizeRouteUpdate,
  validateRouteMarkerIds,
  calcRouteProgress
} = require('./route-service')
const {
  buildTaskUpsertDoc,
  buildMarkerLookup: buildTaskMarkerLookup
} = require('./task-service')
const { summarizeLegacyUserMarkers } = require('./repair-service')

const colMarkers = db.collection('tourism_markers')
const colUsers = db.collection('uni-id-users')
const colUserProfiles = db.collection('users')
const colTasks = db.collection('tourism_tasks')
const colUserTasks = db.collection('user_tasks')
const colRewards = db.collection('rewards')
const colAuditLogs = db.collection('tourism_audit_logs')
const colRoutes = db.collection('tourism_routes')
const colFriendships = db.collection('tourism_friendships')
const colNotifications = db.collection('tourism_notifications')

async function appendAuditLog(input) {
  const row = buildAuditLogEntry(input)
  if (!row) return
  try {
    await colAuditLogs.add(row)
  } catch (e) {
    console.log('[audit] append failed', e && e.message ? e.message : e)
  }
}

function ok(data, errMsg) {
  return { errCode: 0, errMsg: errMsg || 'ok', data }
}

function fail(errMsg, errCode) {
  return { errCode: errCode || -1, errMsg }
}

function toPageArgs(data) {
  const offset = Math.max(Number((data && data.offset) || 0), 0)
  const rawLimit = Number((data && data.limit) || 20)
  const limit = Math.min(Math.max(rawLimit, 1), 100)
  return { offset, limit }
}

function isAdminUser(user) {
  if (!user) return false
  const role = user.role
  if (role === 'admin') return true
  if (Array.isArray(role) && role.includes('admin')) return true
  const permission = user.permission
  if (Array.isArray(permission) && permission.includes('admin')) return true
  return false
}

function resolveLookupName(userLookup, uid) {
  if (!uid) return ''
  if (!userLookup || typeof userLookup.get !== 'function') return String(uid)
  const found = userLookup.get(String(uid))
  return found && found.userName ? found.userName : String(uid)
}

function markerListQuery(keyword) {
  const trimmed = String(keyword || '').trim()
  if (trimmed.length === 0) return colMarkers
  return colMarkers.where({
    title: db.RegExp({
      regexp: trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options: 'i'
    })
  })
}

module.exports = {
  _before: async function() {
    this.auth = { uid: null, isAdmin: false }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
    const userRes = await colUsers.doc(this.auth.uid).get()
    const user = userRes.data && userRes.data.length ? userRes.data[0] : null
    if (!isAdminUser(user)) {
      throw { errCode: -2, errMsg: '无管理员权限' }
    }
    this.auth.isAdmin = true
  },

  async getDashboard() {
    const [users, markers, markersWithCheckins, tasks] = await Promise.all([
      colUsers.count(),
      colMarkers.count(),
      colMarkers.where({ 'checkedBy.0': db.command.exists(true) }).count(),
      colTasks.count()
    ])
    const allMarkers = await colMarkers
      .field({ checkinCount: true }).get()
    const totalCheckins = allMarkers.data.reduce((sum, m) => sum + (m.checkinCount || 0), 0)

    return ok({
      totalUsers: users.total,
      totalMarkers: markers.total,
      totalMarkersWithCheckins: markersWithCheckins.total,
      totalCheckins,
      totalTasks: tasks.total
    })
  },

  async getSyncDiagnostics() {
    const [markersRes, usersRes] = await Promise.all([
      colMarkers.field({ id: true, checkedBy: true }).get(),
      colUsers.field({ _id: true }).get()
    ])

    return ok(buildSyncDiagnostics(markersRes.data, usersRes.data))
  },

  async getUsers(data) {
    const { offset, limit } = toPageArgs(data)
    const [totalRes, userRes, profileRes, markerRes, rewardRes] = await Promise.all([
      colUsers.count(),
      colUsers.skip(offset).limit(limit).get(),
      colUserProfiles.get(),
      colMarkers.field({ checkedBy: true }).get(),
      colRewards.field({
        userId: true,
        reward: true,
        rewardPoints: true,
        rewardClaimed: true,
        source: true,
        routeId: true,
        taskId: true
      }).get()
    ])

    return ok({
      list: normalizeAdminUsers(
        userRes.data,
        profileRes.data,
        deriveActiveCheckinsFromMarkers(markerRes.data),
        aggregateRewardStatsByUser(rewardRes.data)
      ),
      total: totalRes.total,
      offset,
      limit
    })
  },

  async getRewardRecords(data) {
    const { offset, limit } = toPageArgs(data)
    const where = {}
    const userId = String((data && data.userId) || '').trim()
    const source = String((data && data.source) || '').trim()
    const status = String((data && data.status) || '').trim()
    if (userId.length > 0) where.userId = userId

    const query = Object.keys(where).length === 0 ? colRewards : colRewards.where(where)
    const [listRes, userRes] = await Promise.all([
      query
        .field({
          userId: true,
          source: true,
          routeId: true,
          routeName: true,
          taskId: true,
          taskName: true,
          reward: true,
          rewardPoints: true,
          rewardClaimed: true,
          earnedAt: true,
          claimedAt: true
        })
        .orderBy('earnedAt', 'desc')
        .get(),
      colUsers.field({ _id: true, username: true, nickname: true }).get()
    ])
    const filtered = filterRewardRecords(listRes.data, { source, status, userId })
    const page = filtered.slice(offset, offset + limit)

    return ok({
      list: normalizeRewardRecords(page, userRes.data),
      total: filtered.length,
      offset,
      limit
    })
  },

  // P5.3：跨用户/单用户积分汇总；admin 与 App 端共用同语义：task 即发放，
  // route 须 rewardClaimed===true 方计入。
  async getPointsSummary(data) {
    const where = {}
    const userId = String((data && data.userId) || '').trim()
    const source = String((data && data.source) || '').trim()
    if (userId.length > 0) where.userId = userId

    const query = Object.keys(where).length === 0 ? colRewards : colRewards.where(where)
    const listRes = await query
      .field({
        userId: true,
        source: true,
        routeId: true,
        taskId: true,
        reward: true,
        rewardPoints: true,
        rewardClaimed: true,
        earnedAt: true,
        claimedAt: true
      })
      .get()
    const rows = filterRewardRecords(listRes.data, { source, userId })
    return ok(buildAdminPointsSummary(rows))
  },

  async getMarkers(data) {
    const { offset, limit } = toPageArgs(data)
    const keyword = data && data.keyword
    const query = markerListQuery(keyword)
    const [totalRes, listRes] = await Promise.all([
      query.count(),
      query
        .field({
          id: true,
          title: true,
          latitude: true,
          longitude: true,
          iconPath: true,
          width: true,
          height: true,
          checked: true,
          checkinCount: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true
        })
        .orderBy('createdAt', 'asc')
        .skip(offset)
        .limit(limit)
        .get()
    ])
    return ok({ list: listRes.data, total: totalRes.total, offset, limit })
  },

  // 仪表盘"最近打卡记录"专用：直接返回扁平 record 列表（按 checkedAt 降序），
  // 每条带打卡人 userName / 所在 marker / 备注 / 照片缩略图，方便 dashboard 渲染。
  // getCheckins 是按 marker 分组的列表，调用方需要扁平视图时走这里更直观。
  async getRecentCheckins(data) {
    const rawLimit = Number((data && data.limit) || 10)
    const limit = Math.min(Math.max(rawLimit, 1), 100)
    const [markerRes, userRes] = await Promise.all([
      colMarkers
        .where({ 'checkedBy.0': db.command.exists(true) })
        .field({ id: true, title: true, latitude: true, longitude: true, checkedBy: true })
        .orderBy('updatedAt', 'desc')
        .get(),
      colUsers.field({ _id: true, username: true, nickname: true }).get()
    ])
    const userLookup = buildUserLookup(userRes.data)
    const records = flattenCheckinRecords(markerRes.data, userLookup)
    return ok({
      list: records.slice(0, limit),
      total: records.length,
      limit
    })
  },

  async getCheckins(data) {
    const { offset, limit } = toPageArgs(data)
    const keyword = String((data && data.keyword) || '').trim()
    const where = { 'checkedBy.0': db.command.exists(true) }
    if (keyword.length > 0) {
      where.title = db.RegExp({
        regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        options: 'i'
      })
    }
    const [markerRes, userRes] = await Promise.all([
      colMarkers
        .where(where)
        .field({ id: true, title: true, checkedBy: true, checkinCount: true, latitude: true, longitude: true })
        .orderBy('updatedAt', 'desc')
        .get(),
      colUsers.field({ _id: true, username: true, nickname: true }).get()
    ])
    const userLookup = buildUserLookup(userRes.data)
    const groups = groupCheckinRecordsByMarker(markerRes.data, userLookup)
    const totalRecords = groups.reduce((sum, item) => sum + item.recordCount, 0)
    return ok({
      list: groups.slice(offset, offset + limit),
      total: groups.length,
      totalRecords,
      offset,
      limit
    })
  },

  async getMarkerCheckins(data) {
    const { offset, limit } = toPageArgs(data)
    const markerId = data && data.markerId
    const markerDocId = data && data._id
    let markerRes
    if (markerDocId) {
      markerRes = await colMarkers.doc(markerDocId).get()
    } else if (markerId != null) {
      markerRes = await colMarkers.where({ id: Number(markerId) }).limit(1).get()
    } else {
      return fail('缺少打卡点 ID')
    }
    if (!markerRes.data.length) return fail('打卡点不存在')

    const marker = markerRes.data[0]
    const userRes = await colUsers.field({ _id: true, username: true, nickname: true }).get()
    const userLookup = buildUserLookup(userRes.data)
    const records = flattenCheckinRecords([marker], userLookup)
    const groups = groupCheckinRecordsByMarker([marker], userLookup)
    return ok({
      marker: {
        _id: marker._id,
        id: marker.id,
        title: marker.title,
        latitude: marker.latitude,
        longitude: marker.longitude,
        checkinCount: marker.checkinCount || 0,
        createdBy: marker.createdBy || null,
        createdAt: marker.createdAt || null
      },
      list: groups.slice(offset, offset + limit),
      total: groups.length,
      totalRecords: records.length,
      offset,
      limit
    })
  },

  // 后台管理员删除单条打卡记录。前端要传 markerId 或 _id，外加要删的 userId
  // 与 checkedAt（毫秒时间戳）；服务端只信入参作为定位条件，不允许传整个
  // checkedBy[] 覆盖。第一版只动 tourism_markers，不回滚 user_tasks/rewards。
  async deleteCheckinRecord(data) {
    const payload = data || {}
    const targetUserId = String(payload.userId || '').trim()
    if (targetUserId.length === 0) return fail('缺少打卡人 userId')
    const targetCheckedAt = payload.checkedAt != null ? Number(payload.checkedAt) : null
    if (targetCheckedAt == null || !Number.isFinite(targetCheckedAt)) {
      return fail('缺少 checkedAt 时间戳')
    }

    const markerDocId = payload._id
    const markerId = payload.markerId
    let markerRes
    if (markerDocId) {
      markerRes = await colMarkers.doc(markerDocId).get()
    } else if (markerId != null) {
      markerRes = await colMarkers.where({ id: Number(markerId) }).limit(1).get()
    } else {
      return fail('缺少打卡点 ID')
    }
    if (!markerRes.data.length) return fail('打卡点不存在')
    const marker = markerRes.data[0]

    const plan = createDeleteCheckinRecordPlan(marker, {
      userId: targetUserId,
      checkedAt: targetCheckedAt
    })
    if (!plan.shouldDelete) {
      return ok({ deleted: false, removedCount: 0, checkinCount: plan.checkinCount }, '记录不存在')
    }

    await colMarkers.doc(marker._id).update({
      checked: plan.checked,
      checkinCount: plan.checkinCount,
      checkedBy: plan.checkedBy,
      updatedAt: Date.now()
    })

    await appendAuditLog({
      type: 'admin.deleteCheckinRecord',
      actorUid: this.auth.uid,
      targetUid: targetUserId,
      markerId: marker.id,
      markerTitle: marker.title,
      checkedAt: targetCheckedAt,
      reason: String(payload.reason || '')
    })

    return ok({
      deleted: true,
      removedCount: plan.removedCount,
      checkinCount: plan.checkinCount
    }, '删除成功')
  },

  // 后台删除用户：必须服务端事务式级联清理，禁止前端遍历调用多接口（否则
  // 删一半断网会留下孤儿统计 / 任务 / 打卡）。先做安全栅栏（不能删自己 / 最后
  // 一个 admin），再用 createPurgeUserCheckinsPlan 计算每个 marker 的 patch，
  // 然后顺序清理 colUserProfiles / user_tasks / rewards / colUsers。
  async deleteUser(data) {
    const targetId = String((data && data._id) || '').trim()
    if (targetId.length === 0) return fail('缺少用户 _id')
    if (targetId === String(this.auth.uid)) {
      return fail('不能删除当前登录管理员')
    }

    const targetRes = await colUsers.doc(targetId).get()
    if (!targetRes.data.length) return fail('用户不存在')
    const target = targetRes.data[0]

    if (isAdminUser(target)) {
      const allUsersRes = await colUsers.field({ _id: true, role: true, permission: true }).get()
      const adminCount = (allUsersRes.data || []).filter(isAdminUser).length
      if (adminCount <= 1) {
        return fail('不能删除最后一个管理员账号')
      }
    }

    const markerRes = await colMarkers.field({ _id: true, checkedBy: true }).get()
    let markerPatched = 0
    let checkinsRemoved = 0
    for (const marker of markerRes.data) {
      const plan = createPurgeUserCheckinsPlan(marker, targetId)
      if (!plan.shouldUpdate) continue
      await colMarkers.doc(marker._id).update({
        checked: plan.checked,
        checkinCount: plan.checkinCount,
        checkedBy: plan.checkedBy,
        updatedAt: Date.now()
      })
      markerPatched += 1
      checkinsRemoved += plan.removedCount
    }

    const profileRes = await colUserProfiles.where({ userId: targetId }).get()
    let profilesRemoved = 0
    for (const profile of profileRes.data) {
      await colUserProfiles.doc(profile._id).remove()
      profilesRemoved += 1
    }

    const userTasksRes = await colUserTasks.where({ userId: targetId }).get()
    let userTasksRemoved = 0
    for (const row of userTasksRes.data) {
      await colUserTasks.doc(row._id).remove()
      userTasksRemoved += 1
    }

    const rewardsRes = await colRewards.where({ userId: targetId }).get()
    let rewardsRemoved = 0
    for (const row of rewardsRes.data) {
      await colRewards.doc(row._id).remove()
      rewardsRemoved += 1
    }

    await colUsers.doc(targetId).remove()

    await appendAuditLog({
      type: 'admin.deleteUser',
      actorUid: this.auth.uid,
      targetUid: targetId,
      markerId: null,
      markerTitle: target.username || target.nickname || '',
      checkedAt: null,
      reason: String((data && data.reason) || '')
    })

    return ok({
      deleted: true,
      markerPatched,
      checkinsRemoved,
      profilesRemoved,
      userTasksRemoved,
      rewardsRemoved
    }, '用户及关联数据已删除')
  },

  // P3.4 审计页查询：按 occurredAt 倒序分页；可选 type 过滤。
  // 直接返回原始 row，前端自行 buildUserLookup（uniCloud-clientDB 也行；
  // 但保持 cloudobj 是一站式接口，与 getCheckins 设计一致）。
  async getAuditLogs(data) {
    const { offset, limit } = toPageArgs(data)
    const where = {}
    if (data && data.type && AUDIT_TYPES.has(data.type)) {
      where.type = data.type
    }
    const baseQuery = Object.keys(where).length === 0 ? colAuditLogs : colAuditLogs.where(where)
    const [totalRes, listRes] = await Promise.all([
      baseQuery.count(),
      baseQuery.orderBy('occurredAt', 'desc').skip(offset).limit(limit).get()
    ])
    const userRes = await colUsers.field({ _id: true, username: true, nickname: true }).get()
    const userLookup = buildUserLookup(userRes.data)
    const list = (listRes.data || []).map(row => ({
      _id: row._id,
      type: row.type,
      actorUid: row.actorUid,
      actorName: resolveLookupName(userLookup, row.actorUid),
      targetUid: row.targetUid,
      targetName: resolveLookupName(userLookup, row.targetUid),
      markerId: row.markerId,
      markerTitle: row.markerTitle,
      checkedAt: row.checkedAt,
      reason: row.reason,
      occurredAt: row.occurredAt
    }))
    return ok({ list, total: totalRes.total, offset, limit })
  },

  async createMarker(data) {
    try {
      const now = Date.now()
      const marker = sanitizeMarkerCreate(data, this.auth.uid, now)
      const res = await colMarkers.add(marker)
      return ok({ _id: res.id, marker }, '创建成功')
    } catch (e) {
      return fail(e.message || '创建失败')
    }
  },

  async updateMarker(data) {
    if (!data || !data._id) return fail('缺少打卡点 _id')
    try {
      const updates = sanitizeMarkerUpdate(data, Date.now())
      await colMarkers.doc(data._id).update(updates)
      return ok(null, '更新成功')
    } catch (e) {
      return fail(e.message || '更新失败')
    }
  },

  async deleteMarker(data) {
    if (!data || !data._id) return fail('缺少打卡点 _id')
    await colMarkers.doc(data._id).remove()
    return ok(null, '删除成功')
  },

  async batchImport(data) {
    if (!data || !Array.isArray(data.list) || data.list.length === 0) {
      return fail('导入列表不能为空')
    }
    const results = []
    for (let i = 0; i < data.list.length; i++) {
      try {
        const marker = sanitizeMarkerCreate(data.list[i], this.auth.uid, Date.now() + i)
        const res = await colMarkers.add(marker)
        results.push(res.id)
      } catch (e) {
        return fail(`第 ${i + 1} 条导入失败：${e.message || '数据不合法'}`)
      }
    }
    return ok({ ids: results }, '导入成功')
  },

  async syncDefaultMarkers() {
    const now = Date.now()
    const created = []
    const updated = []

    for (const seed of DEFAULT_SEED_MARKERS) {
      const existing = await colMarkers.where({ id: seed.id }).limit(1).get()
      if (!existing.data.length) {
        const marker = buildSeedMarker(seed, now)
        const res = await colMarkers.add(marker)
        created.push({ _id: res.id, id: seed.id, title: seed.title })
      } else {
        await colMarkers.doc(existing.data[0]._id).update(buildSeedUpdate(seed, now))
        updated.push({ _id: existing.data[0]._id, id: seed.id, title: seed.title })
      }
    }

    return ok({
      total: DEFAULT_SEED_MARKERS.length,
      created,
      updated
    }, '默认点同步完成')
  },

  async getTasks() {
    const res = await colTasks.orderBy('createdAt', 'asc').get()
    return ok(res.data)
  },

  async syncDefaultTasks() {
    const now = Date.now()
    const created = []
    const updated = []

    for (const seed of DEFAULT_SEED_TASKS) {
      const existing = await colTasks.where({ id: seed.id }).limit(1).get()
      if (!existing.data.length) {
        const task = buildSeedTask(seed, now)
        const res = await colTasks.add(task)
        created.push({ _id: res.id, id: seed.id, name: seed.name })
      } else {
        await colTasks.doc(existing.data[0]._id).update(buildSeedTaskUpdate(seed, now))
        updated.push({ _id: existing.data[0]._id, id: seed.id, name: seed.name })
      }
    }

    return ok({
      total: DEFAULT_SEED_TASKS.length,
      created,
      updated
    }, '默认任务同步完成')
  },

  async updateTask(data) {
    if (!data || !data._id) return fail('缺少任务 _id')
    const { _id, ...updates } = data
    await colTasks.doc(_id).update(updates)
    return ok(null, '更新成功')
  },

  async upsertTask(data) {
    try {
      const now = Date.now()
      const targetId = data && data._id ? String(data._id) : ''
      let existingTasksForId = null
      const rawId = String((data && data.id) || '').trim()
      if (!targetId && rawId.length === 0) {
        const tasksRes = await colTasks.field({ id: true }).get()
        existingTasksForId = tasksRes.data || []
      }
      const markerSnapshot = await colMarkers.field({ id: true }).get()
      const markerLookup = buildTaskMarkerLookup(markerSnapshot.data || [])
      const doc = buildTaskUpsertDoc(data, this.auth.uid, now, existingTasksForId, markerLookup)
      if (targetId) {
        await colTasks.doc(targetId).update(doc)
        return ok({ _id: targetId, task: doc }, '更新成功')
      }

      const existing = await colTasks.where({ id: doc.id }).limit(1).get()
      if (existing.data && existing.data.length > 0) {
        await colTasks.doc(existing.data[0]._id).update(doc)
        return ok({ _id: existing.data[0]._id, task: doc }, '更新成功')
      }

      const res = await colTasks.add({ ...doc, createdAt: now })
      return ok({ _id: res.id, task: doc }, '创建成功')
    } catch (e) {
      return fail(e.message || '保存失败')
    }
  },

  async deleteTask(data) {
    const targetId = data && data._id ? String(data._id) : ''
    if (!targetId) return fail('缺少任务 _id')
    await colTasks.doc(targetId).update({
      status: 'archived',
      updatedAt: Date.now()
    })
    return ok(null, '归档成功')
  },

  // P5.5 T4 —— 只读审计：列出 createdBy 仍指向真实 uid 的 markers
  // （P5.4 之前的 UGC 残留），方便支持团队按 uid 排查与决定后续清理动作。
  async getLegacyUserMarkers() {
    const markerRes = await colMarkers
      .field({ id: true, title: true, createdBy: true, createdAt: true })
      .get()
    return ok(summarizeLegacyUserMarkers(markerRes.data || []))
  },

  // P4 主题路线 P0 —— admin CRUD。tourism_routes 是 admin 维护的纯配置集合；
  // App 端公开读路由走 marker-center.getActiveRoutes（与本接口隔离权限边界）。
  async getRoutes(data) {
    const { offset, limit } = toPageArgs(data)
    const status = data && data.status
    const keyword = String((data && data.keyword) || '').trim()
    const where = {}
    if (status && ROUTE_STATUSES.has(String(status))) {
      where.status = String(status)
    }
    if (keyword.length > 0) {
      where.name = db.RegExp({
        regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        options: 'i'
      })
    }
    const baseQuery = Object.keys(where).length === 0 ? colRoutes : colRoutes.where(where)
    const [totalRes, listRes] = await Promise.all([
      baseQuery.count(),
      baseQuery.orderBy('createdAt', 'desc').skip(offset).limit(limit).get()
    ])
    return ok({ list: listRes.data, total: totalRes.total, offset, limit })
  },

  async createRoute(data) {
    try {
      const now = Date.now()
      const route = sanitizeRouteCreate(data, this.auth.uid, now)
      const markerSnapshot = await colMarkers.field({ id: true }).get()
      const allIds = (markerSnapshot.data || []).map(item => Number(item.id))
      const validation = validateRouteMarkerIds(route.markerIds, allIds)
      if (!validation.ok) {
        return fail(`markerIds 中存在无效打卡点：${validation.missing.join(', ')}`)
      }
      const res = await colRoutes.add(route)
      return ok({ _id: res.id, route }, '创建成功')
    } catch (e) {
      return fail(e.message || '创建失败')
    }
  },

  async updateRoute(data) {
    if (!data || !data._id) return fail('缺少路线 _id')
    try {
      const now = Date.now()
      const updates = sanitizeRouteUpdate(data, now)
      if (updates.markerIds) {
        const markerSnapshot = await colMarkers.field({ id: true }).get()
        const allIds = (markerSnapshot.data || []).map(item => Number(item.id))
        const validation = validateRouteMarkerIds(updates.markerIds, allIds)
        if (!validation.ok) {
          return fail(`markerIds 中存在无效打卡点：${validation.missing.join(', ')}`)
        }
      }
      await colRoutes.doc(data._id).update(updates)
      return ok(null, '更新成功')
    } catch (e) {
      return fail(e.message || '更新失败')
    }
  },

  async deleteRoute(data) {
    if (!data || !data._id) return fail('缺少路线 _id')
    await colRoutes.doc(data._id).remove()
    return ok(null, '删除成功')
  },

  // 后台排查工具：给定 (userId, routeId) 返回该用户在该路线上的进度详情。
  // 不写库，只读 tourism_routes + tourism_markers.checkedBy[]。
  async getRouteProgressByUser(data) {
    const userId = String((data && data.userId) || '').trim()
    if (userId.length === 0) return fail('缺少 userId')
    const routeId = data && data.routeId
    if (routeId == null || !Number.isFinite(Number(routeId))) {
      return fail('缺少 routeId')
    }
    const routeRes = await colRoutes.where({ id: Number(routeId) }).limit(1).get()
    if (!routeRes.data.length) return fail('路线不存在')
    const route = routeRes.data[0]

    const markerRes = await colMarkers
      .where({ 'checkedBy.userId': userId })
      .field({ id: true, checkedBy: true })
      .get()
    const userCheckedMarkerIds = (markerRes.data || [])
      .filter(marker => (marker.checkedBy || []).some(entry => String(entry && entry.userId || '') === userId))
      .map(marker => Number(marker.id))

    const progress = calcRouteProgress(route, userCheckedMarkerIds)
    return ok({
      route: {
        _id: route._id,
        id: route.id,
        name: route.name,
        markerIds: route.markerIds,
        status: route.status
      },
      userId,
      progress
    })
  },

  // ===== P6 Admin moderation =====

  async getFriendships(data) {
    const payload = data || {}
    const limit = Math.max(1, Math.min(100, Number(payload.limit) || 50))
    const offset = Math.max(0, Number(payload.offset) || 0)
    const query = {}
    const status = String(payload.status || '')
    if (status.length > 0) query.status = status
    const userId = String(payload.userId || '').trim()
    if (userId.length > 0) query.userId = userId
    const res = await colFriendships.where(query).skip(offset).limit(limit).orderBy('createdAt', 'desc').get()
    return ok({ rows: res.data || [], total: Number(res.count || 0) })
  },

  async revokeFriendship(data) {
    const id = String((data || {})._id || '').trim()
    if (!id) return fail('缺少 friendship id')
    const rowRes = await colFriendships.doc(id).get()
    if (!rowRes.data.length) return fail('记录不存在')
    const row = rowRes.data[0]
    // Delete both rows of the pair
    await colFriendships.where({ userId: row.userId, friendUserId: row.friendUserId }).remove()
    await colFriendships.where({ userId: row.friendUserId, friendUserId: row.userId }).remove()
    return ok({ revoked: true, id })
  },

  async getNotifications(data) {
    const payload = data || {}
    const limit = Math.max(1, Math.min(100, Number(payload.limit) || 50))
    const offset = Math.max(0, Number(payload.offset) || 0)
    const query = {}
    const userId = String(payload.userId || '').trim()
    if (userId.length > 0) query.userId = userId
    const type = String(payload.type || '')
    if (type.length > 0) query.type = type
    const res = await colNotifications.where(query).skip(offset).limit(limit).orderBy('createdAt', 'desc').get()
    return ok({ rows: res.data || [], total: Number(res.count || 0) })
  },

  async broadcastNotification(data) {
    const payload = data || {}
    const title = String(payload.title || '').trim()
    const body = String(payload.body || '').trim()
    if (!title) return fail('缺少通知标题')
    const audience = String(payload.audience || 'all')
    const now = Date.now()
    const notif = { type: 'system.broadcast', payload: { title, body }, read: false, readAt: null, createdAt: now }

    if (audience === 'all') {
      const userProfiles = await colUserProfiles.field({ userId: true }).get()
      let count = 0
      for (const p of (userProfiles.data || [])) {
        if (p.userId && String(p.userId).length > 0) {
          try { await colNotifications.add({ ...notif, userId: String(p.userId) }); count++ } catch (_e) {}
        }
      }
      return ok({ sent: count })
    }

    const uids = audience.split(',').map(function(s) { return s.trim() }).filter(function(s) { return s.length > 0 })
    let count = 0
    for (const uid of uids) {
      try { await colNotifications.add({ ...notif, userId: uid }); count++ } catch (_e) {}
    }
    return ok({ sent: count })
  }
}
