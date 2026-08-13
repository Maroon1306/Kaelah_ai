import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { playNotificationSound } from '../utils/sound'

function mapMessage(row) {
  return {
    id: row.id,
    role: row.role,
    text: row.content,
    cards: row.metadata?.cards || [],
    actions: row.actions || row.metadata?.actions || [],
  }
}

export function useChat(conversationId) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [isThinking, setIsThinking] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!conversationId) { setMessages([]); return }
      setLoadError('')
      try {
        const { conversation } = await api.getConversation(conversationId)
        if (!cancelled) setMessages(conversation.messages.map(mapMessage))
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Conversation introuvable.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [conversationId])

  const sendMessage = useCallback(async (text) => {
    const userMsg = { id: `local-${Date.now()}`, role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setIsThinking(true)
    setPhase('thinking')
    const analyzingTimer = setTimeout(() => setPhase('analyzing'), 1000)

    try {
      const response = await api.sendMessage(text, conversationId)
      clearTimeout(analyzingTimer)
      setMessages((prev) => [...prev, mapMessage(response.message)])
      playNotificationSound()
      if (!conversationId) navigate(`/chat/${response.conversationId}`, { replace: true })
    } catch (err) {
      clearTimeout(analyzingTimer)
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', text: err.message || "Une erreur est survenue, réessayez.", cards: [], actions: [] }])
    } finally {
      setIsThinking(false)
      setPhase('idle')
    }
  }, [conversationId, navigate])

  return { messages, isThinking, phase, sendMessage, loadError }
}
