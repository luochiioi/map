// Pure helpers for the friendship domain.
//
// Layout: two-way rows. A successful accept produces two documents
//   { userId: A, friendUserId: B, status: 'accepted', requestedBy: A, ... }
//   { userId: B, friendUserId: A, status: 'accepted', requestedBy: A, ... }
// `requestedBy` records the original direction so 'who asked first' survives
// the mirror. Index (userId, status) keeps "list my friends" hot.
//
// All helpers are pure: no DB I/O, no clock reads. The caller (index.obj.js)
// injects `now` and persists the returned row. Tests live next to the file.

const VALID_STATUSES = new Set(['pending', 'accepted', 'rejected'])
const VALID_DECISIONS = new Set(['accept', 'reject'])

function s(value) {
  return value == null ? '' : String(value)
}

function n(value, fallback = 0) {
  if (value == null) return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function buildFriendRequest(userId, friendUserId, now) {
  const a = s(userId)
  const b = s(friendUserId)
  if (!a || !b) return null
  if (a === b) return null
  const ts = n(now)
  return {
    userId: a,
    friendUserId: b,
    status: 'pending',
    requestedBy: a,
    createdAt: ts,
    updatedAt: ts
  }
}

function applyFriendDecision(row, decision, now) {
  if (row == null) return null
  if (!VALID_DECISIONS.has(decision)) return null
  if (row.status !== 'pending') return null
  const nextStatus = decision === 'accept' ? 'accepted' : 'rejected'
  return {
    ...row,
    status: nextStatus,
    updatedAt: n(now)
  }
}

function buildMirrorRow(acceptedRow, now) {
  if (acceptedRow == null) return null
  if (acceptedRow.status !== 'accepted') return null
  const ts = n(now)
  return {
    userId: s(acceptedRow.friendUserId),
    friendUserId: s(acceptedRow.userId),
    status: 'accepted',
    requestedBy: s(acceptedRow.requestedBy),
    createdAt: ts,
    updatedAt: ts
  }
}

function dedupePendingRequests(rows) {
  if (!Array.isArray(rows)) return []
  const out = []
  const pendingIdxByPair = new Map()
  for (const row of rows) {
    if (row == null) continue
    if (row.status !== 'pending') {
      out.push(row)
      continue
    }
    const key = `${s(row.userId)}::${s(row.friendUserId)}`
    const priorIdx = pendingIdxByPair.get(key)
    if (priorIdx == null) {
      pendingIdxByPair.set(key, out.length)
      out.push(row)
    } else {
      const earlier = n(row.createdAt) < n(out[priorIdx].createdAt) ? row : out[priorIdx]
      out[priorIdx] = earlier
    }
  }
  return out
}

function bucketizeFriendships(rows, uid) {
  const me = s(uid)
  const out = { accepted: [], incoming: [], outgoing: [] }
  if (!Array.isArray(rows) || !me) return out
  for (const row of rows) {
    if (row == null) continue
    if (!VALID_STATUSES.has(row.status)) continue
    const owner = s(row.userId)
    const target = s(row.friendUserId)
    if (row.status === 'accepted' && owner === me) {
      out.accepted.push(row)
    } else if (row.status === 'pending' && target === me) {
      out.incoming.push(row)
    } else if (row.status === 'pending' && owner === me) {
      out.outgoing.push(row)
    }
    // 'rejected' rows and the mirror copy owned by the other party are
    // intentionally dropped — they exist for history / index symmetry, not UI.
  }
  return out
}

function toPublicProfile(profileRow, extras) {
  const row = profileRow || {}
  const ext = extras || {}
  return {
    userId: s(row.userId),
    nickname: s(row.nickname),
    avatar: s(row.avatar),
    totalCheckins: n(row.totalCheckins),
    completedRoutes: n(ext.completedRoutes)
  }
}

module.exports = {
  buildFriendRequest,
  applyFriendDecision,
  buildMirrorRow,
  dedupePendingRequests,
  bucketizeFriendships,
  toPublicProfile
}
