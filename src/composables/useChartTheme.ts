import { computed, type Ref } from 'vue'

export type ChartTheme = 'dark' | 'light'

export interface ChartColors {
  // Backgrounds
  headerBg:    string
  tooltipBg:   string
  cardBg:      string
  // Borders
  headerBorder:  string
  tooltipBorder: string
  cardBorder:    string
  dividerBorder: string
  // Text
  title:       string
  legendText:  string
  axisText:    string
  axisLabel:   string
  ttTime:      string
  ttLabel:     string
  ttValue:     string
  ttStats:     string
  // D3 structural lines
  axisLine:    string
  grid:        string
  crosshair:   string
  // Data / signal
  dataLine:    string
  median:      string
  currentHour: string
  // Box plot
  boxFill:     string
  whisker:     string
  breakMask:   string
  breakSlash:  string
  // Misc
  spcToggle:   string
  spcBorder:   string
  modelText:   string
  modelBg:     string
  alertText:   string
}

const DARK: ChartColors = {
  headerBg:      '#0d1018',
  tooltipBg:     '#1f2430',
  cardBg:        '#13161c',
  headerBorder:  '#252525',
  tooltipBorder: '#3a3f55',
  cardBorder:    '#2a3040',
  dividerBorder: '#2e2e2e',
  title:         '#d0d0d0',
  legendText:    '#888',
  axisText:      '#888',
  axisLabel:     '#666',
  ttTime:        '#aaa',
  ttLabel:       '#ccc',
  ttValue:       '#ffffff',
  ttStats:       '#8ab4d4',
  axisLine:      '#444',
  grid:          '#2a2a2a',
  crosshair:     '#555',
  dataLine:      '#4a90d9',
  median:        '#fade2a',
  currentHour:   '#fade2a',
  boxFill:       '#1a3055',
  whisker:       '#555',
  breakMask:     '#0d1018',
  breakSlash:    '#666',
  spcToggle:     '#3a4a6a',
  spcBorder:     '#1a1d26',
  modelText:     '#777',
  modelBg:       '#13151a',
  alertText:     '#aaa',
}

const LIGHT: ChartColors = {
  headerBg:      '#ffffff',
  tooltipBg:     '#ffffff',
  cardBg:        '#ffffff',
  headerBorder:  '#dce6f0',
  tooltipBorder: '#dce6f0',
  cardBorder:    '#dce6f0',
  dividerBorder: '#dce6f0',
  title:         '#102a83',
  legendText:    '#5a6e94',
  axisText:      '#6a7a9a',
  axisLabel:     '#8a9ab8',
  ttTime:        '#7a8fb5',
  ttLabel:       '#4a5572',
  ttValue:       '#102a83',
  ttStats:       '#5a8abd',
  axisLine:      '#c8d8e8',
  grid:          '#e4eaf4',
  crosshair:     '#9ab0cc',
  dataLine:      '#3a7abf',
  median:        '#c07a00',
  currentHour:   '#009ee0',
  boxFill:       '#e0ecff',
  whisker:       '#8a9ab8',
  breakMask:     '#ffffff',
  breakSlash:    '#b0c0d8',
  spcToggle:     '#8a9ab8',
  spcBorder:     '#dce6f0',
  modelText:     '#5a6e94',
  modelBg:       '#f5f8fc',
  alertText:     '#4a5572',
}

export function useChartTheme(theme: Ref<ChartTheme | undefined> | (() => ChartTheme | undefined)) {
  const getter = typeof theme === 'function' ? theme : () => theme.value
  return computed<ChartColors>(() => getter() === 'light' ? LIGHT : DARK)
}
