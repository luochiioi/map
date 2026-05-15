const assert = require('node:assert/strict')
const test = require('node:test')

const {
  hasUserCheckin,
  buildRepairCheckinEntry,
  createRepairCheckinPlan,
  createDeleteCheckinPlan
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
    note: '历史记录'
  }, 'real-uid', 999)

  assert.deepEqual(entry, {
    userId: 'real-uid',
    checkedAt: 123,
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
    note: null,
    repaired: true
  })
})

test('createDeleteCheckinPlan removes only the authenticated uid and recounts safely', () => {
  const marker = {
    checked: true,
    checkinCount: 5,
    checkedBy: [
      { userId: 'uid-a', checkedAt: 100 },
      { userId: 'uid-b', checkedAt: 200 },
      { userId: 'uid-a', checkedAt: 300 }
    ]
  }

  assert.deepEqual(createDeleteCheckinPlan(marker, 'uid-a'), {
    shouldDelete: true,
    existed: true,
    removedCount: 2,
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'uid-b', checkedAt: 200 }
    ]
  })
})

test('createDeleteCheckinPlan is idempotent when the uid has no record', () => {
  const marker = {
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'uid-b', checkedAt: 200 }
    ]
  }

  assert.deepEqual(createDeleteCheckinPlan(marker, 'uid-a'), {
    shouldDelete: false,
    existed: false,
    removedCount: 0,
    checked: true,
    checkinCount: 1,
    checkedBy: [
      { userId: 'uid-b', checkedAt: 200 }
    ]
  })
})
