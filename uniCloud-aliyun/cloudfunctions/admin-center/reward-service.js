function parseRewardPoints(rewardText) {
  const text = String(rewardText == null ? '' : rewardText)
  const match = text.match(/(\d+)/)
  if (!match) return 0
  const n = Number(match[1])
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function resolveRewardPoints(row) {
  if (row && row.rewardPoints != null) {
    const n = Number(row.rewardPoints)
    if (Number.isFinite(n)) return Math.floor(n)
  }
  return parseRewardPoints(row && row.reward)
}

function ensureRewardStats(map, userId) {
  const key = String(userId || '')
  if (!key) return null
  if (!map.has(key)) {
    map.set(key, {
      totalRewardPoints: 0,
      claimedRewardPoints: 0,
      pendingRewardPoints: 0,
      routeRewardCount: 0,
      taskRewardCount: 0,
      claimedCount: 0,
      pendingCount: 0
    })
  }
  return map.get(key)
}

function rewardSourceType(row) {
  return row && (row.source === 'route' || row.routeId != null) ? 'route' : 'task'
}

function rewardClaimedState(row) {
  return rewardSourceType(row) === 'task' || (row && row.rewardClaimed === true)
}

function aggregateRewardStatsByUser(rewards) {
  const statsByUserId = new Map()
  ;(rewards || []).forEach(row => {
    const stats = ensureRewardStats(statsByUserId, row && row.userId)
    if (!stats) return

    const points = resolveRewardPoints(row)
    const claimed = rewardClaimedState(row)
    const source = rewardSourceType(row)

    stats.totalRewardPoints += points
    if (claimed) {
      stats.claimedRewardPoints += points
      stats.claimedCount += 1
    } else {
      stats.pendingRewardPoints += points
      stats.pendingCount += 1
    }
    if (source === 'route') stats.routeRewardCount += 1
    else stats.taskRewardCount += 1
  })
  return statsByUserId
}

function normalizeRewardRecords(rewards, uniUsers) {
  const lookup = new Map()
  ;(uniUsers || []).forEach(user => {
    const uid = String((user && (user._id || user.uid)) || '')
    if (!uid) return
    lookup.set(uid, String((user && (user.nickname || user.username)) || uid))
  })

  return (rewards || []).map(row => {
    const userId = String((row && row.userId) || '')
    const sourceType = rewardSourceType(row)
    const rewardPoints = resolveRewardPoints(row)
    const rewardClaimed = rewardClaimedState(row)
    const earnedAt = Number((row && row.earnedAt) || 0)
    const claimedAtRaw = row && row.claimedAt != null ? Number(row.claimedAt) : null
    const claimedAt = sourceType === 'task'
      ? (Number.isFinite(claimedAtRaw) && claimedAtRaw != null ? claimedAtRaw : earnedAt)
      : claimedAtRaw != null && Number.isFinite(claimedAtRaw) ? claimedAtRaw : null
    return {
      _id: row && row._id ? String(row._id) : '',
      userId,
      userName: lookup.get(userId) || userId,
      sourceType,
      sourceTitle: sourceType === 'route'
        ? String((row && (row.routeName || row.sourceTitle)) || '')
        : String((row && (row.taskName || row.sourceTitle)) || ''),
      reward: String((row && row.reward) || ''),
      rewardPoints,
      rewardClaimed,
      statusText: rewardClaimed ? '已兑' : '待兑',
      earnedAt: Number.isFinite(earnedAt) ? earnedAt : 0,
      claimedAt
    }
  })
}

function filterRewardRecords(rewards, filters) {
  const source = String((filters && filters.source) || '').trim()
  const status = String((filters && filters.status) || '').trim()
  const userId = String((filters && filters.userId) || '').trim()
  return (rewards || []).filter(row => {
    if (userId.length > 0 && String((row && row.userId) || '') !== userId) return false
    if ((source === 'route' || source === 'task') && rewardSourceType(row) !== source) return false
    if (status === 'claimed' && !rewardClaimedState(row)) return false
    if (status === 'pending' && rewardClaimedState(row)) return false
    return true
  })
}

module.exports = {
  parseRewardPoints,
  aggregateRewardStatsByUser,
  filterRewardRecords,
  normalizeRewardRecords
}
