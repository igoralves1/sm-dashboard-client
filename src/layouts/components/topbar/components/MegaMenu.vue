<template>
  <div class="topbar-item d-none d-md-flex">
    <BDropdown
      :variant="null"
      no-caret
      toggle-class="topbar-link btn fw-medium btn-link"
      offset="16"
      menu-class="dropdown-menu-xxl p-0"
    >
      <template #button-content>
        prana AIIoT
        <Icon icon="tabler:chevron-down" class="ms-1" />
      </template>

      <simplebar class="h-100" style="max-height: 380px" data-simplebar>
        <BRow class="g-0">
          <BCol cols="12">
            <div class="p-3 text-center bg-light bg-opacity-50">
              <h4 class="mb-0 fs-lg fw-semibold">
                {{ t('megamenu.welcome_pre') }} <span class="text-primary">prana AIIoT</span> {{ t('megamenu.welcome_post') }}
              </h4>
            </div>
          </BCol>
        </BRow>
        <BRow class="g-0">
          <BCol v-for="(item, idx) in megaMenuItems" :key="idx" md="4">
            <div class="p-3">
              <h5 class="mb-2 fw-semibold fs-sm dropdown-header">{{ t(item.titleKey) }}</h5>
              <ul class="list-unstyled megamenu-list">
                <li v-for="link in item.links" :key="link.url">
                  <RouterLink :to="link.url" class="dropdown-item">{{ t(link.labelKey) }}</RouterLink>
                </li>
              </ul>
            </div>
          </BCol>
        </BRow>
      </simplebar>
    </BDropdown>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import simplebar from 'simplebar-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

type MegaMenuType = {
  titleKey: string
  links: { labelKey: string; url: string }[]
}

const megaMenuItems: MegaMenuType[] = [
  {
    titleKey: 'megamenu.dashboard_analytics',
    links: [
      { labelKey: 'megamenu.sales_dashboard', url: '#;' },
      { labelKey: 'megamenu.marketing_dashboard', url: '#;' },
      { labelKey: 'megamenu.finance_overview', url: '#;' },
      { labelKey: 'megamenu.user_analytics', url: '#;' },
      { labelKey: 'megamenu.traffic_insights', url: '#;' },
      { labelKey: 'megamenu.performance_metrics', url: '#;' },
      { labelKey: 'megamenu.conversion_tracking', url: '#;' },
    ],
  },
  {
    titleKey: 'megamenu.project_management',
    links: [
      { labelKey: 'megamenu.task_overview', url: '#;' },
      { labelKey: 'megamenu.kanban_board', url: '#;' },
      { labelKey: 'megamenu.gantt_chart', url: '#;' },
      { labelKey: 'megamenu.team_collaboration', url: '#;' },
      { labelKey: 'megamenu.project_milestones', url: '#;' },
      { labelKey: 'megamenu.workflow_automation', url: '#;' },
      { labelKey: 'megamenu.timesheets_reports', url: '#;' },
    ],
  },
  {
    titleKey: 'megamenu.user_management',
    links: [
      { labelKey: 'megamenu.user_profiles', url: '#;' },
      { labelKey: 'megamenu.access_control', url: '#;' },
      { labelKey: 'megamenu.role_permissions', url: '#;' },
      { labelKey: 'megamenu.activity_logs', url: '#;' },
      { labelKey: 'megamenu.security_settings', url: '#;' },
      { labelKey: 'megamenu.user_groups', url: '#;' },
      { labelKey: 'megamenu.authentication_login', url: '#;' },
    ],
  },
]
</script>
