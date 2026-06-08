import { createRouter, createWebHistory } from 'vue-router'
import { allRoutes } from '@/router/routes.ts'
import { appTitle } from '@/helpers'
import { useAuthStore } from '@/stores/auth.ts'
import { useActivityTracker } from '@/composables/useActivityTracker'
import { useSessionTracker } from '@/composables/useSessionTracker'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: allRoutes,
})

router.beforeEach(async (to, _from, next) => {
  // Finalize the outgoing page session before navigation
  useSessionTracker().endPage()

  const title = to.meta.title ? to.meta.title + ' | ' + appTitle : appTitle
  document.title = title.toString()

  const auth = useAuthStore()
  const isPublic = to.meta.public === true

  // If token exists but expired → try silent refresh first
  if (auth.tokenExpiry && Date.now() >= auth.tokenExpiry) {
    await auth.refreshSession()
  }

  if (!auth.isAuthenticated && !isPublic) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  if (auth.isAuthenticated && isPublic) {
    return next({ path: '/dashboard-sm' })
  }

  next()
})

router.afterEach((to) => {
  const auth  = useAuthStore()
  const user  = auth.user?.email ?? 'anonymous'
  const title = to.meta.title ? String(to.meta.title) : to.name ? String(to.name) : to.path

  // Lightweight audit log (login/logout/page_view)
  useActivityTracker().trackPageView(user, to.fullPath, title)

  // Full behavioral session (time, mouse, clicks, IP)
  useSessionTracker().startPage(user, to.fullPath, title)
})

export default router
