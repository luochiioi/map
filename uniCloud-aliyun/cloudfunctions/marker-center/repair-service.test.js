const assert = require('node:assert/strict')
const test = require('node:test')

const {
  hasUserCheckin,
  buildRepairCheckinEntry,
  createRepairCheckinPlan
} = require('./repair-service')

test('hasUserCheckin only matches the authenticated uid', () => {
  const marker = {
    checkedBy: [
      { userId: 'uid-a' },
      { userId: 'uid-b' }
    ]
  }

  assert.equal(hasUserCheckin(marker, 'uid-a'), true)
  assert.equal(hasUserCheckin(marker, 'uid-c'), false)
})

test('buildRepairCheckinEntry ignores client userId and marks the row as repaired', () => {
  const entry = buildRepairCheckinEntry({
    userId: 'attacker',
    checkedAt: 123,
    photoCloudURL: 'cloud://photo.jpg',
    note: '历史记录'
  }, 'real-uid', 999)

  assert.deepEqual(entry, {
    userId: 'real-uid',
    checkedAt: 123,
    photoCloudURL: 'cloud://photo.jpg',
    note: '历史记录',
    repaired: true
  })
})

test('createRepairCheckinPlan is idempotent for markerId plus uid', () => {
  const marker = {
    checkedBy: [
      { userId: 'uid-a', checkedAt: 100 }
    ]
  }

  assert.deepEqual(createRepairCheckinPlan(marker, {}, 'uid-a', 200), {
    shouldRepair: false,
    existed: true,
    entry: null
  })

  const plan = createRepairCheckinPlan(marker, { checkedAt: 150 }, 'uid-b', 200)
  assert.equal(plan.shouldRepair, true)
  assert.equal(plan.existed, false)
  assert.deepEqual(plan.entry, {
    userId: 'uid-b',
    checkedAt: 150,
    photoCloudURL: null,
    note: null,
    repaired: true
  })
})
