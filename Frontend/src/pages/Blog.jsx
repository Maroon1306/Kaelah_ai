import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Reveal from '../components/Reveal'
import { blogPosts } from '../data/mockData'

export default function Blog() {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-hidden min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-24 px-6">
        <div className="max-w-[1000px] mx-auto">
          <Reveal className="text-center max-w-[600px] mx-auto mb-14">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('blog.title')}</h1>
            <p className="text-on-muted mt-3">{t('blog.subtitle')}</p>
          </Reveal>

          <div className="flex flex-col gap-5">
            {blogPosts.map((post, i) => (
              <Reveal key={post.id} delay={i * 100}>
                <Link to={`/blog/${post.slug}`} className="focus-ring card-base card-hover flex flex-col gap-3 p-6 group">
                  <div className="flex items-center gap-4 text-xs text-on-muted">
                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {t(`mock.blog.${post.id}.date`)}</span>
                    <span className="flex items-center gap-1.5"><Clock size={13} /> {t(`mock.blog.${post.id}.readTime`)}</span>
                  </div>
                  <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">{t(`mock.blog.${post.id}.title`)}</h2>
                  <p className="text-sm text-on-muted">{t(`mock.blog.${post.id}.excerpt`)}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mt-1">{t('blog.readMore')} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
