<template>
  <div class="page page-split">
    <div class="page-left">
      <div class="list-header">
        <el-input v-model="searchText" placeholder="搜索事件..." size="small" clearable />
        <el-button @click="addEvent" type="primary" size="small" style="margin-top:8px;width:100%">+ 新建事件</el-button>
      </div>
      <div class="list-body">
        <div
          v-for="(ev, i) in filteredList"
          :key="i"
          class="list-item"
          :class="{ active: selectedIndex === events.indexOf(ev), 'drag-over': dragOverIndex === i }"
          draggable="true"
          @click="selectedIndex = events.indexOf(ev)"
          @dragstart="onDragStart($event, ev)"
          @dragover.prevent="onDragOver($event, i)"
          @dragleave="dragOverIndex = null"
          @drop="onDrop(ev)"
        >
          <div class="drag-handle">⠿</div>
          <div>
            <div class="list-item-title">{{ ev.title || '未命名事件' }}</div>
            <div class="list-item-sub">{{ ev.year }}</div>
          </div>
        </div>
        <div v-if="filteredList.length === 0" class="list-empty">暂无事件</div>
      </div>
    </div>
    <div class="page-right" v-if="selectedIndex !== null">
      <h3>事件详情</h3>
      <el-form label-position="top">
        <el-form-item label="事件名称">
          <el-input v-model="events[selectedIndex].title" />
        </el-form-item>
        <el-form-item label="时间">
          <el-input v-model="events[selectedIndex].year" placeholder="如：公元208年" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="events[selectedIndex].description" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item label="关联角色">
          <div class="tag-list">
            <el-tag v-for="(ch, ci) in events[selectedIndex].characterIds" :key="ci" closable size="small"
              @close="removeCharacter(selectedIndex, ci)">
              {{ getCharName(ch) }}
            </el-tag>
            <el-dropdown @command="(cid: string) => addCharacter(selectedIndex, cid)">
              <el-tag type="info" size="small" style="cursor:pointer">+ 添加角色</el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="c in characters" :key="c.id" :command="c.id">
                    {{ c.name }}
                  </el-dropdown-item>
                  <div v-if="characters.length === 0" style="padding:8px 12px;color:#888;font-size:12px">
                    暂无角色，先去人物页创建
                  </div>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-form-item>
        <el-button @click="deleteEvent(selectedIndex)" type="danger" plain>删除事件</el-button>
      </el-form>
    </div>
    <div class="page-right page-empty" v-else>
      选择一个事件查看详情
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useProjectStore } from '@/stores/project'

interface Event {
  title: string
  year: string
  description: string
  characterIds: string[]
}

interface Character { id: string; name: string }

const projectStore = useProjectStore()
const events = ref<Event[]>([])
const characters = ref<Character[]>([])
const selectedIndex = ref<number | null>(null)
const searchText = ref('')
const loading = ref(false)
const dragOverIndex = ref<number | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dragSrc: Event | null = null

const filteredList = computed(() => {
  let list = events.value
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(e => e.title.toLowerCase().includes(q))
  }
  return list
})

onMounted(async () => {
  loading.value = true
  const data = await window.api.readJSON(projectStore.currentProject!, 'events.json')
  if (data) events.value = data
  await loadCharacters()
  loading.value = false
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

watch(events, () => {
  if (loading.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 800)
}, { deep: true })

async function autoSave() {
  await window.api.writeJSON(projectStore.currentProject!, 'events.json', JSON.parse(JSON.stringify(events.value)))
}

async function loadCharacters() {
  const files = await window.api.listDir(projectStore.currentProject!, 'characters')
  characters.value = []
  for (const f of files) {
    if (f.name.endsWith('.json')) {
      const data = await window.api.readJSON(projectStore.currentProject!, `characters/${f.name}`)
      if (data) characters.value.push({ id: f.name.replace('.json', ''), name: data.name || f.name })
    }
  }
}

function getCharName(id: string) {
  return characters.value.find(c => c.id === id)?.name || id
}

function addEvent() {
  events.value.push({ title: '', year: '', description: '', characterIds: [] })
  selectedIndex.value = events.value.length - 1
}

function deleteEvent(i: number) {
  events.value.splice(i, 1)
  if (selectedIndex.value === i) selectedIndex.value = null
}

function addCharacter(eventIndex: number, charId: string) {
  if (!events.value[eventIndex].characterIds.includes(charId)) {
    events.value[eventIndex].characterIds.push(charId)
  }
}

function removeCharacter(eventIndex: number, charIndex: number) {
  events.value[eventIndex].characterIds.splice(charIndex, 1)
}

function onDragStart(e: DragEvent, ev: Event) {
  dragSrc = ev
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(_e: DragEvent, i: number) {
  dragOverIndex.value = i
}

function onDrop(target: Event) {
  dragOverIndex.value = null
  if (!dragSrc || dragSrc === target) return
  const fromIdx = events.value.indexOf(dragSrc)
  const toIdx = events.value.indexOf(target)
  if (fromIdx === -1 || toIdx === -1) return
  const [item] = events.value.splice(fromIdx, 1)
  events.value.splice(toIdx, 0, item)
  if (selectedIndex.value === fromIdx) selectedIndex.value = toIdx
  else if (selectedIndex.value !== null && selectedIndex.value >= Math.min(fromIdx, toIdx) && selectedIndex.value <= Math.max(fromIdx, toIdx)) {
    selectedIndex.value += fromIdx < toIdx ? -1 : 1
  }
  dragSrc = null
}
</script>

<style scoped>
.page { height: 100%; overflow: hidden }
.page-split { display: flex }
.page-left {
  width: 260px; border-right: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.list-header { padding: 12px }
.list-body { flex: 1; overflow-y: auto }
.list-item {
  padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);
  display: flex; align-items: center; gap: 8px;
}
.list-item:hover { background: rgba(255,255,255,0.04) }
.list-item.active { background: rgba(64,158,255,0.1); border-left: 2px solid #409EFF }
.list-item.drag-over { background: rgba(64,158,255,0.15); border-left: 2px solid #67C23A }
.drag-handle { color: #555; cursor: grab; font-size: 16px; line-height: 1; user-select: none; flex-shrink: 0 }
.drag-handle:active { cursor: grabbing }
.list-item-title { font-size: 14px; color: #ddd }
.list-item-sub { font-size: 12px; color: #888; margin-top: 2px }
.list-empty { text-align: center; color: #888; padding: 24px; font-size: 14px }
.page-right { flex: 1; padding: 16px 24px; overflow-y: auto }
.page-right h3 { margin: 0 0 16px; color: #ccc; font-size: 16px }
.page-empty { display: flex; align-items: center; justify-content: center; color: #888 }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; align-items: center }
</style>
