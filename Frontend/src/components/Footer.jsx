import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import KaelahLogo from './KaelahLogo'

const COLUMN_TARGETS = {
  product: ['/#features', '/#pricing', '/#solutions'],
  company: ['/about', '/blog', '/contact'],
  legal: ['/privacy', '/terms', '/legal'],
}

export default function Footer() {
  const { t } = useTranslation()

  const footerColumns = ['product', 'company', 'legal'].map((key) => ({
    key,
    title: t(`landing.footer.columns.${key}.title`),
    links: t(`landing.footer.columns.${key}.links`, { returnObjects: true }),
  }))

  return (
    <footer className="border-t border-border py-16 px-6">
      <div className="max-w-[1280px] mx-auto flex justify-between gap-12 flex-wrap">
        <div className="max-w-[300px]">
          <Link to="/" className="focus-ring flex items-center gap-2 mb-3 rounded-lg w-fit">
            <KaelahLogo size={32} />
            <span className="text-lg font-bold">{t('common.brand')}<span className="text-accent">{t('common.brandSuffix')}</span></span>
          </Link>
          <p className="text-sm text-on-muted">{t('landing.footer.tagline')}</p>
        </div>
        <div className="flex gap-12 flex-wrap">
          {footerColumns.map((col) => (
            <div key={col.key} className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-on-muted">{col.title}</span>
              {col.links.map((link, i) => (
                <Link key={link} to={COLUMN_TARGETS[col.key][i]} className="focus-ring rounded text-sm text-on-muted hover:text-on-surface transition-colors w-fit">{link}</Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto mt-12 pt-6 border-t border-border">
        <span className="text-sm text-on-muted">{t('landing.footer.copyright')}</span>
      </div>
    </footer>
  )
}
