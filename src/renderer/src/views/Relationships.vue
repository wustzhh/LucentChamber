<template>
  <div class="page">
    <div class="page-header">
      <h2>人物关系</h2>
      <div class="page-toolbar">
        <el-button @click="showAddRelation = true" type="primary">添加关系</el-button>
        <el-select v-model="filterType" placeholder="筛选" clearable size="small" style="width:120px" @change="loadData">
          <el-option v-for="t in relationTypes" :key="t" :label="t" :value="t" />
        </el-select>
        <el-button @click="autoLayout">适应</el-button>
        <el-button @click="loadData">刷新</el-button>
      </div>
    </div>
    <div class="graph-container" ref="graphRef" @click="onGraphClick">
      <div v-if="!hasData" class="graph-empty">
        <p v-if="characters.length === 0">请先在「人物」页面创建角色</p>
        <p v-else>还没有关系数据，点击「添加关系」开始</p>
      </div>
      <div class="bottom-bar" v-if="selectedInfo.length > 0">
        <div style="font-size:12px;color:#888;margin-bottom:4px">共 {{ selectedInfo.length }} 条关系</div>
        <div v-for="item in selectedInfo" :key="item.id" class="relation-row">
          <span>{{ getCharName(item.from) }}</span>
          <span class="arr">→</span>
          <el-tag size="small" type="warning">{{ item.label }}</el-tag>
          <span class="arr">→</span>
          <span>{{ getCharName(item.to) }}</span>
          <el-button type="danger" link size="small" @click="deleteRelation(item)">删除</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="showAddRelation" title="添加关系" width="460px">
      <el-form label-position="top">
        <el-form-item label="源角色">
          <el-select v-model="newRelation.source" style="width:100%" placeholder="选择角色">
            <el-option v-for="c in characters" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标角色">
          <el-select v-model="newRelation.target" style="width:100%" placeholder="选择角色">
            <el-option v-for="c in characters.filter(c => c.id !== newRelation.source)" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关系类型">
          <el-select v-model="newRelation.type" style="width:100%" filterable allow-create placeholder="选择或输入">
            <el-option v-for="t in relationTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddRelation = false">取消</el-button>
        <el-button type="primary" @click="addRelation">确定</el-button>
      </template>
    </el-dialog>

    <div class="status-bar">节点 {{ characters.length }} · 连线 {{ edgeCount }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const graphRef = ref<HTMLElement | null>(null)
const hasData = ref(false)
const selectedInfo = ref<GraphEdge[]>([])
const showAddRelation = ref(false)
const filterType = ref('')
const edgeCount = ref(0)

const relationTypes = ['父母', '子女', '兄弟姐妹', '配偶', '恋人', '朋友', '师傅', '徒弟', '仇敌', '上下级', '同盟', '暗恋']
const characters = ref<Array<{ id: string; name: string }>>([])
const newRelation = ref({ source: '', target: '', type: '朋友' })

interface GraphNode { id: string; label: string }
interface GraphEdge { id: string; from: string; to: string; label: string }

let network: Network | null = null
let edgesDs: DataSet<GraphEdge> | null = null
let allEdges: GraphEdge[] = []
let savedPositions: Record<string, { x: number; y: number }> = {}

onMounted(loadData)
onUnmounted(() => {
  if (network) network.destroy()
  network = null; edgesDs = null
})

function getCharName(id: string): string {
  return characters.value.find(c => c.id === id)?.name || id
}

function getNodeColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash % 360)}, 60%, 55%)`
}

// Single click handler on the container — reads latest network/edgesDs
function onGraphClick(e: MouseEvent) {
  const nw = network
  const eds = edgesDs
  if (!nw || !eds || !graphRef.value) return
  const rect = graphRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const nodeId = nw.getNodeAt({ x, y })
  if (nodeId) {
    const all = eds.get() as GraphEdge[]
    const nid = String(nodeId)
    selectedInfo.value = all.filter(edge => String(edge.from) === nid || String(edge.to) === nid)
    return
  }

  const edgeId = nw.getEdgeAt({ x, y })
  if (edgeId) {
    const edge = eds.get(edgeId as string) as GraphEdge | null
    if (edge) {
      const all = eds.get() as GraphEdge[]
      selectedInfo.value = all.filter(e =>
        (e.from === edge.from && e.to === edge.to) || (e.from === edge.to && e.to === edge.from)
      )
    }
    return
  }
}

async function loadData() {
  // Save positions before destroy
  if (network) {
    try {
      const pos = network.getPositions()
      if (pos && Object.keys(pos).length > 0) savedPositions = pos as Record<string, { x: number; y: number }>
    } catch { /* ignore */ }
    network.destroy()
    network = null
  }

  const [relData, charFiles] = await Promise.all([
    window.api.readJSON(projectStore.currentProject!, 'relationships.json'),
    window.api.listDir(projectStore.currentProject!, 'characters')
  ])

  characters.value = []
  for (const f of charFiles) {
    if (f.name.endsWith('.json')) {
      const data = await window.api.readJSON(projectStore.currentProject!, `characters/${f.name}`)
      if (data?.name) characters.value.push({ id: f.name.replace('.json', ''), name: data.name })
    }
  }

  if (characters.value.length === 0) {
    hasData.value = false
    edgeCount.value = 0
    return
  }

  const nodeItems = characters.value.map(c => {
    const base: any = {
      id: c.id, label: c.name,
      color: { background: getNodeColor(c.name), border: '#fff' }
    }
    if (savedPositions[c.id]) {
      base.x = savedPositions[c.id].x
      base.y = savedPositions[c.id].y
    }
    return base
  })
  const nodes = new DataSet<GraphNode>(nodeItems)

  allEdges = []
  if (relData?.edges) {
    for (const e of relData.edges) {
      if (filterType.value && e.label !== filterType.value) continue
      allEdges.push({
        id: e.id || `${e.from}-${e.to}-${e.label}`,
        from: e.from, to: e.to, label: e.label
      })
    }
  }
  const edges = new DataSet<GraphEdge>(allEdges)
  edgesDs = edges
  edgeCount.value = allEdges.length
  hasData.value = true

  await nextTick()
  if (!graphRef.value) return

  const hasSavedPositions = Object.keys(savedPositions).length > 0

  network = new Network(graphRef.value, { nodes, edges }, {
    physics: {
      enabled: !hasSavedPositions,
      stabilization: { iterations: 200 },
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -40, centralGravity: 0.005, springLength: 150 }
    },
    edges: { arrows: { to: { enabled: false } }, font: { size: 10, color: '#aaa' }, smooth: { type: 'curvedCW' } },
    nodes: { font: { color: '#fff' }, shape: 'dot', size: 20 },
    interaction: { hover: true, tooltipDelay: 100, selectable: true, selectConnectedEdges: false }
  })

  if (!hasSavedPositions) {
    network.once('stabilizationIterationsDone', () => {
      if (network) {
        try { savedPositions = network.getPositions() as Record<string, { x: number; y: number }> } catch { /* ignore */ }
        network.setOptions({ physics: { enabled: false } } as any)
      }
    })
  }

  setTimeout(() => {
    if (network) network.fit({ animation: hasSavedPositions })
  }, hasSavedPositions ? 100 : 300)
}

function autoLayout() {
  if (network) network.fit({ animation: true })
}

async function addRelation() {
  const { source, target, type } = newRelation.value
  if (!source || !target) { ElMessage.warning('请选择源角色和目标角色'); return }
  if (source === target) { ElMessage.warning('不能与自己建立关系'); return }
  try {
    const relData = await window.api.readJSON(projectStore.currentProject!, 'relationships.json') || { nodes: [], edges: [] }
    const edges = relData.edges || []
    if (edges.find((e: any) => ((e.from === source && e.to === target) || (e.from === target && e.to === source)) && e.label === type)) {
      ElMessage.warning('该关系已存在'); return
    }
    edges.push({ id: `${Date.now()}`, from: source, to: target, label: type })
    await window.api.writeJSON(projectStore.currentProject!, 'relationships.json', { nodes: relData.nodes || [], edges })
    showAddRelation.value = false
    newRelation.value = { source: '', target: '', type: '朋友' }
    filterType.value = ''
    ElMessage.success('关系已添加')
    await loadData()
  } catch (e: any) { ElMessage.error(e.message || '保存失败') }
}

async function deleteRelation(edge: GraphEdge) {
  try {
    await ElMessageBox.confirm(`删除「${getCharName(edge.from)} → ${edge.label} → ${getCharName(edge.to)}」？`, '确认删除')
    const relData = await window.api.readJSON(projectStore.currentProject!, 'relationships.json') || { nodes: [], edges: [] }
    relData.edges = (relData.edges || []).filter((e: any) => e.id !== edge.id)
    await window.api.writeJSON(projectStore.currentProject!, 'relationships.json', relData)
    selectedInfo.value = selectedInfo.value.filter(e => e.id !== edge.id)
    ElMessage.success('已删除')
    await loadData()
  } catch { /* cancelled */ }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; overflow: hidden }

.page-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px 0; flex-shrink: 0 }
.page-header h2 { margin: 0; color: #e0e0e0 }
.page-toolbar { display: flex; gap: 8px; align-items: center }

.graph-container { flex: 1 1 0; min-height: 0; margin: 8px; border-radius: 8px; background: rgba(0,0,0,0.15); position: relative; overflow: hidden }
.graph-empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #888; text-align: center; font-size: 14px }
.graph-empty p { margin: 4px 0 }

.bottom-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 6px 12px; max-height: 140px; overflow-y: auto;
  background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);
  border-top: 1px solid rgba(255,255,255,0.1);
  z-index: 10;
}
.relation-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 13px; color: #ccc }
.arr { color: #666; font-size: 11px }

.status-bar { padding: 3px 16px; font-size: 12px; color: #666; flex-shrink: 0; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.04) }
</style>
