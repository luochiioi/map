const assert = require('node:assert/strict')
const test = require('node:test')

const {
  validateTaskInput,
  buildTaskUpsertDoc,
  nextTaskId
} = require('./task-service')

test('validateTaskInput rejects missing id or name', () => {
  assert.throws(() => validateTaskInput({
    name: '任务',
    targetMarkerId: 1
  }), /任务 ID 不能为空/)

  assert.throws(() => validateTaskInput({
    id: 'task_new',
    name: ' ',
    targetMarkerId: 1
  }), /任务名称不能为空/)
})

test('validateTaskInput requires numeric targetMarkerId', () => {
  assert.throws(() => validateTaskInput({
    id: 'task_new',
    name: '任务',
    targetMarkerId: 'bad'
  }), /targetMarkerId 必须是正整数/)
})

test('buildTaskUpsertDoc trims fields and defaults status to active', () => {
  const doc = buildTaskUpsertDoc({
    id: ' task_new ',
    name: ' 新任务 ',
    description: ' 描述 ',
    targetMarkerId: '42',
    targetTitle: ' 目标点 ',
    reward: ' 30 积分 ',
    rewardKind: 'points',
    rewardPoints: '30'
  }, 'admin-1', 1700000000)

  assert.deepEqual(doc, {
    id: 'task_new',
    name: '新任务',
    description: '描述',
    targetMarkerId: 42,
    targetTitle: '目标点',
    reward: '30 积分',
    rewardKind: 'points',
    rewardPoints: 30,
    status: 'active',
    createdBy: 'admin-1',
    updatedAt: 1700000000
  })
})

test('buildTaskUpsertDoc validates reward kind and normalizes archived status', () => {
  const doc = buildTaskUpsertDoc({
    id: 'task_old',
    name: '旧任务',
    targetMarkerId: 1,
    rewardKind: 'none',
    reward: 'ignored',
    rewardPoints: 99,
    status: 'archived'
  }, 'admin-1', 1700000000)

  assert.equal(doc.rewardKind, 'none')
  assert.equal(doc.reward, '')
  assert.equal(doc.rewardPoints, 0)
  assert.equal(doc.status, 'archived')
})

test('nextTaskId generates the next sequential task id', () => {
  assert.equal(nextTaskId([
    { id: 'task_001' },
    { id: 'task_009' },
    { id: 'task_010' },
    { id: 'legacy_task' }
  ]), 'task_011')
  assert.equal(nextTaskId([]), 'task_001')
})

test('buildTaskUpsertDoc generates id when creating a task without one', () => {
  const doc = buildTaskUpsertDoc({
    name: '自动编号任务',
    targetMarkerId: 8,
    rewardKind: 'points',
    rewardPoints: 20
  }, 'admin-1', 1700000000, [
    { id: 'task_001' },
    { id: 'task_006' }
  ])

  assert.equal(doc.id, 'task_007')
  assert.equal(doc.name, '自动编号任务')
})
