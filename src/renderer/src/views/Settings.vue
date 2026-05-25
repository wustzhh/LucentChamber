<template>
  <div class="page page-split">
    <div class="page-left">
      <div class="list-header">
        <el-button @click="addDoc" type="primary" size="small" style="width:100%">+ 新建设定</el-button>
      </div>
      <div class="list-body">
        <div
          v-for="(doc, i) in docs"
          :key="doc.id"
          class="list-item"
          :class="{ active: selectedIndex === i }"
          draggable="true"
          @click="selectDoc(i)"
          @dragstart="onDragStart($event, doc)"
          @dragover.prevent="onDragOver($event, i)"
          @dragleave="dragOverIndex = null"
          @drop="onDrop(doc)"
          @dblclick="renameDoc(i)"
          @contextmenu.prevent="deleteDoc(i)"
        >
          <div class="drag-handle">⠿</div>
          <div class="list-item-title">{{ doc.name || '未命名' }}</div>
        </div>
        <div v-if="docs.length === 0" class="list-empty">暂无设定</div>
      </div>
    </div>
    <div class="page-center" v-if="selectedIndex !== null">
      <div class="editor-toolbar">
        <span class="doc-name">{{ currentDoc?.name }}</span>
      </div>
      <div class="editor-area" ref="editorRef"></div>
    </div>
    <div class="page-center-empty" v-else>
      选择或新建一个设定开始编辑
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'

interface SettingDoc {
  id: string
  name: string
  content: string
}

const projectStore = useProjectStore()
const docs = ref<SettingDoc[]>([])
const selectedIndex = ref<number | null>(null)
const editorRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const dragOverIndex = ref<number | null>(null)
let editorView: EditorView | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dragSrc: SettingDoc | null = null

const currentDoc = computed(() => selectedIndex.value !== null ? docs.value[selectedIndex.value] : null)

onMounted(async () => {
  loading.value = true
  const data = await window.api.readJSON(projectStore.currentProject!, 'settings.json')
  if (data) docs.value = data
  if (docs.value.length > 0) { selectedIndex.value = 0; await nextTick(); initEditor() }
  loading.value = false
})

onUnmounted(() => {
  if (editorView) editorView.destroy()
  if (saveTimer) clearTimeout(saveTimer)
})

watch(docs, () => {
  if (loading.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 800)
}, { deep: true })

async function autoSave() {
  if (editorView && currentDoc.value) {
    currentDoc.value.content = editorView.state.doc.toString()
  }
  await window.api.writeJSON(projectStore.currentProject!, 'settings.json', JSON.parse(JSON.stringify(docs.value)))
}

function initEditor() {
  if (editorView) editorView.destroy()
  if (!editorRef.value || !currentDoc.value) return

  editorView = new EditorView({
    state: EditorState.create({
      doc: currentDoc.value.content || '',
      extensions: [
        keymap.of([...defaultKeymap, ...searchKeymap]),
        EditorView.updateListener.of(() => {
          if (saveTimer) clearTimeout(saveTimer)
          saveTimer = setTimeout(() => autoSave(), 1000)
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '15px', background: 'transparent', color: '#d0d0d0' },
          '.cm-scroller': { lineHeight: '1.8' },
          '.cm-gutters': { display: 'none' },
          '.cm-activeLine': { background: 'rgba(64,158,255,0.06)' }
        }),
        placeholder('开始编写设定...')
      ]
    }),
    parent: editorRef.value
  })
}

function selectDoc(i: number) {
  if (editorView && currentDoc.value) currentDoc.value.content = editorView.state.doc.toString()
  selectedIndex.value = i
  nextTick(() => initEditor())
}

async function addDoc() {
  const { value } = await ElMessageBox.prompt('设定名称', '新建设定')
  if (!value) return
  docs.value.push({ id: `${Date.now()}`, name: value, content: '' })
  selectedIndex.value = docs.value.length - 1
  await nextTick()
  initEditor()
}

async function renameDoc(i: number) {
  const { value } = await ElMessageBox.prompt('新名称', '重命名', { inputValue: docs.value[i].name })
  if (value) docs.value[i].name = value
}

async function deleteDoc(i: number) {
  const { value } = await ElMessageBox.confirm('确定删除？', '确认', { type: 'warning' }).catch(() => null)
  if (!value) return
  if (editorView) editorView.destroy(); editorView = null
  docs.value.splice(i, 1)
  if (i <= selectedIndex.value!) selectedIndex.value = null
}

function onDragStart(e: DragEvent, doc: SettingDoc) { dragSrc = doc; e.dataTransfer!.effectAllowed = 'move' }
function onDragOver(_e: DragEvent, i: number) { dragOverIndex.value = i }

function onDrop(target: SettingDoc) {
  dragOverIndex.value = null
  if (!dragSrc || dragSrc === target) return
  const from = docs.value.indexOf(dragSrc); const to = docs.value.indexOf(target)
  if (from === -1 || to === -1) return
  const [item] = docs.value.splice(from, 1); docs.value.splice(to, 0, item)
  if (selectedIndex.value === from) selectedIndex.value = to
  else if (selectedIndex.value! >= Math.min(from, to) && selectedIndex.value! <= Math.max(from, to)) selectedIndex.value! += from < to ? -1 : 1
  dragSrc = null
}
</script>

<style scoped>
.page { height: 100%; overflow: hidden }
.page-split { display: flex }
.page-left { width: 200px; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; flex-shrink: 0 }
.list-header { padding: 12px }
.list-body { flex: 1; overflow-y: auto }
.list-item { display: flex; align-items: center; gap: 6px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03) }
.list-item:hover { background: rgba(255,255,255,0.04) }
.list-item.active { background: rgba(64,158,255,0.1); border-left: 2px solid #409EFF }
.drag-handle { color: #555; cursor: grab; font-size: 14px; line-height: 1; user-select: none; flex-shrink: 0 }
.list-item-title { font-size: 14px; color: #ddd; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.list-empty { text-align: center; color: #888; padding: 24px; font-size: 14px }
.page-center { flex: 1; display: flex; flex-direction: column; overflow: hidden }
.page-center-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #888 }
.editor-toolbar { display: flex; align-items: center; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0 }
.doc-name { color: #ccc; font-size: 14px }
.editor-area { flex: 1; overflow: auto; padding: 16px 24px; background: rgba(0,0,0,0.15) }
</style>
