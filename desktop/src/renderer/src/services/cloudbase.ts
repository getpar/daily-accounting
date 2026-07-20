/**
 * CloudBase 云同步服务（渲染进程）
 *
 * 使用 @cloudbase/js-sdk 连接腾讯云 CloudBase，
 * 匿名登录 + 数据库 CRUD，配合主进程 SQLite 实现双向同步。
 */

import cloudbase from '@cloudbase/js-sdk'

const COLLECTION = 'records'
const SYNC_META_KEY = 'cloud_sync_meta'
let app: any = null
let db: any = null
let auth: any = null
let envId = ''

// ---- 初始化 ----

/** 初始化 CloudBase 连接 */
export async function initCloud(env: string): Promise<boolean> {
  try {
    envId = env
    app = cloudbase.init({ env })
    auth = app.auth({ persistence: 'local' })

    // 匿名登录
    await auth.anonymousAuthProvider().signIn()
    db = app.database()
    return true
  } catch (e: any) {
    console.error('[CloudBase] 初始化失败:', e.message)
    return false
  }
}

/** 是否已连接 */
export function isConnected(): boolean {
  return db !== null
}

/** 获取环境 ID */
export function getEnvId(): string {
  return envId
}

// ---- 数据操作 ----

export interface CloudRecord {
  _id?: string
  type: string
  amount: number
  categoryKey: string
  categoryName: string
  subcategoryKey: string
  subcategoryName: string
  note: string
  date: string
  updatedAt: number
}

/** 上传单条记录 */
export async function uploadRecord(record: Omit<CloudRecord, '_id'>): Promise<string | null> {
  if (!db) return null
  try {
    const res = await db.collection(COLLECTION).add({ ...record, updatedAt: Date.now() })
    return res.id || null
  } catch (e: any) {
    console.error('[CloudBase] 上传失败:', e.message)
    return null
  }
}

/** 批量上传 */
export async function uploadRecords(records: Omit<CloudRecord, '_id'>[]): Promise<number> {
  if (!db || records.length === 0) return 0
  let count = 0
  for (const r of records) {
    const id = await uploadRecord(r)
    if (id) count++
  }
  return count
}

/** 下载云端所有记录 */
export async function downloadAllRecords(): Promise<CloudRecord[]> {
  if (!db) return []
  try {
    // CloudBase 默认限制一次查 100 条，需要分页
    const all: CloudRecord[] = []
    let offset = 0
    const limit = 100
    while (true) {
      const res = await db.collection(COLLECTION).skip(offset).limit(limit).orderBy('updatedAt', 'desc').get()
      if (!res.data || res.data.length === 0) break
      all.push(...res.data)
      if (res.data.length < limit) break
      offset += limit
    }
    return all
  } catch (e: any) {
    console.error('[CloudBase] 下载失败:', e.message)
    return []
  }
}

/** 下载指定时间之后的记录 */
export async function downloadSince(timestamp: number): Promise<CloudRecord[]> {
  if (!db) return []
  try {
    const all: CloudRecord[] = []
    let offset = 0
    const limit = 100
    while (true) {
      const res = await db.collection(COLLECTION)
        .where({ updatedAt: db.command.gt(timestamp) })
        .skip(offset).limit(limit).orderBy('updatedAt', 'desc').get()
      if (!res.data || res.data.length === 0) break
      all.push(...res.data)
      if (res.data.length < limit) break
      offset += limit
    }
    return all
  } catch (e: any) {
    console.error('[CloudBase] 增量下载失败:', e.message)
    return []
  }
}

// ---- 同步元数据 ----

export async function getSyncMeta(): Promise<{ lastSyncAt: number } | null> {
  if (!db) return null
  try {
    const key = `${SYNC_META_KEY}_${envId.slice(0, 8)}`
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : null
  } catch {
    return null
  }
}

export function saveSyncMeta(meta: { lastSyncAt: number }): void {
  const key = `${SYNC_META_KEY}_${envId.slice(0, 8)}`
  localStorage.setItem(key, JSON.stringify(meta))
}

// ---- 完整同步流程 ----

export interface SyncResult {
  success: boolean
  uploaded: number
  downloaded: number
  error?: string
}

/**
 * 执行完整双向同步：
 * 1. 上传本地记录到云端
 * 2. 下载云端新记录
 * 返回新增到本地的记录
 */
export async function performSync(
  localRecords: {
    type: string; amount: number; categoryKey: string; categoryName: string
    subcategoryKey: string; subcategoryName: string; note: string; date: string
  }[],
): Promise<{ result: SyncResult; newCloudRecords: CloudRecord[] }> {
  if (!db) return { result: { success: false, uploaded: 0, downloaded: 0, error: '未连接云端' }, newCloudRecords: [] }

  try {
    // 1. 上传本地记录（去重：检查是否已存在）
    const existing = await downloadAllRecords()
    const existingKeys = new Set(existing.map((r) => `${r.date}|${r.amount}|${r.subcategoryKey}|${r.type}`))
    const toUpload = localRecords.filter(
      (r) => !existingKeys.has(`${r.date}|${r.amount}|${r.subcategoryKey}|${r.type}`),
    )
    let uploaded = 0
    if (toUpload.length > 0) {
      uploaded = await uploadRecords(toUpload.map((r) => ({ ...r, updatedAt: Date.now() })))
    }

    // 2. 下载云端新记录
    const meta = await getSyncMeta()
    const cloudRecords = meta
      ? await downloadSince(meta.lastSyncAt)
      : await downloadAllRecords()

    // 3. 更新同步时间
    saveSyncMeta({ lastSyncAt: Date.now() })

    return {
      result: { success: true, uploaded, downloaded: cloudRecords.length },
      newCloudRecords: cloudRecords,
    }
  } catch (e: any) {
    return { result: { success: false, uploaded: 0, downloaded: 0, error: e.message }, newCloudRecords: [] }
  }
}

/** 断开连接 */
export function disconnect(): void {
  db = null
  auth = null
  app = null
  envId = ''
}
