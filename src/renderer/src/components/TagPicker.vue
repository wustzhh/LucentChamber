<template>
  <div style="position:relative">
    <el-select
      :model-value="modelValue"
      @update:model-value="onChange"
      filterable
      allow-create
      default-first-option
      :placeholder="placeholder"
      :size="size"
      :style="style"
      @visible-change="onVisible"
    >
      <el-option v-for="t in tags" :key="t.name" :label="t.name" :value="t.name">
        <span style="display:flex;align-items:center;gap:6px">
          <span :style="{ width:'8px', height:'8px', borderRadius:'50%', background: t.color, flexShrink:0 }"></span>
          <span>{{ t.name }}</span>
          <span style="font-size:10px;color:#666;margin-left:auto">{{ t.category }}</span>
        </span>
      </el-option>
    </el-select>
    <span v-if="debug" style="position:absolute;right:0;top:-14px;font-size:10px;color:#666">{{ tags.length }} / {{ status }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'

const props = withDefaults(defineProps<{
  modelValue: string
  category: string
  placeholder?: string
  size?: string
  style?: string
}>(), {
  placeholder: '选择或输入',
  size: 'small',
  style: 'width:100%'
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const projectStore = useProjectStore()
const tags = ref<Array<{ id: string; name: string; category: string; color: string }>>([])
const status = ref('')
const debug = ref(true)

const DEFAULT_COLORS = [
  '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
  '#B37FEB', '#36CFC9', '#FF85C0', '#597EF7', '#73D13D',
  '#FFC53D', '#FF7A45', '#9254DE', '#5CDBD3', '#F759AB',
  '#40A9FF', '#95DE64', '#FFD666', '#FF9C6E', '#B6B7F9'
]

function pickColor(glossary: any[]): string {
  const used = new Set(glossary.map((c: any) => c.color).filter(Boolean))
  for (const c of DEFAULT_COLORS) {
    if (!used.has(c)) return c
  }
  return `hsl(${Math.floor(Math.random() * 360)},55%,55%)`
}

async function ensureCategoriesHaveColors() {
  const glossary = await readGlossary()
  let changed = false
  for (const cat of glossary) {
    if (!cat.color) {
      cat.color = pickColor(glossary)
      changed = true
    }
  }
  if (changed) await writeGlossary(glossary)
}

onMounted(async () => {
  status.value = 'loading'
  try {
    await ensureCategoriesHaveColors()
    await ensureCategory()
    await fetchTags()
    status.value = 'ok'
  } catch (e: any) {
    status.value = 'err:' + (e.message || '?')
  }
})

async function readGlossary(): Promise<any[]> {
  const proj = projectStore.currentProject
  if (!proj) throw new Error('no project')
  return await window.api.readJSON(proj, 'glossary.json') || []
}

async function writeGlossary(glossary: any[]) {
  const proj = projectStore.currentProject
  if (!proj) throw new Error('no project')
  await window.api.writeJSON(proj, 'glossary.json', JSON.parse(JSON.stringify(glossary)))
}

async function ensureCategory() {
  const glossary = await readGlossary()
  if (!glossary.find((c: any) => c.name === props.category)) {
    glossary.push({ id: `${Date.now()}`, name: props.category, terms: [], color: pickColor(glossary) })
    await writeGlossary(glossary)
  }
}

async function fetchTags() {
  const glossary = await readGlossary()
  const seen = new Set<string>()
  const all: Array<{ id: string; name: string; category: string; color: string }> = []
  for (const cat of glossary) {
    const color = cat.color || DEFAULT_COLORS[0]
    if (cat.terms) {
      for (const t of cat.terms) {
        if (!seen.has(t.name)) {
          seen.add(t.name)
          all.push({ id: t.id, name: t.name, category: cat.name, color })
        }
      }
    }
  }
  tags.value = all
  status.value = tags.value.length + ''
}

async function onVisible(visible: boolean) {
  if (visible) await fetchTags()
}

async function onChange(value: string) {
  emit('update:modelValue', value || '')
  if (!value) return
  try {
    const glossary = await readGlossary()
    let cat = glossary.find((c: any) => c.name === props.category)
    if (!cat) {
      cat = { id: `${Date.now()}`, name: props.category, terms: [] }
      glossary.push(cat)
    }
    if (!cat.terms.find((t: any) => t.name === value)) {
      cat.terms.push({ id: `${Date.now()}`, name: value, description: '' })
      await writeGlossary(glossary)
      const color = cat.color || DEFAULT_COLORS[0]
      tags.value.push({ id: `${Date.now()}`, name: value, category: props.category, color })
      status.value = tags.value.length + '+'
    }
  } catch (e: any) {
    status.value = 'e:' + (e.message || '?')
  }
}
</script>
