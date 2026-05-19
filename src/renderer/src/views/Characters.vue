<template>
  <div class="page page-split">
    <div class="page-left">
      <div class="list-header">
        <el-button @click="addCharacter" type="primary" size="small" style="width:100%">+ 新建角色</el-button>
      </div>
      <div class="list-body">
        <div
          v-for="(ch, i) in characterList"
          :key="ch.filename"
          class="list-item"
          :class="{ active: selectedIndex === i, 'drag-over': dragOverIndex === i }"
          draggable="true"
          @click="selectCharacter(i)"
          @dragstart="onDragStart($event, ch)"
          @dragover.prevent="onDragOver($event, i)"
          @dragleave="dragOverIndex = null"
          @drop="onDrop(ch)"
        >
          <div class="drag-handle">⠿</div>
          <div class="list-item-avatar">
            <el-avatar :size="32" :src="ch.avatarSrc || ''">{{ ch.name?.[0] || '?' }}</el-avatar>
          </div>
          <div class="list-item-info">
            <div class="list-item-title">{{ ch.name || '未命名' }}</div>
            <div class="list-item-sub">{{ ch.gender || '' }} {{ ch.age ? ch.age + '岁' : '' }}</div>
          </div>
        </div>
        <div v-if="characterList.length === 0" class="list-empty">暂无角色</div>
      </div>
    </div>
    <div class="page-right" v-if="selectedIndex !== null">
      <h3>角色详情</h3>
      <el-form label-position="top">
        <el-form-item label="头像">
          <div style="display:flex;align-items:center;gap:12px">
            <el-avatar :size="64" :src="current.avatarSrc || ''">{{ current.name?.[0] || '?' }}</el-avatar>
            <el-button size="small" @click="uploadAvatar">更换头像</el-button>
          </div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="姓名">
              <el-input v-model="current.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别">
              <el-select v-model="current.gender" style="width:100%">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="年龄">
          <el-input-number v-model="current.age" :min="0" style="width:200px" />
        </el-form-item>
        <el-form-item label="性格">
          <el-input v-model="current.personality" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="外貌">
          <el-input v-model="current.appearance" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="背景故事">
          <el-input v-model="current.background" type="textarea" :rows="4" />
        </el-form-item>

        <el-divider>自定义字段</el-divider>
        <div v-for="(field, fi) in current.customFields" :key="fi" class="custom-field-row">
          <el-row :gutter="8">
            <el-col :span="6">
              <el-input v-model="field.name" placeholder="字段名" size="small" />
            </el-col>
            <el-col :span="6">
              <el-select v-model="field.type" size="small" style="width:100%">
                <el-option label="文本" value="text" />
                <el-option label="数字" value="number" />
                <el-option label="日期" value="date" />
                <el-option label="长文本" value="textarea" />
                <el-option label="下拉选项" value="select" />
                <el-option label="图片" value="image" />
              </el-select>
            </el-col>
            <el-col :span="9">
              <template v-if="field.type === 'select'">
                <el-input v-model="field.value" placeholder="选项用逗号分隔" size="small" />
              </template>
              <template v-else-if="field.type === 'image'">
                <el-button size="small" @click="uploadCustomImage(fi)">选择图片</el-button>
                <span v-if="field.value" style="font-size:11px;color:#888;margin-left:4px">{{ field.value }}</span>
              </template>
              <template v-else>
                <el-input v-model="field.value" :type="field.type === 'number' ? 'number' : 'text'"
                  :placeholder="fieldPlaceholder(field.type)" size="small" />
              </template>
            </el-col>
            <el-col :span="3">
              <el-button type="danger" :icon="Delete" circle size="small" @click="removeCustomField(fi)" />
            </el-col>
          </el-row>
        </div>
        <el-button type="primary" link @click="addCustomField">+ 添加自定义字段</el-button>

        <div style="margin-top:16px">
          <el-button @click="deleteCurrent" type="danger" plain>删除角色</el-button>
        </div>
      </el-form>
    </div>
    <div class="page-right page-empty" v-else>
      选择一个角色查看详情
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'

interface CustomField { name: string; type: string; value: string }
interface Character {
  filename: string
  name: string; gender: string; age: number
  personality: string; appearance: string; background: string
  avatarPath: string; avatarSrc: string
  customFields: CustomField[]
}

const projectStore = useProjectStore()
const characterList = ref<Character[]>([])
const selectedIndex = ref<number | null>(null)
const loading = ref(false)
const dragOverIndex = ref<number | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dragSrc: Character | null = null

const current = computed(() => {
  if (selectedIndex.value === null || selectedIndex.value >= characterList.value.length) return null
  return characterList.value[selectedIndex.value]
})

onMounted(async () => {
  loading.value = true
  await loadCharacters()
  loading.value = false
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

watch(characterList, () => {
  if (loading.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 800)
}, { deep: true })

async function loadCharacters() {
  const files = await window.api.listDir(projectStore.currentProject!, 'characters')
  const list: Character[] = []
  for (const f of files) {
    if (f.name.endsWith('.json')) {
      const data = await window.api.readJSON(projectStore.currentProject!, `characters/${f.name}`)
      if (data) {
        const ch: Character = { filename: f.name, ...defaultChar(), ...data, avatarSrc: '' }
        if (ch.avatarPath) {
          ch.avatarSrc = await window.api.readImageBase64(projectStore.currentProject!, 'characters', ch.avatarPath) || ''
        }
        list.push(ch)
      }
    }
  }
  // Apply saved order
  const orderData = await window.api.readJSON(projectStore.currentProject!, 'characters_order.json')
  if (orderData && Array.isArray(orderData)) {
    const orderMap = new Map(orderData.map((fn: string, idx: number) => [fn, idx]))
    list.sort((a, b) => (orderMap.get(a.filename) ?? 999) - (orderMap.get(b.filename) ?? 999))
  }
  characterList.value = list
}

async function autoSave() {
  for (const ch of characterList.value) {
    const data = JSON.parse(JSON.stringify({
      name: ch.name, gender: ch.gender, age: ch.age,
      personality: ch.personality, appearance: ch.appearance, background: ch.background,
      avatarPath: ch.avatarPath, customFields: ch.customFields
    }))
    await window.api.writeJSON(projectStore.currentProject!, `characters/${ch.filename}`, data)
  }
  // Save order
  await window.api.writeJSON(projectStore.currentProject!, 'characters_order.json',
    characterList.value.map(c => c.filename))
}

function defaultChar(): Omit<Character, 'filename'> {
  return {
    name: '', gender: '', age: 0,
    personality: '', appearance: '', background: '',
    avatarPath: '', avatarSrc: '', customFields: []
  }
}

function selectCharacter(i: number) { selectedIndex.value = i }

async function addCharacter() {
  const { value } = await ElMessageBox.prompt('角色名称', '新建角色')
  if (!value) return
  const filename = `${value}.json`
  const newChar: Character = { filename, ...defaultChar(), name: value }
  characterList.value.push(newChar)
  selectedIndex.value = characterList.value.length - 1
}

async function deleteCurrent() {
  if (selectedIndex.value === null) return
  try {
    const ch = characterList.value[selectedIndex.value]
    await ElMessageBox.confirm(`确定删除「${ch.name}」？`, '确认')
    loading.value = true
    await window.api.deleteFile(projectStore.currentProject!, `characters/${ch.filename}`)
    characterList.value.splice(selectedIndex.value, 1)
    selectedIndex.value = null
    loading.value = false
    ElMessage.success('已删除')
  } catch { /* cancelled */ }
}

async function uploadAvatar() {
  const path = await window.api.openImageDialog()
  if (!path) return
  const result = await window.api.saveImage(projectStore.currentProject!, 'characters', path)
  if (result.success && result.filename) {
    current.value!.avatarPath = result.filename
    current.value!.avatarSrc = await window.api.readImageBase64(projectStore.currentProject!, 'characters', result.filename) || ''
  }
}

async function uploadCustomImage(fi: number) {
  const path = await window.api.openImageDialog()
  if (!path) return
  const result = await window.api.saveImage(projectStore.currentProject!, 'characters', path)
  if (result.success && result.filename) {
    current.value!.customFields[fi].value = result.filename
  }
}

function addCustomField() {
  current.value?.customFields.push({ name: '', type: 'text', value: '' })
}

function removeCustomField(i: number) {
  current.value?.customFields.splice(i, 1)
}

function fieldPlaceholder(type: string) {
  return type === 'date' ? 'YYYY-MM-DD' : type === 'number' ? '0' : '输入值'
}

function onDragStart(e: DragEvent, ch: Character) {
  dragSrc = ch
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(_e: DragEvent, i: number) {
  dragOverIndex.value = i
}

function onDrop(target: Character) {
  dragOverIndex.value = null
  if (!dragSrc || dragSrc === target) return
  const fromIdx = characterList.value.indexOf(dragSrc)
  const toIdx = characterList.value.indexOf(target)
  if (fromIdx === -1 || toIdx === -1) return
  const [item] = characterList.value.splice(fromIdx, 1)
  characterList.value.splice(toIdx, 0, item)
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
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.list-item:hover { background: rgba(255,255,255,0.04) }
.list-item.active { background: rgba(64,158,255,0.1); border-left: 2px solid #409EFF }
.list-item.drag-over { background: rgba(64,158,255,0.15); border-left: 2px solid #67C23A }
.drag-handle { color: #555; cursor: grab; font-size: 16px; line-height: 1; user-select: none; flex-shrink: 0 }
.drag-handle:active { cursor: grabbing }
.list-item-avatar { flex-shrink: 0 }
.list-item-info { flex: 1; min-width: 0 }
.list-item-title { font-size: 14px; color: #ddd }
.list-item-sub { font-size: 12px; color: #888; margin-top: 2px }
.list-empty { text-align: center; color: #888; padding: 24px; font-size: 14px }
.page-right { flex: 1; padding: 16px 24px; overflow-y: auto }
.page-right h3 { margin: 0 0 16px; color: #ccc; font-size: 16px }
.page-empty { display: flex; align-items: center; justify-content: center; color: #888 }
.custom-field-row { margin-bottom: 8px }
</style>
