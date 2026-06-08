<template>
  <div class="sidenav-user">
    <div class="d-flex justify-content-between align-items-center">
      <div>
        <RouterLink to="" class="link-reset">
          <img :src="user2" alt="user-image" class="rounded-circle mb-2 avatar-md" />
          <span class="sidenav-user-name fw-bold">{{ auth.user?.email?.split('@')[0] || 'User' }}</span>
          <span class="fs-12 fw-semibold" data-lang="user-role">{{ t('nav.user_role') }}</span>
        </RouterLink>
      </div>

      <BDropdown
        :variant="null"
        no-caret
        placement="bottom-end"
        toggle-class="link-reset sidenav-user-set-icon border-0 p-0"
        offset="7"
      >
        <template #button-content>
          <Icon icon="tabler:settings" class="fs-24 align-middle ms-1" />
        </template>

        <template v-for="(item, idx) in userDropdownItems" :key="idx">
          <BDropdownHeader v-if="item.isHeader" class="noti-title">
            <h6 class="text-overflow m-0">{{ item.label }}</h6>
          </BDropdownHeader>

          <BDropdownDivider v-else-if="item.isDivider" />

          <button
            v-else-if="item.url === '#' && item.class?.includes('danger')"
            class="dropdown-item d-flex align-items-center"
            :class="item.class"
            @click="handleLogout"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="me-2 fs-17 align-middle" />
            <span class="align-middle">{{ item.label }}</span>
          </button>

          <RouterLink
            v-else
            :to="item.url ?? '#'"
            class="dropdown-item d-flex align-items-center"
            :class="item.class"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="me-2 fs-17 align-middle" />
            <span class="align-middle">{{ item.label }}</span>
          </RouterLink>
        </template>
      </BDropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import user2 from '@/assets/images/users/user-2.jpg'
import { getUserDropdownItems } from '@/layouts/components/data'
import { useAuthStore } from '@/stores/auth.ts'
import { useI18n } from 'vue-i18n'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

const userDropdownItems = computed(() => getUserDropdownItems(t))

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>
