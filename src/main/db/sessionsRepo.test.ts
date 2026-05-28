/**
 * Wave 0 test stubs for sessionsRepo.
 * These are pending (todo) stubs that Plans 02 and 03 will fill in with real tests.
 * The stubs define the test shapes expected by the sessions domain.
 */

import { describe, it } from 'vitest'
import { sessionsRepo } from './sessionsRepo'

// Silence unused import warning — the stubs reference sessionsRepo by name
void sessionsRepo

describe('sessionsRepo', () => {
  describe('create()', () => {
    it.todo('returns a session row with correct monotonic session_number (first session = 1)')
    it.todo('second session for same campaign gets session_number = 2')
    it.todo('session_number restarts at 1 for a different campaign')
    it.todo('creates session with location, goal, and contextNotes when provided')
    it.todo('creates session with null location when not provided')
  })

  describe('end()', () => {
    it.todo('sets ended_at to current timestamp')
    it.todo('throws if session not found')
  })

  describe('saveRecap()', () => {
    it.todo('persists aiRecap to the session row')
    it.todo('persists playerNotes when provided')
    it.todo('preserves existing playerNotes when playerNotes not provided')
    it.todo('throws if session not found')
  })

  describe('getLastNCompleted()', () => {
    it.todo('returns newest-N completed sessions in oldest-first (chronological) order')
    it.todo('excludes active (not ended) sessions')
    it.todo('limits to N sessions when more exist')
    it.todo('returns empty array when no completed sessions exist')
  })

  describe('getActiveByCampaignId()', () => {
    it.todo('returns the active session when one exists')
    it.todo('returns undefined when no active session exists')
    it.todo('returns undefined after the session is ended')
  })

  describe('getOlderThan()', () => {
    it.todo('returns only sessions with session_number < beforeSessionNumber')
    it.todo('excludes active sessions')
    it.todo('returns sessions in ascending session_number order')
  })

  describe('list()', () => {
    it.todo('returns all completed sessions in descending session_number order')
    it.todo('excludes active sessions')
  })

  describe('getLastLocation()', () => {
    it.todo('returns location from the most recent completed session')
    it.todo('returns null when no sessions are completed')
    it.todo('returns null when the last session has no location')
  })

  describe('endAllActive()', () => {
    it.todo('sets ended_at on all active sessions for the campaign')
    it.todo('does not affect sessions from other campaigns')
  })

  describe('markSummarized()', () => {
    it.todo('sets is_summarized = true on the session')
  })
})
