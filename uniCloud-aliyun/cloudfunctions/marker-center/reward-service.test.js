const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildClaimedReward,
  buildTaskRewardEntry,
  enrichRewardWithSource,
  parseRewardPoints,
  rewardSourceType,
  rewardClaimedState,
  buildPointsSummary,
  buildPointsLedger
} = require('./reward-service')

test('buildClaimedReward marks reward claimed with server timestamp', () => {
  assert.deepEqual(buildClaimedReward({ rewardClaimed: false }, 1800000000000), {
    rewardClaimed: true,
    claimedAt: 1800000000000
  })
})

test('parseRewardPoints extracts integer points from reward text', () => {
  assert.equal(parseRewardPoints('20 积分'), 20)
  assert.equal(parseRewardPoints('20 points'), 20)
  assert.equal(parseRewardPoints('no numeric reward'), 0)
})

test('buildTaskRewardEntry stores normalized rewardPoints and auto-claims task rewards', () => {
  assert.deepEqual(buildTaskRewardEntry('uid-1', {
    id: 'task_001',
    name: 'Palace Explorer',
    reward: '10 points'
  }, 1700000000000), {
    userId: 'uid-1',
    taskId: 'task_001',
    taskName: 'Palace Explorer',
    reward: '10 points',
    rewardPoints: 10,
    source: 'task',
    earnedAt: 1700000000000,
    rewardClaimed: true,
    claimedAt: 1700000000000
  })
})

test('enrichRewardWithSource joins route reward by routeId', () => {
  const reward = { _id: 'rw-1', source: 'route', routeId: 100, reward: '20 points' }
  const routes = [{ id: 100, name: 'Macau Heritage Walk' }]
  const row = enrichRewardWithSource(reward, routes, [])

  assert.equal(row.sourceType, 'route')
  assert.equal(row.routeName, 'Macau Heritage Walk')
  assert.equal(row.taskName, '')
  assert.equal(row.sourceTitle, 'Macau Heritage Walk')
})

test('enrichRewardWithSource joins task reward by taskId', () => {
  const reward = { _id: 'rw-2', source: 'task', taskId: 'task_001', reward: '10 points' }
  const tasks = [{ id: 'task_001', name: 'Palace Explorer' }]
  const row = enrichRewardWithSource(reward, [], tasks)

  assert.equal(row.sourceType, 'task')
  assert.equal(row.routeName, '')
  assert.equal(row.taskName, 'Palace Explorer')
  assert.equal(row.sourceTitle, 'Palace Explorer')
})

test('enrichRewardWithSource treats missing source as task for legacy rows', () => {
  const reward = { _id: 'rw-3', taskId: 'task_002', taskName: 'Legacy Task', reward: '15 points' }
  const row = enrichRewardWithSource(reward, [], [])

  assert.equal(row.sourceType, 'task')
  assert.equal(row.routeName, '')
  assert.equal(row.taskName, 'Legacy Task')
  assert.equal(row.sourceTitle, 'Legacy Task')
})

test('enrichRewardWithSource falls back to stored routeName when active route is missing', () => {
  const reward = { _id: 'rw-4', source: 'route', routeId: 200, routeName: 'Archived Route', reward: 'Badge' }
  const row = enrichRewardWithSource(reward, [], [])

  assert.equal(row.sourceType, 'route')
  assert.equal(row.routeName, 'Archived Route')
  assert.equal(row.sourceTitle, 'Archived Route')
})

test('enrichRewardWithSource returns stable empty sourceTitle when names are absent', () => {
  const reward = { _id: 'rw-5', source: 'route', routeId: 999, reward: 'Mystery' }
  const row = enrichRewardWithSource(reward, [], [])

  assert.equal(row.sourceType, 'route')
  assert.equal(row.routeName, '')
  assert.equal(row.taskName, '')
  assert.equal(row.sourceTitle, '')
})

test('enrichRewardWithSource preserves claim fields from reward row', () => {
  const reward = {
    _id: 'rw-6',
    source: 'task',
    taskId: 'task_003',
    reward: '12 points',
    rewardClaimed: true,
    claimedAt: 1800000000000
  }
  const row = enrichRewardWithSource(reward, [], [{ id: 'task_003', name: 'Island Story' }])

  assert.equal(row.rewardClaimed, true)
  assert.equal(row.claimedAt, 1800000000000)
})

test('enrichRewardWithSource treats task rewards as already issued even for legacy pending rows', () => {
  const reward = {
    _id: 'rw-7',
    taskId: 'task_004',
    reward: '8 points',
    rewardClaimed: false,
    earnedAt: 1700000000000
  }
  const row = enrichRewardWithSource(reward, [], [{ id: 'task_004', name: 'Auto Task' }])

  assert.equal(row.sourceType, 'task')
  assert.equal(row.rewardClaimed, true)
  assert.equal(row.claimedAt, 1700000000000)
})

test('rewardSourceType returns route for source==="route" and task otherwise', () => {
  assert.equal(rewardSourceType({ source: 'route', routeId: 1 }), 'route')
  assert.equal(rewardSourceType({ source: 'task', taskId: 't1' }), 'task')
  assert.equal(rewardSourceType({ taskId: 't1' }), 'task')
  assert.equal(rewardSourceType({}), 'task')
  assert.equal(rewardSourceType(null), 'task')
})

test('rewardClaimedState reports task rewards as issued and route rewards by rewardClaimed flag', () => {
  assert.deepEqual(
    rewardClaimedState({ source: 'task', earnedAt: 1700000000000, rewardClaimed: false }),
    { issued: true, issuedAt: 1700000000000 }
  )
  assert.deepEqual(
    rewardClaimedState({ source: 'route', earnedAt: 1700000000000, rewardClaimed: true, claimedAt: 1800000000000 }),
    { issued: true, issuedAt: 1800000000000 }
  )
  assert.deepEqual(
    rewardClaimedState({ source: 'route', earnedAt: 1700000000000, rewardClaimed: false }),
    { issued: false, issuedAt: null }
  )
})

test('buildPointsSummary sums task points immediately and gates route points behind claim', () => {
  const rewards = [
    { source: 'task', taskId: 't1', reward: '10 points', earnedAt: 1700000000000 },
    { source: 'task', taskId: 't2', reward: '5 points', earnedAt: 1700000000010, rewardClaimed: false },
    { source: 'route', routeId: 100, reward: '20 points', earnedAt: 1700000000020, rewardClaimed: false },
    { source: 'route', routeId: 101, reward: '30 points', earnedAt: 1700000000030, rewardClaimed: true, claimedAt: 1800000000000 },
    { taskId: 't3', reward: '7 points', earnedAt: 1700000000040 }
  ]
  const summary = buildPointsSummary(rewards)

  assert.equal(summary.totalEarnedPoints, 72)
  assert.equal(summary.taskIssuedPoints, 22)
  assert.equal(summary.routeIssuedPoints, 30)
  assert.equal(summary.issuedPoints, 52)
  assert.equal(summary.pendingRoutePoints, 20)
})

test('buildPointsSummary handles empty input safely', () => {
  const summary = buildPointsSummary([])
  assert.equal(summary.totalEarnedPoints, 0)
  assert.equal(summary.issuedPoints, 0)
  assert.equal(summary.pendingRoutePoints, 0)
  assert.equal(summary.taskIssuedPoints, 0)
  assert.equal(summary.routeIssuedPoints, 0)
})

test('buildPointsLedger yields one ledger row per reward sorted by issuedAt desc (pending last)', () => {
  const rewards = [
    { _id: 'r1', source: 'task', taskId: 't1', taskName: 'A', reward: '10 points', earnedAt: 1700000000000 },
    { _id: 'r2', source: 'route', routeId: 100, routeName: 'R1', reward: '20 points', earnedAt: 1700000000020, rewardClaimed: false },
    { _id: 'r3', source: 'route', routeId: 101, routeName: 'R2', reward: '30 points', earnedAt: 1700000000010, rewardClaimed: true, claimedAt: 1800000000000 }
  ]
  const ledger = buildPointsLedger(rewards)

  assert.equal(ledger.length, 3)
  assert.equal(ledger[0].rewardId, 'r3') // most recent issued
  assert.equal(ledger[0].status, 'issued')
  assert.equal(ledger[0].points, 30)
  assert.equal(ledger[0].issuedAt, 1800000000000)
  assert.equal(ledger[1].rewardId, 'r1')
  assert.equal(ledger[1].status, 'issued')
  assert.equal(ledger[2].rewardId, 'r2')
  assert.equal(ledger[2].status, 'pending')
  assert.equal(ledger[2].points, 20)
})
