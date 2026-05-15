const assert = require('node:assert/strict')
const test = require('node:test')

const { buildAuditLogEntry, summarizeAuditLogs } = require('./audit-service')

test('buildAuditLogEntry rejects unknown type', () => {
  assert.equal(buildAuditLogEntry({ type: 'unknown.thing' }), null)
  assert.equal(buildAuditLogEntry(null), null)
})

test('buildAuditLogEntry normalizes admin.deleteCheckinRecord row', () => {
  const row = buildAuditLogEntry({
    type: 'admin.deleteCheckinRecord',
    actorUid: 'admin-1',
    targetUid: 'user-2',
    markerId: '7',
    markerTitle: ' 故宫 ',
    checkedAt: 1700000000000,
    reason: '违规内容',
    occurredAt: 1800000000000
  })

  assert.deepEqual(row, {
    type: 'admin.deleteCheckinRecord',
    actorUid: 'admin-1',
    targetUid: 'user-2',
    markerId: 7,
    markerTitle: ' 故宫 ',
    checkedAt: 1700000000000,
    reason: '违规内容',
    occurredAt: 1800000000000
  })
})

test('buildAuditLogEntry stamps occurredAt when missing', () => {
  const before = Date.now()
  const row = buildAuditLogEntry({
    type: 'user.deleteCheckin',
    actorUid: 'u1',
    targetUid: 'u1'
  })
  const after = Date.now()
  assert.ok(row.occurredAt >= before && row.occurredAt <= after, 'occurredAt should be wall-clock')
  assert.equal(row.checkedAt, null)
  assert.equal(row.reason, '')
})

test('buildAuditLogEntry accepts user.claimReward row', () => {
  const row = buildAuditLogEntry({
    type: 'user.claimReward',
    actorUid: 'u1',
    targetUid: 'u1',
    reason: 'reward:rw-1',
    occurredAt: 1800000000000
  })

  assert.equal(row.type, 'user.claimReward')
  assert.equal(row.actorUid, 'u1')
  assert.equal(row.targetUid, 'u1')
  assert.equal(row.reason, 'reward:rw-1')
  assert.equal(row.occurredAt, 1800000000000)
})

test('buildAuditLogEntry coerces non-finite numbers safely', () => {
  const row = buildAuditLogEntry({
    type: 'admin.deleteUser',
    actorUid: 'a',
    targetUid: 'b',
    markerId: 'not-a-number',
    checkedAt: 'NaN',
    occurredAt: 1
  })
  assert.equal(row.markerId, null)
  assert.equal(row.checkedAt, null)
  assert.equal(row.occurredAt, 1)
})

test('summarizeAuditLogs counts by type', () => {
  const rows = [
    { type: 'admin.deleteCheckinRecord' },
    { type: 'admin.deleteCheckinRecord' },
    { type: 'admin.deleteCheckinRecord' },
    { type: 'user.deleteCheckin' },
    { type: 'admin.deleteUser' }
  ]
  assert.deepEqual(summarizeAuditLogs(rows), {
    totalAdminDeletes: 3,
    totalUserDeletes: 1,
    totalAdminDeleteUser: 1
  })
})

test('summarizeAuditLogs tolerates empty / null input', () => {
  assert.deepEqual(summarizeAuditLogs([]), {
    totalAdminDeletes: 0,
    totalUserDeletes: 0,
    totalAdminDeleteUser: 0
  })
  assert.deepEqual(summarizeAuditLogs(null), {
    totalAdminDeletes: 0,
    totalUserDeletes: 0,
    totalAdminDeleteUser: 0
  })
})
