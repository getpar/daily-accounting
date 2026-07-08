import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 分类
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  addCategory: (data: { category_key: string; category_name: string; subcategory_key: string; subcategory_name: string }) =>
    ipcRenderer.invoke('categories:add', data),
  deleteCategory: (categoryKey: string, subcategoryKey: string) =>
    ipcRenderer.invoke('categories:delete', categoryKey, subcategoryKey),

  // 流水记录
  addRecord: (data: { type: string; amount: number; category_key: string; subcategory_key: string; note: string; record_date: string }) =>
    ipcRenderer.invoke('records:add', data),
  getRecordList: (filters?: { page?: number; pageSize?: number; month?: string; category_key?: string; type?: string; keyword?: string }) =>
    ipcRenderer.invoke('records:getList', filters),
  deleteRecord: (id: number) => ipcRenderer.invoke('records:delete', id),
  updateRecord: (id: number, data: { type: string; amount: number; category_key: string; subcategory_key: string; note: string; record_date: string }) =>
    ipcRenderer.invoke('records:update', id, data),

  // 统计
  getMonthlyStats: (month: string, type?: string) => ipcRenderer.invoke('stats:getMonthlyStats', month, type),
  getMonthlyTotal: (month: string, type?: string) => ipcRenderer.invoke('stats:getMonthlyTotal', month, type),
  getDailyTrend: (month: string, type?: string) => ipcRenderer.invoke('stats:getDailyTrend', month, type),
  compareMonths: (month1: string, month2: string) => ipcRenderer.invoke('stats:compareMonths', month1, month2),

  // 设置
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // 导出
  exportAll: (month?: string, type?: string) => ipcRenderer.invoke('records:exportAll', month, type),
  saveFile: (defaultName: string, buffer: number[]) => ipcRenderer.invoke('dialog:saveFile', defaultName, buffer),

  // 备份恢复
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),

  // 周期性账单
  getRecurringBills: () => ipcRenderer.invoke('recurring:getAll'),
  addRecurring: (data: { type: string; amount: number; category_key: string; subcategory_key: string; note: string; cycle: string; next_date: string }) =>
    ipcRenderer.invoke('recurring:add', data),
  deleteRecurring: (id: number) => ipcRenderer.invoke('recurring:delete', id),
  toggleRecurring: (id: number, active: boolean) => ipcRenderer.invoke('recurring:toggle', id, active),
  executeRecurring: (id: number) => ipcRenderer.invoke('recurring:executeNow', id),

  // 快捷键
  getShortcut: () => ipcRenderer.invoke('shortcut:get'),
  setShortcut: (accelerator: string) => ipcRenderer.invoke('shortcut:set', accelerator),
})
