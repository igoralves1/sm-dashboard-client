import { createRouter, createWebHistory } from 'vue-router'
import { allRoutes } from '@/router/routes.ts'
import { appTitle } from '@/helpers'
import { useAuthStore } from '@/stores/auth.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: allRoutes,
})

router.beforeEach(async (to, _from, next) => {
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
    return next({ path: '/dashboard' })
  }

  next()
})

export default router
