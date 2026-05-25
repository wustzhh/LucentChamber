<template>
  <div class="page page-split">
    <div class="page-left">
      <div class="list-header">
        <el-button @click="addCategory" type="primary" size="small" style="width:100%">+ 新建分类</el-button>
      </div>
      <div class="list-body">
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="list-item"
          :class="{ active: selectedCatId === cat.id }"
          @click="selectedCatId = cat.id"
          @dblclick="renameCategory(cat)"
          @contextmenu.prevent="deleteCategory(cat)"
        >
          <span :style="{ width:'10px', height:'10px', borderRadius:'50%', background: cat.color || '#666', flexShrink:0 }"></span>
          <div class="list-item-title">{{ cat.name }}</div>
          <div class="list-item-count">{{ cat.terms.length }}</div>
        </div>
        <div v-if="categories.length === 0" class="list-empty">暂无分类</div>
      </div>
    </div>
    <div class="page-right" v-if="currentCategory">
      <div class="right-header">
        <h3>{{ currentCategory.name }}</h3>
        <el-button @click="addTerm" type="primary" size="small">+ 添加词条</el-button>
      </div>
      <div class="term-list">
        <div
          v-for="(term, ti) in currentCategory.terms"
          :key="term.id"
          class="term-item"
          draggable="true"
          @dragstart="onDragStart($event, term)"
          @dragover.prevent="onDragOver($event, ti)"
          @dragleave="dragOverIndex = null"
          @drop="onDrop(term)"
        >
          <div class="drag-handle">⠿</div>
          <div class="term-fields">
            <el-input v-model="term.name" placeholder="名称" size="small" style="width:160px" />
            <el-input v-model="term.description" placeholder="描述" size="small" />
            <el-button type="danger" :icon="DeleteIcon" circle size="small" @click="removeTerm(ti)" />
          </div>
        </div>
        <div v-if="currentCategory.terms.length === 0" class="list-empty">暂无词条</div>
      </div>
    </div>
    <div class="page-right page-empty" v-else>
      选择一个分类查看词条
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete as DeleteIcon } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'

interface GlossaryTerm { id: string; name: string; description: string }
interface GlossaryCategory { id: string; name: string; terms: GlossaryTerm[]; color: string }

const DEFAULT_COLORS = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
  '#B37FEB', '#36CFC9', '#FF85C0', '#597EF7', '#73D13D',
  '#FFC53D', '#FF7A45', '#9254DE', '#5CDBD3', '#F759AB',
  '#40A9FF', '#95DE64', '#FFD666', '#FF9C6E', '#B6B7F9'
]

function pickColor(): string {
  const used = new Set(categories.value.filter(c => c.color).map(c => c.color))
  for (const c of DEFAULT_COLORS) if (!used.has(c)) return c
  return `hsl(${Math.floor(Math.random() * 360)},55%,55%)`
}

const projectStore = useProjectStore()
const categories = ref<GlossaryCategory[]>([])
const selectedCatId = ref<string | null>(null)
const loading = ref(false)
const dragOverIndex = ref<number | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dragSrc: GlossaryTerm | null = null

const currentCategory = computed(() => categories.value.find(c => c.id === selectedCatId.value) || null)

onMounted(async () => {
  loading.value = true
  const data = await window.api.readJSON(projectStore.currentProject!, 'glossary.json')
  if (data) categories.value = data
  // Ensure all categories have colors
  let changed = false
  for (const cat of categories.value) {
    if (!cat.color) { cat.color = pickColor(); changed = true }
  }
  if (changed) await autoSave()
  if (categories.value.length > 0) selectedCatId.value = categories.value[0].id
  loading.value = false
})

onUnmounted(() => { if (saveTimer) clearTimeout(saveTimer) })

watch(categories, () => {
  if (loading.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 800)
}, { deep: true })

async function autoSave() {
  await window.api.writeJSON(projectStore.currentProject!, 'glossary.json', JSON.parse(JSON.stringify(categories.value)))
}

async function addCategory() {
  const { value } = await ElMessageBox.prompt('分类名称', '新建分类')
  if (!value) return
  categories.value.push({ id: `${Date.now()}`, name: value, terms: [], color: pickColor() })
  selectedCatId.value = categories.value[categories.value.length - 1].id
}

async function renameCategory(cat: GlossaryCategory) {
  const { value } = await ElMessageBox.prompt('新名称', '重命名', { inputValue: cat.name })
  if (value) cat.name = value
}

async function deleteCategory(cat: GlossaryCategory) {
  try {
    await ElMessageBox.confirm(`确定删除「${cat.name}」？`, '确认', { type: 'warning' })
    categories.value = categories.value.filter(c => c.id !== cat.id)
    if (selectedCatId.value === cat.id) selectedCatId.value = categories.value[0]?.id || null
  } catch { /* cancelled */ }
}

function addTerm() {
  if (!currentCategory.value) return
  currentCategory.value.terms.push({ id: `${Date.now()}`, name: '', description: '' })
}

function removeTerm(i: number) {
  currentCategory.value?.terms.splice(i, 1)
}

function onDragStart(e: DragEvent, term: GlossaryTerm) { dragSrc = term; e.dataTransfer!.effectAllowed = 'move' }
function onDragOver(_e: DragEvent, i: number) { dragOverIndex.value = i }

function onDrop(target: GlossaryTerm) {
  dragOverIndex.value = null
  if (!dragSrc || dragSrc === target || !currentCategory.value) return
  const terms = currentCategory.value.terms
  const from = terms.indexOf(dragSrc); const to = terms.indexOf(target)
  if (from === -1 || to === -1) return
  const [item] = terms.splice(from, 1); terms.splice(to, 0, item)
  dragSrc = null
}
</script>

<style scoped>
.page { height: 100%; overflow: hidden }
.page-split { display: flex }
.page-left { width: 200px; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; flex-shrink: 0 }
.list-header { padding: 12px }
.list-body { flex: 1; overflow-y: auto }
.list-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03) }
.list-item:hover { background: rgba(255,255,255,0.04) }
.list-item.active { background: rgba(64,158,255,0.1); border-left: 2px solid #409EFF }
.list-item-title { font-size: 14px; color: #ddd; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.list-item-count { font-size: 12px; color: #888; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 8px }
.list-empty { text-align: center; color: #888; padding: 24px; font-size: 14px }
.page-right { flex: 1; display: flex; flex-direction: column; overflow: hidden }
.page-empty { display: flex; align-items: center; justify-content: center; color: #888 }
.right-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px 8px; flex-shrink: 0 }
.right-header h3 { margin: 0; color: #ccc; font-size: 16px }
.term-list { flex: 1; overflow-y: auto; padding: 8px 24px }
.term-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03) }
.drag-handle { color: #555; cursor: grab; font-size: 14px; user-select: none; flex-shrink: 0 }
.term-fields { display: flex; gap: 8px; align-items: center; flex: 1 }
</style>
