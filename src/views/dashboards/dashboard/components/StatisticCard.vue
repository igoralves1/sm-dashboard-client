<template>
    <BCard no-body>
        <BCardBody>
            <RouterLink to="#" class="text-muted float-end mt-n1 fs-xl">
                <Icon icon="tabler:external-link" />
            </RouterLink>
            <h5 :title="item.title">{{ item.title }}<span v-if="item.suffix" class="text-muted fw-normal ms-1 fs-xs">({{ item.suffix }})</span></h5>
            <div class="d-flex align-items-center gap-2 my-3">
                <div class="avatar-md flex-shrink-0">
                    <span class="avatar-title text-bg-light rounded-circle fs-22">
                        <Icon :icon="item.icon" />
                    </span>
                </div>
                <h3 class="mb-0 text-nowrap stat-value">
                    <CountUp :end-val="item.value"
                        :options="{ prefix: item.prefix || '', enableScrollSpy: true, scrollSpyOnce: true }" />
                </h3>
                <span class="fw-medium ms-2 fs-xs ms-auto text-nowrap" :class="[
                    item.badgeVariant === 'light'
                        ? 'text-bg-light'
                        : `badge-soft-${item.badgeVariant}`,
                    'badge',
                ]">
                    {{ item.badgeText }}
                </span>
            </div>
            <p class="mb-0 d-flex align-items-center">
                <span class="bullet-dot me-1" :class="`bullet-${item.pointColor}`"></span>
                <span class="text-nowrap text-muted">{{ item.description }}</span>
                <span class="float-end ms-auto">
                    <b>{{ item.total }}</b>
                </span>
            </p>
        </BCardBody>
    </Bcard>
</template>

<script setup lang="ts">
import { BCard, BCardBody } from 'bootstrap-vue-next';
import type { StatCard } from './types';
import CountUp from 'vue-countup-v3'
import { Icon } from '@iconify/vue';

defineProps<{
    item: StatCard
}>()
</script>

<style scoped>
.stat-value {
  font-size: clamp(0.95rem, 1.6vw, 1.25rem);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bullet-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-dot 2s infinite;
}

.bullet-primary {
  background: var(--bs-primary);
  animation-name: pulse-primary;
}
.bullet-secondary {
  background: var(--bs-secondary);
  animation-name: pulse-secondary;
}

@keyframes pulse-primary {
  0%   { box-shadow: 0 0 0 0 rgba(var(--bs-primary-rgb), 0.6); }
  70%  { box-shadow: 0 0 0 6px rgba(var(--bs-primary-rgb), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--bs-primary-rgb), 0); }
}
@keyframes pulse-secondary {
  0%   { box-shadow: 0 0 0 0 rgba(var(--bs-secondary-rgb), 0.6); }
  70%  { box-shadow: 0 0 0 6px rgba(var(--bs-secondary-rgb), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--bs-secondary-rgb), 0); }
}
</style>
