const ALLOWED_TYPES = new Set([
  'user.deleteCheckin',
  'user.claimReward'
])

function s(value) {
  return value == null ? '' : String(value)
}

function n(value) {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function buildAuditLogEntry(input) {
  const raw = input || {}
  if (!ALLOWED_TYPES.has(raw.type)) return null
  const occurredAt = Number.isFinite(Number(raw.occurredAt)) ? Number(raw.occurredAt) : Date.now()

  return {
    type: raw.type,
    actorUid: s(raw.actorUid),
    targetUid: s(raw.targetUid),
    markerId: n(raw.markerId),
    markerTitle: s(raw.markerTitle),
    checkedAt: n(raw.checkedAt),
    reason: s(raw.reason),
    occurredAt
  }
}

module.exports = {
  ALLOWED_TYPES,
  buildAuditLogEntry
}
