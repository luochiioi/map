const assert = require('node:assert/strict')
const test = require('node:test')

const {
  parseRouteDeepLink,
  buildRouteShareText,
  buildRouteShareLink,
  ROUTE_DEEP_LINK_PREFIX
} = require('./deepLink')

test('parseRouteDeepLink extracts route id and shareFrom from a canonical link', () => {
  const parsed = parseRouteDeepLink('mapcheckin://route?id=42&shareFrom=u-9')
  assert.deepEqual(parsed, { id: 42, shareFrom: 'u-9' })
})

test('parseRouteDeepLink finds the link embedded in a share message', () => {
  const text = '「澳门遗迹漫步」邀请你打卡 — 复制链接到 App 打开\nmapcheckin://route?id=101&shareFrom=alice'
  const parsed = parseRouteDeepLink(text)
  assert.equal(parsed.id, 101)
  assert.equal(parsed.shareFrom, 'alice')
})

test('parseRouteDeepLink accepts query params in any order', () => {
  const parsed = parseRouteDeepLink('mapcheckin://route?shareFrom=bob&id=7')
  assert.deepEqual(parsed, { id: 7, shareFrom: 'bob' })
})

test('parseRouteDeepLink returns null for an id-less link', () => {
  assert.equal(parseRouteDeepLink('mapcheckin://route?shareFrom=alice'), null)
})

test('parseRouteDeepLink returns null for a non-route scheme', () => {
  assert.equal(parseRouteDeepLink('https://example.com/route?id=1'), null)
  assert.equal(parseRouteDeepLink('mapcheckin://marker?id=1'), null)
  assert.equal(parseRouteDeepLink(''), null)
  assert.equal(parseRouteDeepLink(null), null)
})

test('parseRouteDeepLink rejects non-integer or zero id', () => {
  assert.equal(parseRouteDeepLink('mapcheckin://route?id=abc&shareFrom=x'), null)
  assert.equal(parseRouteDeepLink('mapcheckin://route?id=0&shareFrom=x'), null)
  assert.equal(parseRouteDeepLink('mapcheckin://route?id=-3&shareFrom=x'), null)
})

test('parseRouteDeepLink works when shareFrom is absent', () => {
  const parsed = parseRouteDeepLink('mapcheckin://route?id=12')
  assert.deepEqual(parsed, { id: 12, shareFrom: '' })
})

test('buildRouteShareLink composes the canonical link from id + uid', () => {
  assert.equal(buildRouteShareLink(42, 'u-9'), 'mapcheckin://route?id=42&shareFrom=u-9')
  assert.equal(buildRouteShareLink(42, ''), 'mapcheckin://route?id=42')
})

test('buildRouteShareLink returns empty string on invalid id', () => {
  assert.equal(buildRouteShareLink(0, 'u-9'), '')
  assert.equal(buildRouteShareLink(-1, 'u-9'), '')
  assert.equal(buildRouteShareLink(null, 'u-9'), '')
  assert.equal(buildRouteShareLink('abc', 'u-9'), '')
})

test('buildRouteShareText wraps the link with the canonical message', () => {
  const text = buildRouteShareText('澳门遗迹漫步', 42, 'u-9')
  assert.match(text, /「澳门遗迹漫步」邀请你打卡/)
  assert.match(text, /复制链接到 App 打开/)
  assert.match(text, /mapcheckin:\/\/route\?id=42&shareFrom=u-9/)
})

test('buildRouteShareText falls back when name is empty', () => {
  const text = buildRouteShareText('', 42, 'u-9')
  assert.match(text, /「这条路线」邀请你打卡/)
})

test('buildRouteShareText returns empty when route id invalid', () => {
  assert.equal(buildRouteShareText('某路线', 0, 'u-9'), '')
})

test('ROUTE_DEEP_LINK_PREFIX is the canonical mapcheckin route prefix', () => {
  assert.equal(ROUTE_DEEP_LINK_PREFIX, 'mapcheckin://route')
})
