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
    photoCloudURL: 'cloud://x/checkin-photos/user-2/p.jpg',
    checkedAt: 1700000000000,
    reason: '违规内容',
    purgePhoto: true,
    purgeError: '',
    occurredAt: 1800000000000
  })

  assert.deepEqual(row, {
    type: 'admin.deleteCheckinRecord',
    actorUid: 'admin-1',
    targetUid: 'user-2',
    markerId: 7,
    markerTitle: ' 故宫 ',
    photoCloudURL: 'cloud://x/checkin-photos/user-2/p.jpg',
    checkedAt: 1700000000000,
    reason: '违规内容',
    purgePhoto: true,
    purgeError: '',
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
  assert.equal(row.purgePhoto, false)
  assert.equal(row.photoCloudURL, null)
  assert.equal(row.checkedAt, null)
  assert.equal(row.reason, '')
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

test('summarizeAuditLogs counts by type and photo purge outcome', () => {
  const rows = [
    { type: 'admin.deleteCheckinRecord', purgePhoto: true,  purgeError: '' },
    { type: 'admin.deleteCheckinRecord', purgePhoto: true,  purgeError: 'storage timeout' },
    { type: 'admin.deleteCheckinRecord', purgePhoto: false, purgeError: '' },
    { type: 'user.deleteCheckin',        purgePhoto: false, purgeError: '' },
    { type: 'admin.deleteUser',          purgePhoto: false, purgeError: '' }
  ]
  assert.deepEqual(summarizeAuditLogs(rows), {
    totalAdminDeletes: 3,
    totalUserDeletes: 1,
    totalAdminDeleteUser: 1,
    totalPhotoPurged: 1,
    totalPhotoPurgeFailed: 1
  })
})

test('summarizeAuditLogs tolerates empty / null input', () => {
  assert.deepEqual(summarizeAuditLogs([]), {
    totalAdminDeletes: 0,
    totalUserDeletes: 0,
    totalAdminDeleteUser: 0,
    totalPhotoPurged: 0,
    totalPhotoPurgeFailed: 0
  })
  assert.deepEqual(summarizeAuditLogs(null), {
    totalAdminDeletes: 0,
    totalUserDeletes: 0,
    totalAdminDeleteUser: 0,
    totalPhotoPurged: 0,
    totalPhotoPurgeFailed: 0
  })
})
