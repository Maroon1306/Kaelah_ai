import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react'
import Button from '../../components/Button'
import KaelahLogo from '../../components/KaelahLogo'
import { useAdminAuth } from '../../context/AdminAuthContext'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) navigate('/admin/adminpanel', { replace: true })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/admin/adminpanel', { replace: true })
    } catch (err) {
      setError(err.message || 'Connexion impossible.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center p-4 relative bg-bg">
      <div className="fixed -top-[10%] -left-[10%] w-[45%] h-[45%] bg-gradient-radial-primary rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-[10%] -right-[10%] w-[35%] h-[35%] bg-gradient-radial-accent rounded-full blur-3xl pointer-events-none" />

      <main className="w-full max-w-[400px] relative z-10">
        <div className="glass ai-glow rounded-2xl p-7">
          <div className="flex items-center gap-2 mb-2">
            <KaelahLogo size={26} />
            <span className="text-[15px] font-bold tracking-tight">Kaelah<span className="text-accent">AI</span></span>
          </div>
          <div className="flex items-center gap-2 mb-6 text-on-muted">
            <ShieldCheck size={14} />
            <span className="text-xs font-semibold uppercase tracking-wider">Administration</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-dim" />
                <input type="email" required autoFocus className="input-field pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@kaelah-ai.com" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-dim" />
                <input type="password" required className="input-field pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-error-dim text-error text-[13px]">
                <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="ai" className="w-full mt-1" loading={loading}>Se connecter</Button>
          </form>
        </div>
      </main>
    </div>
  )
}
