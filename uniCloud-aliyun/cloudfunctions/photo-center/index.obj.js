const authUtil = require('auth-util')

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
      cloudPath: `checkin-photos/${this.auth.uid}/${Date.now()}_${fileName || 'photo.jpg'}`,
      fileContent: Buffer.from(fileContent, 'base64')
    })
    return {
      errCode: 0,
      data: {
        fileID: result.fileID,
        cloudURL: result.fileID
      }
    }
  },

  async delete(data) {
    const { fileID } = data
    if (!fileID) return { errCode: -1, errMsg: '缺少文件ID' }
    await uniCloud.deleteFile({ fileList: [fileID] })
    return { errCode: 0, errMsg: '删除成功' }
  }
}
