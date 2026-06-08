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
  'Usuários': 'nav.users', 'Contatos': 'nav.contacts',
  'Funções': 'nav.roles', 'Permissões': 'nav.permissions',
  'Atividade': 'nav.activity', 'Alertas': 'nav.alerts',
  'Dashboard': 'nav.dashboard', 'Monitoramento': 'nav.monitoring',
  'Dashboards': 'nav.dashboard',
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
