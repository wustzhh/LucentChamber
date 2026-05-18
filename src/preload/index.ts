import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
  register: (username: string, password: string) =>
    ipcRenderer.invoke('auth:register', username, password),

  // Projects
  listProjects: (userId: number) =>
    ipcRenderer.invoke('project:list', userId),
  createProject: (name: string) =>
    ipcRenderer.invoke('project:create', name),
  deleteProject: (name: string) =>
    ipcRenderer.invoke('project:delete', name),

  // File ops
  readJSON: (projectName: string, filePath: string) =>
    ipcRenderer.invoke('file:readJSON', projectName, filePath),
  writeJSON: (projectName: string, filePath: string, data: any) =>
    ipcRenderer.invoke('file:writeJSON', projectName, filePath, data),
  readText: (projectName: string, filePath: string) =>
    ipcRenderer.invoke('file:readText', projectName, filePath),
  writeText: (projectName: string, filePath: string, data: string) =>
    ipcRenderer.invoke('file:writeText', projectName, filePath, data),
  listDir: (projectName: string, dirPath: string) =>
    ipcRenderer.invoke('file:listDir', projectName, dirPath),
  deleteFile: (projectName: string, filePath: string) =>
    ipcRenderer.invoke('file:deleteFile', projectName, filePath),

  // Image ops
  openImageDialog: () => ipcRenderer.invoke('dialog:openImage'),
  saveImage: (projectName: string, subDir: string, sourcePath: string) =>
    ipcRenderer.invoke('image:save', projectName, subDir, sourcePath),
  getImagePath: (projectName: string, subDir: string, filename: string) =>
    ipcRenderer.invoke('image:getPath', projectName, subDir, filename),
  readImageBase64: (projectName: string, subDir: string, filename: string) =>
    ipcRenderer.invoke('image:readBase64', projectName, subDir, filename)
})
