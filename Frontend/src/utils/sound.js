let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  return audioCtx
}

/**
 * A short two-note chime, synthesized on the fly (no audio file to fetch or
 * ship) — used as the "Kaelah answered" cue. Browsers suspend AudioContext
 * until a user gesture has happened on the page; resume() is a no-op once
 * it's already running, so this stays safe to call from anywhere.
 */
export function playNotificationSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const notes = [{ freq: 880, start: 0 }, { freq: 1318.5, start: 0.09 }]
  for (const { freq, start } of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t0 = ctx.currentTime + start
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.12, t0 + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.3)
  }
}
