<template>
  <div class="main-layout">
    <header class="topbar">
      <div class="topbar-left">
        <span class="logo">LucentChamber</span>
        <el-divider direction="vertical" />
        <span class="project-name">{{ projectStore.currentProject }}</span>
      </div>
      <div class="topbar-right">
        <el-button @click="$router.push('/projects')" size="small">切换作品</el-button>
        <el-button @click="handleLogout" size="small">退出</el-button>
      </div>
    </header>
    <div class="main-body">
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed">
          <el-icon><Fold v-if="!sidebarCollapsed" /><Expand v-else /></el-icon>
        </div>
        <nav class="sidebar-nav">
          <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item"
            :class="{ active: isActive(item.path) }">
            <el-icon><component :is="item.icon" /></el-icon>
            <span v-if="!sidebarCollapsed" class="nav-text">{{ item.label }}</span>
          </router-link>
        </nav>
      </aside>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Fold, Expand, Clock, Document, User, Connection, MapLocation, Edit } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useProjectStore } from '@/stores/project'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const projectStore = useProjectStore()
const sidebarCollapsed = ref(false)

const navItems = [
  { path: '/workspace/timeline', label: '时间线', icon: Clock },
  { path: '/workspace/events', label: '大事件', icon: Document },
  { path: '/workspace/characters', label: '人物', icon: User },
  { path: '/workspace/relationships', label: '关系', icon: Connection },
  { path: '/workspace/maps', label: '地图', icon: MapLocation },
  { path: '/workspace/editor', label: '编辑器', icon: Edit }
]

function isActive(path: string) {
  return route.path === path
}

function handleLogout() {
  userStore.logout()
  projectStore.clearProject()
  router.push('/login')
}
</script>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  padding: 0 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: 8px }
.logo { font-weight: bold; font-size: 16px; color: #409EFF }
.project-name { color: #ccc; font-size: 14px }

.main-body { display: flex; flex: 1; overflow: hidden }
.sidebar {
  width: 180px;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
  flex-shrink: 0;
}
.sidebar.collapsed { width: 56px }
.sidebar-toggle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
  color: #888;
  font-size: 18px;
}
.sidebar-toggle:hover { color: #409EFF }
.sidebar-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 8px }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #aaa;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.06); color: #e0e0e0 }
.nav-item.active { background: rgba(64, 158, 255, 0.15); color: #409EFF }
.nav-text { white-space: nowrap }

.content { flex: 1; overflow: auto; padding: 0 }
</style>
