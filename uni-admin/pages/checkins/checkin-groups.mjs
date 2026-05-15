function normalizeRecord(record) {
  const userId = record.userId || ''
  return {
    markerDocId: record.markerDocId || '',
    markerId: record.markerId,
    markerTitle: record.markerTitle || '',
    latitude: record.latitude,
    longitude: record.longitude,
    userId,
    userName: record.userName || userId,
    checkedAt: record.checkedAt || 0,
    note: record.note || null,
    repaired: record.repaired === true
  }
}

function sortRecords(records) {
  return records.slice().sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0))
}

function buildGroupFromRecords(records) {
  const sorted = sortRecords(records.map(normalizeRecord))
  const first = sorted[0] || {}
  return {
    markerDocId: first.markerDocId || '',
    markerId: first.markerId,
    markerTitle: first.markerTitle || '',
    latitude: first.latitude,
    longitude: first.longitude,
    checkinCount: sorted.length,
    recordCount: sorted.length,
    latestCheckedAt: first.checkedAt || 0,
    records: sorted
  }
}

function normalizeGroup(group) {
  const records = sortRecords((group.records || []).map(normalizeRecord))
  return {
    markerDocId: group.markerDocId || '',
    markerId: group.markerId,
    markerTitle: group.markerTitle || '',
    latitude: group.latitude,
    longitude: group.longitude,
    checkinCount: group.checkinCount || records.length,
    recordCount: group.recordCount || records.length,
    latestCheckedAt: group.latestCheckedAt || (records[0] ? records[0].checkedAt : 0),
    records
  }
}

function isGroupedItem(item) {
  return Array.isArray(item && item.records)
}

export function normalizeCheckinGroups(items) {
  if (!Array.isArray(items) || items.length === 0) return []
  if (items.some(isGroupedItem)) {
    return items.map(normalizeGroup)
  }

  const buckets = new Map()
  items.forEach(item => {
    const key = String(item.markerDocId || item.markerId || item.markerTitle || '')
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  })

  const groups = []
  buckets.forEach(records => {
    groups.push(buildGroupFromRecords(records))
  })
  groups.sort((a, b) => (b.latestCheckedAt || 0) - (a.latestCheckedAt || 0))
  return groups
}

export function mergeCheckinGroups(existing, incoming) {
  const merged = new Map()
  ;(existing || []).forEach(group => {
    const normalized = normalizeGroup(group)
    const key = String(normalized.markerDocId || normalized.markerId || normalized.markerTitle || '')
    merged.set(key, normalized)
  })
  ;(incoming || []).forEach(group => {
    const normalized = normalizeGroup(group)
    const key = String(normalized.markerDocId || normalized.markerId || normalized.markerTitle || '')
    const current = merged.get(key)
    if (!current) {
      merged.set(key, normalized)
      return
    }
    const records = sortRecords([...current.records, ...normalized.records])
    current.records = records
    current.recordCount = records.length
    current.checkinCount = records.length
    current.latestCheckedAt = records[0] ? records[0].checkedAt : 0
  })
  return Array.from(merged.values()).sort((a, b) => (b.latestCheckedAt || 0) - (a.latestCheckedAt || 0))
}
