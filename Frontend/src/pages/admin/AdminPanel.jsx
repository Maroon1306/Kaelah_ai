import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Building2, Wallet, CreditCard, LogOut, KeyRound, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react'
import KaelahLogo from '../../components/KaelahLogo'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { adminApi } from '../../services/adminApi'
import SignupsChart from '../../components/admin/SignupsChart'
import PlanBreakdownChart from '../../components/admin/PlanBreakdownChart'

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="card-base p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${accent ? 'bg-gradient-ai-soft text-accent' : 'bg-gradient-ai-soft text-primary'}`}><Icon size={18} /></div>
        <span className="text-sm font-semibold text-on-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

function PasswordModal({ open, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminApi.changePassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Changer le mot de passe">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium">Mot de passe actuel</label>
          <input type="password" required className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium">Nouveau mot de passe</label>
          <input type="password" required minLength={8} className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        {error && <p className="flex items-center gap-1.5 text-sm text-error"><AlertCircle size={14} className="flex-shrink-0" />{error}</p>}
        {success && <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={14} className="flex-shrink-0" />Mot de passe mis à jour.</p>}
        <Button type="submit" variant="primary" className="w-full" loading={loading}>Mettre à jour</Button>
      </form>
    </Modal>
  )
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const { admin, logout } = useAdminAuth()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [feedback, setFeedback] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      adminApi.getStats().then(setStats),
      adminApi.getUsers().then(({ users }) => setUsers(users)),
      adminApi.getFeedback().then(({ feedback }) => setFeedback(feedback)),
      adminApi.getPayments().then(({ payments }) => setPayments(payments)).catch(() => setPayments([])),
    ]).finally(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <KaelahLogo size={24} />
          <span className="text-base font-bold tracking-tight">Kaelah<span className="text-accent">AI</span></span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-4 border border-border text-[11px] font-semibold text-on-muted uppercase tracking-wide">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-muted hidden sm:inline">{admin?.email}</span>
          <Button variant="secondary" size="sm" onClick={() => setPasswordModalOpen(true)}><KeyRound size={14} /> Mot de passe</Button>
          <Button variant="secondary" size="sm" onClick={handleLogout}><LogOut size={14} /> Déconnexion</Button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-6 flex flex-col gap-8">
        {loading ? (
          <p className="text-on-muted text-sm">Chargement…</p>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile icon={Users} label="Utilisateurs" value={stats?.totalUsers ?? 0} />
              <StatTile icon={Building2} label="Entreprises" value={stats?.totalCompanies ?? 0} />
              <StatTile icon={Wallet} label="MRR estimé" value={`${stats?.mrr ?? 0}€`} accent />
              <StatTile icon={CreditCard} label="Paiements récents" value={payments.length} accent />
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="card-base p-5 flex flex-col gap-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-on-muted uppercase tracking-wide">Inscriptions par semaine</h3>
                {stats?.signupsByWeek && <SignupsChart data={stats.signupsByWeek} />}
              </div>
              <div className="card-base p-5 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-on-muted uppercase tracking-wide">Répartition des plans</h3>
                {stats?.planBreakdown && <PlanBreakdownChart breakdown={stats.planBreakdown} />}
              </div>
            </div>

            {/* Users table */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Utilisateurs ({users.length})</h2>
              <div className="card-base overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-surface-3">
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Utilisateur</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Entreprise</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Plan</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Statut</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Inscrit le</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <p className="text-sm font-medium">{u.full_name}</p>
                            <p className="text-xs text-on-muted">{u.email}</p>
                          </td>
                          <td className="px-5 py-3.5 text-sm whitespace-nowrap">{u.company_name || '—'}</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-primary-dim text-primary text-[11px] font-semibold capitalize">{u.plan || '—'}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-on-muted whitespace-nowrap">{u.subscription_status || '—'}</td>
                          <td className="px-5 py-3.5 text-xs text-on-muted whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Payments table */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Paiements récents</h2>
              <div className="card-base overflow-hidden">
                {payments.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-on-muted">Aucun paiement pour le moment.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border bg-surface-3">
                          <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Entreprise</th>
                          <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Date</th>
                          <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Montant</th>
                          <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-5 py-3.5 text-sm whitespace-nowrap">{p.companyName}</td>
                            <td className="px-5 py-3.5 text-xs text-on-muted whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                            <td className="px-5 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.amount} {p.currency?.toUpperCase()}</td>
                            <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded-full bg-success-dim text-success text-[11px] font-semibold">{p.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Feedback */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><MessageSquare size={18} className="text-on-muted" /> Retours utilisateurs ({feedback.length})</h2>
              <div className="card-base divide-y divide-border overflow-hidden">
                {feedback.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-on-muted">Aucun retour pour le moment.</p>
                ) : (
                  feedback.map((f) => (
                    <div key={f.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-sm font-medium">{f.full_name || f.email || 'Anonyme'}{f.company_name ? ` · ${f.company_name}` : ''}</span>
                        <span className="text-xs text-on-dim flex-shrink-0">{new Date(f.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-on-muted">{f.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <PasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  )
}
