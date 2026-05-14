const db = uniCloud.database()
const uniId = require('uni-id-common')
const { buildProfileUpdate, needsUserDoc } = require('./profile-service')

async function checkIdExist(userName) {
  try {
    const result = await db.collection('uni-id-users')
      .where({ nickname: userName.trim() })
      .get()

    if (result.data.length > 0) {
      return {
        errCode: 'HAS_EXIST',
        errMsg: '名称已存在',
        data: result.data[0]
      }
    } else {
      return {
        errCode: 'NOT_EXIST',
        errMsg: '名称不存在',
        data: null
      }
    }
  } catch (e) {
    return {
      errCode: 'DATABASE_QUERY_FAILED',
      errMsg: '数据库查询错误',
      data: null
    }
  }
}

module.exports = {
  _before: function() {
  },

  async login(userName, userPassword) {
    if (userName === '' || userPassword === '') {
      return {
        errCode: 'PARAM_IS_NULL',
        errMsg: '账号或密码不能为空',
        data: null
      }
    }

    const isIdExist = await checkIdExist(userName)

    if (isIdExist.errCode === 'NOT_EXIST') {
      return {
        errCode: 'USERNAME_FAILED',
        errMsg: '用户名称错误',
        data: null
      }
    } else if (isIdExist.errCode === 'DATABASE_QUERY_FAILED') {
      return isIdExist
    }

    const resUserInfo = isIdExist.data

    if (resUserInfo.password === userPassword) {
      const uniIdIns = uniId.createInstance({ context: this })
      const tokenResult = await uniIdIns.createToken({ uid: resUserInfo._id })

      return {
        errCode: 0,
        errMsg: '登录成功',
        data: {
          token: tokenResult.token,
          tokenExpired: tokenResult.tokenExpired,
          userId: resUserInfo._id,
          accountId: resUserInfo.username,
          userName: resUserInfo.nickname
        }
      }
    } else {
      return {
        errCode: 'PASSWORD_ERROR',
        errMsg: '密码错误',
        data: null
      }
    }
  },

  async sign(userName, userPassword) {
    if (userName === '' || userPassword === '') {
      return {
        errCode: 'PARAM_IS_NULL',
        errMsg: '名称和密码都不能为空',
        data: null
      }
    }

    const isIdExist = await checkIdExist(userName)

    if (isIdExist.errCode === 'DATABASE_QUERY_FAILED') {
      return {
        errCode: 'DATABASE_QUERY_FAILED',
        errMsg: '数据库查询错误',
        data: null
      }
    } else if (isIdExist.errCode === 'HAS_EXIST') {
      return {
        errCode: 'HAS_EXIST',
        errMsg: '名称已存在',
        data: null
      }
    }

    try {
      const countUser = await db.collection('uni-id-users').count()
      const nextUserId = countUser.total + 1

      let userId
      if (nextUserId <= 999) {
        userId = '000_' + String(nextUserId).padStart(3, '0')
      } else {
        const nextUserIdHead = Math.floor(nextUserId / 1000)
        const nextUserIdTail = nextUserId % 1000
        userId = String(nextUserIdHead).padStart(3, '0') + '_' + String(nextUserIdTail).padStart(3, '0')
      }

      await db.collection('uni-id-users').add({
        username: userId.trim(),
        nickname: userName.trim(),
        password: userPassword.trim()
      })

      return {
        errCode: 0,
        errMsg: '注册成功',
        data: null
      }
    } catch (e) {
      return {
        errCode: 'FAILED_TO_WRITE_TO_DATABASE',
        errMsg: '数据库写入错误',
        data: null
      }
    }
  },

  async checkToken() {
    const token = this.getUniIdToken()
    if (!token) {
      return { errCode: -1, errMsg: 'Token 不存在' }
    }
    const uniIdIns = uniId.createInstance({ context: this })
    const payload = await uniIdIns.checkToken(token)
    if (payload.code === 0) {
      const userRes = await db.collection('uni-id-users').doc(payload.uid).get()
      const userInfo = userRes.data.length > 0 ? userRes.data[0] : null
      return {
        errCode: 0,
        errMsg: 'Token 有效',
        data: {
          uid: payload.uid,
          userId: payload.uid,
          accountId: userInfo != null ? userInfo.username : '',
          userName: userInfo != null ? userInfo.nickname : payload.uid
        }
      }
    }
    return { errCode: -1, errMsg: 'Token 已过期' }
  },

  // 用户资料更新:支持 nickname / avatar / password 三类字段独立或组合更新。
  // 密码字段需要旧密码校验,通过 profile-service 内的双因素逻辑判定。
  // 客户端 pages/profile-edit/profile-edit.uvue 调用。
  async updateProfile(payload) {
    if (!this.auth || !this.auth.uid) {
      return { errCode: 'NOT_LOGIN', errMsg: '未登录', data: null }
    }
    const uid = this.auth.uid

    let userDoc = null
    if (needsUserDoc(payload)) {
      try {
        const userRes = await db.collection('uni-id-users').doc(uid).get()
        userDoc = (userRes.data || [])[0] || null
      } catch (e) {
        return { errCode: 'DATABASE_QUERY_FAILED', errMsg: '数据库查询错误', data: null }
      }
    }

    const result = buildProfileUpdate(payload, userDoc)
    if (result.errCode !== 0) {
      return { errCode: result.errCode, errMsg: result.errMsg, data: null }
    }

    try {
      await db.collection('uni-id-users').doc(uid).update(result.update)
    } catch (e) {
      return { errCode: 'FAILED_TO_WRITE_TO_DATABASE', errMsg: '数据库写入错误', data: null }
    }
    return { errCode: 0, errMsg: '更新成功', data: { updated: Object.keys(result.update) } }
  }
}
