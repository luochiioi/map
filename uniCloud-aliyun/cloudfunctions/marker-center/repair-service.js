function hasUserCheckin(marker, uid) {
  if (!marker || !Array.isArray(marker.checkedBy)) return false
  return marker.checkedBy.some(entry => entry && entry.userId === uid)
}

function buildRepairCheckinEntry(payload, uid, now) {
  const checkedAt = Number((payload && payload.checkedAt) || now)
  return {
    userId: uid,
    checkedAt: Number.isFinite(checkedAt) ? checkedAt : now,
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

function createDeleteCheckinPlan(marker, uid) {
  const original = marker && Array.isArray(marker.checkedBy) ? marker.checkedBy : []
  const checkedBy = original.filter(entry => !entry || entry.userId !== uid)
  const removedCount = original.length - checkedBy.length
  return {
    shouldDelete: removedCount > 0,
    existed: removedCount > 0,
    removedCount,
    checked: checkedBy.length > 0,
    checkinCount: checkedBy.length,
    checkedBy
  }
}

module.exports = {
  hasUserCheckin,
  buildRepairCheckinEntry,
  createRepairCheckinPlan,
  createDeleteCheckinPlan
}
