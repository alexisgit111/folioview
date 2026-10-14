export interface DemoDocument {
  id: string
  title: string
  subtitle: string
  kind: 'Brochure' | 'Portfolio' | 'Presentation'
  url: string
  suggestedMode: 'flipbook' | 'single' | 'present'
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

/** Bundled, fictional sample documents. They ship with the app; nothing is fetched remotely. */
export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: 'harbourview',
    title: 'Harbourview Terrace',
    subtitle: '12-page property brochure · A4 portrait',
    kind: 'Brochure',
    url: `${base}/demo/harbourview-terrace-brochure.pdf`,
    suggestedMode: 'flipbook',
  },
  {
    id: 'portfolio',
    title: 'Studio Portfolio',
    subtitle: '8 pages · A4 landscape',
    kind: 'Portfolio',
    url: `${base}/demo/studio-portfolio.pdf`,
    suggestedMode: 'flipbook',
  },
  {
    id: 'deck',
    title: 'Vendor Meeting Deck',
    subtitle: '7 slides · 16:9',
    kind: 'Presentation',
    url: `${base}/demo/vendor-meeting-deck.pdf`,
    suggestedMode: 'present',
  },
]
