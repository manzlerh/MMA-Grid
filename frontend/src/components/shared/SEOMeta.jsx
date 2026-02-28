import { Helmet } from 'react-helmet-async'

const SITE_TITLE = 'MMA Trivia'

/**
 * Renders document head meta for SEO and social sharing.
 * @param {{ title: string, description?: string, image?: string, url?: string }} props
 */
export default function SEOMeta({ title, description, image, url }) {
  const fullTitle = title ? `${title} | ${SITE_TITLE}` : SITE_TITLE
  const desc = description ?? 'Daily MMA trivia games: Grid and Connections puzzles. New challenges every day.'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const imageUrl = image ?? (origin ? `${origin}/MMA%20Grid%20Icon%202.svg` : '')
  const canonicalUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '')

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}
    </Helmet>
  )
}
