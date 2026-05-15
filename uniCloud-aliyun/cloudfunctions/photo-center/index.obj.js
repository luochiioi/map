const authUtil = require('auth-util')

// P9-1: 打卡照片上传功能已移除。photo-center 现在只服务"修改资料页"的
// 头像上传（profile-edit.uvue）。deletePhoto / delete / photo-service.js
// （检查点照片命名空间校验）已随打卡照片功能一并删除。
module.exports = {
  _before: async function() {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
  },

  async upload(data) {
    const { fileContent, fileName } = data
    if (!fileContent) return { errCode: -1, errMsg: '缺少文件内容' }

    const result = await uniCloud.uploadFile({
      cloudPath: `avatars/${this.auth.uid}/${Date.now()}_${fileName || 'avatar.jpg'}`,
      fileContent: Buffer.from(fileContent, 'base64')
    })
    return {
      errCode: 0,
      data: {
        fileID: result.fileID,
        cloudURL: result.fileID
      }
    }
  }
}
