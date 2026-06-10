import type { EChartsOption } from "echarts"
import type { ActivityItem, DiscussionMessage, ProjectStat, QuarterlyReport, StatCard, TimelineEvent } from "./types"
import { generateRandomEChartData } from "@/helpers/generators"
import { getColor } from "@/helpers/chart"

import user1 from '@/assets/images/users/user-1.jpg'
import user10 from '@/assets/images/users/user-10.jpg'
import user4 from '@/assets/images/users/user-4.jpg'
import user6 from '@/assets/images/users/user-6.jpg'
import user7 from '@/assets/images/users/user-7.jpg'
import user8 from '@/assets/images/users/user-8.jpg'
import user9 from '@/assets/images/users/user-9.jpg'

export function getStatCards(t: (k: string, p?: any) => string): StatCard[] {
  return [
    {
      id: 1,
      title: t('dashboard.active_sensors_card'),
      value: 2847,
      badgeText: t('dashboard.new_badge', { n: 12 }),
      badgeVariant: 'primary',
      icon: 'tabler:cpu',
      pointColor: 'primary',
      description: t('dashboard.total_sensors'),
      total: '3.200',
    },
    {
      id: 2,
      title: t('dashboard.alerts_card'),
      value: 38,
      badgeText: t('dashboard.new_badge', { n: 5 }),
      badgeVariant: 'secondary',
      icon: 'tabler:bell-ringing',
      pointColor: 'secondary',
      description: t('dashboard.total_alerts'),
      total: '1.240',
    },
    {
      id: 3,
      title: t('dashboard.water_consumption'),
      value: 847,
      suffix: t('dashboard.water_unit'),
      badgeText: '-3.2%',
      badgeVariant: 'light',
      icon: 'tabler:droplet',
      pointColor: 'primary',
      description: t('dashboard.monthly_total'),
      total: `12.450 ${t('dashboard.water_unit')}`,
    },
    {
      id: 4,
      title: t('dashboard.energy_card'),
      value: 1847,
      suffix: t('dashboard.energy_unit'),
      badgeText: '+2.1%',
      badgeVariant: 'secondary',
      icon: 'tabler:bolt',
      pointColor: 'secondary',
      description: t('dashboard.monthly_total'),
      total: `48.200 ${t('dashboard.energy_unit')}`,
    },
    {
      id: 5,
      title: t('dashboard.connected_cities'),
      value: 14,
      badgeText: t('dashboard.new_badge', { n: 2 }),
      badgeVariant: 'primary',
      icon: 'tabler:building-community',
      pointColor: 'primary',
      description: t('dashboard.total_cities'),
      total: '18',
    },
  ]
}
/** @deprecated use getStatCards(t) */
export const statCards: StatCard[] = [] // kept for TS compatibility — overridden at runtime

export function getQuarterlyReports(t: (k: string) => string): QuarterlyReport[] {
  return [
    { id: 1, quarter: t('data.q1'), period: t('data.q1_period'), revenue: '12.400 m³', expense: '38.200 kWh', margin: '98,2%' },
    { id: 2, quarter: t('data.q2'), period: t('data.q2_period'), revenue: '11.800 m³', expense: '41.500 kWh', margin: '97,8%' },
    { id: 3, quarter: t('data.q3'), period: t('data.q3_period'), revenue: '13.200 m³', expense: '44.100 kWh', margin: '96,5%' },
    { id: 4, quarter: t('data.q4'), period: t('data.q4_period'), revenue: '10.900 m³', expense: '36.800 kWh', margin: '99,1%' },
  ]
}
/** @deprecated use getQuarterlyReports(t) */
export const quarterlyReports: QuarterlyReport[] = []

export function getProjectStats(t: (k: string) => string): ProjectStat[] {
  return [
    { id: 1, title: t('data.stations_operational'), count: '+ 2.340', percentage: 82.2, variant: 'secondary', showPercentage: true },
    { id: 2, title: t('data.in_maintenance'),       count: '+ 420',   percentage: 14.75, variant: 'info',      showPercentage: true },
    { id: 3, title: t('data.pending_alerts'),        count: '+ 87',    percentage: 3.05,  variant: 'secondary', showPercentage: true },
  ]
}
/** @deprecated use getProjectStats(t) */
export const projectStats: ProjectStat[] = []

export function getTimelineEvents(t: (k: string) => string): TimelineEvent[] {
  return [
    {
      id: 1, icon: 'tabler:droplet-filled', iconColor: 'primary',
      title: t('data.ev1_title'), time: t('data.ev1_time'), description: t('data.ev1_desc'),
      tag: t('data.tag_critical'), tagVariant: 'danger',
      userName: t('data.user_system'), userImage: user1, userLink: '/pages/profile', hasDivider: true,
    },
    {
      id: 2, icon: 'tabler:bolt', iconColor: 'warning',
      title: t('data.ev2_title'), time: t('data.ev2_time'), description: t('data.ev2_desc'),
      tag: t('data.tag_energy'), tagVariant: 'warning',
      userName: 'Sensor PTP-07', userImage: user6, userLink: '/pages/profile', hasDivider: true,
    },
    {
      id: 3, icon: 'tabler:settings-check', iconColor: 'success',
      title: t('data.ev3_title'), time: t('data.ev3_time'), description: t('data.ev3_desc'),
      tag: t('data.tag_maintenance'), tagVariant: 'success',
      userName: 'Carlos Souza', userImage: user9, userLink: '/pages/profile', hasDivider: true,
    },
    {
      id: 4, icon: 'tabler:building-community', iconColor: 'info',
      title: t('data.ev4_title'), time: t('data.ev4_time'), description: t('data.ev4_desc'),
      tag: t('data.tag_expansion'), tagVariant: 'info',
      userName: t('data.user_simemap_team'), userImage: user10, userLink: '/pages/profile', hasDivider: true,
    },
    {
      id: 5, icon: 'tabler:chart-bar', iconColor: 'primary',
      title: t('data.ev5_title'), time: t('data.ev5_time'), description: t('data.ev5_desc'),
      tag: t('data.tag_report'), tagVariant: 'secondary',
      userName: t('data.user_system'), userImage: user8, userLink: '/pages/profile', hasDivider: true,
    },
    {
      id: 6, icon: 'tabler:wifi', iconColor: 'success',
      title: t('data.ev6_title'), time: t('data.ev6_time'), description: t('data.ev6_desc'),
      tag: t('data.tag_connectivity'), tagVariant: 'primary',
      userName: t('data.user_network_monitor'), userImage: user7, userLink: '/pages/profile', hasDivider: false,
    },
  ]
}
/** @deprecated use getTimelineEvents(t) */
export const timelineEvents: TimelineEvent[] = []

export const discussionMessages: DiscussionMessage[] = [
  {
    id: 1,
    userName: 'Ana Lima',
    userImage: user8,
    timeAgo: '10 min atrás',
    message: 'Sensor RAP01 de Silvanópolis voltou ao nível normal. Ótimo!',
    hasAvatar: true,
  },
  {
    id: 2,
    userName: 'Daniel Neves',
    userInitials: 'DN',
    userInitialsColor: 'purple',
    timeAgo: '1h atrás',
    message: 'Aguardando confirmação do técnico de campo sobre a manutenção em Palmas.',
    hasAvatar: false,
  },
  {
    id: 3,
    userName: 'Marcos Oliveira',
    userImage: user10,
    timeAgo: '16h atrás',
    message: 'Excelente análise dos dados de consumo energético do trimestre!',
    hasAvatar: true,
  },
  {
    id: 4,
    userName: 'Beatriz Santos',
    userImage: user1,
    timeAgo: '20h atrás',
    message: 'Novo dashboard de qualidade da água está pronto para revisão.',
    hasAvatar: true,
  },
  {
    id: 5,
    userName: 'Ricardo Alves',
    userImage: user6,
    timeAgo: '2 dias atrás',
    message: 'Integração dos sensores IoT de Miranorte concluída com sucesso.',
    hasAvatar: true,
  },
]

export const activityItems: ActivityItem[] = [
  {
    id: 1,
    text: 'Nível RAP01 Silvanópolis: 97%',
    time: '09:30',
    badgeVariant: 'primary',
  },
  {
    id: 2,
    text: 'Fluxo PTP-07 Miranorte normalizado',
    time: '11:00',
    badgeVariant: 'info',
  },
  {
    id: 3,
    text: 'Relatório de consumo exportado',
    time: '13:15',
    badgeVariant: 'secondary',
  },
  {
    id: 4,
    text: 'Alerta de pressão — PTP-02',
    time: '15:40',
    badgeVariant: 'light',
    badgeText: 'dark',
  },
  {
    id: 5,
    text: 'Backup de dados concluído',
    time: '17:10',
    badgeVariant: 'warning',
    badgeText: 'light',
  },
]

export const getPieEchartOptions = (): EChartsOption => {
  const charityData = generateRandomEChartData(['Charity A', 'Charity B', 'Charity C'])
  return {
    tooltip: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['60%', '100%'],
        // @ts-expect-error hoverAnimation is a valid property
        hoverAnimation: false,
        label: { show: false },
        labelLine: { show: false },
        data: charityData.map((item, index) => ({
          value: item.value,
          itemStyle: {
            color: index === 0 ? getColor('primary') : index === 1 ? getColor('secondary') : '#bbcae14d',
          },
        })),
      },
    ],
  }
}

export const getRevenueChartOptions = (): EChartsOption => {
  const xLabels = Array.from({ length: 15 }, (_, i) => `Day ${i + 1}`)

  return {
    textStyle: { fontFamily: getComputedStyle(document.body).fontFamily },
    tooltip: {
      trigger: 'axis',
      padding: [5, 0],
      backgroundColor: getColor('secondary-bg'),
      borderColor: getColor('border-color'),
      textStyle: { color: getColor('light-text-emphasis') },
      borderWidth: 1,
      transitionDuration: 0.125,
      axisPointer: { type: 'none' },
      shadowBlur: 2,
      shadowColor: 'rgba(76, 76, 92, 0.15)',
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: getColor('secondary-color'), margin: 15 },
      splitLine: { show: false },
    },
    yAxis: {
      max: 1800,
      type: 'value',
      splitLine: { lineStyle: { color: '#676b891f', type: 'dashed' } },
      boundaryGap: [0, '100%'],
      axisLabel: {
        show: true,
        color: getColor('secondary-color'),
        margin: 15,
        formatter: function (value:any) {
          return '$' + value
        },
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Total Revenue',
        type: 'line',
        smooth: true,
        symbolSize: 2,
        itemStyle: {
          color: getColor('primary'),
          borderColor: getColor('primary'),
          borderWidth: 2,
        },
        areaStyle: {
          opacity: 0.2,
          color: getColor('primary'),
        },
        lineStyle: {
          color: getColor('primary'),
        },
        symbol: 'circle',
        stack: 'data',
        data: [45, 88, 120, 160, 210, 240, 350, 420, 380, 500, 640, 710, 890, 1150, 1200],
      },
      {
        name: 'Orders',
        type: 'line',
        smooth: true,
        symbolSize: 2,
        itemStyle: {
          color: getColor('secondary'),
          borderColor: getColor('secondary'),
          borderWidth: 2,
        },
        areaStyle: {
          opacity: 0.2,
          color: getColor('secondary'),
        },
        lineStyle: {
          color: getColor('secondary'),
        },
        symbol: 'circle',
        stack: 'data',
        data: [15, 30, 35, 50, 55, 75, 95, 120, 135, 160, 180, 210, 250, 390, 450],
      },
    ],
    grid: {
      right: 20,
      left: 5,
      bottom: 5,
      top: 8,
      containLabel: true,
    },
  }
}

export const getProgressChartOptions = (): EChartsOption => {
  return {
    tooltip: {
      trigger: 'item',
      padding: [8, 15],
      backgroundColor: getColor('secondary-bg'),
      borderColor: getColor('border-color'),
      textStyle: { color: getColor('light-text-emphasis') },
      borderWidth: 1,
      transitionDuration: 0.125,
      axisPointer: { type: 'none' },
      shadowBlur: 2,
      shadowColor: 'rgba(76, 76, 92, 0.15)',
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    },
    textStyle: {
      fontFamily: getComputedStyle(document.body).fontFamily,
    },
    series: [
      {
        name: 'Project Progress',
        type: 'pie',
        radius: [60, 100],
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 8,
        },
        label: {
          color: getColor('secondary-color'),
        },
        data: [
          { value: 97, name: 'Silvanópolis — Água', itemStyle: { color: getColor('primary') } },
          { value: 88, name: 'Miranorte — Água', itemStyle: { color: getColor('secondary') } },
          { value: 94, name: 'Palmas — Energia', itemStyle: { color: getColor('info') } },
          { value: 76, name: 'Gurupi — Energia', itemStyle: { color: getColor('success') } },
          { value: 82, name: 'Araguaína — Água', itemStyle: { color: getColor('light') } },
          { value: 91, name: 'Porto Nacional — IoT', itemStyle: { color: getColor('warning') } },
        ],
      },
    ],
  }
}
