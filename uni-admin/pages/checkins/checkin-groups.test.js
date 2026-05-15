const assert = require('node:assert/strict')
const test = require('node:test')

async function loadModule() {
  return import('./checkin-groups.mjs')
}

test('normalizeCheckinGroups groups legacy flat records by marker', async () => {
  const { normalizeCheckinGroups } = await loadModule()
  const groups = normalizeCheckinGroups([
    { markerDocId: 'm1', markerId: 1, markerTitle: '北京交通大学', userId: 'u1', userName: '阿丽', checkedAt: 100 },
    { markerDocId: 'm1', markerId: 1, markerTitle: '北京交通大学', userId: 'u2', checkedAt: 300 },
    { markerDocId: 'm2', markerId: 2, markerTitle: '澳门大三巴', userId: 'u3', checkedAt: 200 }
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0].markerTitle, '北京交通大学')
  assert.equal(groups[0].recordCount, 2)
  assert.deepEqual(groups[0].records.map(item => item.userId), ['u2', 'u1'])
  assert.equal(groups[0].records[1].userName, '阿丽')
})

test('normalizeCheckinGroups preserves grouped records and sorts nested records', async () => {
  const { normalizeCheckinGroups } = await loadModule()
  const groups = normalizeCheckinGroups([
    {
      markerDocId: 'm1',
      markerId: 1,
      markerTitle: '北京交通大学',
      recordCount: 2,
      latestCheckedAt: 100,
      records: [
        { markerDocId: 'm1', markerId: 1, markerTitle: '北京交通大学', userId: 'u1', checkedAt: 100 },
        { markerDocId: 'm1', markerId: 1, markerTitle: '北京交通大学', userId: 'u2', checkedAt: 300 }
      ]
    }
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].recordCount, 2)
  assert.equal(groups[0].latestCheckedAt, 100)
  assert.deepEqual(groups[0].records.map(item => item.userId), ['u2', 'u1'])
})

test('mergeCheckinGroups combines groups split across paged responses', async () => {
  const { mergeCheckinGroups, normalizeCheckinGroups } = await loadModule()
  const firstPage = normalizeCheckinGroups([
    { markerDocId: 'm1', markerId: 1, markerTitle: '北京交通大学', userId: 'u1', checkedAt: 100 }
  ])
  const secondPage = normalizeCheckinGroups([
    { markerDocId: 'm1', markerId: 1, markerTitle: '北京交通大学', userId: 'u2', checkedAt: 300 }
  ])

  const merged = mergeCheckinGroups(firstPage, secondPage)

  assert.equal(merged.length, 1)
  assert.equal(merged[0].recordCount, 2)
  assert.deepEqual(merged[0].records.map(item => item.userId), ['u2', 'u1'])
})
