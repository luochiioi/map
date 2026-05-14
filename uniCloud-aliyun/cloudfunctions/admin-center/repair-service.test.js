const assert = require('node:assert/strict')
const test = require('node:test')

const {
  isLegacyUserMarker,
  findLegacyUserMarkers,
  summarizeLegacyUserMarkers
} = require('./repair-service')

test('isLegacyUserMarker ignores system, admin, empty, and null createdBy', () => {
  assert.equal(isLegacyUserMarker({ createdBy: 'system' }), false)
  assert.equal(isLegacyUserMarker({ createdBy: 'admin' }), false)
  assert.equal(isLegacyUserMarker({ createdBy: '' }), false)
  assert.equal(isLegacyUserMarker({ createdBy: null }), false)
  assert.equal(isLegacyUserMarker({}), false)
  assert.equal(isLegacyUserMarker(null), false)
})

test('isLegacyUserMarker flags arbitrary uid strings', () => {
  assert.equal(isLegacyUserMarker({ createdBy: 'uid_abc123' }), true)
  assert.equal(isLegacyUserMarker({ createdBy: '5fbd...' }), true)
  assert.equal(isLegacyUserMarker({ createdBy: '  uid_x  ' }), true)
})

test('findLegacyUserMarkers narrows a mixed marker list to legacy user-authored rows', () => {
  const list = findLegacyUserMarkers([
    { id: 1, createdBy: 'system' },
    { id: 2, createdBy: 'uid_alice' },
    { id: 3, createdBy: null },
    { id: 4, createdBy: 'uid_bob' },
    { id: 5, createdBy: 'admin' }
  ])
  assert.deepEqual(list.map(row => row.id), [2, 4])
})

test('summarizeLegacyUserMarkers groups counts and ids per uid', () => {
  const summary = summarizeLegacyUserMarkers([
    { id: 1, createdBy: 'system' },
    { id: 2, createdBy: 'uid_alice' },
    { id: 3, createdBy: 'uid_alice' },
    { id: 4, createdBy: 'uid_bob' }
  ])
  assert.equal(summary.total, 3)
  assert.equal(summary.byUser.length, 2)
  const alice = summary.byUser.find(b => b.userId === 'uid_alice')
  const bob = summary.byUser.find(b => b.userId === 'uid_bob')
  assert.equal(alice.markerCount, 2)
  assert.deepEqual(alice.markerIds, [2, 3])
  assert.equal(bob.markerCount, 1)
  assert.deepEqual(bob.markerIds, [4])
})
