// profile-service: 用户 profile 字段更新策略的纯逻辑层。
// index.obj.js.updateProfile() 拉 db row 后调用 buildProfileUpdate(),
// 用返回的 update map 决定写库。把"哪些字段允许更新 / 旧密码校验"
// 抽出便于单测,避免业务规则散落在 RPC 入口。
//
// 设计要点(P7):
// - nickname: 必须 trim 非空才进 update;"   " 当作手抖忽略
// - avatar: 允许空串(表示用户主动清除头像)
// - password: 双因素 —— newPassword 长度 ≥ 6 且 oldPassword === user.password
//   才生效。短密码当无操作处理(plan 已确认:客户端先校验)
// - 空更新返 NOTHING_TO_UPDATE 防止 db.update({}) 触发 uniCloud 报错

function buildProfileUpdate(payload, user) {
  const safe = payload || {}
  const update = {}

  if (typeof safe.nickname === 'string' && safe.nickname.trim().length > 0) {
    update.nickname = safe.nickname.trim()
  }

  // avatar 显式 typeof string 即允许写入(包括空串清除头像)
  if (typeof safe.avatar === 'string') {
    update.avatar = safe.avatar
  }

  if (typeof safe.newPassword === 'string' && safe.newPassword.length >= 6) {
    if (!user) {
      return { errCode: 'USER_NOT_FOUND', errMsg: '用户不存在', update: null }
    }
    if (user.password !== safe.oldPassword) {
      return { errCode: 'OLD_PASSWORD_WRONG', errMsg: '旧密码错误', update: null }
    }
    update.password = safe.newPassword
  }

  if (Object.keys(update).length === 0) {
    return { errCode: 'NOTHING_TO_UPDATE', errMsg: '没有可更新内容', update: null }
  }

  return { errCode: 0, errMsg: '', update }
}

// 客户端需要预先知道"这次调用是否需要服务端读取 user 表"。
// 提取成 helper 让 index.obj.js 跳过无密码改动场景的 DB 读。
function needsUserDoc(payload) {
  const safe = payload || {}
  return typeof safe.newPassword === 'string' && safe.newPassword.length >= 6
}

module.exports = { buildProfileUpdate, needsUserDoc }
