function SpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function isSpeechRecognitionAvailable() {
  return Boolean(SpeechRecognitionCtor())
}

/**
 * Browser speech-to-text. The world director only ever receives the
 * resulting string — never raw audio.
 */
export function createVoiceInput({ onResult, onError, onStart, onEnd } = {}) {
  const Ctor = SpeechRecognitionCtor()
  if (!Ctor) {
    return {
      available: false,
      start() {
        onError?.(new Error('Speech recognition is not available in this browser.'))
      },
      stop() {},
    }
  }

  const recognition = new Ctor()
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  recognition.continuous = false

  recognition.onstart = () => onStart?.()
  recognition.onend = () => onEnd?.()
  recognition.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') {
      onEnd?.()
      return
    }
    onError?.(new Error(event.error || 'Speech recognition failed.'))
  }
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim()
    if (transcript) {
      onResult?.(transcript)
    }
  }

  return {
    available: true,
    start() {
      try {
        recognition.start()
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Could not start the microphone.'))
      }
    },
    stop() {
      try {
        recognition.stop()
      } catch {
        // already stopped
      }
    },
  }
}
