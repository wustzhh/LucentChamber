import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { initDB, getUser, createUser } from './database'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null

function getDataDir(): string {
  let base: string
  if (app.isPackaged) {
    base = process.env.PORTABLE_EXECUTABLE_DIR || dirname(app.getPath('exe'))
  } else {
    base = process.cwd()
  }
  const dir = join(base, 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getWorkspacesDir(): string {
  const dir = join(getDataDir(), 'workspaces')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'LucentChamber'
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ====== IPC Handlers ======

// Auth
ipcMain.handle('auth:login', (_event, username: string, password: string) => {
  try {
    const db = initDB(getDataDir())
    const user = getUser(db, username, password)
    db.close()
    if (user) {
      return { success: true, userId: user.id, username: user.username }
    }
    return { success: false, error: '用户名或密码错误' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('auth:register', (_event, username: string, password: string) => {
  try {
    const db = initDB(getDataDir())
    const result = createUser(db, username, password)
    db.close()
    return result
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

// Project CRUD
ipcMain.handle('project:list', (_event, userId: number) => {
  const dir = getWorkspacesDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const projFile = join(dir, d.name, 'project.json')
      if (fs.existsSync(projFile)) {
        const meta = JSON.parse(fs.readFileSync(projFile, 'utf-8'))
        return { name: d.name, ...meta }
      }
      return { name: d.name }
    })
})

ipcMain.handle('project:create', (_event, name: string) => {
  const projDir = join(getWorkspacesDir(), name)
  if (fs.existsSync(projDir)) {
    return { success: false, error: '项目已存在' }
  }
  fs.mkdirSync(projDir, { recursive: true })
  fs.mkdirSync(join(projDir, 'characters'), { recursive: true })
  fs.mkdirSync(join(projDir, 'images'), { recursive: true })
  fs.mkdirSync(join(projDir, 'images', 'characters'), { recursive: true })
  fs.mkdirSync(join(projDir, 'images', 'maps'), { recursive: true })
  fs.mkdirSync(join(projDir, 'images', 'illustrations'), { recursive: true })

  const meta = { name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  fs.writeFileSync(join(projDir, 'project.json'), JSON.stringify(meta, null, 2))

  fs.writeFileSync(join(projDir, 'timeline.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(join(projDir, 'events.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(join(projDir, 'relationships.json'), JSON.stringify({ nodes: [], edges: [] }, null, 2))
  fs.writeFileSync(join(projDir, 'maps.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(join(projDir, 'novel.txt'), '')
  fs.writeFileSync(join(projDir, 'glossary.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(join(projDir, 'settings.json'), JSON.stringify([], null, 2))

  return { success: true, project: meta }
})

ipcMain.handle('project:delete', (_event, name: string) => {
  const projDir = join(getWorkspacesDir(), name)
  if (!fs.existsSync(projDir)) return { success: false, error: '项目不存在' }
  fs.rmSync(projDir, { recursive: true, force: true })
  return { success: true }
})

// File operations
ipcMain.handle('file:readJSON', (_event, projectName: string, filePath: string) => {
  const fullPath = join(getWorkspacesDir(), projectName, filePath)
  if (!fs.existsSync(fullPath)) return null
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
})

ipcMain.handle('file:writeJSON', (_event, projectName: string, filePath: string, data: any) => {
  const fullPath = join(getWorkspacesDir(), projectName, filePath)
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2))
  return { success: true }
})

ipcMain.handle('file:readText', (_event, projectName: string, filePath: string) => {
  const fullPath = join(getWorkspacesDir(), projectName, filePath)
  if (!fs.existsSync(fullPath)) return ''
  return fs.readFileSync(fullPath, 'utf-8')
})

ipcMain.handle('file:writeText', (_event, projectName: string, filePath: string, data: string) => {
  const fullPath = join(getWorkspacesDir(), projectName, filePath)
  fs.writeFileSync(fullPath, data, 'utf-8')
  return { success: true }
})

ipcMain.handle('file:listDir', (_event, projectName: string, dirPath: string) => {
  const fullPath = join(getWorkspacesDir(), projectName, dirPath)
  if (!fs.existsSync(fullPath)) return []
  return fs.readdirSync(fullPath, { withFileTypes: true })
    .map(d => ({ name: d.name, isDirectory: d.isDirectory() }))
})

ipcMain.handle('file:deleteFile', (_event, projectName: string, filePath: string) => {
  const fullPath = join(getWorkspacesDir(), projectName, filePath)
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
  return { success: true }
})

// Image operations
ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('image:save', (_event, projectName: string, subDir: string, sourcePath: string) => {
  const ext = sourcePath.split('.').pop() || 'png'
  const filename = `${Date.now()}.${ext}`
  const targetDir = join(getWorkspacesDir(), projectName, 'images', subDir)
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
  const targetPath = join(targetDir, filename)
  fs.copyFileSync(sourcePath, targetPath)
  return { success: true, filename, path: targetPath }
})

ipcMain.handle('image:getPath', (_event, projectName: string, subDir: string, filename: string) => {
  return join(getWorkspacesDir(), projectName, 'images', subDir, filename)
})

ipcMain.handle('image:readBase64', (_event, projectName: string, subDir: string, filename: string) => {
  const fullPath = join(getWorkspacesDir(), projectName, 'images', subDir, filename)
  if (!fs.existsSync(fullPath)) return null
  const ext = fullPath.split('.').pop()?.toLowerCase() || 'png'
  const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }
  const mime = mimeMap[ext] || 'image/png'
  const data = fs.readFileSync(fullPath).toString('base64')
  return `data:${mime};base64,${data}`
})

// ====== App lifecycle ======
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
