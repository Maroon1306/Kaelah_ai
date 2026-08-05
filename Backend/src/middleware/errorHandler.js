export function errorHandler(err, req, res, next) {
  console.error(err)
  const status = err.status || 500
  const message = status === 500 ? 'Erreur serveur.' : err.message
  res.status(status).json({ error: message })
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
