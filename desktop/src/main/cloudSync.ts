/**
 * 云同步服务 — 桌面端 ↔ CloudBase 云数据库
 *
 * 状态：框架已就绪，等待 CloudBase 环境 ID 激活后即可启用。
 * 当前所有云函数为空实现，本地数据不受影响。
 */

import fs from 'fs'
import path from 'path'

// ---- 配置（待 CloudBase 审核通过后填入） ----

let CLOUD_ENV_ID = ''
let CLOUD_ENABLED = false

/** 设置 CloudBase 环境 ID，设置后启用云同步 */
export function setCloudEnvId(envId: string): void {
  CLOUD_ENV_ID = envId
  CLOUD_ENABLED = !!envId
  if (CLOUD_ENABLED) {
    console.log('[CloudSync] 云同步已启用，环境 ID:', envId)
  }
}

export function isCloudEnabled(): boolean {
  return CLOUD_ENABLED
}

export function getCloudEnvId(): string {
  return CLOUD_ENV_ID
}

// ---- 数据序列化（桌面 SQLite ↔ 云 JSON 格式） ----

export interface SyncRecord {
  _id?: string           // CloudBase 自动生成的 ID
  type: string
  amount: number
  categoryKey: string
  categoryName: string
  subcategoryKey: string
  subcategoryName: string
  note: string
  date: string           // YYYY-MM-DD
  syncedAt?: string      // 最后同步时间
}

export interface SyncManifest {
  lastSyncAt: string     // ISO 时间戳
  recordCount: number
  envId: string
}

const MANIFEST_PATH = ''

function getManifestPath(): string {
  const userDataPath = require('electron').app.getPath('userData')
  return path.join(userDataPath, 'cloud-sync-manifest.json')
}

/** 读取本地同步状态文件 */
export function loadManifest(): SyncManifest | null {
  try {
    const p = getManifestPath()
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch { /* ignore */ }
  return null
}

/** 保存同步状态 */
export function saveManifest(manifest: SyncManifest): void {
  fs.writeFileSync(getManifestPath(), JSON.stringify(manifest, null, 2))
}

/** 将桌面端数据库记录转为云同步格式 */
export function recordsToSyncFormat(records: any[]): SyncRecord[] {
  return records.map((r) => ({
    type: r.type || 'expense',
    amount: r.amount,
    categoryKey: r.category_key || r.categoryKey,
    categoryName: r.category_name || r.categoryName,
    subcategoryKey: r.subcategory_key || r.subcategoryKey,
    subcategoryName: r.subcategory_name || r.subcategoryName,
    note: r.note || '',
    date: r.record_date || r.date,
  }))
}

// ---- 核心同步逻辑（预留接口） ----

/**
 * 上传本地数据到云数据库
 * TODO: 接入 CloudBase SDK 实现真正的上传
 */
export async function uploadToCloud(records: SyncRecord[]): Promise<{
  success: boolean
  uploaded: number
  error?: string
}> {
  if (!CLOUD_ENABLED) {
    return { success: false, uploaded: 0, error: '云同步未启用，请先配置 CloudBase 环境 ID' }
  }

  // TODO: 使用 CloudBase SDK 批量上传
  // const db = cloudbase.init({ env: CLOUD_ENV_ID }).database()
  // const collection = db.collection('records')
  // for (const record of records) {
  //   await collection.add(record)
  // }

  console.log(`[CloudSync] 准备上传 ${records.length} 条记录（环境未激活，仅模拟）`)
  return { success: true, uploaded: records.length }
}

/**
 * 从云数据库下载数据
 * TODO: 接入 CloudBase SDK 实现真正的下载
 */
export async function downloadFromCloud(since?: string): Promise<{
  success: boolean
  records: SyncRecord[]
  error?: string
}> {
  if (!CLOUD_ENABLED) {
    return { success: false, records: [], error: '云同步未启用' }
  }

  // TODO: 使用 CloudBase SDK 查询
  // const db = cloudbase.init({ env: CLOUD_ENV_ID }).database()
  // let query = db.collection('records')
  // if (since) query = query.where({ updatedAt: db.command.gt(since) })
  // const result = await query.get()
  // return { success: true, records: result.data }

  console.log(`[CloudSync] 准备下载数据（环境未激活，仅模拟）`)
  return { success: true, records: [] }
}

/**
 * 执行完整的双向同步：
 * 1. 上传本地新记录到云端
 * 2. 下载云端新记录到本地
 * 3. 合并去重
 */
export async function performFullSync(
  localRecords: any[],
  importToLocal: (records: SyncRecord[]) => Promise<number>
): Promise<{
  success: boolean
  uploaded: number
  downloaded: number
  error?: string
}> {
  if (!CLOUD_ENABLED) {
    return { success: false, uploaded: 0, downloaded: 0, error: '云同步未启用' }
  }

  try {
    // 1. 上传
    const syncRecords = recordsToSyncFormat(localRecords)
    const uploadResult = await uploadToCloud(syncRecords)
    if (!uploadResult.success) return { ...uploadResult, downloaded: 0 }

    // 2. 下载
    const manifest = loadManifest()
    const downloadResult = await downloadFromCloud(manifest?.lastSyncAt)
    if (!downloadResult.success) return { ...downloadResult, uploaded: uploadResult.uploaded }

    // 3. 写入本地
    let downloaded = 0
    if (downloadResult.records.length > 0) {
      downloaded = await importToLocal(downloadResult.records)
    }

    // 4. 更新同步状态
    saveManifest({
      lastSyncAt: new Date().toISOString(),
      recordCount: localRecords.length + downloaded,
      envId: CLOUD_ENV_ID,
    })

    return { success: true, uploaded: uploadResult.uploaded, downloaded }
  } catch (e: any) {
    return { success: false, uploaded: 0, downloaded: 0, error: e.message || '同步失败' }
  }
}
