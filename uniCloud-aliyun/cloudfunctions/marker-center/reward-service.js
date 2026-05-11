function s(value) {
  return value == null ? '' : String(value)
}

function n(value) {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function parseRewardPoints(rewardText) {
  const text = s(rewardText)
  const match = text.match(/(\d+)/)
  if (!match) return 0
  const num = Number(match[1])
  return Number.isFinite(num) ? Math.floor(num) : 0
}

function buildClaimedReward(reward, now) {
  return {
    rewardClaimed: true,
    claimedAt: Number(now)
  }
}

function buildTaskRewardEntry(userId, task, now) {
  const reward = s(task && task.reward)
  return {
    userId: s(userId),
    taskId: s(task && task.id),
    taskName: s(task && task.name),
    reward,
    rewardPoints: parseRewardPoints(reward),
    source: 'task',
    earnedAt: Number(now),
    rewardClaimed: true,
    claimedAt: Number(now)
  }
}

function findRoute(routes, routeId) {
  const id = n(routeId)
  if (id == null) return null
  const list = Array.isArray(routes) ? routes : []
  return list.find(route => Number(route && route.id) === id) || null
}

function findTask(tasks, taskId) {
  const id = s(taskId)
  if (!id) return null
  const list = Array.isArray(tasks) ? tasks : []
  return list.find(task => s(task && task.id) === id) || null
}

function enrichRewardWithSource(reward, routes, tasks) {
  const row = reward || {}
  const sourceType = row.source === 'route' ? 'route' : 'task'
  const route = sourceType === 'route' ? findRoute(routes, row.routeId) : null
  const task = sourceType === 'task' ? findTask(tasks, row.taskId) : null
  const routeName = sourceType === 'route' ? s((route && route.name) || row.routeName) : ''
  const taskName = sourceType === 'task' ? s((task && task.name) || row.taskName) : ''

  return {
    ...row,
    sourceType,
    routeName,
    taskName,
    sourceTitle: sourceType === 'route' ? routeName : taskName,
    rewardClaimed: sourceType === 'task' ? true : row.rewardClaimed === true,
    claimedAt: sourceType === 'task'
      ? Number(row.claimedAt || row.earnedAt || 0)
      : row.claimedAt != null ? Number(row.claimedAt) : null
  }
}

function rewardSourceType(row) {
  if (row == null) return 'task'
  return row.source === 'route' ? 'route' : 'task'
}

function rewardPointsOf(row) {
  if (row == null) return 0
  const stored = n(row.rewardPoints)
  if (stored != null && stored > 0) return Math.floor(stored)
  return parseRewardPoints(row.reward)
}

function rewardIssuedAt(row) {
  if (row == null) return 0
  const claimed = n(row.claimedAt)
  if (claimed != null && claimed > 0) return claimed
  const earned = n(row.earnedAt)
  return earned != null ? earned : 0
}

// task rewards count as issued at earnedAt (auto-issued, legacy rows without
// source are treated as task too). route rewards only count as issued once
// rewardClaimed === true, using claimedAt as the issuance timestamp.
function rewardClaimedState(row) {
  const type = rewardSourceType(row)
  if (type === 'task') {
    return { issued: true, issuedAt: rewardIssuedAt(row) }
  }
  if (row != null && row.rewardClaimed === true) {
    return { issued: true, issuedAt: rewardIssuedAt(row) }
  }
  return { issued: false, issuedAt: null }
}

function buildPointsSummary(rewards) {
  const list = Array.isArray(rewards) ? rewards : []
  let totalEarnedPoints = 0
  let taskIssuedPoints = 0
  let routeIssuedPoints = 0
  let pendingRoutePoints = 0

  for (const row of list) {
    const points = rewardPointsOf(row)
    if (points <= 0) continue
    totalEarnedPoints += points
    const type = rewardSourceType(row)
    const state = rewardClaimedState(row)
    if (type === 'task') {
      taskIssuedPoints += points
      continue
    }
    if (state.issued) {
      routeIssuedPoints += points
    } else {
      pendingRoutePoints += points
    }
  }

  return {
    totalEarnedPoints,
    issuedPoints: taskIssuedPoints + routeIssuedPoints,
    pendingRoutePoints,
    taskIssuedPoints,
    routeIssuedPoints
  }
}

function buildPointsLedger(rewards) {
  const list = Array.isArray(rewards) ? rewards : []
  const rows = list.map(row => {
    const type = rewardSourceType(row)
    const state = rewardClaimedState(row)
    const points = rewardPointsOf(row)
    const titleFallback = type === 'route' ? (row && row.routeName) : (row && row.taskName)
    return {
      rewardId: s(row && row._id),
      source: type,
      points,
      status: state.issued ? 'issued' : 'pending',
      earnedAt: n(row && row.earnedAt) || 0,
      issuedAt: state.issuedAt,
      taskId: type === 'task' ? s(row && row.taskId) : '',
      routeId: type === 'route' ? n(row && row.routeId) : null,
      title: s((row && row.sourceTitle) || titleFallback || '')
    }
  })

  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'issued' ? -1 : 1
    const aKey = a.status === 'issued' ? (a.issuedAt || 0) : a.earnedAt
    const bKey = b.status === 'issued' ? (b.issuedAt || 0) : b.earnedAt
    return bKey - aKey
  })

  return rows
}

module.exports = {
  buildClaimedReward,
  buildTaskRewardEntry,
  enrichRewardWithSource,
  parseRewardPoints,
  rewardSourceType,
  rewardClaimedState,
  buildPointsSummary,
  buildPointsLedger
}
