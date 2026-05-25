import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') },
    { path: '/register', name: 'Register', component: () => import('@/views/Register.vue') },
    { path: '/projects', name: 'Projects', component: () => import('@/views/Projects.vue') },
    {
      path: '/workspace',
      component: () => import('@/views/MainLayout.vue'),
      children: [
        { path: 'timeline', name: 'Timeline', component: () => import('@/views/Timeline.vue') },
        { path: 'events', name: 'Events', component: () => import('@/views/Events.vue') },
        { path: 'characters', name: 'Characters', component: () => import('@/views/Characters.vue') },
        { path: 'relationships', name: 'Relationships', component: () => import('@/views/Relationships.vue') },
        { path: 'maps', name: 'Maps', component: () => import('@/views/Maps.vue') },
        { path: 'editor', name: 'Editor', component: () => import('@/views/Editor.vue') },
        { path: 'settings', name: 'Settings', component: () => import('@/views/Settings.vue') },
        { path: 'glossary', name: 'Glossary', component: () => import('@/views/Glossary.vue') }
      ]
    }
  ]
})

export default router
