import { useTranslation } from 'react-i18next'
import Navbar from './Navbar'
import Footer from './Footer'
import Reveal from './Reveal'

export default function LegalPageLayout({ namespace }) {
  const { t } = useTranslation()
  const sections = t(`legal.${namespace}.sections`, { returnObjects: true })
  const intro = t(`legal.${namespace}.intro`, { defaultValue: '' })

  return (
    <div className="overflow-x-hidden min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-24 px-6">
        <div className="max-w-[720px] mx-auto">
          <Reveal className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t(`legal.${namespace}.title`)}</h1>
            {intro && <p className="text-on-muted mt-3">{intro}</p>}
          </Reveal>
          <div className="flex flex-col gap-4">
            {sections.map((section, i) => (
              <Reveal key={section.heading} delay={i * 60}>
                <div className="card-base p-6">
                  <h2 className="text-base font-semibold mb-2">{section.heading}</h2>
                  <p className="text-sm leading-relaxed text-on-muted">{section.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
