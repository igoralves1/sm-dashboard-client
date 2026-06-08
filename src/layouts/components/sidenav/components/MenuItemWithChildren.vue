<template>
  <li class="side-nav-item" :class="{ active: isOpen }">
    <button class="side-nav-link" :aria-expanded="isOpen" @click="toggleOpen">
      <span v-if="item.icon" class="menu-icon"><Icon :icon="item.icon" /></span>
      <span class="menu-text" data-lang="dashboards">{{ tLabel(item.label) }}</span>
      <span v-if="item.badge" :class="`badge bg-${item.badge.variant}`">{{ item.badge.text }}</span>
      <span v-else class="menu-arrow"><Icon icon="tabler:chevron-down" /></span>
    </button>
    <BCollapse v-model="isOpen">
      <ul class="sub-menu">
        <template v-for="(child, idx) in item.children">
          <MenuItemWithChildren
            v-if="child.children"
            :key="child.key"
            :item="child"
            :level="(level ?? 0) + 1"
          />
          <MenuItem v-else :key="idx" :item="child" />
        </template>
      </ul>
    </BCollapse>
  </li>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

import type { MenuItemType } from '@/types/layout'
import MenuItem from '@/layouts/components/sidenav/components/MenuItem.vue'
import { useRoute } from 'vue-router'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

type PropsType = {
  item: MenuItemType
  openMenuKey?: string | null
  setOpenMenuKey?: (key: string | null) => void
  level?: number
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
  // English labels
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
const isTopLevel = computed(() => (props.level ?? 0) === 0)

const isActive = computed(() => {
  const isChildActive = (children: MenuItemType[]): boolean =>
    children.some(
      (child) =>
        (child.url && pathname.value.includes(child.url)) ||
        (child.children && isChildActive(child.children)),
    )
  return isChildActive(props.item.children || [])
})

const isOpen = computed(() => {
  return isTopLevel.value ? props.openMenuKey === props.item.key : localOpen.value
})

const localOpen = ref(false)
const didAutoOpen = ref(false)

watchEffect(() => {
  if (isActive.value && !didAutoOpen.value) {
    if (isTopLevel.value && props.setOpenMenuKey) {
      props.setOpenMenuKey(props.item.key)
    } else {
      localOpen.value = true
    }
    didAutoOpen.value = true
  }
})

const toggleOpen = () => {
  if (isTopLevel.value && props.setOpenMenuKey) {
    props.setOpenMenuKey(isOpen.value ? null : props.item.key)
  } else {
    localOpen.value = !localOpen.value
  }
}
</script>
