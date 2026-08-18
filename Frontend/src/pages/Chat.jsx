import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, Paperclip, ChevronDown, X, Loader2 } from 'lucide-react'
import ChatMessage from '../components/ChatMessage'
import LoadingAI from '../components/LoadingAI'
import ContextPanel from '../components/ContextPanel'
import KaelahLogo from '../components/KaelahLogo'
import { suggestedPrompts } from '../data/mockData'
import { useChat } from '../hooks/useChat'
import { api } from '../services/api'

const ACCEPTED_FILES = '.pdf,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt'

export default function Chat() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const { messages, isThinking, phase, sendMessage } = useChat(conversationId)
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isThinking, phase])

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const { upload } = await api.uploadFile(file)
        setAttachments((prev) => [...prev, { id: upload.id, name: file.name, url: upload.file_url, type: upload.file_type }])
      }
    } catch {
      // Swallow — the attachment simply won't appear; the user can retry.
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id))

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return
    sendMessage(input.trim(), attachments)
    setInput('')
    setAttachments([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex-1 flex min-h-0 h-screen overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-16 md:pt-6 pb-6" ref={scrollRef}>
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 flex flex-col gap-6">
          {isEmpty && (
            <div className="text-center py-16 animate-fade-up">
              <div className="w-18 h-18 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-surface-2 border border-border ai-glow" style={{ width: '72px', height: '72px' }}>
                <KaelahLogo size={40} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{t('chat.emptyTitle')}</h1>
              <p className="text-lg text-on-muted mt-2">{t('chat.emptySubtitle')}</p>
              <div className="grid sm:grid-cols-2 gap-3 max-w-[600px] mx-auto mt-8">
                {suggestedPrompts.map((prompt) => (
                  <button key={prompt.id} className="focus-ring card-base card-hover flex items-center justify-between p-4 text-left" onClick={() => sendMessage(t(`mock.suggestedPrompts.${prompt.id}`))}>
                    <span className="text-sm font-medium">{t(`mock.suggestedPrompts.${prompt.id}`)}</span>
                    <ChevronDown size={16} className="text-on-muted -rotate-45" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}

          {isThinking && (
            <div className="flex gap-3 max-w-[800px] mx-auto w-full animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 ai-glow"><KaelahLogo size={20} /></div>
              <div className="flex-1 pt-1.5">
                {phase === 'thinking' && <LoadingAI variant="thinking" />}
                {phase === 'analyzing' && <LoadingAI variant="analyzing" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 sm:px-6 pb-5 pt-2 bg-gradient-to-t from-bg via-bg to-transparent">
        <div className="max-w-[800px] mx-auto flex flex-col gap-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 animate-fade-up">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-lg bg-surface-4 border border-border text-[13px]">
                  {a.type?.startsWith('image') ? (
                    <img src={a.url} alt={a.name} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                  ) : (
                    <Paperclip size={13} className="text-on-muted flex-shrink-0" />
                  )}
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <button className="focus-ring text-on-muted hover:text-on-surface flex-shrink-0" onClick={() => removeAttachment(a.id)} aria-label={t('common.close')}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="glass flex items-center gap-1 px-3 py-2 rounded-2xl border border-border-md transition-all focus-within:border-primary focus-within:shadow-glow-sm">
            <button className="focus-ring w-9 h-9 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors flex-shrink-0 disabled:opacity-60" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label={t('chat.attachFile')}>
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />
            <input type="text" className="flex-1 bg-transparent border-none outline-none text-on-surface text-[15px] py-2 px-1" placeholder={t('chat.inputPlaceholder')} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} />
            <button className={`focus-ring w-9 h-9 flex items-center justify-center rounded-lg transition-all flex-shrink-0 ${input.trim() || attachments.length > 0 ? 'bg-gradient-ai text-white ai-glow hover:scale-105' : 'bg-surface-6 text-on-muted'}`} onClick={handleSend} disabled={!input.trim() && attachments.length === 0} aria-label={t('chat.send')}><Send size={16} /></button>
          </div>
          <p className="text-center text-xs text-on-dim mt-1">{t('chat.disclaimer')}</p>
        </div>
      </div>
    </div>
    <ContextPanel />
    </div>
  )
}
