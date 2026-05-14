// whoami-service: 把"DB row → 客户端可见 profile"这一步抽成纯函数,
// 单元测试覆盖字段映射 / 空值 fallback / 缺失列保护。
// index.obj.js 负责 auth 校验 + DB 读取 + 调用此 builder。
// 设计原因(P7 引入):原 whoami 只返 uid,客户端无法在不再发一次 RPC
// 的情况下拿到 nickname/avatar。把"返回结构"抽出便于版本演化。

// 给空字符串作为兜底:UTS 客户端的 UserInfo.avatar 字段是 non-null string,
// 服务端绝不返回 null,避免 §47 (JSON.parse<T>() null 索引保护)层叠开销。
function buildWhoamiResponse(userDoc) {
  if (!userDoc) {
    return { errCode: 404, errMsg: '用户不存在', data: null }
  }
  return {
    errCode: 0,
    errMsg: '',
    data: {
      uid: String(userDoc._id || ''),
      nickname: String(userDoc.nickname || ''),
      avatar: String(userDoc.avatar || ''),
      accountId: String(userDoc.username || '')
    }
  }
}

module.exports = { buildWhoamiResponse }
