const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildClaimedReward,
  buildTaskRewardEntry,
  enrichRewardWithSource,
  parseRewardPoints
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
