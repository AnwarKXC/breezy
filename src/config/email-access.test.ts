import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessModule, canPerformAction } from './access'
import { ACTIONS } from './actionPermissions'
import { PERMISSION_MODULES } from './permissions'

test('front desk can manage shared email without changing its connection settings', () => {
  assert.equal(canAccessModule('front_desk', PERMISSION_MODULES.EMAIL), true)
  assert.equal(canPerformAction('front_desk', ACTIONS.EMAIL_READ), true)
  assert.equal(canPerformAction('front_desk', ACTIONS.EMAIL_WRITE), true)
  assert.equal(canPerformAction('front_desk', ACTIONS.SETTINGS_WRITE), false)
})

test('administration roles retain mailbox and configuration access', () => {
  for (const role of ['admin', 'accountant'] as const) {
    assert.equal(canPerformAction(role, ACTIONS.EMAIL_WRITE), true)
    assert.equal(canPerformAction(role, ACTIONS.SETTINGS_WRITE), true)
  }
})
