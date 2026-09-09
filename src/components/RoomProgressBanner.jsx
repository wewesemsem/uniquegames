import { useWorldState } from '../world/WorldState.js'

/**
 * Persistent badge while later rooms (2–3) are still painting in the background.
 */
export function RoomProgressBanner() {
  const world = useWorldState()
  const pending = world.pendingRooms ?? []
  const ready = world.readyRoomCount ?? 0
  const total = world.totalRoomCount ?? 0
  const show =
    pending.length > 0 && (world.status === 'generating' || world.status === 'loading' || world.status === 'processing')

  if (!show) return null

  const names = pending.map((room) => room.name).join(', ')
  const progressLabel = total > 0 ? `${ready}/${total} rooms ready` : null

  return (
    <div className="room-progress-banner" role="status" aria-live="polite">
      <span className="room-progress-spinner" aria-hidden="true" />
      <div className="room-progress-copy">
        <strong>
          {pending.length === 1 ? 'Still painting 1 room' : `Still painting ${pending.length} rooms`}
        </strong>
        <span>
          {names}
          {progressLabel ? ` · ${progressLabel}` : ''}
        </span>
      </div>
    </div>
  )
}
