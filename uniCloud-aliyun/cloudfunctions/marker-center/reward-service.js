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

module.exports = {
  buildClaimedReward,
  buildTaskRewardEntry,
  enrichRewardWithSource,
  parseRewardPoints
}
