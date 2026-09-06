/**
 * What the person chose in the lobby before joining.
 *
 * Kept in its own module, deliberately free of any LiveKit import: the lobby
 * needs these helpers, and pulling them from `lib/livekit.ts` would drag the
 * whole LiveKit SDK into the main bundle instead of the lazily loaded
 * meeting-room chunk.
 */
export interface JoinPrefs {
  micOn: boolean
  cameraOn: boolean
}

const joinPrefsKey = (meetingId: string) => `intellimeet-join:${meetingId}`

/** Remember the lobby toggles so a refresh does not lose them. */
export function saveJoinPrefs(meetingId: string, prefs: JoinPrefs): void {
  try {
    sessionStorage.setItem(joinPrefsKey(meetingId), JSON.stringify(prefs))
  } catch {
    /* private mode or storage disabled - fall back to the safe default */
  }
}

/**
 * Read back the lobby choice.
 *
 * When there is nothing stored - someone opened the room URL directly, or
 * cleared their session - default to microphone AND camera OFF. Publishing
 * someone's camera because their in-memory state was lost is a privacy bug,
 * not a convenience. They can switch both on from the control bar.
 */
export function loadJoinPrefs(meetingId: string): JoinPrefs {
  try {
    const raw = sessionStorage.getItem(joinPrefsKey(meetingId))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<JoinPrefs>
      return { micOn: parsed.micOn === true, cameraOn: parsed.cameraOn === true }
    }
  } catch {
    /* fall through to the safe default */
  }
  return { micOn: false, cameraOn: false }
}
