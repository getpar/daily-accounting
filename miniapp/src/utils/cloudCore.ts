/**
 * 云同步核心逻辑（纯 TypeScript，零 Taro / 零 wx 依赖）
 *
 * 设计说明：
 * - 本文件只包含"同步算法"，不碰任何小程序 API，因此可以直接在 Node 环境
 *   运行验证脚本（scripts/verify-sync.js），提前跑通桌面 ↔ 小程序的同步逻辑。
 * - 真实的 CloudBase 连接 与 本地模拟云 都实现 CloudCollection 接口，
 *   同步引擎不关心背后是哪种，换成真云时零改动。
 *
 * 同步语义（与桌面端 services/cloudbase.ts 完全对齐）：
 * - 新增记录双向同步；去重键 = date|amount|subcategoryKey|type
 * - 编辑/删除暂不同步（桌面端当前也是如此，属已知限制）
 * - 多用户隔离：每条云端记录带 ownerId（同步码），同码才是同一户，
 *   所有人共用一个云环境也各看各的账（方案 B）
 */

// ---- 数据结构 ----

/** 云数据库 records 集合中的一条记录（字段格式与桌面端上传的保持一致） */
export interface CloudRecord {
  _id?: string
  type: string
  amount: number
  categoryKey: string
  categoryName: string
  subcategoryKey: string
  subcategoryName: string
  note: string
  date: string          // YYYY-MM-DD
  updatedAt: number     // 毫秒时间戳，增量同步依据
  source?: string       // 'desktop' | 'miniapp'（旧数据可能没有此字段）
  ownerId?: string      // 同步码（户标识），只同步同码记录；旧数据无此字段 = 孤立数据不再拉取
}

/** 可同步的本地记录（与小程序 RecordItem / 桌面端 records 表字段兼容） */
export interface SyncableRecord {
  id?: string
  type: string
  amount: number
  categoryKey: string
  categoryName: string
  subcategoryKey: string
  subcategoryName: string
  note: string
  date: string
}

/** 最小键值存储接口：小程序端 = Taro Storage，验证脚本 = 内存对象 */
export interface KVStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

/** 云数据库集合的最小操作面：模拟云 和 wx.cloud 真云 都实现它 */
export interface CloudCollection {
  /** 分页拉取云端属于指定同步码的全部记录 */
  listAll(ownerId: string): Promise<CloudRecord[]>
  /** 上传一条记录，返回云端 _id（失败返回 null） */
  add(record: Omit<CloudRecord, '_id'>): Promise<string | null>
}

// ---- 公共约定 ----

/** 本地记录"上次同步时间"的存储键（按同步码分隔，换户不影响旧户增量） */
export function lastSyncKey(ownerId: string): string {
  return `cloud_last_sync_at_${ownerId}`
}

/** 生成随机同步码：12 位大写字母数字（去掉了易混淆的 I/O/U），碰撞概率约 3.8×10¹⁸ 分之一 */
export function newOwnerId(): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTVWXYZ023456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)]
  return out
}

/** 同步码归一化：去掉空格/连字符、转大写（用户手输容错） */
export function normalizeOwnerId(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** 同步码显示格式：每 4 位一杠，方便手机照着键盘输 */
export function formatOwnerId(id: string): string {
  return (id || '').replace(/(.{4})(?=.)/g, '$1-')
}

/** 同步码合法性：至少 8 位（未来若改长度只动这一处） */
export function isValidOwnerId(id: string): boolean {
  return /^[A-Z0-9]{8,}$/.test(id)
}

/** 跨端去重键 —— 必须与桌面端 cloudbase.ts 中 performSync 的键保持一致 */
export function recordKey(r: { date: string; amount: number; subcategoryKey: string; type: string }): string {
  return `${r.date}|${r.amount}|${r.subcategoryKey}|${r.type}`
}

/** 云端记录 → 本地记录格式 */
export function cloudToLocal(r: CloudRecord): SyncableRecord {
  return {
    id: `cloud_${r._id || recordKey(r)}`,
    type: r.type,
    amount: r.amount,
    categoryKey: r.categoryKey,
    categoryName: r.categoryName || '',
    subcategoryKey: r.subcategoryKey,
    subcategoryName: r.subcategoryName || '',
    note: r.note || '',
    date: r.date,
  }
}

/** 本地记录 → 云端上传格式 */
export function localToCloud(r: SyncableRecord, source: string, now: number, ownerId: string): Omit<CloudRecord, '_id'> {
  return {
    type: r.type,
    amount: r.amount,
    categoryKey: r.categoryKey,
    categoryName: r.categoryName,
    subcategoryKey: r.subcategoryKey,
    subcategoryName: r.subcategoryName,
    note: r.note || '',
    date: r.date,
    updatedAt: now,
    source,
    ownerId,
  }
}

// ---- 本地模拟云（开发验证用） ----

/**
 * 创建一个存在 KVStore 里的"模拟云数据库"。
 * 行为对齐 CloudBase：自动生成 _id、按 updatedAt 排序、无鉴权。
 * 桌面端 → 小程序 的跨端验证脚本共用同一个 KVStore 即等价于共用一个云环境。
 */
export function createMockCloud(store: KVStore, collectionKey: string = 'mock_cloud_records'): CloudCollection {
  function read(): CloudRecord[] {
    const raw = store.get(collectionKey)
    return raw ? (JSON.parse(raw) as CloudRecord[]) : []
  }
  function write(list: CloudRecord[]): void {
    store.set(collectionKey, JSON.stringify(list))
  }
  return {
    async listAll(ownerId) {
      return read()
        .filter((r) => r.ownerId === ownerId)
        .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
    },
    async add(record) {
      const list = read()
      const _id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      list.push({ ...record, _id })
      write(list)
      return _id
    },
  }
}

// ---- 同步引擎 ----

export interface SyncDeps {
  /** 云端集合（模拟云或真云） */
  cloud: CloudCollection
  /** 本端标识：'miniapp' / 'desktop' */
  source: string
  /** 本户同步码（只同步同码记录，多用户隔离的关键） */
  ownerId: string
  /** 读取本地全部记录 */
  getLocal: () => Promise<SyncableRecord[]>
  /** 把云端记录写入本地，返回实际新增条数（需自行做本地去重） */
  addLocal: (records: SyncableRecord[]) => Promise<number>
  /** 存放 lastSyncAt 的键值存储 */
  store: KVStore
  /** 可注入的时钟（便于测试） */
  now?: () => number
}

export interface SyncResult {
  ok: boolean
  pushed: number      // 本端上传到云端的条数
  pulled: number      // 从云端拉到本地的条数
  error?: string
}

/** 统计一批记录里每个去重键出现几次（按笔数配对的核心） */
type KeyPart = { date: string; amount: number; subcategoryKey: string; type: string }
export function countByRecordKey<T extends KeyPart>(list: T[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of list) m.set(recordKey(r), (m.get(recordKey(r)) || 0) + 1)
  return m
}

/**
 * 执行一次完整双向同步（按"笔数"配对，v0.6.5）：
 * 去重键 = 日期|金额|小类|类型；同一键可能出现多笔（同日同额同类不同笔）。
 * 1. 本地某键 N 笔、云端 M 笔：N>M 时补传 N-M 笔（多笔一笔不丢，两端各记同一笔也不会重复）
 * 2. M>N 时从云端补拉 M-N 笔（限上次同步之后写入的，再验一次同步码）
 * 3. 记录本次同步时间
 */
export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ? deps.now() : Date.now()
  if (!isValidOwnerId(deps.ownerId || '')) {
    return { ok: false, pushed: 0, pulled: 0, error: '同步码未设置或不合法' }
  }
  try {
    const cloudAll = await deps.cloud.listAll(deps.ownerId)
    const cloudCounts = countByRecordKey(cloudAll)

    const local = await deps.getLocal()
    const localCounts = countByRecordKey(local)

    // 1. 推送：本地比云端多出的笔数逐笔补传（同键最多传 localCounts-cloudCounts 笔）
    let pushed = 0
    const pushedPerKey = new Map<string, number>()
    for (const r of local) {
      const k = recordKey(r)
      const need = (localCounts.get(k) || 0) - (cloudCounts.get(k) || 0)
      const done = pushedPerKey.get(k) || 0
      if (need > 0 && done < need) {
        const id = await deps.cloud.add(localToCloud(r, deps.source, now, deps.ownerId))
        if (id) {
          pushed++
          pushedPerKey.set(k, done + 1)
        }
      }
    }

    // 2. 拉取：云端比本地多出的笔数，从上次同步之后写入的记录里补（限码 + 防驱动层漏筛）
    const lastSync = Number(deps.store.get(lastSyncKey(deps.ownerId)) || 0)
    const pulledPerKey = new Map<string, number>()
    const incoming: CloudRecord[] = []
    for (const r of cloudAll) {
      if (r.ownerId !== deps.ownerId || (r.updatedAt || 0) <= lastSync) continue
      const k = recordKey(r)
      const need = (cloudCounts.get(k) || 0) - (localCounts.get(k) || 0)
      const done = pulledPerKey.get(k) || 0
      if (need > 0 && done < need) {
        pulledPerKey.set(k, done + 1)
        incoming.push(r)
      }
    }
    let pulled = 0
    if (incoming.length > 0) {
      pulled = await deps.addLocal(incoming.map(cloudToLocal))
    }

    // 3. 更新同步时间
    deps.store.set(lastSyncKey(deps.ownerId), String(now))

    return { ok: true, pushed, pulled }
  } catch (e: any) {
    return { ok: false, pushed: 0, pulled: 0, error: e?.message || String(e) }
  }
}
