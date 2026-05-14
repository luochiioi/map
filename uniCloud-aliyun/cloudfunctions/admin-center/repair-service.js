// P5.5 T4 — UGC removal audit helpers.
// P5.4 stripped App-side marker creation. Rows persisted before then can
// still carry a real user uid in `createdBy`, which is exactly the data
// we want to flag for support review. This module is a pure helper so
// it can be unit-tested without touching uniCloud.

const SYSTEM_CREATORS = new Set(['system', 'admin', ''])

function isLegacyUserMarker(row) {
  if (!row) return false
  const raw = row.createdBy
  if (raw == null) return false
  const text = String(raw).trim()
  if (text.length === 0) return false
  if (SYSTEM_CREATORS.has(text)) return false
  return true
}

function findLegacyUserMarkers(markers) {
  return (markers || []).filter(isLegacyUserMarker)
}

function summarizeLegacyUserMarkers(markers) {
  const list = findLegacyUserMarkers(markers)
  const byUser = new Map()
  list.forEach(row => {
    const uid = String(row.createdBy || '')
    const bucket = byUser.get(uid) || { userId: uid, markerCount: 0, markerIds: [] }
    bucket.markerCount += 1
    bucket.markerIds.push(Number(row.id) || row.id)
    byUser.set(uid, bucket)
  })
  return {
    total: list.length,
    byUser: Array.from(byUser.values())
  }
}

module.exports = {
  isLegacyUserMarker,
  findLegacyUserMarkers,
  summarizeLegacyUserMarkers
}
