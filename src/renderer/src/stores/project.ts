import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useProjectStore = defineStore('project', () => {
  const currentProject = ref<string | null>(null)

  function setProject(name: string) {
    currentProject.value = name
  }

  function clearProject() {
    currentProject.value = null
  }

  return { currentProject, setProject, clearProject }
})
