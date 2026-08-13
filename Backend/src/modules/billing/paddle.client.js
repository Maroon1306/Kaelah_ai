import { Paddle, Environment } from '@paddle/paddle-node-sdk'

let paddleClient = null

export function getPaddle() {
  if (!process.env.PADDLE_API_KEY) return null
  if (!paddleClient) {
    paddleClient = new Paddle(process.env.PADDLE_API_KEY, {
      environment: process.env.PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox,
    })
  }
  return paddleClient
}
