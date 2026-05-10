// 路线完成检测纯函数。
// 与 admin-center/route-service.js 的 calcRouteProgress / isRouteCompleted
// 保持完全一致的语义；之所以再写一份是因为 uniCloud 不支持跨 cloudfunction
// require（PITFALLS §规则 28）。两侧都有单测，schema 漂移会被 CI 抓到。
//
// 写库副作用集中在 marker-center/index.obj.js 的 checkin / repairCheckin，
// 这里只暴露 (route, doneIds, alreadyCompletedRouteIds) → 计划对象的纯函数。

function calcRouteProgress(route, userCheckedMarkerIds) {
  const routeIds = (route && Array.isArray(route.markerIds)) ? route.markerIds : []
  const userIds = Array.isArray(userCheckedMarkerIds) ? userCheckedMarkerIds : []
  const userSet = new Set(userIds.map(item => Number(item)))
  const doneMarkerIds = []
  const pendingMarkerIds = []
  for (let i = 0; i < routeIds.length; i++) {
    const n = Number(routeIds[i])
    if (userSet.has(n)) {
      doneMarkerIds.push(n)
    } else {
      pendingMarkerIds.push(n)
    }
  }
  const total = routeIds.length
  const done = doneMarkerIds.length
  return {
    total,
    done,
    ratio: total > 0 ? done / total : 0,
    doneMarkerIds,
    pendingMarkerIds
  }
}

function isRouteCompleted(route, userCheckedMarkerIds) {
  const progress = calcRouteProgress(route, userCheckedMarkerIds)
  return progress.total > 0 && progress.done === progress.total
}

// 找出"刚刚完成、之前还没记账"的路线列表。
// alreadyCompletedRouteIds 是 user_routes 里这个 uid 已经写过的 routeId 集合，
// 用来做 (userId, routeId) 幂等：同一条路线删-再打-完成不应再次发奖。
function findNewlyCompletedRoutes(routes, userCheckedMarkerIds, alreadyCompletedRouteIds) {
  const list = Array.isArray(routes) ? routes : []
  const already = new Set((alreadyCompletedRouteIds || []).map(id => Number(id)))
  const result = []
  for (let i = 0; i < list.length; i++) {
    const route = list[i]
    if (!route) continue
    const routeId = Number(route.id)
    if (!Number.isFinite(routeId)) continue
    if (already.has(routeId)) continue
    if (!isRouteCompleted(route, userCheckedMarkerIds)) continue
    result.push(route)
  }
  return result
}

// user_routes 行：完成时间用服务端 now，rewardClaimed 留 false 给 P5 兑换页。
// userId 必须由调用方从 this.auth.uid 传入（PITFALLS §规则 14），不能信
// 客户端任何参数。
function buildUserRouteEntry(userId, route, now) {
  return {
    userId: String(userId || ''),
    routeId: Number(route && route.id),
    routeName: String((route && route.name) || ''),
    completedAt: Number(now),
    rewardClaimed: false
  }
}

// rewards 行：与 marker-center.checkTasksForMarker 写入的 task 奖励行字段
// 保持兼容 —— { userId, reward, earnedAt } 三件套不变；新加 routeId /
// routeName / source: 'route' 用于区分来源。task 奖励行没有 source 字段，
// 读取方应把缺失的 source 当作 'task'。
function buildRouteRewardEntry(userId, route, now) {
  return {
    userId: String(userId || ''),
    routeId: Number(route && route.id),
    routeName: String((route && route.name) || ''),
    reward: String((route && route.reward) || ''),
    source: 'route',
    earnedAt: Number(now)
  }
}

module.exports = {
  calcRouteProgress,
  isRouteCompleted,
  findNewlyCompletedRoutes,
  buildUserRouteEntry,
  buildRouteRewardEntry
}
