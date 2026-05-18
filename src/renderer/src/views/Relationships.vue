<template>
  <div class="page">
    <div class="page-header">
      <h2>人物关系</h2>
      <div class="page-toolbar">
        <el-button @click="showAddRelation = true" type="primary">添加关系</el-button>
        <el-select v-model="filterType" placeholder="筛选关系类型" clearable size="small" style="width:160px">
          <el-option v-for="t in relationTypes" :key="t" :label="t" :value="t" />
        </el-select>
        <el-button @click="autoLayout">自动布局</el-button>
        <el-button @click="loadData">刷新</el-button>
      </div>
    </div>
    <div class="graph-container" ref="graphRef">
      <div v-if="!hasData" class="graph-empty">
        还没有关系数据，点击「添加关系」开始
      </div>
    </div>

    <el-dialog v-model="showAddRelation" title="添加关系" width="480px">
      <el-form label-position="top">
        <el-form-item label="源角色">
          <el-select v-model="newRelation.source" style="width:100%">
            <el-option v-for="c in characters" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标角色">
          <el-select v-model="newRelation.target" style="width:100%">
            <el-option v-for="c in characters.filter(c => c.id !== newRelation.source)" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关系类型">
          <el-select v-model="newRelation.type" style="width:100%" filterable allow-create>
            <el-option v-for="t in relationTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddRelation = false">取消</el-button>
        <el-button type="primary" @click="addRelation">确定</el-button>
      </template>
    </el-dialog>

    <div class="bottom-bar" v-if="selectedInfo">
      {{ selectedInfo }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const graphRef = ref()
const hasData = ref(false)
const selectedInfo = ref('')
const showAddRelation = ref(false)
const filterType = ref('')

const relationTypes = ['父母', '子女', '兄弟姐妹', '配偶', '恋人', '朋友', '师傅', '徒弟', '仇敌', '上下级', '同盟', '暗恋']
const characters = ref<Array<{ id: string; name: string }>>([])

const newRelation = ref({ source: '', target: '', type: '朋友' })

interface GraphNode { id: string; label: string }
interface GraphEdge { id: string; from: string; to: string; label: string }

let network: Network | null = null

onMounted(loadData)
onUnmounted(() => { if (network) network.destroy() })

function getNodeColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash % 360)
  return `hsl(${h}, 60%, 55%)`
}

async function loadData() {
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

  const nodes = new DataSet<GraphNode>(
    characters.value.map(c => ({ id: c.id, label: c.name, color: { background: getNodeColor(c.name), border: '#fff' } }))
  )

  const edgesData: GraphEdge[] = []
  if (relData?.edges) {
    for (const e of relData.edges) {
      if (filterType.value && e.label !== filterType.value) continue
      edgesData.push({ id: e.id || `${e.from}-${e.to}-${e.label}`, from: e.from, to: e.to, label: e.label })
    }
  }
  const edges = new DataSet<GraphEdge>(edgesData)
  hasData.value = true

  await nextTick()
  if (!graphRef.value) return

  if (network) network.destroy()

  network = new Network(graphRef.value, { nodes, edges }, {
    physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -40 } },
    edges: { arrows: { to: { enabled: false } }, font: { size: 11, color: '#aaa' }, smooth: { type: 'curvedCW' } },
    nodes: { font: { color: '#fff' }, shape: 'dot', size: 16 },
    interaction: { hover: true, tooltipDelay: 100 }
  })

  network.on('selectNode', (params: any) => {
    const nodeId = params.nodes[0]
    const char = characters.value.find(c => c.id === nodeId)
    if (char) selectedInfo.value = `已选中：${char.name}`
  })
  network.on('selectEdge', (params: any) => {
    const edgeId = params.edges[0]
    const edge = edges.get(edgeId) as GraphEdge | null
    if (edge) selectedInfo.value = `${edge.from} → ${edge.label} → ${edge.to}`
  })
  network.on('deselectNode', () => { selectedInfo.value = '' })
  network.on('deselectEdge', () => { selectedInfo.value = '' })
}

function autoLayout() {
  if (network) network.fit({ animation: true })
}

async function addRelation() {
  if (!newRelation.value.source || !newRelation.value.target) return
  const relData = await window.api.readJSON(projectStore.currentProject!, 'relationships.json') || { nodes: [], edges: [] }
  const edges = relData.edges || []
  edges.push({
    id: `${Date.now()}`,
    from: newRelation.value.source,
    to: newRelation.value.target,
    label: newRelation.value.type
  })
  await window.api.writeJSON(projectStore.currentProject!, 'relationships.json', { nodes: relData.nodes || [], edges })
  showAddRelation.value = false
  newRelation.value = { source: '', target: '', type: '朋友' }
  filterType.value = ''
  loadData()
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; overflow: hidden }
.page-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px 0;
}
.page-header h2 { margin: 0; color: #e0e0e0 }
.page-toolbar { display: flex; gap: 8px; align-items: center }
.graph-container { flex: 1; position: relative; margin: 8px }
.graph-empty {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  color: #888;
}
.bottom-bar {
  padding: 8px 16px;
  background: rgba(0,0,0,0.3);
  border-top: 1px solid rgba(255,255,255,0.06);
  color: #aaa; font-size: 13px;
}
</style>
