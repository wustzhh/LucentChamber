<template>
  <div class="page">
    <div class="page-header">
      <h2>时间线</h2>
      <div class="page-toolbar">
        <el-select v-model="currentTimelineId" size="small" style="width:140px" @change="onSwitchTimeline">
          <el-option v-for="tl in timelines" :key="tl.id" :label="tl.name" :value="tl.id" />
        </el-select>
        <el-button size="small" @click="addTimeline">+</el-button>
        <el-button size="small" @click="renameTimeline" :disabled="!currentTimelineId">✎</el-button>
        <el-button size="small" @click="deleteTimeline" :disabled="timelines.length <= 1">✕</el-button>
        <el-divider direction="vertical" />
        <el-button type="primary" size="small" @click="addNode">添加节点</el-button>
        <el-button-group>
          <el-button size="small" @click="zoomOut">-</el-button>
          <el-button size="small" @click="zoomIn">+</el-button>
        </el-button-group>
        <el-button size="small" @click="fitView">适应</el-button>
        <span class="scale-label">{{ Math.round(zoomLevel * 100) }}%</span>
      </div>
    </div>
    <div class="timeline-canvas" ref="canvasRef" @wheel.prevent="onWheel">
      <div class="timeline-axis" :style="{ minWidth: trackWidth + 'px' }">
        <div class="timeline-line"></div>
        <div class="timeline-track">
          <div
            v-for="item in displayNodes"
            :key="item.node.id"
            class="timeline-node"
            :style="{ left: item.position + 'px', marginTop: item.topOffset + 'px' }"
            :class="{ selected: selectedId === item.node.id }"
            @click="selectNode(item.node)"
          >
            <el-tooltip effect="dark" placement="top" :show-after="300">
              <template #content>
                <div>{{ item.node.title }}</div>
                <div style="font-size:11px;color:#aaa">{{ item.node.year ?? '未知年份' }}</div>
              </template>
              <div class="timeline-click-area">
                <div class="timeline-dot"></div>
                <div class="timeline-node-label">{{ item.node.title || '未命名' }}</div>
                <div class="timeline-node-date">{{ item.node.year ?? '—' }}</div>
              </div>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div class="timeline-empty" v-if="timelineNodes.length === 0">
        点击「添加节点」创建第一个时间节点
      </div>
    </div>
    <div class="page-panel" v-if="selectedNode">
      <h3>节点详情</h3>
      <el-form label-position="top">
        <el-form-item label="标题">
          <el-input v-model="selectedNode.title" placeholder="如：太古纪元" />
        </el-form-item>
        <el-form-item label="年份（整数，支持负数）">
          <el-input-number v-model="selectedNode.year" :step="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="selectedNode.description" type="textarea" :rows="4" />
        </el-form-item>
        <el-button @click="deleteSelected" type="danger" plain>删除节点</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'

interface TimelineNode {
  id: string
  title: string
  year: number | null
  description: string
}

interface Timeline {
  id: string
  name: string
  nodes: TimelineNode[]
}

interface DisplayNode {
  node: TimelineNode
  position: number
  topOffset: number
}

const BASE_PIXELS_PER_YEAR = 60
const MARGIN_LEFT = 80
const VERTICAL_STAGGER = 28

const projectStore = useProjectStore()
const timelines = ref<Timeline[]>([])
const currentTimelineId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const zoomLevel = ref(1)
const loading = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

function pixelsPerYear() { return BASE_PIXELS_PER_YEAR * zoomLevel.value }

const currentTimeline = computed(() =>
  timelines.value.find(t => t.id === currentTimelineId.value) || null
)

const timelineNodes = computed(() =>
  currentTimeline.value?.nodes || []
)

const sortedNodes = computed(() =>
  [...timelineNodes.value].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
)

const selectedNode = computed(() =>
  timelineNodes.value.find(n => n.id === selectedId.value) || null
)

const displayNodes = computed<DisplayNode[]>(() => {
  const list = sortedNodes.value
  if (list.length === 0) return []
  const ppy = pixelsPerYear()
  const minYear = list[0].year ?? 0
  const offsets = [0, -VERTICAL_STAGGER, 0, VERTICAL_STAGGER]
  return list.map((node, i) => ({
    node,
    position: ((node.year ?? 0) - minYear) * ppy + MARGIN_LEFT,
    topOffset: offsets[i % 4]
  }))
})

const trackWidth = computed(() => {
  const list = sortedNodes.value
  if (list.length < 2) return 800
  const minY = list[0].year ?? 0
  const maxY = list[list.length - 1].year ?? 0
  return (maxY - minY) * pixelsPerYear() + MARGIN_LEFT * 2 + 200
})

onMounted(async () => {
  loading.value = true
  const data = await loadData()
  if (data) {
    // Migration: old flat array → new structure
    if (Array.isArray(data) && data.length > 0 && !('nodes' in data[0])) {
      timelines.value = [{ id: '1', name: '主线', nodes: data }]
    } else if (Array.isArray(data)) {
      timelines.value = data
    }
    if (timelines.value.length === 0) {
      timelines.value = [{ id: '1', name: '主线', nodes: [] }]
    }
    currentTimelineId.value = timelines.value[0].id
  }
  loading.value = false
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

watch(timelines, () => {
  if (loading.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 500)
}, { deep: true })

async function loadData() {
  return window.api.readJSON(projectStore.currentProject!, 'timeline.json')
}

async function autoSave() {
  try {
    await window.api.writeJSON(projectStore.currentProject!, 'timeline.json',
      JSON.parse(JSON.stringify(timelines.value)))
  } catch (e: any) { ElMessage.error(e.message || '保存失败') }
}

function onSwitchTimeline() {
  selectedId.value = null
}

async function addTimeline() {
  const { value } = await ElMessageBox.prompt('时间线名称', '新建时间线')
  if (!value) return
  const id = `${Date.now()}`
  timelines.value.push({ id, name: value, nodes: [] })
  currentTimelineId.value = id
  selectedId.value = null
}

async function renameTimeline() {
  const tl = currentTimeline.value
  if (!tl) return
  const { value } = await ElMessageBox.prompt('新名称', '重命名', { inputValue: tl.name })
  if (value) tl.name = value
}

async function deleteTimeline() {
  if (timelines.value.length <= 1) return
  try {
    await ElMessageBox.confirm('确定删除当前时间线？', '确认')
    timelines.value = timelines.value.filter(t => t.id !== currentTimelineId.value)
    currentTimelineId.value = timelines.value[0]?.id || null
    selectedId.value = null
  } catch { /* cancelled */ }
}

function addNode() {
  const tl = currentTimeline.value
  if (!tl) return
  const years = tl.nodes.map(n => n.year).filter((y): y is number => y != null)
  const maxYear = years.length > 0 ? Math.max(...years) : -1
  const node: TimelineNode = { id: `${Date.now()}`, title: '', year: maxYear + 1, description: '' }
  tl.nodes.push(node)
  selectedId.value = node.id
}

function selectNode(node: TimelineNode) {
  selectedId.value = node.id
}

function deleteSelected() {
  const tl = currentTimeline.value
  if (!tl || !selectedId.value) return
  tl.nodes = tl.nodes.filter(n => n.id !== selectedId.value)
  selectedId.value = null
}

function zoomIn() { zoomAtCenter(1.2) }
function zoomOut() { zoomAtCenter(1 / 1.2) }

function zoomAtCenter(factor: number) {
  if (!canvasRef.value) { zoomLevel.value = Math.max(0.2, Math.min(3, zoomLevel.value * factor)); return }
  const el = canvasRef.value
  applyZoom(factor, el.clientWidth / 2)
}

function fitView() {
  zoomLevel.value = calcMinZoom()
  if (canvasRef.value) canvasRef.value.scrollLeft = 0
}

function calcMinZoom(): number {
  const el = canvasRef.value
  const canvasW = el ? el.clientWidth : 800
  const list = sortedNodes.value
  if (list.length < 2) return 1
  const yearRange = Math.max((list[list.length - 1].year ?? 0) - (list[0].year ?? 0), 1)
  return Math.max(0.2, Math.min(1, (canvasW - MARGIN_LEFT * 2) / (yearRange * BASE_PIXELS_PER_YEAR)))
}

function onWheel(e: WheelEvent) {
  if (!canvasRef.value) return
  const el = canvasRef.value
  if (e.ctrlKey || e.metaKey) {
    const rect = el.getBoundingClientRect()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    applyZoom(factor, e.clientX - rect.left)
  } else {
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    el.scrollLeft = Math.max(0, Math.min(maxScroll, el.scrollLeft + e.deltaY))
  }
}

function applyZoom(factor: number, viewportX: number) {
  const el = canvasRef.value!
  const oldPpy = pixelsPerYear()
  const oldScroll = el.scrollLeft
  const canvasX = oldScroll + viewportX
  const yearPixel = canvasX - MARGIN_LEFT
  const yearsFromMin = yearPixel / Math.max(oldPpy, 1)
  zoomLevel.value = Math.max(calcMinZoom(), Math.min(3, zoomLevel.value * factor))
  nextTick(() => {
    const newPpy = pixelsPerYear()
    el.scrollLeft = Math.max(0, yearsFromMin * newPpy + MARGIN_LEFT - viewportX)
  })
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; overflow: hidden }
.page-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px 0; flex-shrink: 0;
}
.page-header h2 { margin: 0; color: #e0e0e0 }
.page-toolbar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap }
.scale-label { color: #888; font-size: 12px; margin-left: 4px; min-width: 40px }

.timeline-canvas {
  flex: 1; overflow-x: auto; overflow-y: hidden;
  padding: 24px 0 12px 0; position: relative; min-height: 200px;
  cursor: default;
}

.timeline-axis { position: relative; width: 100%; min-width: 400px; min-height: 160px }

.timeline-line {
  position: absolute; top: 68px; left: 0; right: 0;
  height: 2px; background: rgba(64,158,255,0.3); pointer-events: none;
}

.timeline-track { position: relative; height: 160px }

.timeline-node {
  position: absolute; top: 60px; cursor: pointer; user-select: none;
  transition: margin-top 0.2s ease;
}

.timeline-click-area {
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 12px; margin: -8px -12px; min-width: 64px;
}

.timeline-dot {
  width: 16px; height: 16px; border-radius: 50%;
  background: #409EFF; margin-bottom: 6px;
  transition: transform 0.15s, box-shadow 0.15s; flex-shrink: 0;
}
.timeline-node.selected .timeline-dot { background: #67C23A; box-shadow: 0 0 10px rgba(103,194,58,0.6); transform: scale(1.3) }
.timeline-node:hover .timeline-dot { transform: scale(1.3); box-shadow: 0 0 8px rgba(64,158,255,0.5) }
.timeline-node-label { font-size: 13px; color: #ddd; line-height: 1.4; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.timeline-node-date { font-size: 11px; color: #888; margin-top: 1px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.timeline-empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #888 }

.page-panel { border-top: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; flex-shrink: 0 }
.page-panel h3 { margin: 0 0 12px; color: #ccc; font-size: 14px }
</style>
