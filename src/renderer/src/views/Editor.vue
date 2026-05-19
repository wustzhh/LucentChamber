<template>
  <div class="page page-split">
    <div class="page-left">
      <div class="list-header">
        <el-button @click="addChapter" type="primary" size="small" style="width:100%">+ 新建章节</el-button>
      </div>
      <div class="list-body">
        <div v-for="(ch, i) in chapters" :key="i" class="list-item"
          :class="{ active: selectedIndex === i }"
          @click="selectChapter(i)">
          <div class="list-item-title">{{ ch }}</div>
        </div>
        <div v-if="chapters.length === 0" class="list-empty">
          点击「新建章节」开始
        </div>
      </div>
    </div>
    <div class="page-center" v-if="selectedIndex !== null">
      <div class="editor-toolbar">
        <span class="chapter-name">{{ chapters[selectedIndex] }}</span>
        <span class="word-count">字数: {{ wordCount }}</span>
        <el-button size="small" @click="renameChapter">重命名</el-button>
      </div>
      <div class="editor-area" ref="editorRef"></div>
    </div>
    <div class="page-center-empty" v-else>
      选择一个章节开始写作
    </div>
    <div class="page-right" :class="{ collapsed: rightCollapsed }">
      <div class="right-toggle" @click="rightCollapsed = !rightCollapsed">
        <el-icon><ArrowRight v-if="rightCollapsed" /><ArrowLeft v-else /></el-icon>
      </div>
      <div class="right-content" v-if="!rightCollapsed">
        <h4>插图</h4>
        <div class="illust-grid">
          <div v-for="(img, i) in illustrations" :key="i" class="illust-item">
            <img v-if="img.src" :src="img.src" class="illust-thumb" />
          </div>
          <div class="illust-add" @click="addIllustration">
            <el-icon><Plus /></el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Plus, ArrowRight, ArrowLeft } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'

const projectStore = useProjectStore()
const chapters = ref<string[]>([])
const selectedIndex = ref<number | null>(null)
const rightCollapsed = ref(false)
const illustrations = ref<Array<{ src: string; filename: string }>>([])
const editorRef = ref()
const charCount = ref(0)
const wordCount = ref(0)

let editorView: EditorView | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let chapterTexts: string[] = []

const HEADING_REGEX = /^(#{1,3})\s+(.+)$/m

onMounted(async () => {
  await loadChapters()
  await loadIllustrations()
})
onUnmounted(() => {
  if (editorView) editorView.destroy()
  if (saveTimer) clearTimeout(saveTimer)
})

async function loadChapters() {
  const fullText = await window.api.readText(projectStore.currentProject!, 'novel.txt') || ''
  if (!fullText.trim()) {
    chapters.value = ['第一章']
    chapterTexts = ['# 第一章\n\n']
  } else {
    chapterTexts = splitChapters(fullText)
    chapters.value = chapterTexts.map(extractTitle)
  }
  if (chapters.value.length > 0 && selectedIndex.value === null) {
    selectedIndex.value = 0
    await nextTick()
    initEditor(0)
  }
}

function splitChapters(text: string): string[] {
  const parts: string[] = []
  const lines = text.split('\n')
  let current = ''
  for (const line of lines) {
    if (HEADING_REGEX.test(line) && current.trim()) {
      parts.push(current.trimEnd() + '\n')
      current = line + '\n'
    } else {
      current += line + '\n'
    }
  }
  if (current.trim()) parts.push(current.trimEnd() + '\n')
  return parts.length > 0 ? parts : ['# 第一章\n\n']
}

function extractTitle(text: string): string {
  const m = text.match(HEADING_REGEX)
  return m ? m[2] : '无标题'
}

function selectChapter(i: number) {
  if (editorView && selectedIndex.value !== null && selectedIndex.value < chapterTexts.length) {
    chapterTexts[selectedIndex.value] = editorView.state.doc.toString()
  }
  selectedIndex.value = i
  nextTick(() => initEditor(i))
}

function initEditor(i: number) {
  if (editorView) editorView.destroy()
  const text = chapterTexts[i] || `# ${chapters.value[i]}\n\n`

  editorView = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [
        keymap.of([...defaultKeymap, ...searchKeymap]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const content = update.state.doc.toString()
            charCount.value = content.length
            wordCount.value = content.replace(/\s/g, '').length
            if (saveTimer) clearTimeout(saveTimer)
            saveTimer = setTimeout(() => autoSave(), 1000)
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '15px', background: 'transparent', color: '#d0d0d0' },
          '.cm-scroller': { lineHeight: '1.8' },
          '.cm-gutters': { display: 'none' },
          '.cm-activeLine': { background: 'rgba(64,158,255,0.06)' }
        }),
        placeholder('开始写作...')
      ]
    }),
    parent: editorRef.value
  })
  charCount.value = text.length
  wordCount.value = text.replace(/\s/g, '').length
}

async function autoSave() {
  if (selectedIndex.value === null || !editorView) return
  chapterTexts[selectedIndex.value] = editorView.state.doc.toString()
  await window.api.writeText(projectStore.currentProject!, 'novel.txt', chapterTexts.join(''))
}

async function addChapter() {
  const { value } = await ElMessageBox.prompt('章节名称', '新建章节')
  if (!value) return
  if (editorView && selectedIndex.value !== null && selectedIndex.value < chapterTexts.length) {
    chapterTexts[selectedIndex.value] = editorView.state.doc.toString()
  }
  const newHeading = `# ${value}\n\n`
  chapters.value.push(value)
  chapterTexts.push(newHeading)
  selectedIndex.value = chapters.value.length - 1
  await window.api.writeText(projectStore.currentProject!, 'novel.txt', chapterTexts.join(''))
  nextTick(() => initEditor(selectedIndex.value!))
}

async function renameChapter() {
  if (selectedIndex.value === null) return
  const oldTitle = chapters.value[selectedIndex.value]
  const { value } = await ElMessageBox.prompt('新名称', '重命名章节', { inputValue: oldTitle })
  if (!value) return
  chapters.value[selectedIndex.value] = value
  if (editorView && selectedIndex.value < chapterTexts.length) {
    let text = editorView.state.doc.toString()
    text = text.replace(HEADING_REGEX, `# ${value}`)
    chapterTexts[selectedIndex.value] = text
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: text }
    })
  }
  await window.api.writeText(projectStore.currentProject!, 'novel.txt', chapterTexts.join(''))
}

async function addIllustration() {
  const path = await window.api.openImageDialog()
  if (!path) return
  const result = await window.api.saveImage(projectStore.currentProject!, 'illustrations', path)
  if (result.success) {
    await loadIllustrations()
  }
}

async function loadIllustrations() {
  try {
    const files = await window.api.listDir(projectStore.currentProject!, 'images/illustrations')
    illustrations.value = []
    for (const f of files) {
      if (!f.isDirectory) {
        const src = await window.api.readImageBase64(projectStore.currentProject!, 'illustrations', f.name)
        if (src) {
          illustrations.value.push({ src, filename: f.name })
        }
      }
    }
  } catch { /* dir may not exist yet */ }
}

</script>

<style scoped>
.page { height: 100%; overflow: hidden }
.page-split { display: flex }
.page-left {
  width: 180px; border-right: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.list-header { padding: 8px }
.list-body { flex: 1; overflow-y: auto }
.list-item { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03) }
.list-item:hover { background: rgba(255,255,255,0.04) }
.list-item.active { background: rgba(64,158,255,0.1); border-left: 2px solid #409EFF }
.list-item-title { font-size: 14px; color: #ddd }
.list-empty { text-align: center; color: #888; padding: 24px; font-size: 14px }
.page-center { flex: 1; display: flex; flex-direction: column; overflow: hidden }
.page-center-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #888 }
.editor-toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.chapter-name { color: #ccc; font-size: 14px }
.word-count { color: #888; font-size: 12px; margin-left: auto }
.editor-area {
  flex: 1; overflow: auto; padding: 16px 24px;
  background: rgba(0,0,0,0.15);
}
.page-right {
  width: 200px; border-left: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-shrink: 0;
}
.page-right.collapsed { width: 28px }
.right-toggle {
  width: 28px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #888;
}
.right-toggle:hover { color: #409EFF }
.right-content { flex: 1; padding: 12px; overflow-y: auto }
.right-content h4 { margin: 0 0 8px; color: #ccc; font-size: 13px }
.illust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px }
.illust-item { aspect-ratio: 1; border-radius: 4px; overflow: hidden; background: rgba(0,0,0,0.3) }
.illust-thumb { width: 100%; height: 100%; object-fit: cover }
.illust-add {
  aspect-ratio: 1; border-radius: 4px;
  border: 1px dashed rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #888; font-size: 20px;
}
.illust-add:hover { border-color: #409EFF; color: #409EFF }
</style>
