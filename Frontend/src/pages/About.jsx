import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, ArrowRight } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import Reveal from '../components/Reveal'

export default function About() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="overflow-x-hidden min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-24 px-6">
        <div className="max-w-[720px] mx-auto">
          <Reveal className="text-center mb-14">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('about.title')}</h1>
            <p className="text-on-muted mt-3">{t('about.subtitle')}</p>
          </Reveal>

          <Reveal>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-ai flex items-center justify-center text-white ai-glow flex-shrink-0"><Sparkles size={24} /></div>
              <div>
                <p className="font-semibold">FANASINA Michael</p>
                <p className="text-sm text-on-muted">{t('about.founderRole')}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="card-base p-7 mb-6">
              <h2 className="text-lg font-semibold mb-3">{t('about.storyHeading')}</h2>
              <p className="text-[15px] leading-relaxed text-on-muted">{t('about.story')}</p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="card-base p-7 mb-10">
              <h2 className="text-lg font-semibold mb-3">{t('about.missionHeading')}</h2>
              <p className="text-[15px] leading-relaxed text-on-muted">{t('about.mission')}</p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="glass ai-glow text-center py-12 px-8 rounded-[2rem]">
              <h2 className="text-xl font-semibold">{t('about.ctaTitle')}</h2>
              <Button variant="ai" size="lg" className="mt-6" onClick={() => navigate('/contact')}>{t('about.ctaButton')} <ArrowRight size={16} /></Button>
            </div>
          </Reveal>
        </div>
      </main>
      <Footer />
    </div>
  )
}
