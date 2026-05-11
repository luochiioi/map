const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.join(__dirname, '..')

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

test('focus navigation uses explicit delta and does not introspect getCurrentPages', () => {
  const store = read('stores/useMapStore.uts')
  assert.match(store, /export function returnToIndexForFocus\(deltaToIndex: number\): void/)
  assert.equal(store.includes('getCurrentPages('), false)
  assert.equal(store.includes('as UTSJSONObject'), false)
  assert.equal(store.includes('page["route"]'), false)
  assert.match(store, /uni\.navigateBack\(\{ delta: deltaToIndex \}\)/)
  assert.match(store, /uni\.reLaunch\(\{ url: '\/pages\/index\/index' \}\)/)
})

test('focus navigation callers pass explicit delta', () => {
  const expectations = [
    { file: 'pages/my-checkins/my-checkins.uvue', delta: 1 },
    { file: 'pages/tasks/tasks.uvue', delta: 1 },
    { file: 'pages/task-detail/task-detail.uvue', delta: 2 },
    { file: 'pages/route-detail/route-detail.uvue', delta: 2 }
  ]
  for (const { file, delta } of expectations) {
    const source = read(file)
    const pattern = new RegExp(`returnToIndexForFocus\\(${delta}\\)`)
    assert.match(source, pattern, file)
    assert.equal(source.includes('returnToIndexForFocus()'), false, file)
    assert.equal(source.includes("uni.reLaunch({ url: '/pages/index/index' })"), false, file)
  }
})

test('app launch does not run a second marker sync before index page owns sync', () => {
  const source = read('App.uvue')
  assert.equal(source.includes('syncMarkers(userId)'), false)
})
