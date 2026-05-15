const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildFriendRequest,
  applyFriendDecision,
  buildMirrorRow,
  dedupePendingRequests,
  bucketizeFriendships,
  toPublicProfile
} = require('./friendship-service')

// ===== buildFriendRequest =====

test('buildFriendRequest returns a pending row with normalized uids and timestamps', () => {
  const row = buildFriendRequest('u1', 'u2', 1700000000000)
  assert.deepEqual(row, {
    userId: 'u1',
    friendUserId: 'u2',
    status: 'pending',
    requestedBy: 'u1',
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  })
})

test('buildFriendRequest rejects self-friending', () => {
  assert.equal(buildFriendRequest('u1', 'u1', 1700000000000), null)
})

test('buildFriendRequest rejects empty / nullish uids', () => {
  assert.equal(buildFriendRequest('', 'u2', 1700000000000), null)
  assert.equal(buildFriendRequest('u1', '', 1700000000000), null)
  assert.equal(buildFriendRequest(null, 'u2', 1700000000000), null)
  assert.equal(buildFriendRequest('u1', null, 1700000000000), null)
})

test('buildFriendRequest coerces non-string uids without changing identity', () => {
  const row = buildFriendRequest(42, 99, 1700000000000)
  assert.equal(row.userId, '42')
  assert.equal(row.friendUserId, '99')
})

// ===== applyFriendDecision =====

test('applyFriendDecision returns a new accepted row without mutating input', () => {
  const original = {
    _id: 'f1', userId: 'u1', friendUserId: 'u2',
    status: 'pending', requestedBy: 'u1',
    createdAt: 1700000000000, updatedAt: 1700000000000
  }
  const next = applyFriendDecision(original, 'accept', 1700000005000)

  assert.equal(next.status, 'accepted')
  assert.equal(next.updatedAt, 1700000005000)
  assert.equal(next.createdAt, 1700000000000)
  assert.equal(next._id, 'f1')
  // original is untouched
  assert.equal(original.status, 'pending')
  assert.equal(original.updatedAt, 1700000000000)
})

test('applyFriendDecision returns a rejected row on reject', () => {
  const next = applyFriendDecision(
    { userId: 'u1', friendUserId: 'u2', status: 'pending', requestedBy: 'u1', createdAt: 1, updatedAt: 1 },
    'reject',
    1700000005000
  )
  assert.equal(next.status, 'rejected')
  assert.equal(next.updatedAt, 1700000005000)
})

test('applyFriendDecision rejects unknown decisions', () => {
  const row = { userId: 'u1', friendUserId: 'u2', status: 'pending', requestedBy: 'u1', createdAt: 1, updatedAt: 1 }
  assert.equal(applyFriendDecision(row, 'wat', 2), null)
  assert.equal(applyFriendDecision(row, '', 2), null)
  assert.equal(applyFriendDecision(null, 'accept', 2), null)
})

test('applyFriendDecision refuses to flip a non-pending row', () => {
  const row = { userId: 'u1', friendUserId: 'u2', status: 'accepted', requestedBy: 'u1', createdAt: 1, updatedAt: 1 }
  assert.equal(applyFriendDecision(row, 'accept', 2), null)
  assert.equal(applyFriendDecision(row, 'reject', 2), null)
})

// ===== buildMirrorRow =====

test('buildMirrorRow flips userId / friendUserId and keeps accepted status', () => {
  const accepted = {
    _id: 'f1', userId: 'u1', friendUserId: 'u2',
    status: 'accepted', requestedBy: 'u1',
    createdAt: 1700000000000, updatedAt: 1700000005000
  }
  const mirror = buildMirrorRow(accepted, 1700000005000)

  assert.deepEqual(mirror, {
    userId: 'u2',
    friendUserId: 'u1',
    status: 'accepted',
    requestedBy: 'u1',
    createdAt: 1700000005000,
    updatedAt: 1700000005000
  })
})

test('buildMirrorRow refuses to mirror non-accepted rows', () => {
  const pending = { userId: 'u1', friendUserId: 'u2', status: 'pending', requestedBy: 'u1', createdAt: 1, updatedAt: 1 }
  assert.equal(buildMirrorRow(pending, 2), null)
})

// ===== dedupePendingRequests =====

test('dedupePendingRequests collapses duplicate pending rows by (userId, friendUserId)', () => {
  const rows = [
    { userId: 'u1', friendUserId: 'u2', status: 'pending', createdAt: 1 },
    { userId: 'u1', friendUserId: 'u2', status: 'pending', createdAt: 2 },
    { userId: 'u1', friendUserId: 'u3', status: 'pending', createdAt: 3 }
  ]
  const out = dedupePendingRequests(rows)
  assert.equal(out.length, 2)
  const u2 = out.find(r => r.friendUserId === 'u2')
  assert.equal(u2.createdAt, 1)
})

test('dedupePendingRequests ignores non-pending rows and bad input', () => {
  assert.deepEqual(dedupePendingRequests(null), [])
  assert.deepEqual(dedupePendingRequests(undefined), [])
  const out = dedupePendingRequests([
    { userId: 'u1', friendUserId: 'u2', status: 'accepted', createdAt: 1 },
    { userId: 'u1', friendUserId: 'u2', status: 'pending', createdAt: 2 }
  ])
  assert.equal(out.length, 2)
})

// ===== bucketizeFriendships =====

test('bucketizeFriendships partitions rows into accepted / incoming / outgoing for a uid', () => {
  const rows = [
    { _id: 'a', userId: 'me', friendUserId: 'u2', status: 'accepted' },
    { _id: 'b', userId: 'u3', friendUserId: 'me', status: 'pending' },
    { _id: 'c', userId: 'me', friendUserId: 'u4', status: 'pending' },
    { _id: 'd', userId: 'me', friendUserId: 'u5', status: 'rejected' },
    { _id: 'e', userId: 'u6', friendUserId: 'me', status: 'accepted' }
  ]
  const out = bucketizeFriendships(rows, 'me')

  assert.deepEqual(out.accepted.map(r => r._id), ['a'])
  assert.deepEqual(out.incoming.map(r => r._id), ['b'])
  assert.deepEqual(out.outgoing.map(r => r._id), ['c'])
})

test('bucketizeFriendships tolerates empty / missing input', () => {
  const out = bucketizeFriendships(null, 'me')
  assert.deepEqual(out, { accepted: [], incoming: [], outgoing: [] })
})

// ===== toPublicProfile =====

test('toPublicProfile masks contact info and exposes public stats only', () => {
  const profile = toPublicProfile(
    {
      _id: 'p1',
      userId: 'u9',
      nickname: 'Alice',
      avatar: 'cloud://avatars/1.jpg',
      totalCheckins: 12,
      email: 'alice@example.com',
      mobile: '13800000000'
    },
    { completedRoutes: 3 }
  )

  assert.deepEqual(profile, {
    userId: 'u9',
    nickname: 'Alice',
    avatar: 'cloud://avatars/1.jpg',
    totalCheckins: 12,
    completedRoutes: 3
  })
  assert.equal(profile.email, undefined)
  assert.equal(profile.mobile, undefined)
})

test('toPublicProfile defaults missing fields to safe zeros', () => {
  const profile = toPublicProfile(null, null)
  assert.deepEqual(profile, {
    userId: '',
    nickname: '',
    avatar: '',
    totalCheckins: 0,
    completedRoutes: 0
  })
})
