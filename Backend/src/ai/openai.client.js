import OpenAI from 'openai'

let client = null

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
