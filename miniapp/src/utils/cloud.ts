// CloudBase 暂未启用，等拿到正式小程序 AppID 后配置
// 当前所有数据使用本地存储（参见 storage.ts）

const ENABLE_CLOUD = false

export async function initCloud(): Promise<boolean> {
  return false
}

export interface CloudRecord {
  type: string; amount: number; categoryKey: string; categoryName: string
  subcategoryKey: string; subcategoryName: string; note: string; date: string
}

export async function fetchRecords(): Promise<any[]> { return [] }
export async function addCloudRecord(): Promise<null> { return null }
export async function updateCloudRecord(): Promise<boolean> { return false }
export async function deleteCloudRecord(): Promise<boolean> { return false }
export async function getCloudSetting(): Promise<null> { return null }
export async function setCloudSetting(): Promise<boolean> { return false }

export interface CustomCategory {
  categoryKey: string; categoryName: string; subcategoryKey: string; subcategoryName: string
}

export async function fetchCustomCategories(): Promise<any[]> { return [] }
export async function addCustomCategory(): Promise<boolean> { return false }
export async function deleteCustomCategory(): Promise<boolean> { return false }
