/**
 * CloudBase 云同步服务（渲染进程）
 *
 * 使用 @cloudbase/js-sdk 连接腾讯云 CloudBase，
 * 匿名登录 + 数据库 CRUD，配合主进程 SQLite 实现双向同步。
 */

import cloudbase from '@cloudbase/js-sdk'

const COLLECTION = 'records'
const SYNC_META_KEY = 'cloud_sync_meta'
const OWNER_KEY = 'cloud_owner_id'
let app: any = null
let db: any = null
let auth: any = null
let envId = ''
let ownerId = ''

// ---- 同步码（户标识，多用户隔离）----
// 与小程序端 cloudCore.ts 的同名工具保持同步（字符集/长度/校验规则必须一致）

/** 生成随机同步码：12 位大写字母数字（去掉易混淆的 I/O/U） */
export function newOwnerId(): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTVWXYZ023456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)]
  return out
}

/** 同步码归一化：去空格/连字符、转大写 */
export function normalizeOwnerId(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** 同步码显示格式：每 4 位一杠 */
export function formatOwnerId(id: string): string {
  return (id || '').replace(/(.{4})(?=.)/g, '$1-')
}

function isValidOwnerId(id: string): boolean {
  return /^[A-Z0-9]{8,}$/.test(id)
}

/** 获取本户同步码（没有则自动生成并持久化） */
export function getOwnerId(): string {
  if (!ownerId) {
    ownerId = localStorage.getItem(OWNER_KEY) || ''
    if (!isValidOwnerId(ownerId)) {
      ownerId = newOwnerId()
      localStorage.setItem(OWNER_KEY, ownerId)
    }
  }
  return ownerId
}

/** 设置/加入指定户：输入小程序端显示的同步码，成功返回 true */
export function setOwnerId(raw: string): boolean {
  const id = normalizeOwnerId(raw)
  if (!isValidOwnerId(id)) return false
  ownerId = id
  localStorage.setItem(OWNER_KEY, id)
  return true
}

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
  ownerId?: string   // 同步码，只同步同码记录（多用户隔离）
  source?: string
}

/** 上传单条记录（失败时把真实错误带回去，不再静默吞掉） */
export async function uploadRecord(record: Omit<CloudRecord, '_id'>): Promise<{ id: string | null; error?: string }> {
  if (!db) return { id: null, error: '未连接云端' }
  try {
    const res = await db.collection(COLLECTION).add({ ...record, ownerId: getOwnerId(), updatedAt: Date.now() })
    return { id: res.id || null }
  } catch (e: any) {
    console.error('[CloudBase] 上传失败:', e.message)
    return { id: null, error: e.message || String(e) }
  }
}

/** 批量上传：成功数 + 失败数 + 第一条错误 */
export async function uploadRecords(records: Omit<CloudRecord, '_id'>[]): Promise<{ uploaded: number; failed: number; firstError?: string }> {
  if (!db || records.length === 0) return { uploaded: 0, failed: 0 }
  let uploaded = 0
  let failed = 0
  let firstError: string | undefined
  for (const r of records) {
    const res = await uploadRecord(r)
    if (res.id) uploaded++
    else { failed++; firstError = firstError || res.error }
  }
  return { uploaded, failed, firstError }
}

/** 下载云端本户（同同步码）的全部记录 */
export async function downloadAllRecords(): Promise<CloudRecord[]> {
  if (!db) return []
  try {
    // CloudBase 默认限制一次查 100 条，需要分页
    const all: CloudRecord[] = []
    let offset = 0
    const limit = 100
    while (true) {
      const res = await db.collection(COLLECTION)
        .where({ ownerId: getOwnerId() })
        .skip(offset).limit(limit).orderBy('updatedAt', 'desc').get()
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

/** 下载本户指定时间之后的记录 */
export async function downloadSince(timestamp: number): Promise<CloudRecord[]> {
  if (!db) return []
  try {
    const all: CloudRecord[] = []
    let offset = 0
    const limit = 100
    while (true) {
      const res = await db.collection(COLLECTION)
        .where({ ownerId: getOwnerId(), updatedAt: db.command.gt(timestamp) })
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
    const val = localStorage.getItem(syncMetaKey())
    return val ? JSON.parse(val) : null
  } catch {
    return null
  }
}

export function saveSyncMeta(meta: { lastSyncAt: number }): void {
  localStorage.setItem(syncMetaKey(), JSON.stringify(meta))
}

// 同步进度按 环境+同步码 分隔：换环境或换户都不会错用旧增量时间戳
function syncMetaKey(): string {
  return `${SYNC_META_KEY}_${envId.slice(0, 8)}_${getOwnerId().slice(0, 8)}`
}

// ---- 完整同步流程 ----

export interface SyncResult {
  success: boolean
  uploaded: number
  downloaded: number
  error?: string
}

/** 跨端去重键 —— 与小程序 cloudCore.ts 的 recordKey 保持一致 */
function recordKeyOf(r: { date: string; amount: number; subcategoryKey: string; type: string }): string {
  return `${r.date}|${r.amount}|${r.subcategoryKey}|${r.type}`
}

function countBy(list: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const k of list) m.set(k, (m.get(k) || 0) + 1)
  return m
}

/**
 * 执行完整双向同步（按"笔数"配对，v0.6.5，与小程序端 runSync 算法对齐）：
 * 1. 某键本地 N 笔、云端 M 笔：N>M 补传 N-M 笔（同日同额同类多笔一笔不丢）
 * 2. 下载后同样按笔数配对：只导入本地缺的笔数（自己刚传的不会倒灌回来重复入账）
 */
export async function performSync(
  localRecords: {
    type: string; amount: number; categoryKey: string; categoryName: string
    subcategoryKey: string; subcategoryName: string; note: string; date: string
  }[],
): Promise<{ result: SyncResult; newCloudRecords: CloudRecord[] }> {
  if (!db) return { result: { success: false, uploaded: 0, downloaded: 0, error: '未连接云端' }, newCloudRecords: [] }

  try {
    // 1. 上传：本地比云端多出的笔数逐笔补传
    const existing = await downloadAllRecords()
    const cloudCounts = countBy(existing.map(recordKeyOf))
    const localCounts = countBy(localRecords.map(recordKeyOf))
    const toUpload: typeof localRecords = []
    const pushPerKey = new Map<string, number>()
    for (const r of localRecords) {
      const k = recordKeyOf(r)
      const need = (localCounts.get(k) || 0) - (cloudCounts.get(k) || 0)
      const done = pushPerKey.get(k) || 0
      if (need > 0 && done < need) {
        toUpload.push(r)
        pushPerKey.set(k, done + 1)
      }
    }
    let uploaded = 0
    if (toUpload.length > 0) {
      const up = await uploadRecords(toUpload.map((r) => ({ ...r, updatedAt: Date.now() })))
      uploaded = up.uploaded
      // 该传却一条都没传上去 = 写入通道断了，必须把真实错误抱出来，不能再冒充"已最新"
      if (up.uploaded === 0) {
        return {
          result: { success: false, uploaded: 0, downloaded: 0, error: `云端写入失败（${up.failed} 条未传）：${up.firstError || '未知原因'} — 请检查 records 集合是否存在、权限是否允许创建、匿名登录是否开启` },
          newCloudRecords: [],
        }
      }
    }

    // 2. 下载云端新记录（本户增量；首同步无进度记录时全量拉）
    const meta = await getSyncMeta()
    const cloudRecordsRaw = meta
      ? await downloadSince(meta.lastSyncAt)
      : await downloadAllRecords()

    // 3. 按笔数配对：云端总笔数(含本轮刚上传)超出本地的部分才导入，防重复入账
    const cloudAllCounts = new Map(cloudCounts)
    for (const [k, n] of pushPerKey) cloudAllCounts.set(k, (cloudAllCounts.get(k) || 0) + n)
    const takenPerKey = new Map<string, number>()
    const newCloudRecords: CloudRecord[] = []
    for (const r of cloudRecordsRaw) {
      const k = recordKeyOf(r)
      const cap = (cloudAllCounts.get(k) || 0) - (localCounts.get(k) || 0)
      const taken = takenPerKey.get(k) || 0
      if (taken < cap) {
        takenPerKey.set(k, taken + 1)
        newCloudRecords.push(r)
      }
    }

    // 4. 更新同步时间
    saveSyncMeta({ lastSyncAt: Date.now() })

    return {
      result: { success: true, uploaded, downloaded: newCloudRecords.length },
      newCloudRecords,
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
