const assert = require('node:assert/strict')
const test = require('node:test')

const {
  DEFAULT_SEED_MARKERS,
  DEFAULT_SEED_TASKS,
  buildSeedMarker,
  buildSeedTask,
  sanitizeMarkerCreate,
  sanitizeMarkerUpdate,
  buildUserLookup,
  flattenCheckinRecords,
  groupCheckinRecordsByMarker,
  createDeleteCheckinRecordPlan,
  createPurgeUserCheckinsPlan,
  deriveUserStatsFromMarkers,
  deriveActiveCheckinsFromMarkers,
  normalizeAdminUsers,
  buildSyncDiagnostics
} = require('./marker-service')

test('default seed markers match the eight local marker ids', () => {
  assert.equal(DEFAULT_SEED_MARKERS.length, 8)
  assert.deepEqual(DEFAULT_SEED_MARKERS.map(item => item.id), [1, 2, 3, 4, 5, 6, 7, 8])
})

test('buildSeedMarker produces an idempotent cloud marker shape', () => {
  const marker = buildSeedMarker(DEFAULT_SEED_MARKERS[0], 123456)

  assert.equal(marker.id, 1)
  assert.equal(marker.title, '北京故宫')
  assert.equal(marker.iconPath, '/static/marker_default.png')
  assert.equal(marker.createdBy, 'system')
  assert.equal(marker.createdAt, 123456)
  assert.equal(marker.updatedAt, 123456)
  assert.equal(marker.checked, false)
  assert.equal(marker.checkinCount, 0)
  assert.deepEqual(marker.checkedBy, [])
})

test('default seed tasks match local starter tasks and stay active', () => {
  assert.equal(DEFAULT_SEED_TASKS.length, 6)
  assert.deepEqual(DEFAULT_SEED_TASKS.map(item => item.id), [
    'task_001',
    'task_002',
    'task_003',
    'task_004',
    'task_005',
    'task_006'
  ])

  const task = buildSeedTask(DEFAULT_SEED_TASKS[0], 123456)

  assert.equal(task.id, 'task_001')
  assert.equal(task.name, '故宫探索者')
  assert.equal(task.targetMarkerId, 1)
  assert.equal(task.status, 'active')
  assert.equal(task.createdBy, 'system')
  assert.equal(task.createdAt, 123456)
  assert.equal(task.updatedAt, 123456)
})

test('sanitizeMarkerCreate accepts only safe marker fields', () => {
  const marker = sanitizeMarkerCreate({
    title: ' 新点位 ',
    latitude: '22.2',
    longitude: '113.5',
    checkedBy: [{ userId: 'attacker' }],
    checkinCount: 99,
    createdBy: 'attacker'
  }, 'admin-user', 1000)

  assert.deepEqual(marker, {
    id: 1000,
    title: '新点位',
    latitude: 22.2,
    longitude: 113.5,
    iconPath: '/static/marker_default.png',
    width: 36,
    height: 36,
    checked: false,
    checkinCount: 0,
    checkedBy: [],
    createdBy: 'admin-user',
    createdAt: 1000,
    updatedAt: 1000
  })
})

test('sanitizeMarkerUpdate ignores protected fields', () => {
  const updates = sanitizeMarkerUpdate({
    title: ' 改名 ',
    latitude: '28.1',
    longitude: '112.9',
    checkedBy: [],
    checkinCount: 0,
    createdBy: 'attacker',
    createdAt: 1,
    updatedAt: 1
  }, 2000)

  assert.deepEqual(updates, {
    title: '改名',
    latitude: 28.1,
    longitude: 112.9,
    updatedAt: 2000
  })
})

test('flattenCheckinRecords returns records sorted by newest checkin first', () => {
  const userLookup = buildUserLookup([
    { _id: 'u1', username: 'alice', nickname: '阿丽' },
    { _id: 'u2', username: 'bob' }
  ])
  const records = flattenCheckinRecords([
    {
      _id: 'm1',
      id: 1,
      title: '北京故宫',
      latitude: 39.9163,
      longitude: 116.3972,
      checkedBy: [
        { userId: 'u1', checkedAt: 100, note: '早' },
        { userId: 'u2', checkedAt: 300, note: null }
      ]
    },
    {
      _id: 'm2',
      id: 2,
      title: '上海迪士尼',
      latitude: 31.1465,
      longitude: 121.6593,
      checkedBy: [
        { userId: 'u3', checkedAt: 200, note: '中' }
      ]
    }
  ], userLookup)

  assert.deepEqual(records.map(item => item.userId), ['u2', 'u3', 'u1'])
  assert.equal(records[0].markerId, 1)
  assert.equal(records[0].markerTitle, '北京故宫')
  assert.equal(records[0].userName, 'bob')
  assert.equal(records[2].userName, '阿丽')
})

test('flattenCheckinRecords preserves repaired checkin flags', () => {
  const records = flattenCheckinRecords([
    {
      _id: 'm1',
      id: 1,
      title: '北京故宫',
      latitude: 39.9163,
      longitude: 116.3972,
      checkedBy: [
        { userId: 'uid-1', checkedAt: 100, repaired: true }
      ]
    }
  ])

  assert.equal(records.length, 1)
  assert.equal(records[0].repaired, true)
})

test('groupCheckinRecordsByMarker returns one group per marker with nested records', () => {
  const userLookup = buildUserLookup([
    { _id: 'u1', username: 'alice' },
    { _id: 'u2', nickname: '旅行者 B' }
  ])
  const groups = groupCheckinRecordsByMarker([
    {
      _id: 'm1',
      id: 1,
      title: '北京故宫',
      latitude: 39.9163,
      longitude: 116.3972,
      checkinCount: 2,
      checkedBy: [
        { userId: 'u1', checkedAt: 100, note: '早' },
        { userId: 'u2', checkedAt: 300, note: null }
      ]
    },
    {
      _id: 'm2',
      id: 2,
      title: '上海迪士尼',
      latitude: 31.1465,
      longitude: 121.6593,
      checkinCount: 1,
      checkedBy: [
        { userId: 'u3', checkedAt: 200, note: '中', repaired: true }
      ]
    }
  ], userLookup)

  assert.equal(groups.length, 2)
  assert.equal(groups[0].markerId, 1)
  assert.equal(groups[0].recordCount, 2)
  assert.deepEqual(groups[0].records.map(item => item.userId), ['u2', 'u1'])
  assert.equal(groups[0].records[0].userName, '旅行者 B')
  assert.equal(groups[1].records[0].repaired, true)
})

test('createDeleteCheckinRecordPlan removes one exact checkin record and recalculates count', () => {
  const marker = {
    checked: true,
    checkinCount: 3,
    checkedBy: [
      { userId: 'u1', checkedAt: 100 },
      { userId: 'u2', checkedAt: 200 },
      { userId: 'u1', checkedAt: 300 }
    ]
  }

  assert.deepEqual(createDeleteCheckinRecordPlan(marker, { userId: 'u1', checkedAt: 100 }), {
    shouldDelete: true,
    removedCount: 1,
    checked: true,
    checkinCount: 2,
    checkedBy: [
      { userId: 'u2', checkedAt: 200 },
      { userId: 'u1', checkedAt: 300 }
    ]
  })
})

test('createPurgeUserCheckinsPlan removes every entry of a user and recounts', () => {
  const marker = {
    checked: true,
    checkinCount: 3,
    checkedBy: [
      { userId: 'u1', checkedAt: 100 },
      { userId: 'u2', checkedAt: 200 },
      { userId: 'u1', checkedAt: 300 }
    ]
  }

  assert.deepEqual(createPurgeUserCheckinsPlan(marker, 'u1'), {
    shouldUpdate: true,
    removedCount: 2,
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'u2', checkedAt: 200 }
    ]
  })
})

test('createPurgeUserCheckinsPlan flips checked to false when last entry removed', () => {
  const marker = {
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'u1', checkedAt: 100 }
    ]
  }

  assert.deepEqual(createPurgeUserCheckinsPlan(marker, 'u1'), {
    shouldUpdate: true,
    removedCount: 1,
    checked: false,
    checkinCount: 0,
    checkedBy: []
  })
})

test('createPurgeUserCheckinsPlan is a no-op when user has no records on this marker', () => {
  const marker = {
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'u2', checkedAt: 200 }
    ]
  }

  const plan = createPurgeUserCheckinsPlan(marker, 'u1')
  assert.equal(plan.shouldUpdate, false)
  assert.equal(plan.removedCount, 0)
  assert.equal(plan.checkinCount, 1)
  assert.equal(plan.checkedBy, marker.checkedBy)
})

test('createPurgeUserCheckinsPlan rejects empty userId without scanning', () => {
  const plan = createPurgeUserCheckinsPlan({
    checked: true,
    checkinCount: 1,
    checkedBy: [{ userId: '', checkedAt: 100 }]
  }, '')
  assert.equal(plan.shouldUpdate, false)
  assert.equal(plan.removedCount, 0)
})

test('createDeleteCheckinRecordPlan is idempotent for a missing record', () => {
  const marker = {
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'u2', checkedAt: 200 }
    ]
  }

  assert.deepEqual(createDeleteCheckinRecordPlan(marker, { userId: 'u1', checkedAt: 100 }), {
    shouldDelete: false,
    removedCount: 0,
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'u2', checkedAt: 200 }
    ]
  })
})

test('buildSyncDiagnostics summarizes cloud marker, checkin, and user counts', () => {
  const diagnostics = buildSyncDiagnostics([
    { id: 1, checkedBy: [{ userId: 'uid-1' }, { userId: 'uid-2' }] },
    { id: 2, checkedBy: [] },
    { id: 3 }
  ], [
    { _id: 'uid-1' },
    { _id: 'uid-2' }
  ])

  assert.deepEqual(diagnostics, {
    markerTotal: 3,
    markerWithCheckins: 1,
    checkinTotal: 2,
    userTotal: 2
  })
})

test('normalizeAdminUsers reads accounts from uni-id-users and merges profile stats', () => {
  const markerStats = deriveUserStatsFromMarkers([
    {
      createdBy: 'uid-2',
      checkedBy: [
        { userId: 'uid-1' },
        { userId: 'uid-2' }
      ]
    },
    {
      createdBy: 'uid-2',
      checkedBy: [
        { userId: 'uid-1' }
      ]
    }
  ])

  const users = normalizeAdminUsers([
    {
      _id: 'uid-1',
      username: 'admin',
      nickname: '管理员',
      role: 'admin',
      register_date: 1000
    },
    {
      _id: 'uid-2',
      username: 'traveler',
      nickname: '',
      role: ['user']
    }
  ], [
    {
      userId: 'uid-1',
      totalCheckins: 3
    },
    {
      userId: 'other-user',
      totalCheckins: 4
    }
  ], markerStats)

  assert.deepEqual(users, [
    {
      _id: 'uid-1',
      uid: 'uid-1',
      userId: 'admin',
      nickname: '管理员',
      role: 'admin',
      totalCheckins: 3,
      activeCheckins: 2,
      totalRewardPoints: 0,
      claimedRewardPoints: 0,
      pendingRewardPoints: 0,
      routeRewardCount: 0,
      taskRewardCount: 0,
      claimedCount: 0,
      pendingCount: 0,
      createdAt: 1000
    },
    {
      _id: 'uid-2',
      uid: 'uid-2',
      userId: 'traveler',
      nickname: 'traveler',
      role: ['user'],
      totalCheckins: 1,
      activeCheckins: 1,
      totalRewardPoints: 0,
      claimedRewardPoints: 0,
      pendingRewardPoints: 0,
      routeRewardCount: 0,
      taskRewardCount: 0,
      claimedCount: 0,
      pendingCount: 0,
      createdAt: null
    }
  ])
})

test('deriveActiveCheckinsFromMarkers counts current checkedBy records per user', () => {
  const activeStats = deriveActiveCheckinsFromMarkers([
    {
      id: 1,
      checkedBy: [
        { userId: 'uid-1', checkedAt: 100 },
        { userId: 'uid-2', checkedAt: 200 }
      ]
    },
    {
      id: 2,
      checkedBy: [
        { userId: 'uid-1', checkedAt: 300 },
        { userId: 'uid-3', checkedAt: 400 }
      ]
    },
    {
      id: 3,
      checkedBy: []
    }
  ])

  assert.equal(activeStats.get('uid-1').activeCheckins, 2)
  assert.equal(activeStats.get('uid-2').activeCheckins, 1)
  assert.equal(activeStats.get('uid-3').activeCheckins, 1)
  assert.equal(activeStats.has('missing-user'), false)
})

test('normalizeAdminUsers exposes activeCheckins separately from cumulative totalCheckins', () => {
  const activeStats = deriveActiveCheckinsFromMarkers([
    {
      checkedBy: [
        { userId: 'uid-1' },
        { userId: 'uid-2' }
      ]
    }
  ])

  const users = normalizeAdminUsers([
    { _id: 'uid-1', username: 'alice', nickname: 'Alice' },
    { _id: 'uid-2', username: 'bob', nickname: 'Bob' },
    { _id: 'uid-3', username: 'cara', nickname: 'Cara' }
  ], [
    { userId: 'uid-1', totalCheckins: 5 },
    { userId: 'uid-3', totalCheckins: 7 }
  ], activeStats)

  assert.equal(users[0].totalCheckins, 5)
  assert.equal(users[0].activeCheckins, 1)
  assert.equal(Object.prototype.hasOwnProperty.call(users[0], 'totalCreated'), false)
  assert.equal(users[1].totalCheckins, 1)
  assert.equal(users[1].activeCheckins, 1)
  assert.equal(Object.prototype.hasOwnProperty.call(users[1], 'totalCreated'), false)
  assert.equal(users[2].totalCheckins, 7)
  assert.equal(users[2].activeCheckins, 0)
  assert.equal(Object.prototype.hasOwnProperty.call(users[2], 'totalCreated'), false)
})
