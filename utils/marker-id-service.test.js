const assert = require('node:assert/strict')
const test = require('node:test')

const { normalizeMarkerId } = require('./marker-id-service')

test('normalizeMarkerId accepts numeric and string marker ids', () => {
  assert.equal(normalizeMarkerId(1710000000000), 1710000000000)
  assert.equal(normalizeMarkerId('1710000000000'), 1710000000000)
  assert.equal(normalizeMarkerId(' 1710000000000 '), 1710000000000)
})

test('normalizeMarkerId rejects empty, invalid and non-finite ids', () => {
  assert.equal(normalizeMarkerId(''), null)
  assert.equal(normalizeMarkerId('abc'), null)
  assert.equal(normalizeMarkerId('123abc'), null)
  assert.equal(normalizeMarkerId(Number.NaN), null)
  assert.equal(normalizeMarkerId(null), null)
})
