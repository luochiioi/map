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
  flattenCheckinRecords,
  deriveUserStatsFromMarkers,
  normalizeAdminUsers,
  buildSyncDiagnostics
} = require('./marker-service')

const colMarkers = db.collection('tourism_markers')
const colUsers = db.collection('uni-id-users')
const colUserProfiles = db.collection('users')
const colTasks = db.collection('tourism_tasks')

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
    const [totalRes, userRes, profileRes, markerRes] = await Promise.all([
      colUsers.count(),
      colUsers.skip(offset).limit(limit).get(),
      colUserProfiles.get(),
      colMarkers.field({ createdBy: true, checkedBy: true }).get()
    ])

    return ok({
      list: normalizeAdminUsers(userRes.data, profileRes.data, deriveUserStatsFromMarkers(markerRes.data)),
      total: totalRes.total,
      offset,
      limit
    })
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
    const markerRes = await colMarkers
      .where(where)
      .field({ id: true, title: true, checkedBy: true, latitude: true, longitude: true })
      .orderBy('updatedAt', 'desc')
      .get()
    const records = flattenCheckinRecords(markerRes.data)
    return ok({
      list: records.slice(offset, offset + limit),
      total: records.length,
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
    const records = flattenCheckinRecords([marker])
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
      list: records.slice(offset, offset + limit),
      total: records.length,
      offset,
      limit
    })
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
  }
}
