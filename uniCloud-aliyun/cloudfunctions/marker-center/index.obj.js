const db = uniCloud.database()
const col = db.collection('tourism_markers')
const colTasks = db.collection('user_tasks')
const colRewards = db.collection('rewards')
const colUserProfiles = db.collection('users')
const colAuditLogs = db.collection('tourism_audit_logs')
const colRoutes = db.collection('tourism_routes')
const colUserRoutes = db.collection('user_routes')
const colTaskDefs = db.collection('tourism_tasks')
const colFriendships = db.collection('tourism_friendships')
const colNotifications = db.collection('tourism_notifications')
const authUtil = require('auth-util')
const { createRepairCheckinPlan, createDeleteCheckinPlan } = require('./repair-service')
const {
  calcRouteProgress,
  findNewlyCompletedRoutes,
  buildUserRouteEntry,
  buildRouteRewardEntry
} = require('./route-completion')
const {
  buildClaimedReward,
  buildTaskRewardEntry,
  enrichRewardWithSource,
  buildPointsSummary,
  buildPointsLedger
} = require('./reward-service')
const { buildAuditLogEntry } = require('./audit-service')
const {
  buildFriendRequest,
  applyFriendDecision,
  buildMirrorRow,
  bucketizeFriendships,
  toPublicProfile
} = require('./friendship-service')
const {
  buildLeaderboard,
  attachFriendFilter,
  aggregateLeaderboardRows
} = require('./leaderboard-service')
const { buildNotification, markRead } = require('./notification-service')
const { buildWhoamiResponse } = require('./whoami-service')

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
        const rewardEntry = buildRouteRewardEntry(uid, route, now)
        if (rewardEntry != null) {
          await colRewards.add(rewardEntry)
          completedRoutes.push({
            id: Number(route.id),
            name: String(route.name || ''),
            reward: String(rewardEntry.reward || '')
          })
          emitNotification('route.completed', uid, {
            routeId: Number(route.id),
            routeName: String(route.name || '')
          })
        }
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
async function appendAuditLog(input) {
  try {
    const row = buildAuditLogEntry(input)
    if (!row) return
    await colAuditLogs.add(row)
  } catch (e) {
    console.log('[audit] append failed', e && e.message ? e.message : e)
  }
}

async function appendUserDeleteAudit(input) {
  await appendAuditLog({
    type: 'user.deleteCheckin',
    actorUid: input.actorUid,
    targetUid: input.actorUid,
    markerId: input.markerId,
    markerTitle: input.markerTitle,
    photoCloudURL: input.photoCloudURL,
    checkedAt: input.checkedAt,
    reason: '',
    purgePhoto: false,
    purgeError: '',
    occurredAt: Date.now()
  })
}

async function appendClaimRewardAudit(input) {
  await appendAuditLog({
    type: 'user.claimReward',
    actorUid: input.actorUid,
    targetUid: input.actorUid,
    markerId: null,
    markerTitle: '',
    photoCloudURL: null,
    checkedAt: null,
    reason: `reward:${String(input.rewardId || '')}`,
    purgePhoto: false,
    purgeError: '',
    occurredAt: Date.now()
  })
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
    if (!this.auth || !this.auth.uid) {
      return { errCode: 401, errMsg: '未登录', data: null }
    }
    const userRes = await db.collection('uni-id-users')
      .doc(this.auth.uid)
      .field({ _id: 1, nickname: 1, avatar: 1, username: 1 })
      .get()
    const user = (userRes.data || [])[0]
    return buildWhoamiResponse(user)
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
    // P4：服务端 join active 路线，按 markerId 找到 marker 所属的路线集合，
    // 让 my-checkins 卡片直接渲染"属于 X 路线"小 tag。归档路线不参与匹配
    // （admin 把路线归档后不应再出现在用户历史卡片上）。
    const [markerRes, routesRes] = await Promise.all([
      col
        .where({ 'checkedBy.userId': uid })
        .field({ id: true, title: true, latitude: true, longitude: true, iconPath: true, width: true, height: true, checkedBy: true, checkinCount: true })
        .get(),
      colRoutes
        .where({ status: 'active' })
        .field({ id: true, name: true, markerIds: true })
        .get()
    ])

    // markerId → [{id, name}] 的反向索引
    const routesByMarkerId = new Map()
    ;(routesRes.data || []).forEach(route => {
      const ids = Array.isArray(route.markerIds) ? route.markerIds : []
      ids.forEach(mid => {
        const key = Number(mid)
        if (!routesByMarkerId.has(key)) routesByMarkerId.set(key, [])
        routesByMarkerId.get(key).push({ id: Number(route.id), name: String(route.name || '') })
      })
    })

    const list = []
    ;(markerRes.data || []).forEach(marker => {
      const entries = (marker.checkedBy || []).filter(entry => entry && String(entry.userId || '') === uid)
      const routesForMarker = routesByMarkerId.get(Number(marker.id)) || []
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
          repaired: entry.repaired === true,
          routes: routesForMarker
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
    const [rewardRes, routesRes, tasksRes] = await Promise.all([
      colRewards.where({ userId: this.auth.uid }).orderBy('earnedAt', 'desc').get(),
      colRoutes.where({ status: 'active' }).field({ id: true, name: true }).get(),
      colTaskDefs.where({ status: 'active' }).field({ id: true, name: true }).get()
    ])
    const rewards = rewardRes.data || []
    const routes = routesRes.data || []
    const tasks = tasksRes.data || []
    return {
      errCode: 0,
      data: rewards.map(reward => enrichRewardWithSource(reward, routes, tasks))
    }
  },

  async getPointsSummary() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const [rewardRes, routesRes, tasksRes] = await Promise.all([
      colRewards.where({ userId: this.auth.uid }).orderBy('earnedAt', 'desc').get(),
      colRoutes.where({ status: 'active' }).field({ id: true, name: true }).get(),
      colTaskDefs.where({ status: 'active' }).field({ id: true, name: true }).get()
    ])
    const rewards = (rewardRes.data || []).map(reward => enrichRewardWithSource(reward, routesRes.data || [], tasksRes.data || []))
    const summary = buildPointsSummary(rewards)
    const ledger = buildPointsLedger(rewards)
    return {
      errCode: 0,
      data: {
        ...summary,
        ledger
      }
    }
  },

  async claimReward(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const rewardId = String(payload.rewardId || '')
    if (!rewardId) return { errCode: -1, errMsg: '缺少奖励 ID' }

    const uid = String(this.auth.uid)
    const rewardRes = await colRewards.where({ _id: rewardId, userId: uid }).limit(1).get()
    if (!rewardRes.data.length) {
      return { errCode: -1, errMsg: '奖励不存在或无权兑换' }
    }

    const reward = rewardRes.data[0]
    if (reward.rewardClaimed === true) {
      return {
        errCode: 0,
        errMsg: '奖励已兑换',
        data: { rewardId, claimed: false, rewardClaimed: true, claimedAt: reward.claimedAt || null }
      }
    }

    const now = Date.now()
    await colRewards.doc(reward._id).update(buildClaimedReward(reward, now))
    await appendClaimRewardAudit({ actorUid: uid, rewardId })

    return {
      errCode: 0,
      errMsg: '兑换成功',
      data: { rewardId, claimed: true, rewardClaimed: true, claimedAt: now }
    }
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
      rewardKind: route.rewardKind || 'prize',
      rewardPoints: Number(route.rewardPoints || 0),
      status: route.status,
      progress: calcRouteProgress(route, userCheckedMarkerIds)
    }))

    return { errCode: 0, data: list }
  },

  // ===== P6 Social — friendship =====
  // Two-way rows. requestFriend writes one pending row; respondFriend either
  // flips it to rejected, or flips it to accepted AND inserts the mirror row
  // so `where({ userId: me, status: 'accepted' })` works for both sides.
  // Idempotency: a second requestFriend for the same pair returns the
  // existing pending/accepted row unchanged. If the other side already has
  // a pending request to us, requestFriend auto-accepts (skips a redundant
  // step in the UI).

  async requestFriend(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const targetUid = String(payload.targetUid || '').trim()
    if (!targetUid) return { errCode: -1, errMsg: '缺少目标用户' }
    if (targetUid === String(this.auth.uid)) return { errCode: -1, errMsg: '不能添加自己为好友' }

    // P8 B5: 服务端兜底拦截"幽灵 ID"。不能等 colFriendships.add 默默成功后,
    // 让客户端在 outgoing 列表看到一个永远不会有人响应的 pending 行。详见 PITFALLS §规则 51。
    const userExistRes = await db.collection('uni-id-users').doc(targetUid).get()
    if (!userExistRes.data || userExistRes.data.length === 0) {
      return { errCode: -1, errMsg: '目标用户不存在' }
    }

    const now = Date.now()

    // P8 B6: 拉一次发起人的 nickname/avatar 给消息中心 payload,fresh/resurrect/auto-accept 三处复用。
    const meRes = await db.collection('uni-id-users').doc(String(this.auth.uid))
      .field({ nickname: true, avatar: true }).get()
    const me = (meRes.data || [])[0] || {}
    const fromPayload = {
      fromUserId: String(this.auth.uid),
      fromNickname: String(me.nickname || ''),
      fromAvatar: String(me.avatar || '')
    }

    // If the target already requested me, auto-accept that row instead of
    // creating a competing pending row.
    const incomingRes = await colFriendships
      .where({ userId: targetUid, friendUserId: String(this.auth.uid) })
      .limit(1).get()
    if (incomingRes.data.length) {
      const incoming = incomingRes.data[0]
      if (incoming.status === 'accepted') {
        // P8 B4: 5 类反馈文案细化 — 既有 accepted(对方早已是好友)。
        return { errCode: 0, errMsg: '你们已是好友(无需重复发送)', data: { friendshipId: incoming._id, status: 'accepted', autoAccepted: false } }
      }
      if (incoming.status === 'pending') {
        const flipped = applyFriendDecision(incoming, 'accept', now)
        await colFriendships.doc(incoming._id).update({ status: flipped.status, updatedAt: flipped.updatedAt })
        await colFriendships.add(buildMirrorRow(flipped, now))
        // P8 B6: 通知对方"对方接受了你的好友请求"。auto-accept 路径同样通过消息中心反馈。
        emitNotification('friend.accepted', targetUid, fromPayload)
        // P8 B4: auto-accept 文案改"对方此前已发起请求,你们已成为好友"避免与"请求已发送"混淆。
        return { errCode: 0, errMsg: '对方此前已发起请求,你们已成为好友', data: { friendshipId: incoming._id, status: 'accepted', autoAccepted: true } }
      }
      // rejected: fall through and create a fresh pending row from me.
    }

    const existingRes = await colFriendships
      .where({ userId: String(this.auth.uid), friendUserId: targetUid })
      .limit(1).get()
    if (existingRes.data.length) {
      const row = existingRes.data[0]
      if (row.status === 'pending') {
        // 既有 pending 不重发通知,避免对方刷屏。
        // P8 B4: dup pending 文案区分于 fresh,提示"此前已存在记录"。
        return { errCode: 0, errMsg: '请求已发送(此前已存在记录)', data: { friendshipId: row._id, status: 'pending' } }
      }
      if (row.status === 'accepted') {
        // P8 B4: 已是好友 — 不应再重复创建请求,客户端 toast 直接展示。
        return { errCode: 0, errMsg: '你们已是好友(无需重复发送)', data: { friendshipId: row._id, status: 'accepted' } }
      }
      // rejected → resurrect as pending so users can retry after a refusal.
      await colFriendships.doc(row._id).update({ status: 'pending', updatedAt: now, requestedBy: String(this.auth.uid) })
      // P8 B6: resurrect 路径也是一次新的"对方收到好友请求"事件。
      emitNotification('friend.requested', targetUid, fromPayload)
      return { errCode: 0, errMsg: '请求已发送,等待对方响应', data: { friendshipId: row._id, status: 'pending' } }
    }

    const fresh = buildFriendRequest(this.auth.uid, targetUid, now)
    if (fresh == null) return { errCode: -1, errMsg: '参数无效' }
    const addRes = await colFriendships.add(fresh)
    // P8 B6: fresh pending,服务端必须发 'friend.requested',否则被请求方消息中心收不到通知。
    emitNotification('friend.requested', targetUid, fromPayload)
    return { errCode: 0, errMsg: '请求已发送,等待对方响应', data: { friendshipId: addRes.id, status: 'pending' } }
  },

  async respondFriend(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const friendshipId = String(payload.friendshipId || '').trim()
    const decision = String(payload.decision || '').trim()
    if (!friendshipId) return { errCode: -1, errMsg: '缺少 friendshipId' }
    if (decision !== 'accept' && decision !== 'reject') {
      return { errCode: -1, errMsg: '无效的决定' }
    }

    const rowRes = await colFriendships.doc(friendshipId).get()
    if (!rowRes.data.length) return { errCode: -1, errMsg: '好友请求不存在' }
    const row = rowRes.data[0]
    if (String(row.friendUserId) !== String(this.auth.uid)) {
      return { errCode: -1, errMsg: '无权处理此请求' }
    }
    if (row.status !== 'pending') {
      return { errCode: -1, errMsg: '请求已处理' }
    }

    const now = Date.now()
    const next = applyFriendDecision(row, decision, now)
    if (next == null) return { errCode: -1, errMsg: '请求已处理' }

    await colFriendships.doc(friendshipId).update({ status: next.status, updatedAt: next.updatedAt })

    if (decision === 'accept') {
      const mirror = buildMirrorRow(next, now)
      // Defensive: skip mirror if it already exists (e.g., retried accept).
      const mirrorExisting = await colFriendships
        .where({ userId: mirror.userId, friendUserId: mirror.friendUserId, status: 'accepted' })
        .limit(1).get()
      if (!mirrorExisting.data.length) {
        await colFriendships.add(mirror)
      }
      // Notify the original requester that the friend request was accepted.
      emitNotification('friend.accepted', String(row.requestedBy), {
        friendUserId: String(this.auth.uid),
        friendshipId
      })
    }

    return { errCode: 0, errMsg: decision === 'accept' ? '已接受' : '已拒绝', data: { friendshipId, status: next.status } }
  },

  async listFriends(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const filter = payload.status ? String(payload.status) : null
    const me = String(this.auth.uid)

    // Pull every row that touches me. Two queries (one per index) is cheaper
    // and clearer than a $or — uniCloud's where supports OR via db.command.or
    // but we already have separate (userId, status) and (friendUserId, status)
    // indexes, so the simple two-call shape is fine here.
    const [ownedRes, mirrorPendingRes] = await Promise.all([
      colFriendships.where({ userId: me }).get(),
      colFriendships.where({ friendUserId: me, status: 'pending' }).get()
    ])
    const rows = [...(ownedRes.data || []), ...(mirrorPendingRes.data || [])]
    const buckets = bucketizeFriendships(rows, me)

    // Enrich every bucket with the other party's public profile so the UI
    // can render nicknames without a second round trip.
    const otherUidSet = new Set()
    const collect = list => list.forEach(r => {
      const owner = String(r.userId)
      const target = String(r.friendUserId)
      otherUidSet.add(owner === me ? target : owner)
    })
    collect(buckets.accepted)
    collect(buckets.incoming)
    collect(buckets.outgoing)

    const profileMap = new Map()
    if (otherUidSet.size) {
      const profiles = await colUserProfiles
        .where({ userId: db.command.in([...otherUidSet]) })
        .get()
      for (const p of (profiles.data || [])) {
        profileMap.set(String(p.userId), p)
      }
    }

    const attach = list => list.map(row => {
      const owner = String(row.userId)
      const target = String(row.friendUserId)
      const otherUid = owner === me ? target : owner
      const profile = profileMap.get(otherUid) || null
      return { ...row, profile: toPublicProfile(profile, { completedRoutes: 0 }) }
    })

    const accepted = attach(buckets.accepted)
    const incoming = attach(buckets.incoming)
    const outgoing = attach(buckets.outgoing)

    if (filter === 'accepted') return { errCode: 0, data: { accepted, incoming: [], outgoing: [] } }
    if (filter === 'pending') return { errCode: 0, data: { accepted: [], incoming, outgoing } }
    return { errCode: 0, data: { accepted, incoming, outgoing } }
  },

  async getFriendProfile(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const uid = String(payload.uid || '').trim()
    if (!uid) return { errCode: -1, errMsg: '缺少用户' }
    const me = String(this.auth.uid)

    // Allow self-lookup (used by the friends page header), otherwise require
    // an accepted friendship row owned by me.
    if (uid !== me) {
      const frRes = await colFriendships
        .where({ userId: me, friendUserId: uid, status: 'accepted' })
        .limit(1).get()
      if (!frRes.data.length) return { errCode: -1, errMsg: '尚未成为好友' }
    }

    const [profileRes, completedRes] = await Promise.all([
      colUserProfiles.where({ userId: uid }).limit(1).get(),
      colUserRoutes.where({ userId: uid }).count()
    ])
    const profile = profileRes.data.length ? profileRes.data[0] : null
    const completedRoutes = Number(completedRes && completedRes.total || 0)
    // Fall back to the uid itself so the row carries an identity even when
    // the user has not customised their profile yet.
    const enriched = { ...(profile || {}), userId: profile ? profile.userId : uid }
    return { errCode: 0, data: toPublicProfile(enriched, { completedRoutes }) }
  },

  async unfriend(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const targetUid = String(payload.targetUid || '').trim()
    if (!targetUid) return { errCode: -1, errMsg: '缺少目标用户' }
    if (targetUid === String(this.auth.uid)) return { errCode: -1, errMsg: '不能解除自己' }

    // Delete both rows of the pair to keep the index clean.
    const me = String(this.auth.uid)
    await colFriendships
      .where({ userId: me, friendUserId: targetUid })
      .remove()
    await colFriendships
      .where({ userId: targetUid, friendUserId: me })
      .remove()
    return { errCode: 0, errMsg: '已解除好友', data: { targetUid } }
  },

  // ===== P6 Leaderboard =====
  // Reads three slices (rewards, user_routes, users), aggregates via the
  // pure helper, then optionally filters to the caller's accepted-friend
  // set. No DB caching: the row set is bounded by user count × 3 reads,
  // and the hard limit on the response stays ≤ 50.
  //
  // Auth: a logged-out caller can still read the global board, but
  // scope=friends always needs a uid (because "my friends" is undefined
  // otherwise). The empty-friend case explicitly returns just the caller.

  async getLeaderboard(data) {
    const payload = data || {}
    const metric = String(payload.metric || 'points')
    const scope = String(payload.scope || 'global')
    const requestedLimit = Number(payload.limit)
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50
    const me = this.auth.uid ? String(this.auth.uid) : null

    if (scope === 'friends' && !me) {
      return { errCode: -1, errMsg: '请先登录' }
    }

    const [rewardsRes, userRoutesRes, usersRes] = await Promise.all([
      colRewards.field({ userId: true, rewardPoints: true, earnedAt: true }).get(),
      colUserRoutes.field({ userId: true, routeId: true, completedAt: true }).get(),
      colUserProfiles.field({ userId: true, nickname: true, avatar: true, totalCheckins: true }).get()
    ])

    let rows = aggregateLeaderboardRows({
      rewards: rewardsRes.data || [],
      userRoutes: userRoutesRes.data || [],
      userProfiles: usersRes.data || []
    })

    if (scope === 'friends' && me) {
      const friendsRes = await colFriendships
        .where({ userId: me, status: 'accepted' })
        .field({ friendUserId: true })
        .get()
      const allowed = new Set((friendsRes.data || []).map(r => String(r.friendUserId)))
      allowed.add(me)
      rows = attachFriendFilter(rows, allowed)
    }

    const board = buildLeaderboard(rows, { metric, limit })
    const selfRow = me ? board.find(row => row.userId === me) || null : null

    return {
      errCode: 0,
      data: {
        metric: board.length ? board[0].metric : (['points', 'routes', 'checkins'].indexOf(metric) >= 0 ? metric : 'points'),
        scope,
        rows: board,
        self: selfRow
      }
    }
  },

  // ===== P6 Notifications =====

  async getNotifications(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const limit = Math.max(1, Math.min(100, Number(payload.limit) || 50))
    const offset = Math.max(0, Number(payload.offset) || 0)
    const res = await colNotifications
      .where({ userId: String(this.auth.uid) })
      .orderBy('createdAt', 'desc')
      .skip(offset).limit(limit)
      .get()
    return { errCode: 0, data: res.data }
  },

  async getUnreadNotificationCount() {
    if (!this.auth.uid) return { errCode: 0, data: { count: 0 } }
    const res = await colNotifications
      .where({ userId: String(this.auth.uid), read: false })
      .count()
    return { errCode: 0, data: { count: Number(res && res.total || 0) } }
  },

  async markNotificationRead(data) {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const payload = data || {}
    const id = String(payload._id || '').trim()
    if (!id) return { errCode: -1, errMsg: '缺少通知ID' }
    const rowRes = await colNotifications.doc(id).get()
    if (!rowRes.data.length) return { errCode: -1, errMsg: '通知不存在' }
    const row = rowRes.data[0]
    if (String(row.userId) !== String(this.auth.uid)) return { errCode: -1, errMsg: '无权操作' }
    const next = markRead(row, Date.now())
    if (next == null) return { errCode: 0, data: { read: false } }
    await colNotifications.doc(id).update({ read: true, readAt: next.readAt })
    return { errCode: 0, data: { read: true } }
  },

  async markAllNotificationsRead() {
    if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
    const me = String(this.auth.uid)
    const res = await colNotifications
      .where({ userId: me, read: false })
      .get()
    const now = Date.now()
    for (const row of (res.data || [])) {
      const next = markRead(row, now)
      if (next != null) {
        await colNotifications.doc(row._id).update({ read: true, readAt: next.readAt })
      }
    }
    return { errCode: 0, data: { updated: (res.data || []).length } }
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
      createdAt: now,
      updatedAt: now
    })
    return
  }

  const updates = { updatedAt: now }
  if (increments.totalCheckins) updates.totalCheckins = db.command.inc(increments.totalCheckins)
  if (increments.totalPhotos) updates.totalPhotos = db.command.inc(increments.totalPhotos)
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
      await colRewards.add(buildTaskRewardEntry(userId, task, now))
    }
    completed.push({ taskId: task.id, taskName: task.name, reward: task.reward })
  }
  return completed
}

// P6: fire-and-forget notification emitter. Failure is logged but never blocks
// the parent operation (route completion, friend accept, etc.).
async function emitNotification(type, userId, payload) {
  const row = buildNotification(type, userId, payload, Date.now())
  if (row == null) return
  try {
    await colNotifications.add(row)
  } catch (e) {
    console.log('[notif] emit failed', type, userId, e && e.message ? e.message : e)
  }
}
