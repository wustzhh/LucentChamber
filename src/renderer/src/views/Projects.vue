<template>
  <div class="projects-container">
    <div class="projects-header">
      <div>
        <h1>我的作品</h1>
        <p style="color:#888;margin-top:4px">当前用户：{{ userStore.username }}</p>
      </div>
      <div style="display:flex;gap:12px">
        <el-button @click="handleLogout">退出登录</el-button>
        <el-button type="primary" @click="showCreateDialog = true">新建作品</el-button>
      </div>
    </div>

    <div class="projects-grid" v-if="projects.length > 0">
      <div v-for="p in projects" :key="p.name" class="project-card" @click="openProject(p.name)">
        <div class="project-card-icon">📖</div>
        <div class="project-card-name">{{ p.name }}</div>
        <div class="project-card-date" v-if="p.createdAt">
          {{ new Date(p.createdAt).toLocaleDateString('zh-CN') }}
        </div>
        <el-button class="project-card-delete" type="danger" circle size="small" :icon="Delete"
          @click.stop="handleDeleteProject(p.name)" />
      </div>
    </div>
    <div v-else class="projects-empty">
      <p style="font-size:48px">📝</p>
      <p style="color:#888;margin-top:12px">还没有作品，点击右上角「新建作品」开始</p>
    </div>

    <el-dialog v-model="showCreateDialog" title="新建作品" width="400px">
      <el-input v-model="newProjectName" placeholder="请输入作品名称" size="large" @keyup.enter="handleCreate" />
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :disabled="!newProjectName.trim()">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useProjectStore } from '@/stores/project'

const router = useRouter()
const userStore = useUserStore()
const projectStore = useProjectStore()

const projects = ref<Array<{ name: string; createdAt?: string }>>([])
const showCreateDialog = ref(false)
const newProjectName = ref('')

onMounted(async () => {
  if (!userStore.isLoggedIn && !userStore.loadSession()) { router.push('/login'); return }
  projects.value = await window.api.listProjects(userStore.userId!)
})

async function handleCreate() {
  if (!newProjectName.value.trim()) return
  const result = await window.api.createProject(newProjectName.value.trim())
  if (result.success) {
    showCreateDialog.value = false
    newProjectName.value = ''
    ElMessage.success('创建成功')
    projects.value = await window.api.listProjects(userStore.userId!)
  } else {
    ElMessage.error(result.error || '创建失败')
  }
}

async function handleDeleteProject(name: string) {
  try {
    await ElMessageBox.confirm(`确定删除「${name}」吗？此操作不可恢复。`, '警告', { type: 'warning' })
    await window.api.deleteProject(name)
    ElMessage.success('已删除')
    projects.value = await window.api.listProjects(userStore.userId!)
  } catch { /* cancelled */ }
}

function openProject(name: string) {
  projectStore.setProject(name)
  router.push('/workspace/timeline')
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.projects-container {
  height: 100vh;
  padding: 32px;
  background: #1a1a2e;
  color: #e0e0e0;
}
.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}
h1 { color: #e0e0e0; margin-bottom: 0; }
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}
.project-card {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.project-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(64, 158, 255, 0.4);
}
.project-card-icon { font-size: 36px; margin-bottom: 12px }
.project-card-name { font-size: 16px; margin-bottom: 4px }
.project-card-date { font-size: 12px; color: #888 }
.project-card-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}
.project-card:hover .project-card-delete { opacity: 1 }
.projects-empty { text-align: center; margin-top: 120px }
</style>
