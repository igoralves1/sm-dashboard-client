<template>
  <div class="topbar-item">
    <BDropdown
      placement="bottom-end"
      :variant="null"
      no-caret
      toggle-class="topbar-link py-0 px-1"
      menu-class="dropdown-menu-lg p-0"
      offset="22"
    >
      <template #button-content>
        <Icon icon="lucide:bell" class="fs-xxl" />
        <BBadge class="badge-square text-bg-warning topbar-badge">14</BBadge>
      </template>

      <div class="px-3 py-2 border-bottom">
        <BRow class="align-items-center">
          <BCol>
            <h6 class="m-0 fs-md fw-semibold">{{ t('topbar.notifications_title') }}</h6>
          </BCol>
          <BCol class="text-end">
            <a href="#" class="badge text-bg-light badge-label py-1">{{ t('topbar.alerts_badge') }}</a>
          </BCol>
        </BRow>
      </div>

      <simplebar style="max-height: 300px" data-simplebar>
        <div
          v-for="notification in notifications"
          :id="notification.id"
          :key="notification.id"
          class="dropdown-item notification-item py-2 text-wrap"
        >
          <span class="d-flex gap-2">
            <span class="avatar-md flex-shrink-0">
              <span
                :class="`avatar-title bg-${notification.variant}-subtle text-${notification.variant} rounded fs-22`"
              >
                <Icon :icon="notification.icon" :class="`fs-xl fill-${notification.variant}`" />
              </span>
            </span>
            <span class="flex-grow-1 text-muted">
              <span class="fw-medium text-body">{{ t(notification.messageKey) }}</span>
              <br />
              <span class="fs-xs">{{ t(notification.timestampKey) }}</span>
            </span>
            <BButton variant="link" type="button" class="flex-shrink-0 text-muted p-0">
              <Icon icon="tabler:xbox-x-filled" class="fs-xxl" />
            </BButton>
          </span>
        </div>
      </simplebar>

      <BDropdownItem
        class="text-center text-reset text-decoration-underline link-offset-2 fw-bold notify-item border-top border-light py-2"
      >
        {{ t('topbar.view_all_alerts') }}
      </BDropdownItem>
    </BDropdown>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import simplebar from 'simplebar-vue'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

type NotificationType = {
  id: string
  icon: string
  variant: 'danger' | 'warning' | 'success' | 'primary' | 'info' | 'secondary'
  messageKey: string
  timestampKey: string
}

const notifications: NotificationType[] = [
  { id: 'notification-1',  icon: 'lucide:server-crash',    variant: 'danger',    messageKey: 'topbar.notif_server_crash', timestampKey: 'topbar.ts_30min' },
  { id: 'notification-2',  icon: 'lucide:alert-triangle',  variant: 'warning',   messageKey: 'topbar.notif_memory',       timestampKey: 'topbar.ts_10min' },
  { id: 'notification-3',  icon: 'lucide:check-circle',    variant: 'success',   messageKey: 'topbar.notif_backup',       timestampKey: 'topbar.ts_1h' },
  { id: 'notification-4',  icon: 'lucide:user-plus',       variant: 'primary',   messageKey: 'topbar.notif_new_user',     timestampKey: 'topbar.ts_just_now' },
  { id: 'notification-5',  icon: 'lucide:bug',             variant: 'danger',    messageKey: 'topbar.notif_bug',          timestampKey: 'topbar.ts_20min' },
  { id: 'notification-6',  icon: 'lucide:message-circle',  variant: 'info',      messageKey: 'topbar.notif_comment',      timestampKey: 'topbar.ts_15min' },
  { id: 'notification-7',  icon: 'lucide:battery-warning', variant: 'warning',   messageKey: 'topbar.notif_battery',      timestampKey: 'topbar.ts_45min' },
  { id: 'notification-8',  icon: 'lucide:cloud-upload',    variant: 'success',   messageKey: 'topbar.notif_upload',       timestampKey: 'topbar.ts_1h' },
  { id: 'notification-9',  icon: 'lucide:calendar',        variant: 'primary',   messageKey: 'topbar.notif_meeting',      timestampKey: 'topbar.ts_2h' },
  { id: 'notification-10', icon: 'lucide:download',        variant: 'secondary', messageKey: 'topbar.notif_report',       timestampKey: 'topbar.ts_3h' },
  { id: 'notification-11', icon: 'lucide:lock',            variant: 'danger',    messageKey: 'topbar.notif_login_fail',   timestampKey: 'topbar.ts_5h' },
  { id: 'notification-12', icon: 'lucide:bell-ring',       variant: 'info',      messageKey: 'topbar.notif_timesheet',    timestampKey: 'topbar.ts_today_9am' },
  { id: 'notification-13', icon: 'lucide:database-zap',    variant: 'warning',   messageKey: 'topbar.notif_database',     timestampKey: 'topbar.ts_yesterday' },
  { id: 'notification-14', icon: 'lucide:check-square',    variant: 'success',   messageKey: 'topbar.notif_system_check', timestampKey: 'topbar.ts_2days' },
]
</script>
