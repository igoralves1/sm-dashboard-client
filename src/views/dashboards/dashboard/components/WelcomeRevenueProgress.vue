<template>
    <BCard no-body>
        <BCardBody class="p-0">
            <BRow class="g-0">
                <BCol xxl="3" xl="6" class="order-xl-1 order-xxl-0">
                    <div class="p-4 border-end border-dashed">
                        <h4 class="card-title mb-1">Gestão de Condomínios</h4>
                        <p class="text-muted fs-xs">Você tem <span class="text-primary fw-semibold">42</span> alertas e 6 notificações de sensores IoT.</p>

                        <BListGroup flush class="mt-3">
                            <BListGroupItem v-for="item in activityItems" :key="item.id"
                                class="d-flex justify-content-between align-items-center border-0 px-0">
                                <div>
                                    <BBadge :variant="item.badgeVariant" :text-variant="item.badgeText"
                                        class="avatar-xs me-2">
                                        <span class="avatar-title fw-medium fs-sm">{{ item.id }}</span>
                                    </BBadge>
                                    {{ item.text }}
                                </div>
                                <span class="text-muted">{{ item.time }}</span>
                            </BListGroupItem>
                        </BListGroup>

                        <div class="text-center mt-2">
                            <BButton variant="secondary" class="rounded-pill" href="#!">
                                Ver Alertas
                            </BButton>
                        </div>
                    </div>
                    <hr class="d-xxl-none border-light m-0" />
                </BCol>

                <BCol xxl="6" class="order-xl-3 order-xxl-1">
                    <div class="px-4 py-3 border-end border-dashed">
                        <b-row class="text-center mb-3">
                            <BCol>
                                <div class="bg-light bg-opacity-50 p-2">
                                    <h5 class="m-0">
                                        <span class="text-muted me-1">Consumo Total:</span>
                                        <CountUp class="d-inline-flex" :end-val="1847"
                                            :options="{ suffix: ' MWh', enableScrollSpy: true, scrollSpyOnce: true }" />
                                    </h5>
                                </div>
                            </BCol>
                            <BCol>
                                <div class="bg-light bg-opacity-50 p-2">
                                    <h5 class="m-0">
                                        <span class="text-muted me-1">Sensores Ativos:</span>
                                        <CountUp class="d-inline-flex" :end-val="2847"
                                            :options="{ separator: '.' }" />
                                    </h5>
                                </div>
                            </BCol>
                        </b-row>
                        <StackedAreaChart />
                    </div>
                </BCol>

                <BCol xxl="3" xl="6" class="order-xl-2 order-xxl-2">
                    <div class="p-3">
                        <h4 class="card-title mb-1">Status das Estações de Água</h4>
                        <p class="text-muted fs-xs">21 estações monitoradas em tempo real.</p>

                        <b-row class="mt-4">
                            <BCol>
                                <DonutChart />
                            </BCol>
                        </b-row>
                    </div>
                    <hr class="d-xxl-none border-light m-0" />
                </BCol>
            </BRow>
        </BCardBody>
    </BCard>
</template>

<script setup lang="ts">
import { activityItems } from './data';
import { BBadge, BButton, BCard, BCol, BListGroupItem, BRow } from 'bootstrap-vue-next';
import CountUp from 'vue-countup-v3'
import { Icon } from '@iconify/vue';
import StackedAreaChart from './StackedAreaChart.vue';
import DonutChart from './DonutChart.vue';
</script>
