/**
 * Wave 0 test stubs for the sessions tRPC router.
 * The sessions router does not exist yet — it will be created in Plan 04-02.
 * These stubs define the test shapes for the session start/end/recap procedures.
 */

import { describe, it } from 'vitest'

describe('sessions tRPC router', () => {
  describe('sessions.start', () => {
    it.todo('creates a session row in the DB with correct campaign_id and session_number')
    it.todo('sets the active session in sessionActiveMap for the campaign')
    it.todo('returns the created session row')
    it.todo('fails if a session is already active for the campaign')
  })

  describe('sessions.end', () => {
    it.todo('sets ended_at on the session row')
    it.todo('clears the active session from sessionActiveMap')
    it.todo('returns the updated session row')
    it.todo('fails if no session is active for the campaign')
  })

  describe('sessions.saveRecap', () => {
    it.todo('persists aiRecap and playerNotes to the session row')
    it.todo('returns the updated session row')
  })

  describe('sessions.updatePlayerNotes', () => {
    it.todo('updates playerNotes on a completed session')
    it.todo('returns the updated session row')
  })

  describe('sessions.list', () => {
    it.todo('returns all completed sessions for a campaign in descending order')
  })
})
