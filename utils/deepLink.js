// Pure helpers for mapcheckin:// deep-link parsing and share-text composition.
// Tested by utils/deepLink.test.js (Node).

const ROUTE_DEEP_LINK_PREFIX = 'mapcheckin://route'

function parseRouteDeepLink(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  const start = text.indexOf('mapcheckin://route?')
  if (start < 0) return null

  const queryStart = start + 'mapcheckin://route?'.length
  let queryEnd = queryStart
  while (queryEnd < text.length && !/[\s<>]/.test(text[queryEnd])) {
    queryEnd++
  }
  const query = text.slice(queryStart, queryEnd)
  if (query.length === 0) return null

  const params = new Map()
  for (const part of query.split('&')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    params.set(part.slice(0, eq), part.slice(eq + 1))
  }

  const idStr = params.get('id')
  if (!idStr) return null
  const id = parseInt(idStr, 10)
  if (!Number.isFinite(id) || id <= 0) return null

  return { id, shareFrom: params.get('shareFrom') || '' }
}

function buildRouteShareLink(id, uid) {
  const num = typeof id === 'number' ? id : parseInt(id, 10)
  if (!Number.isFinite(num) || num <= 0) return ''
  const uidPart = uid && String(uid).length > 0 ? `&shareFrom=${String(uid)}` : ''
  return `mapcheckin://route?id=${num}${uidPart}`
}

function buildRouteShareText(name, routeId, uid) {
  if (typeof routeId !== 'number' || routeId <= 0) return ''
  const title = name && String(name).length > 0 ? String(name) : '这条路线'
  const link = buildRouteShareLink(routeId, uid)
  return `「${title}」邀请你打卡 — 复制链接到 App 打开\n${link}`
}

module.exports = {
  parseRouteDeepLink,
  buildRouteShareLink,
  buildRouteShareText,
  ROUTE_DEEP_LINK_PREFIX
}
