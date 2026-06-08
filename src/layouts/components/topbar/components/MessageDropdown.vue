<template>
  <div class="topbar-item">
    <BDropdown
      placement="bottom-end"
      :variant="null"
      no-caret
      toggle-class="topbar-link py-0 px-1"
      menu-class="dropdown-menu-lg p-0 my-0"
      offset="22"
    >
      <template #button-content>
        <Icon icon="lucide:mails" class="fs-xxl" />
        <BBadge class="text-bg-success badge-circle topbar-badge">7</BBadge>
      </template>

      <div class="px-3 py-2 border-bottom">
        <BRow class="align-items-center">
          <BCol>
            <h6 class="m-0 fs-md fw-semibold">{{ t('topbar.messages_title') }}</h6>
          </BCol>
          <BCol class="text-end">
            <a href="#" class="badge badge-soft-success badge-label py-1">{{ t('topbar.notifications_count_badge') }}</a>
          </BCol>
        </BRow>
      </div>

      <simplebar style="max-height: 300px" data-simplebar>
        <div
          v-for="message in messages"
          :id="message.id"
          :key="message.id"
          :class="['notification-item py-2 text-wrap dropdown-item', { active: message.active }]"
        >
          <div class="d-flex gap-3">
            <template v-if="message.user.icon">
              <span class="avatar-md flex-shrink-0">
                <span :class="`avatar-title rounded-circle fs-22 ${message.user.bgClass}`">
                  <Icon :icon="message.user.icon" class="fs-22 fill-white" />
                </span>
              </span>
            </template>

            <template v-if="message.user.avatar">
              <span class="flex-shrink-0">
                <img
                  :src="message.user.avatar"
                  height="36"
                  width="36"
                  class="avatar-md rounded-circle"
                  alt="User Avatar"
                />
              </span>
            </template>

            <span class="flex-grow-1 text-muted">
              <span class="fw-medium text-body">{{ message.user.name }}</span>
              {{ t(message.actionKey) }}
              <span class="fw-medium text-body text-wrap">{{ message.context }}</span>
              <br />
              <span class="fs-xs">{{ t(message.timestampKey) }}</span>
            </span>

            <BButton variant="link" class="flex-shrink-0 text-muted p-0">
              <Icon icon="tabler:xbox-x-filled" class="fs-xxl" />
            </BButton>
          </div>
        </div>
      </simplebar>

      <BDropdownItem
        class="text-center text-reset text-decoration-underline link-offset-2 fw-bold notify-item border-top border-light"
      >
        {{ t('topbar.read_all_messages') }}
      </BDropdownItem>
    </BDropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import simplebar from 'simplebar-vue'
import { Icon } from '@iconify/vue'
import user1 from '@/assets/images/users/user-1.jpg'
import user2 from '@/assets/images/users/user-2.jpg'
import user4 from '@/assets/images/users/user-4.jpg'
import user5 from '@/assets/images/users/user-5.jpg'
import user6 from '@/assets/images/users/user-6.jpg'

const { t } = useI18n()

type MessageItemType = {
  id: string
  user: {
    name: string
    avatar?: string
    icon?: string
    bgClass?: string
  }
  actionKey: string
  context: string
  timestampKey: string
  active?: boolean
}

const messages: MessageItemType[] = [
  {
    id: 'message-1',
    user: { name: 'Liam Carter', avatar: user1 },
    actionKey: 'topbar.msg_uploaded',
    context: 'Project Phoenix',
    timestampKey: 'topbar.ts_5min',
    active: true,
  },
  {
    id: 'message-2',
    user: { name: 'Ava Mitchell', avatar: user2 },
    actionKey: 'topbar.msg_commented',
    context: 'Marketing Campaign Q3',
    timestampKey: 'topbar.ts_12min',
  },
  {
    id: 'message-3',
    user: { name: 'Noah Blake', icon: 'lucide:shield-check', bgClass: 'text-bg-info' },
    actionKey: 'topbar.msg_updated_status',
    context: 'Client Onboarding',
    timestampKey: 'topbar.ts_30min',
  },
  {
    id: 'message-4',
    user: { name: 'Sophia Taylor', avatar: user4 },
    actionKey: 'topbar.msg_sent_invoice',
    context: 'Service Renewal',
    timestampKey: 'topbar.ts_1h',
  },
  {
    id: 'message-5',
    user: { name: 'Ethan Moore', avatar: user5 },
    actionKey: 'topbar.msg_completed_task',
    context: 'UI Review',
    timestampKey: 'topbar.ts_2h',
  },
  {
    id: 'message-6',
    user: { name: 'Olivia White', avatar: user6 },
    actionKey: 'topbar.msg_assigned_task',
    context: 'Sales Pipeline',
    timestampKey: 'topbar.ts_yesterday',
  },
]
</script>
