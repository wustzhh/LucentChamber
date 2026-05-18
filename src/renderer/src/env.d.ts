/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  api: {
    login: (username: string, password: string) => Promise<{ success: boolean; userId?: number; username?: string; error?: string }>
    register: (username: string, password: string) => Promise<{ success: boolean; userId?: number; error?: string }>
    listProjects: (userId: number) => Promise<Array<{ name: string; createdAt?: string }>>
    createProject: (name: string) => Promise<{ success: boolean; project?: any; error?: string }>
    deleteProject: (name: string) => Promise<{ success: boolean; error?: string }>
    readJSON: (projectName: string, filePath: string) => Promise<any>
    writeJSON: (projectName: string, filePath: string, data: any) => Promise<{ success: boolean }>
    readText: (projectName: string, filePath: string) => Promise<string>
    writeText: (projectName: string, filePath: string, data: string) => Promise<{ success: boolean }>
    listDir: (projectName: string, dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean }>>
    deleteFile: (projectName: string, filePath: string) => Promise<{ success: boolean }>
    openImageDialog: () => Promise<string | null>
    saveImage: (projectName: string, subDir: string, sourcePath: string) => Promise<{ success: boolean; filename?: string; path?: string }>
    getImagePath: (projectName: string, subDir: string, filename: string) => Promise<string>
    readImageBase64: (projectName: string, subDir: string, filename: string) => Promise<string | null>
  }
}
