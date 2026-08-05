import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Reveal from '../components/Reveal'
import { blogPosts } from '../data/mockData'

export default function BlogPost() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const post = blogPosts.find((p) => p.slug === slug)

  if (!post) return <Navigate to="/blog" replace />

  const paragraphs = t(`mock.blog.${post.id}.content`, { returnObjects: true })

  return (
    <div className="overflow-x-hidden min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 pb-24 px-6">
        <div className="max-w-[720px] mx-auto">
          <Link to="/blog" className="focus-ring inline-flex items-center gap-1.5 text-sm text-on-muted hover:text-on-surface transition-colors mb-8 rounded">
            <ArrowLeft size={15} /> {t('blog.backToBlog')}
          </Link>
          <Reveal>
            <div className="flex items-center gap-4 text-xs text-on-muted mb-4">
              <span className="flex items-center gap-1.5"><Calendar size={13} /> {t(`mock.blog.${post.id}.date`)}</span>
              <span className="flex items-center gap-1.5"><Clock size={13} /> {t(`mock.blog.${post.id}.readTime`)}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">{t(`mock.blog.${post.id}.title`)}</h1>
            <div className="flex flex-col gap-5">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-[17px] leading-relaxed text-on-muted">{p}</p>
              ))}
            </div>
          </Reveal>
        </div>
      </main>
      <Footer />
    </div>
  )
}
