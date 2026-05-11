const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.join(__dirname, '..')

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

test('focus navigation prefers existing index page instead of unconditional reLaunch', () => {
  const store = read('stores/useMapStore.uts')
  assert.match(store, /export function returnToIndexForFocus\(\): void/)
  assert.match(store, /getCurrentPages\(\)/)
  assert.match(store, /uni\.navigateBack\(\{ delta: delta \}\)/)
  assert.match(store, /uni\.reLaunch\(\{ url: '\/pages\/index\/index' \}\)/)

  ;[
    'pages/my-checkins/my-checkins.uvue',
    'pages/route-detail/route-detail.uvue',
    'pages/tasks/tasks.uvue',
    'pages/task-detail/task-detail.uvue'
  ].forEach(relPath => {
    const source = read(relPath)
    assert.match(source, /returnToIndexForFocus\(\)/, relPath)
    assert.equal(source.includes("uni.reLaunch({ url: '/pages/index/index' })"), false, relPath)
  })
})

test('app launch does not run a second marker sync before index page owns sync', () => {
  const source = read('App.uvue')
  assert.equal(source.includes('syncMarkers(userId)'), false)
})
