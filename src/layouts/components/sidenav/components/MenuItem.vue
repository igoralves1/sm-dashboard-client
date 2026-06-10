<template>
  <li v-if="item.url" class="side-nav-item" :class="{ active: isActive }">
    <RouterLink
      :to="item.url"
      class="side-nav-link"
      :class="{ disabled: item.isDisabled, 'special-menu': item.isSpecial, active: isActive }"
    >
      <span v-if="item.icon" class="menu-icon"><Icon :icon="item.icon" /></span>
      <span class="menu-text">{{ tLabel(item.label) }}</span>
      <span v-if="item.badge" :class="`badge text-bg-${item.badge.variant} opacity-50`">{{
        item.badge.text
      }}</span>
    </RouterLink>   
  </li>
</template>

<script setup lang="ts">
import type { MenuItemType } from '@/types/layout'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type PropsType = {
  item: MenuItemType
}

const props = defineProps<PropsType>()
const { t } = useI18n()

const NAV_MAP: Record<string, string> = {
  // Portuguese labels
  'Usuários': 'nav.users', 'Contatos': 'nav.contacts',
  'Funções': 'nav.roles', 'Permissões': 'nav.permissions',
  'Atividade': 'nav.activity', 'Alertas': 'nav.alerts',
  'Dashboard': 'nav.dashboard', 'Monitoramento': 'nav.monitoring',
  'Dashboards': 'nav.dashboards',
  'HF - Água': 'nav.hf_water',
  // English labels (shown when EN is active — pass-through but still mapped for symmetry)
  'Users': 'nav.users', 'Contacts': 'nav.contacts',
  'Roles': 'nav.roles', 'Permissions': 'nav.permissions',
  'Activity': 'nav.activity', 'Alerts': 'nav.alerts',
  'Monitoring': 'nav.monitoring',
  // App items
  'Landing Page': 'nav.landing_page',
  'Ecommerce': 'nav.ecommerce',
  'Email': 'nav.email',
  'Projects': 'nav.projects',
  'File Manager': 'nav.file_manager',
  'Chat': 'nav.chat',
  'Calendar': 'nav.calendar',
  'Invoice': 'nav.invoice',
  'Other Apps': 'nav.other_apps',
  // Custom pages
  'Pages': 'nav.pages',
  'Miscellaneous': 'nav.miscellaneous',
  'Authentication': 'nav.authentication',
  'Error Pages': 'nav.error_pages',
  // Layouts
  'Layout Options': 'nav.layout_options',
  'Sidebars': 'nav.sidebars',
  'Topbars': 'nav.topbars',
  // Components
  'Base UI': 'nav.base_ui',
  'Widgets': 'nav.widgets',
  'Metrics': 'nav.metrics',
  'Graphs': 'nav.graphs',
  'Forms': 'nav.forms',
  'Tables': 'nav.tables',
  'Icons': 'nav.icons',
  'Maps': 'nav.maps',
  // Menu items
  'Menu Levels': 'nav.menu_levels',
  'Disabled Menu': 'nav.disabled_menu',
}
function tLabel(label: string | undefined) {
  if (!label) return ''
  return NAV_MAP[label] ? t(NAV_MAP[label]) : label
}

const route = useRoute()
const pathname = computed(() => route.path)

const isActive = computed(() => {
  return props.item.url && pathname.value.endsWith(props.item.url)
})
</script>
