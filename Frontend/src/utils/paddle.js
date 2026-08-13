const SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js'

let scriptPromise = null
let initialized = false
let currentHandler = null

/** Registers the callback for the next Paddle.js events (checkout.completed, etc). */
export function setPaddleEventHandler(handler) {
  currentHandler = handler
}

function loadScript() {
  if (window.Paddle) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.onload = resolve
      script.onerror = () => reject(new Error('Impossible de charger Paddle.js.'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

/**
 * Loads Paddle.js and initializes it once with the environment/token the
 * backend hands back alongside the checkout config — safe to call on every
 * "change plan" click, it only does real work the first time.
 */
export async function getPaddle({ clientToken, environment }) {
  await loadScript()
  if (!initialized) {
    if (environment === 'sandbox') window.Paddle.Environment.set('sandbox')
    window.Paddle.Initialize({
      token: clientToken,
      eventCallback: (event) => currentHandler?.(event),
    })
    initialized = true
  }
  return window.Paddle
}
