const assert = require('node:assert/strict')
const test = require('node:test')

const { buildWhoamiResponse } = require('./whoami-service')

test('buildWhoamiResponse maps full doc to client envelope', () => {
  const doc = {
    _id: 'u123',
    nickname: '小明',
    avatar: 'cloud://path/avatar.png',
    username: '001_042'
  }
  assert.deepEqual(buildWhoamiResponse(doc), {
    errCode: 0,
    errMsg: '',
    data: {
      uid: 'u123',
      nickname: '小明',
      avatar: 'cloud://path/avatar.png',
      accountId: '001_042'
    }
  })
})

test('buildWhoamiResponse fills empty string for missing optional fields', () => {
  const doc = { _id: 'u123' }
  const res = buildWhoamiResponse(doc)
  assert.equal(res.errCode, 0)
  assert.equal(res.data.uid, 'u123')
  assert.equal(res.data.nickname, '')
  assert.equal(res.data.avatar, '')
  assert.equal(res.data.accountId, '')
})

test('buildWhoamiResponse returns 404 envelope when doc is null', () => {
  const res = buildWhoamiResponse(null)
  assert.equal(res.errCode, 404)
  assert.equal(res.data, null)
})

test('buildWhoamiResponse returns 404 envelope when doc is undefined', () => {
  const res = buildWhoamiResponse(undefined)
  assert.equal(res.errCode, 404)
  assert.equal(res.data, null)
})

test('buildWhoamiResponse coerces non-string _id (defensive)', () => {
  const doc = { _id: 12345, nickname: 'x' }
  const res = buildWhoamiResponse(doc)
  assert.equal(res.data.uid, '12345')
  assert.equal(typeof res.data.uid, 'string')
})

test('buildWhoamiResponse treats null fields like missing', () => {
  const doc = { _id: 'u1', nickname: null, avatar: null, username: null }
  const res = buildWhoamiResponse(doc)
  assert.equal(res.data.nickname, '')
  assert.equal(res.data.avatar, '')
  assert.equal(res.data.accountId, '')
})
