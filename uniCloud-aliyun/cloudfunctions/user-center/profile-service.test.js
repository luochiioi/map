const assert = require('node:assert/strict')
const test = require('node:test')

const { buildProfileUpdate, needsUserDoc } = require('./profile-service')

// ===== buildProfileUpdate: nickname =====

test('buildProfileUpdate writes trimmed nickname when non-empty', () => {
  const res = buildProfileUpdate({ nickname: '  小明  ' }, null)
  assert.equal(res.errCode, 0)
  assert.deepEqual(res.update, { nickname: '小明' })
})

test('buildProfileUpdate ignores whitespace-only nickname', () => {
  const res = buildProfileUpdate({ nickname: '    ' }, null)
  assert.equal(res.errCode, 'NOTHING_TO_UPDATE')
  assert.equal(res.update, null)
})

test('buildProfileUpdate ignores empty-string nickname', () => {
  const res = buildProfileUpdate({ nickname: '' }, null)
  assert.equal(res.errCode, 'NOTHING_TO_UPDATE')
})

// ===== buildProfileUpdate: avatar =====

test('buildProfileUpdate writes avatar cloudPath verbatim', () => {
  const res = buildProfileUpdate({ avatar: 'cloud://x/a.png' }, null)
  assert.equal(res.errCode, 0)
  assert.deepEqual(res.update, { avatar: 'cloud://x/a.png' })
})

test('buildProfileUpdate allows empty avatar (clear-avatar semantic)', () => {
  const res = buildProfileUpdate({ avatar: '' }, null)
  assert.equal(res.errCode, 0)
  assert.deepEqual(res.update, { avatar: '' })
})

test('buildProfileUpdate ignores non-string avatar (e.g. null)', () => {
  const res = buildProfileUpdate({ avatar: null }, null)
  assert.equal(res.errCode, 'NOTHING_TO_UPDATE')
})

// ===== buildProfileUpdate: password =====

test('buildProfileUpdate rejects short newPassword as no-op', () => {
  // 客户端先校验长度 >= 6;服务端再保险一道,短密码当作"未提供"
  const res = buildProfileUpdate({ oldPassword: 'pw123456', newPassword: 'abc' }, { password: 'pw123456' })
  assert.equal(res.errCode, 'NOTHING_TO_UPDATE')
})

test('buildProfileUpdate writes newPassword when old matches', () => {
  const res = buildProfileUpdate(
    { oldPassword: 'pw123456', newPassword: 'newpw123' },
    { password: 'pw123456' }
  )
  assert.equal(res.errCode, 0)
  assert.deepEqual(res.update, { password: 'newpw123' })
})

test('buildProfileUpdate returns OLD_PASSWORD_WRONG when old mismatches', () => {
  const res = buildProfileUpdate(
    { oldPassword: 'wrong', newPassword: 'newpw123' },
    { password: 'pw123456' }
  )
  assert.equal(res.errCode, 'OLD_PASSWORD_WRONG')
  assert.equal(res.update, null)
})

test('buildProfileUpdate returns USER_NOT_FOUND when password requested without user doc', () => {
  const res = buildProfileUpdate({ oldPassword: 'x', newPassword: 'newpw123' }, null)
  assert.equal(res.errCode, 'USER_NOT_FOUND')
  assert.equal(res.update, null)
})

// ===== buildProfileUpdate: combined =====

test('buildProfileUpdate writes both nickname and avatar in same call', () => {
  const res = buildProfileUpdate({ nickname: 'A', avatar: 'cloud://x' }, null)
  assert.equal(res.errCode, 0)
  assert.deepEqual(res.update, { nickname: 'A', avatar: 'cloud://x' })
})

test('buildProfileUpdate writes nickname+avatar+password together', () => {
  const res = buildProfileUpdate(
    { nickname: 'B', avatar: 'cloud://y', oldPassword: 'pw123456', newPassword: 'newpw123' },
    { password: 'pw123456' }
  )
  assert.equal(res.errCode, 0)
  assert.deepEqual(res.update, { nickname: 'B', avatar: 'cloud://y', password: 'newpw123' })
})

test('buildProfileUpdate empty payload returns NOTHING_TO_UPDATE', () => {
  const res = buildProfileUpdate({}, null)
  assert.equal(res.errCode, 'NOTHING_TO_UPDATE')
})

test('buildProfileUpdate null payload returns NOTHING_TO_UPDATE', () => {
  const res = buildProfileUpdate(null, null)
  assert.equal(res.errCode, 'NOTHING_TO_UPDATE')
})

// ===== needsUserDoc =====

test('needsUserDoc returns true only when valid newPassword present', () => {
  assert.equal(needsUserDoc({ newPassword: 'longenough' }), true)
  assert.equal(needsUserDoc({ newPassword: 'abc' }), false) // too short
  assert.equal(needsUserDoc({ nickname: 'x' }), false)
  assert.equal(needsUserDoc({}), false)
  assert.equal(needsUserDoc(null), false)
})
