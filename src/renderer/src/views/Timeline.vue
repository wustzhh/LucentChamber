<template>
  <div class="page">
    <div class="page-header">
      <h2>时间线</h2>
      <div class="page-toolbar">
        <el-button type="primary" @click="addNode">添加节点</el-button>
        <el-button-group>
          <el-button @click="zoomOut">-</el-button>
          <el-button @click="zoomIn">+</el-button>
        </el-button-group>
        <el-button @click="fitView">适应窗口</el-button>
      </div>
    </div>
    <div class="timeline-canvas" ref="canvasRef">
      <div class="timeline-axis" :style="{ transform: `scale(${scale})`, transformOrigin: 'left center' }">
        <div class="timeline-track">
          <div v-for="(node, i) in nodes" :key="i" class="timeline-node"
            :style="{ left: `${node.position || i * 150 + 60}px` }"
            :class="{ selected: selectedIndex === i }"
            @click="selectNode(i)">
            <div class="timeline-dot"></div>
            <div class="timeline-node-label">{{ node.title || '节点 ' + (i + 1) }}</div>
            <div class="timeline-node-date">{{ node.year || '年份' }}</div>
          </div>
        </div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-empty" v-if="nodes.length === 0">
        点击「添加节点」创建第一个时间节点
      </div>
    </div>
    <div class="page-panel" v-if="selectedIndex !== null">
      <h3>节点详情</h3>
      <el-form label-position="top">
        <el-form-item label="标题">
          <el-input v-model="nodes[selectedIndex].title" placeholder="如：太古纪元" />
        </el-form-item>
        <el-form-item label="年份">
          <el-input v-model="nodes[selectedIndex].year" placeholder="如：太古历元年" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="nodes[selectedIndex].description" type="textarea" :rows="4" />
        </el-form-item>
        <el-button @click="saveTimeline" type="primary">保存</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'

interface TimelineNode {
  title: string
  year: string
  description: string
  position: number
}

const projectStore = useProjectStore()
const nodes = ref<TimelineNode[]>([])
const selectedIndex = ref<number | null>(null)
const canvasRef = ref()
const scale = ref(1)

onMounted(async () => {
  const data = await loadData()
  if (data) nodes.value = data
})

async function loadData() {
  return window.api.readJSON(projectStore.currentProject!, 'timeline.json')
}

async function saveTimeline() {
  await window.api.writeJSON(projectStore.currentProject!, 'timeline.json', nodes.value)
}

function addNode() {
  nodes.value.push({ title: '', year: '', description: '', position: nodes.value.length * 150 + 60 })
  selectedIndex.value = nodes.value.length - 1
}

function selectNode(i: number) {
  selectedIndex.value = i
}

function zoomIn() {
  scale.value = Math.min(scale.value + 0.1, 2)
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.1, 0.3)
}

function fitView() {
  scale.value = 1
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; overflow: hidden }
.page-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px 0;
}
.page-header h2 { margin: 0; color: #e0e0e0 }
.page-toolbar { display: flex; gap: 8px }
.timeline-canvas {
  flex: 1; overflow: auto; padding: 40px 24px;
  position: relative; min-height: 200px;
}
.timeline-axis { position: relative; padding: 60px 0 }
.timeline-line {
  position: absolute; top: 60px; left: 0; right: 0;
  height: 2px; background: rgba(64,158,255,0.3);
}
.timeline-track { position: relative; height: 120px }
.timeline-node {
  position: absolute; top: 0; cursor: pointer; text-align: center;
  transform: translateX(-50%);
}
.timeline-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: #409EFF; margin: 0 auto 8px;
}
.timeline-node.selected .timeline-dot {
  background: #67C23A; box-shadow: 0 0 8px rgba(103,194,58,0.5);
}
.timeline-node-label { font-size: 13px; color: #ddd }
.timeline-node-date { font-size: 11px; color: #888; margin-top: 2px }
.timeline-empty { text-align: center; color: #888; margin-top: 80px }
.page-panel {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 16px 24px;
}
.page-panel h3 { margin: 0 0 12px; color: #ccc; font-size: 14px }
</style>
