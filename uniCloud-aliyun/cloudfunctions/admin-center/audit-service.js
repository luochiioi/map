// tourism_audit_logs 集合的纯函数 helper：
//
// 1) buildAuditLogEntry(input) —— 把上下文规范成一行 append-only 审计记录
// 2) summarizeAuditLogs(rows)  —— 把 N 行折成 { totalAdminDeletes, totalUserDeletes,
//                                  totalAdminDeleteUser }
//
// 字段约定（type 是字符串字面量，不是 enum）：
//   type:           'admin.deleteCheckinRecord' | 'admin.deleteUser' | 'user.deleteCheckin'
//   actorUid:       string  —— 触发者 uid（普通用户=本人；管理员=this.auth.uid）
//   targetUid:      string  —— 被删用户 uid；admin.deleteUser 时 = 用户本人
//   markerId:       number|null
//   markerTitle:    string
//   checkedAt:      number(ms-epoch)|null
//   reason:         string  —— admin 输入；user 自删默认空
//   occurredAt:     number(ms-epoch)
//
// 写日志失败仅 console.log，绝不阻塞主流程（与 P3.4 计划文档一致）。

const ALLOWED_TYPES = new Set([
  'admin.deleteCheckinRecord',
  'admin.deleteUser',
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

function summarizeAuditLogs(rows) {
  const summary = {
    totalAdminDeletes: 0,
    totalUserDeletes: 0,
    totalAdminDeleteUser: 0
  }
  ;(rows || []).forEach(row => {
    if (!row) return
    if (row.type === 'admin.deleteCheckinRecord') summary.totalAdminDeletes += 1
    else if (row.type === 'user.deleteCheckin') summary.totalUserDeletes += 1
    else if (row.type === 'admin.deleteUser') summary.totalAdminDeleteUser += 1
  })
  return summary
}

module.exports = {
  ALLOWED_TYPES,
  buildAuditLogEntry,
  summarizeAuditLogs
}
