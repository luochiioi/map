const assert = require('node:assert/strict')
const test = require('node:test')

const {
  calcRouteProgress,
  isRouteCompleted,
  findNewlyCompletedRoutes,
  buildUserRouteEntry,
  buildRouteRewardEntry
} = require('./route-completion')

test('calcRouteProgress matches admin-center/route-service shape', () => {
  const route = { markerIds: [3, 5, 7] }
  assert.deepEqual(calcRouteProgress(route, [3, 5]), {
    total: 3,
    done: 2,
    ratio: 2 / 3,
    doneMarkerIds: [3, 5],
    pendingMarkerIds: [7]
  })
  assert.deepEqual(calcRouteProgress({ markerIds: [] }, [1, 2]), {
    total: 0,
    done: 0,
    ratio: 0,
    doneMarkerIds: [],
    pendingMarkerIds: []
  })
})

test('isRouteCompleted requires every marker checked and at least one marker', () => {
  const route = { markerIds: [3, 5, 7] }
  assert.equal(isRouteCompleted(route, [3, 5, 7]), true)
  assert.equal(isRouteCompleted(route, [3, 5, 7, 9]), true)
  assert.equal(isRouteCompleted(route, [3, 5]), false)
  assert.equal(isRouteCompleted({ markerIds: [] }, []), false)
})

test('findNewlyCompletedRoutes returns routes that are completed AND not yet recorded', () => {
  const routes = [
    { id: 100, markerIds: [1, 2] },
    { id: 200, markerIds: [3, 4] },
    { id: 300, markerIds: [5, 6, 7] }
  ]
  const newly = findNewlyCompletedRoutes(routes, [1, 2, 3, 4, 5], [200])
  assert.deepEqual(newly.map(r => r.id), [100])
})

test('findNewlyCompletedRoutes is idempotent for an already-recorded route', () => {
  const routes = [{ id: 100, markerIds: [1, 2] }]
  // user redoes a checkin on a route they have already completed before
  assert.deepEqual(findNewlyCompletedRoutes(routes, [1, 2], [100]), [])
})

test('findNewlyCompletedRoutes ignores routes user has not finished', () => {
  const routes = [
    { id: 100, markerIds: [1, 2, 3] },
    { id: 200, markerIds: [4, 5] }
  ]
  assert.deepEqual(findNewlyCompletedRoutes(routes, [1, 4], []), [])
})

test('findNewlyCompletedRoutes survives empty / null inputs without throwing', () => {
  assert.deepEqual(findNewlyCompletedRoutes([], [1, 2], []), [])
  assert.deepEqual(findNewlyCompletedRoutes(null, [1, 2], null), [])
})

test('buildUserRouteEntry stamps userId and completion time, rewardClaimed false', () => {
  const entry = buildUserRouteEntry('uid-1', { id: 100, name: '湖湘文化之旅' }, 1700000000)
  assert.deepEqual(entry, {
    userId: 'uid-1',
    routeId: 100,
    routeName: '湖湘文化之旅',
    completedAt: 1700000000,
    rewardClaimed: false
  })
})

test('buildRouteRewardEntry tags source=route and keeps userId/reward/earnedAt 字段', () => {
  const reward = buildRouteRewardEntry('uid-1', { id: 100, name: '湖湘文化之旅', reward: '20 积分' }, 1700000000)
  assert.deepEqual(reward, {
    userId: 'uid-1',
    routeId: 100,
    routeName: '湖湘文化之旅',
    reward: '20 积分',
    source: 'route',
    earnedAt: 1700000000
  })
})
