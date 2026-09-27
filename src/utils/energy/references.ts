/**
 * Regulatory and standards references behind the diagnostic thresholds.
 *
 * Kept as data rather than prose so the panel can link them, and so a change
 * of regulation is a one-line edit here instead of a hunt through copy in four
 * locale files.
 */

export interface Reference {
  /** Short label shown inline on an indicator. */
  tag: string
  /** Full document name, as published. */
  name: string
  url: string
  /** Which indicators lean on this document. */
  covers: string[]
}

export const REFERENCES: Reference[] = [
  {
    tag: 'PRODIST M8',
    name: 'ANEEL — PRODIST Módulo 8: Qualidade da Energia Elétrica',
    url: 'https://www.gov.br/aneel/pt-br/centrais-de-conteudos/procedimentos-regulatorios/prodist',
    covers: ['voltage', 'harmonics'],
  },
  {
    tag: 'REN 1.000/2021',
    name: 'ANEEL — Resolução Normativa nº 1.000, de 7 de dezembro de 2021',
    url: 'https://www2.aneel.gov.br/cedoc/ren20211000.html',
    covers: ['powerFactor'],
  },
  {
    tag: 'IEEE C57.91',
    name: 'IEEE C57.91 — Guide for Loading Mineral-Oil-Immersed Transformers and Step-Voltage Regulators',
    url: 'https://standards.ieee.org/ieee/C57.91/7163/',
    covers: ['thermal', 'loading'],
  },
  {
    tag: 'IEEE 1159',
    name: 'IEEE 1159 — Recommended Practice for Monitoring Electric Power Quality',
    url: 'https://standards.ieee.org/ieee/1159/7573/',
    covers: ['unbalance'],
  },
]

/** References backing one indicator. */
export function referencesFor(key: string): Reference[] {
  return REFERENCES.filter((r) => r.covers.includes(key))
}

/**
 * Where the "Industry 5.0" framing comes from.
 *
 * The term is a European Commission policy construct, not a marketing label:
 * the 2021 DG Research and Innovation report defines it as *complementing*
 * Industry 4.0 — keeping the IoT and AI foundation, but adding three pillars
 * that pure efficiency optimisation leaves out.
 */
export interface Industry5Source {
  name: string
  publisher: string
  year: string
  url: string
}

export const INDUSTRY5_SOURCES: Industry5Source[] = [
  {
    name: 'Industry 5.0 — Towards a sustainable, human-centric and resilient European industry',
    publisher: 'European Commission, DG Research and Innovation (Breque, De Nul, Petridis)',
    year: '2021',
    url: 'https://research-and-innovation.ec.europa.eu/knowledge-publications-tools-and-data/publications/all-publications/industry-50-towards-sustainable-human-centric-and-resilient-european-industry_en',
  },
  {
    name: 'Industry 5.0 — publication record',
    publisher: 'Publications Office of the European Union',
    year: '2021',
    url: 'https://op.europa.eu/en/publication-detail/-/publication/468a892a-5097-11eb-b59f-01aa75ed71a1/',
  },
  {
    name: 'Opinion on Industry 5.0 (CELEX 52024IE1285)',
    publisher: 'European Economic and Social Committee — EUR-Lex',
    year: '2024',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024IE1285',
  },
  {
    name: 'Similarities and differences between Industry 4.0 and 5.0',
    publisher: 'Journal of Innovation & Knowledge (Elsevier)',
    year: '2025',
    url: 'https://www.elsevier.es/en-revista-journal-innovation-knowledge-376-articulo-similarities-differences-between-industry-4-0-S2444569X25002665',
  },
  {
    name: 'LLM-based co-pilot for energy-efficient scheduling in Industry 5.0',
    publisher: 'Processes (MDPI)',
    year: '2026',
    url: 'https://www.mdpi.com/2227-9717/14/4/709',
  },
]

/** The three pillars, as the i18n keys that describe them. */
export const INDUSTRY5_PILLARS = ['human', 'sustainability', 'resilience'] as const
