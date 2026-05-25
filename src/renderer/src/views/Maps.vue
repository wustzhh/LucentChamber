<template>
  <div class="page page-split">
    <div class="page-left">
      <div class="list-header">
        <el-button @click="addMap" type="primary" size="small" style="width:100%">+ 新建地图</el-button>
      </div>
      <div class="list-body">
        <div v-for="(m, i) in maps" :key="i" class="list-item"
          :class="{ active: selectedIndex === i }"
          @click="selectedIndex = i">
          <div class="list-item-title">{{ m.name || '未命名地图' }}</div>
        </div>
        <div v-if="maps.length === 0" class="list-empty">暂无地图</div>
      </div>
    </div>
    <div class="page-right" v-if="selectedIndex !== null">
      <h3>地图详情</h3>
      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="current.name" />
        </el-form-item>
        <el-form-item label="地图图片">
          <div class="map-image-area">
            <img v-if="current.image" :src="getImageSrc(current.image)" class="map-preview" />
            <div v-else class="map-placeholder">暂无图片</div>
          </div>
          <el-button size="small" @click="uploadMapImage" style="margin-top:8px">更换图片</el-button>
        </el-form-item>
        <el-form-item label="类型">
          <TagPicker v-model="current.type" category="地图标签" placeholder="选择或输入类型" size="small" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="current.description" type="textarea" :rows="5" />
        </el-form-item>
        <div style="display:flex;gap:8px">
          <el-button @click="saveMaps" type="primary">保存</el-button>
          <el-button @click="deleteMap(selectedIndex)" type="danger" plain>删除地图</el-button>
        </div>
      </el-form>
    </div>
    <div class="page-right page-empty" v-else>
      选择一个地图查看详情
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import TagPicker from '@/components/TagPicker.vue'

interface MapData { name: string; image: string; description: string; type: string }

const projectStore = useProjectStore()
const maps = ref<MapData[]>([])
const selectedIndex = ref<number | null>(null)
const imageSrcCache = ref<Record<string, string>>({})

const current = computed(() => maps.value[selectedIndex.value!] || null)

onMounted(async () => {
  const data = await window.api.readJSON(projectStore.currentProject!, 'maps.json')
  if (data) {
    maps.value = data
    for (const m of maps.value) {
      if (m.image) {
        imageSrcCache.value[m.image] = await window.api.readImageBase64(projectStore.currentProject!, 'maps', m.image) || ''
      }
    }
  }
})

function getImageSrc(filename: string): string {
  return imageSrcCache.value[filename] || ''
}

async function saveMaps() {
  await window.api.writeJSON(projectStore.currentProject!, 'maps.json', JSON.parse(JSON.stringify(maps.value)))
  ElMessage.success('保存成功')
}

function addMap() {
  maps.value.push({ name: '', image: '', description: '', type: '' })
  selectedIndex.value = maps.value.length - 1
}

async function uploadMapImage() {
  const path = await window.api.openImageDialog()
  if (!path) return
  const result = await window.api.saveImage(projectStore.currentProject!, 'maps', path)
  if (result.success && result.filename) {
    current.value!.image = result.filename
    imageSrcCache.value[result.filename] = await window.api.readImageBase64(projectStore.currentProject!, 'maps', result.filename) || ''
  }
}

function deleteMap(i: number) {
  maps.value.splice(i, 1)
  if (selectedIndex.value === i) selectedIndex.value = null
  saveMaps()
}
</script>

<style scoped>
.page { height: 100%; overflow: hidden }
.page-split { display: flex }
.page-left {
  width: 220px; border-right: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.list-header { padding: 12px }
.list-body { flex: 1; overflow-y: auto }
.list-item { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03) }
.list-item:hover { background: rgba(255,255,255,0.04) }
.list-item.active { background: rgba(64,158,255,0.1); border-left: 2px solid #409EFF }
.list-item-title { font-size: 14px; color: #ddd }
.list-empty { text-align: center; color: #888; padding: 24px; font-size: 14px }
.page-right { flex: 1; padding: 16px 24px; overflow-y: auto }
.page-right h3 { margin: 0 0 16px; color: #ccc; font-size: 16px }
.page-empty { display: flex; align-items: center; justify-content: center; color: #888 }
.map-image-area {
  width: 100%; min-height: 200px; max-height: 400px; overflow: hidden;
  border-radius: 8px; background: rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center;
}
.map-preview { max-width: 100%; max-height: 400px; object-fit: contain }
.map-placeholder { color: #888 }
</style>
