/**
 * Regulatory, standards and industry references behind the water-supply
 * diagnostic thresholds (Hidroforte page).
 *
 * Kept as data so the panels can link them and a change of regulation is a
 * one-line edit here. Every figure quoted in diagnostics.ts was checked against
 * the linked document (2026-09-29); `note` records the exact point relied on.
 */

import type { Reference } from '@/utils/energy/references'

export interface WaterReference extends Reference {
  /** What we take from this document — shown as a tooltip. */
  note: string
}

export const WATER_REFERENCES: WaterReference[] = [
  // ── Brazil: government / regulators / standards ──────────────────────────
  {
    tag: 'ABNT NBR 12217',
    name: 'ABNT NBR 12217:1994 — Projeto de reservatório de distribuição de água para abastecimento público',
    url: 'https://www.normas.com.br/visualizar/abnt-nbr-nm/5610/abnt-nbr12217-projeto-de-reservatorio-de-distribuicao-de-agua-para-abastecimento-publico-procedimento',
    covers: ['reserve'],
    note: 'Norma brasileira de projeto de reservatórios: volume útil entre os níveis máximo e mínimo para regularizar as variações diárias de consumo.',
  },
  {
    tag: 'REEC/UFG 2019',
    name: 'Silva & Borges (2019) — Análise do volume de reservação dos reservatórios do SAA (REEC/UFG), sobre PNB 594/77 e NBR 12217/94',
    url: 'https://files.cercomp.ufg.br/weby/up/140/o/AN%C3%81LISE_DO_VOLUME_DE_RESERVA%C3%87%C3%83O_DOS_SAA.pdf',
    covers: ['reserve', 'trend'],
    note: 'Critério clássico (ABNT PNB 594/77): reservação igual a 1/3 do dia de maior consumo, ou seja 8 h em adução contínua.',
  },
  {
    tag: 'Portaria 888/2021',
    name: 'Ministério da Saúde — Portaria GM/MS nº 888, de 4 de maio de 2021 (padrão de potabilidade)',
    url: 'https://bvsms.saude.gov.br/bvs/saudelegis/gm/2021/prt0888_07_05_2021.html',
    covers: ['turnover'],
    note: 'Art. 32: mínimo de 0,2 mg/L de cloro residual livre em toda a extensão do sistema de distribuição (reservatório e rede).',
  },
  {
    tag: 'ANA NR 9/2024',
    name: 'ANA — Resolução nº 211/2024, Norma de Referência nº 9/2024: indicadores operacionais de água e esgoto',
    url: 'https://www.gov.br/ana/pt-br/legislacao/resolucoes/resolucoes-regulatorias/2024/211',
    covers: ['continuity'],
    note: 'Indicador Nível I "Índice de intermitência do serviço de abastecimento de água" — garantia de não intermitência.',
  },
  {
    tag: 'SNIS IN071–IN074',
    name: 'Ministério das Cidades — SNIS, Glossário de Indicadores Água e Esgotos 2022',
    url: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis/produtos-do-snis/diagnosticos/Glossario_Indicadores_AE2022.pdf',
    covers: ['continuity'],
    note: 'IN071/IN072 (paralisações) e IN073/IN074 (intermitências): economias atingidas e duração média.',
  },
  {
    tag: 'Lei 14.026/2020',
    name: 'Lei nº 14.026/2020 — Novo Marco Legal do Saneamento Básico',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14026.htm',
    covers: ['continuity'],
    note: 'Regularidade e continuidade como princípios da prestação; base legal das normas de referência da ANA.',
  },

  // ── USA: federal / state regulators ──────────────────────────────────────
  {
    tag: 'EPA/AWWA 2002',
    name: 'US EPA / AWWA — Finished Water Storage Facilities (Distribution System White Paper, 2002)',
    url: 'https://www.epa.gov/sites/default/files/2015-09/documents/2007_05_18_disinfection_tcr_whitepaper_tcr_storage.pdf',
    covers: ['reserve', 'turnover', 'trend'],
    note: 'Porção inferior do reservatório = reserva de emergência; Tabela 2: Ohio EPA renovação diária ≥ 20 % (recomendado 25 %), Georgia EPD mínimo 30 % (meta 50 %), renovação completa em 3–5 dias.',
  },
  {
    tag: 'Ten States 2022',
    name: 'Great Lakes–Upper Mississippi River Board — Recommended Standards for Water Works, 2022 ("Ten States Standards")',
    url: 'https://files.dep.state.pa.us/Water/BSDW/Public_Water_Supply_Permits/2022_Recommended_Standards_for_Water_Works.pdf',
    covers: ['turnover', 'reserve', 'trend', 'telemetry'],
    note: '§7.1.6 e): tempo de renovação ≤ 5 dias; §7.4.3: controle de nível por telemetria, alarmes de extravasamento e de nível baixo.',
  },

  // ── Pumps: standards body + manufacturer ─────────────────────────────────
  {
    tag: 'ANSI/HI 9.6.3',
    name: 'Hydraulic Institute — ANSI/HI 9.6.3 Rotodynamic Pumps: Guideline for Operating Regions',
    url: 'https://www.pumps.org/product/ansi-hi-9-6-3-2017-rotodynamic-pumps-guideline-for-operating-regions/',
    covers: ['stability'],
    note: 'Região de operação preferencial (POR) tipicamente entre 70 % e 120 % da vazão no ponto de melhor eficiência (BEP).',
  },
  {
    tag: 'Grundfos',
    name: 'Grundfos — Industry Pump Handbook',
    url: 'https://www.grundfos.com/content/dam/global/page-assets/learn/research-and-insights/documents/engineering-manual-pump-handbook-2016-master-en.pdf',
    covers: ['stability'],
    note: 'Fabricante: ponto de trabalho dentro da zona de alta eficiência reduz consumo de energia, vibração e desgaste.',
  },

  // ── Statistics / reliability ─────────────────────────────────────────────
  {
    tag: 'NIST 6.3.2',
    name: 'NIST/SEMATECH e-Handbook of Statistical Methods — 6.3.2 Shewhart control charts',
    url: 'https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc321.htm',
    covers: ['stability', 'anomalies'],
    note: 'Limites de controle a ±3σ da média (k = 3) — padrão industrial para processo "sob controle".',
  },
  {
    tag: 'NIST 7.1.6',
    name: 'NIST/SEMATECH e-Handbook of Statistical Methods — 7.1.6 What are outliers in the data?',
    url: 'https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm',
    covers: ['anomalies'],
    note: 'Cercas internas Q1 − 1,5·IQR / Q3 + 1,5·IQR (outlier moderado) e externas a 3·IQR (outlier extremo).',
  },
  {
    tag: 'ISO 14224',
    name: 'ISO 14224:2016 — Collection and exchange of reliability and maintenance data for equipment',
    url: 'https://www.iso.org/standard/64076.html',
    covers: ['continuity'],
    note: 'Tempo em operação vs. tempo parado; disponibilidade = tempo em operação / (em operação + parado).',
  },
  {
    tag: 'IWA PIs',
    name: 'IWA — Performance Indicators for Water Supply Services, 3rd ed. (Alegre et al.)',
    url: 'https://iwaponline.com/ebooks/book/255/Performance-Indicators-for-Water-Supply-Services',
    covers: ['continuity', 'telemetry'],
    note: 'Sistema internacional de referência de indicadores de desempenho para prestadores de água.',
  },

  // ── Private operator practice ────────────────────────────────────────────
  {
    tag: 'Sabesp SCADA',
    name: 'Revista TAE — Sistemas SCADA, automação e telemetria na operação do abastecimento (caso Sabesp)',
    url: 'https://tratamentodeagua.com.br/artigo/automacao-telemetria-operacao-abastecimento/',
    covers: ['telemetry', 'reserve'],
    note: 'Operador privado: nível de reservatórios e bombeamento supervisionados em tempo real no CCO, com histórico e alarmes.',
  },
]

export function waterReferencesFor(kind: string): WaterReference[] {
  return WATER_REFERENCES.filter(r => r.covers.includes(kind))
}
