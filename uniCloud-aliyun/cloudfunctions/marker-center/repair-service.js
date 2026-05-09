function hasUserCheckin(marker, uid) {
  if (!marker || !Array.isArray(marker.checkedBy)) return false
  return marker.checkedBy.some(entry => entry && entry.userId === uid)
}

function buildRepairCheckinEntry(payload, uid, now) {
  const checkedAt = Number((payload && payload.checkedAt) || now)
  return {
    userId: uid,
    checkedAt: Number.isFinite(checkedAt) ? checkedAt : now,
    photoCloudURL: (payload && payload.photoCloudURL) || null,
    note: (payload && payload.note) || null,
    repaired: true
  }
}

function createRepairCheckinPlan(marker, payload, uid, now) {
  if (hasUserCheckin(marker, uid)) {
    return {
      shouldRepair: false,
      existed: true,
      entry: null
    }
  }

  return {
    shouldRepair: true,
    existed: false,
    entry: buildRepairCheckinEntry(payload, uid, now)
  }
}

module.exports = {
  hasUserCheckin,
  buildRepairCheckinEntry,
  createRepairCheckinPlan
}
