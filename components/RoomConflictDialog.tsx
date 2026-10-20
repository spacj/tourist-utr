'use client'
import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useI18n } from '@/hooks/useI18n'
import { apiPost } from '@/lib/apiFetch'
import { fmt } from '@/lib/i18n/fmt'

/** `existing` from a 409 already_in_room reply of /api/rooms/create|join. */
export interface ExistingRoom {
  roomId: string
  code: string
  state?: 'lobby' | 'racing' | 'finished'
  huntTitle?: string
}

export function existingRoomFrom(data: unknown): ExistingRoom | null {
  const e = (data as { existing?: Partial<ExistingRoom> } | null)?.existing
  if (!e || typeof e.roomId !== 'string' || typeof e.code !== 'string') return null
  return { roomId: e.roomId, code: e.code, state: e.state, huntTitle: e.huntTitle }
}

/**
 * "You're already in room X" — offers to go back to that room, or leave it
 * (forfeiting if it's racing) and carry on with `onContinue` (which retries
 * the original create/join with force:true).
 */
export function RoomConflictDialog({
  existing, onContinue, onClose,
}: {
  existing: ExistingRoom | null
  onContinue: () => Promise<void> | void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  if (!existing) return null
  const racing = existing.state === 'racing'

  const leaveAndContinue = async () => {
    if (busy) return
    setBusy(true)
    try {
      // Best effort: the forced retry overwrites the pointer either way.
      await apiPost(racing ? '/api/rooms/abandon' : '/api/rooms/leave', { roomId: existing.roomId }).catch(() => {})
      await onContinue()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} dismissible={!busy} title={fmt(t('alreadyInRoomTitle'), { code: existing.code })}>
      <p className="confirm-body">
        {racing ? t('alreadyInRoomRacingBody') : t('alreadyInRoomLobbyBody')}
      </p>
      <div className="confirm-actions flow-stack-actions">
        <a href={`/multiplayer/${existing.code}`} className="btn-secondary flow-btn">{t('goToMyRoom')}</a>
        <button type="button" className={racing ? 'btn-danger' : 'btn-primary'} onClick={leaveAndContinue} disabled={busy} aria-busy={busy}>
          {busy ? '…' : (racing ? t('forfeitAndContinue') : t('leaveAndContinue'))}
        </button>
      </div>
    </Modal>
  )
}
