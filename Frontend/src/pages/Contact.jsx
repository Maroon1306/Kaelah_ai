import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Send, CheckCircle2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import Reveal from '../components/Reveal'

export default function Contact() {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle')

  const handleSubmit = (e) => {
    e.preventDefault()
    setStatus('sending')
    setTimeout(() => setStatus('sent'), 900)
  }

  return (
    <div className="overflow-x-hidden min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-24 px-6">
        <div className="max-w-[1000px] mx-auto">
          <Reveal className="text-center max-w-[600px] mx-auto mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('contact.title')}</h1>
            <p className="text-on-muted mt-3">{t('contact.subtitle')}</p>
          </Reveal>

          <div className="grid md:grid-cols-[1fr_320px] gap-6">
            <Reveal>
              <div className="card-base p-7">
                {status === 'sent' ? (
                  <div className="flex flex-col items-center text-center py-10 gap-3 animate-fade-in">
                    <div className="icon-tile text-success w-14 h-14 rounded-2xl flex items-center justify-center"><CheckCircle2 size={28} /></div>
                    <p className="text-on-surface font-medium max-w-sm">{t('contact.form.success')}</p>
                  </div>
                ) : (
                  <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium">{t('contact.form.name')}</label>
                        <input type="text" placeholder={t('contact.form.namePlaceholder')} required className="input-field" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium">{t('contact.form.email')}</label>
                        <input type="email" placeholder={t('contact.form.emailPlaceholder')} required className="input-field" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium">{t('contact.form.subject')}</label>
                      <input type="text" placeholder={t('contact.form.subjectPlaceholder')} required className="input-field" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium">{t('contact.form.message')}</label>
                      <textarea placeholder={t('contact.form.messagePlaceholder')} required rows={5} className="input-field resize-none" />
                    </div>
                    <Button type="submit" variant="ai" size="lg" className="w-fit" loading={status === 'sending'}>
                      {status === 'sending' ? t('contact.form.sending') : <>{t('contact.form.submit')} <Send size={16} /></>}
                    </Button>
                  </form>
                )}
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="card-base p-6 flex flex-col gap-3 h-fit">
                <h3 className="text-sm font-semibold">{t('contact.directHeading')}</h3>
                <a href={`mailto:${t('contact.directEmail')}`} className="focus-ring flex items-center gap-2.5 p-3 rounded-lg bg-surface-3 border border-border text-sm text-on-surface hover:bg-surface-4 transition-colors">
                  <Mail size={16} className="text-primary flex-shrink-0" /> <span className="truncate">{t('contact.directEmail')}</span>
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
