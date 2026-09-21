/**
 * 本地「模拟云」全链路验证脚本 — 纯 Node 运行，不需要微信开发者工具、不需要云环境
 *
 * 运行方式：cd miniapp && npm run verify:sync
 *
 * 验证的是与小程序上线时完全相同的同步核心（src/utils/cloudCore.ts）：
 * 模拟「桌面端 + 小程序」多台设备共用一个模拟云，依次跑通——
 *   ① 桌面记一笔 → 手机看得到
 *   ② 手机记一笔 → 桌面看得到
 *   ③ 反复同步不重复入账（幂等性）
 *   ④ 增量同步只拉新数据
 *   ⑤ 双端同记一笔 → 自动合并为一条
 *   ⑥ 不同同步码的两户互不可见（多用户隔离，方案 B）
 *   ⑦ 新设备输入相同同步码 → 拉回整户历史账
 *   ⑧ 同日同额同类两笔 → 按笔数配对，一笔不丢（v0.6.5，方案 C）
 */
const path = require('path')
const {
  recordKey, cloudToLocal, localToCloud, createMockCloud, runSync,
} = require(path.join(__dirname, '..', '.sync-verify', 'cloudCore.js'))

// ---- 测试工具 ----

let failed = 0
function assert(cond, label) {
  if (cond) { console.log('  \x1b[32m✓\x1b[0m ' + label) }
  else { console.error('  \x1b[31m✗ ' + label + '\x1b[0m'); failed++ }
}

function memoryStore() {
  const m = new Map()
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) }
}

// 全局虚拟时钟：所有设备共用，保证 updatedAt 大小关系可控
let clock = 1_700_000_000_000
const now = () => (clock += 1000)

function countBy(arr) {
  const m = new Map()
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1)
  return m
}

// ---- 模拟桌面端（复刻 desktop cloudbase.ts performSync v0.6.5 按笔数配对算法） ----

function createDesktopDevice(cloud, ownerId) {
  let local = []
  let lastSyncAt = 0
  return {
    /** 模拟用户在桌面端记一笔（写进本地 SQLite） */
    appAdd(r) { local.push({ ...r, id: local.length + 1 }) },
    getLocal: () => local,
    /** 模拟桌面端点击"同步"按钮 */
    async performSync() {
      const existing = await cloud.listAll(ownerId)
      const cloudCounts = countBy(existing.map(recordKey))
      const localCounts = countBy(local.map(recordKey))
      // 推送：本地比云端多出的笔数逐笔补传
      let uploaded = 0
      const pushPerKey = new Map()
      for (const r of local) {
        const k = recordKey(r)
        const need = (localCounts.get(k) || 0) - (cloudCounts.get(k) || 0)
        const done = pushPerKey.get(k) || 0
        if (need > 0 && done < need) {
          await cloud.add(localToCloud(r, 'desktop', now(), ownerId))
          uploaded++
          pushPerKey.set(k, done + 1)
        }
      }
      // 拉取：首同步全量，之后按 updatedAt 增量（对齐 downloadSince）
      const raw = lastSyncAt === 0 ? existing : existing.filter((r) => (r.updatedAt || 0) > lastSyncAt)
      const cloudAllCounts = new Map(cloudCounts)
      for (const [k, n] of pushPerKey) cloudAllCounts.set(k, (cloudAllCounts.get(k) || 0) + n)
      const takenPerKey = new Map()
      const toAdd = []
      for (const r of raw) {
        const k = recordKey(r)
        const cap = (cloudAllCounts.get(k) || 0) - (localCounts.get(k) || 0)
        const taken = takenPerKey.get(k) || 0
        if (taken < cap) {
          takenPerKey.set(k, taken + 1)
          toAdd.push(cloudToLocal(r))
        }
      }
      toAdd.forEach((r) => local.push(r))
      lastSyncAt = now()
      return { uploaded, downloaded: toAdd.length }
    },
  }
}

// ---- 模拟小程序端（走真正的上线代码 runSync + addRecord 写本地后立即引擎推送） ----

function createMiniappDevice(cloud, ownerId) {
  let local = []
  const store = memoryStore()
  async function addLocal(recs) {
    let added = 0
    for (const r of recs) {
      if (r.id && local.some((l) => String(l.id) === String(r.id))) continue // 只防同一条云端记录重复导入
      local.push(r)
      added++
    }
    return added
  }
  function sync() {
    return runSync({ cloud, source: 'miniapp', ownerId, getLocal: async () => local, addLocal, store, now })
  }
  return {
    /** 模拟 storage.ts addRecord：写本地 + 立即触发一次同步（由引擎按笔数上云），返回同步结果 */
    async appAdd(r) {
      local.unshift({ ...r, id: String(now()) })
      return sync()
    },
    getLocal: () => local,
    /** 模拟页面 useDidShow 时触发的 syncNow */
    sync,
  }
}

const REC = {
  lunch:  { type: 'expense', amount: 25,   categoryKey: 'food',      categoryName: '餐饮饮食', subcategoryKey: 'lunch',  subcategoryName: '午餐',     note: '公司楼下', date: '2026-09-18' },
  bus:    { type: 'expense', amount: 2,    categoryKey: 'transport', categoryName: '交通出行', subcategoryKey: 'bus',    subcategoryName: '公交地铁', note: '', date: '2026-09-19' },
  rent:   { type: 'expense', amount: 2400, categoryKey: 'housing',   categoryName: '住房居家', subcategoryKey: 'rent',   subcategoryName: '房租/房贷', note: '9月', date: '2026-09-01' },
  salary: { type: 'income',  amount: 8000, categoryKey: 'finance',   categoryName: '金融保险', subcategoryKey: 'invest', subcategoryName: '投资理财', note: '工资', date: '2026-09-10' },
  coffee: { type: 'expense', amount: 18,   categoryKey: 'food',      categoryName: '餐饮饮食', subcategoryKey: 'snack',  subcategoryName: '零食饮料', note: '拿铁', date: '2026-09-20' },
}

// 两户人家的同步码（12 位，与线上格式一致）
const HOUSE_A = 'ABCD1EFG2HJK'
const HOUSE_B = 'MNOP3QRS4TUV'

// ---- 开始验证 ----

async function main() {
  console.log('\n☁️  本地模拟云 · 多设备 + 多用户隔离 同步全链路验证\n')

  const cloud = createMockCloud(memoryStore())
  const desktop = createDesktopDevice(cloud, HOUSE_A)
  const miniapp = createMiniappDevice(cloud, HOUSE_A)

  console.log('【场景①】桌面端记 3 笔账 → 同步上云 → 小程序打开首页')
  desktop.appAdd(REC.lunch); desktop.appAdd(REC.bus); desktop.appAdd(REC.rent)
  let dr = await desktop.performSync()
  assert(dr.uploaded === 3, `桌面端上传 3 条（实际 ${dr.uploaded}）`)
  let mr = await miniapp.sync()
  assert(mr.ok && mr.pulled === 3, `小程序拉到 3 条（实际 ${mr.pulled}）`)
  assert(
    miniapp.getLocal().some((r) => r.amount === 2400 && r.subcategoryName === '房租/房贷' && r.date === '2026-09-01'),
    '字段完整映射（金额/分类名/日期）',
  )

  console.log('\n【场景②】小程序记 2 笔账（写本地后由引擎自动推上云）→ 桌面端点同步')
  let ar = await miniapp.appAdd(REC.salary)
  assert(ar.ok && ar.pushed === 1, `小程序记账后引擎推上 1 笔（pushed=${ar.pushed}）`)
  ar = await miniapp.appAdd(REC.coffee)
  assert(ar.pushed === 1, `咖啡 ¥18 同样推上 1 笔（pushed=${ar.pushed}）`)
  dr = await desktop.performSync()
  assert(dr.uploaded === 0, `桌面端不把云端已有的自家记录重复上传（上传 ${dr.uploaded} 条）`)
  assert(dr.downloaded === 2, `桌面端拉到小程序的 2 笔（实际 ${dr.downloaded}）`)
  const dl = desktop.getLocal()
  assert(
    dl.some((r) => r.amount === 8000 && r.type === 'income') && dl.some((r) => r.amount === 18 && r.date === '2026-09-20'),
    '桌面端本地已含收入 ¥8000 与咖啡 ¥18',
  )

  console.log('\n【场景③】反复同步 → 不重复入账（幂等性）')
  mr = await miniapp.sync()
  assert(mr.pushed === 0 && mr.pulled === 0, `小程序再次同步 0 进 0 出（pushed=${mr.pushed}, pulled=${mr.pulled}）`)
  assert(miniapp.getLocal().length === 5, `小程序本地仍为 5 条（实际 ${miniapp.getLocal().length}）`)
  dr = await desktop.performSync()
  assert(desktop.getLocal().length === 5, `桌面端仍为 5 条（实际 ${desktop.getLocal().length}）`)

  console.log('\n【场景④】增量同步：桌面再记 1 笔新账 → 小程序只拉这 1 条')
  desktop.appAdd({ ...REC.lunch, date: '2026-09-20', note: '加班餐' }) // 新日期 = 新记录
  await desktop.performSync()
  mr = await miniapp.sync()
  assert(mr.pulled === 1, `小程序只拉到 1 条新增（实际 ${mr.pulled}）`)
  assert(miniapp.getLocal().length === 6, `小程序本地共 6 条（实际 ${miniapp.getLocal().length}）`)

  console.log('\n【场景⑤】双端同时记同一笔账 → 合并为一条（跨端去重键一致）')
  const same = { ...REC.coffee, date: '2026-09-21' }
  desktop.appAdd(same)
  await desktop.performSync()
  mr = await miniapp.appAdd(same) // 小程序也记了一模一样的（v0.6.5：引擎按笔数配对，不补传也不补拉）
  assert(mr.pushed === 0 && mr.pulled === 0, `同步引擎识别同键记录，不再上传也不再拉取（pushed=${mr.pushed}, pulled=${mr.pulled}）`)
  assert(miniapp.getLocal().filter((r) => r.date === '2026-09-21').length === 1, '同一天同金额同分类只有 1 条')

  console.log('\n【场景⑥】另一户（不同同步码）共用同一云环境 → 互相看不到')
  const bobDesktop = createDesktopDevice(cloud, HOUSE_B)
  const bobMiniapp = createMiniappDevice(cloud, HOUSE_B)
  bobDesktop.appAdd({ ...REC.rent, amount: 999, note: '鲍勃的房租' })
  await bobDesktop.performSync()
  mr = await miniapp.sync() // A 户小程序同步
  assert(mr.pushed === 0 && mr.pulled === 0, `A 户同步 0 进 0 出，完全无感（pushed=${mr.pushed}, pulled=${mr.pulled}）`)
  assert(miniapp.getLocal().length === 7, `A 户小程序本地仍 7 条（实际 ${miniapp.getLocal().length}）`)
  const bobBeforeCount = bobMiniapp.getLocal().length
  await bobMiniapp.sync()
  assert(bobMiniapp.getLocal().length === bobBeforeCount + 1, `B 户小程序只拉到 B 户自己的 1 条（实际 ${bobMiniapp.getLocal().length - bobBeforeCount}）`)
  assert(!bobMiniapp.getLocal().some((r) => r.amount === 2400), 'B 户看不到 A 户的房租 ¥2400')

  console.log('\n【场景⑦】新电脑输入 A 户同步码 → 拉回 A 户全部历史账')
  const newDesktop = createDesktopDevice(cloud, HOUSE_A)
  dr = await newDesktop.performSync()
  assert(dr.uploaded === 0 && dr.downloaded === 7, `新机拉到 A 户全部 7 条（uploaded=${dr.uploaded}, downloaded=${dr.downloaded}）`)
  assert(newDesktop.getLocal().some((r) => r.amount === 2400) && !newDesktop.getLocal().some((r) => r.amount === 999),
    '新机能 see A 户房租、看不见 B 户的记录')

  console.log('\n【场景⑧】同日同额同类两笔 → 按笔数配对，一笔不丢（v0.6.5 方案 C）')
  const twin = { type: 'expense', amount: 888, categoryKey: 'food', categoryName: '餐饮饮食', subcategoryKey: 'dinner', subcategoryName: '晚餐', note: '请客A', date: '2026-09-23' }
  desktop.appAdd(twin)
  desktop.appAdd({ ...twin, note: '请客B' }) // 同一笔指纹（日期/金额/小类/类型完全相同），备注不同也算同键
  dr = await desktop.performSync()
  assert(dr.uploaded === 2, `同键两笔一起传上云，不合并（uploaded=${dr.uploaded}）`)
  mr = await miniapp.sync()
  assert(mr.pulled === 2, `小程序两笔都拉到（pulled=${mr.pulled}）`)
  assert(miniapp.getLocal().filter((r) => r.amount === 888).length === 2, `小程序本地同键 2 笔未被合成 1 笔（实际 ${miniapp.getLocal().filter((r) => r.amount === 888).length}）`)
  dr = await desktop.performSync()
  assert(dr.uploaded === 0 && dr.downloaded === 0, `收敛：平衡后再同步 0 推 0 拉（uploaded=${dr.uploaded}, downloaded=${dr.downloaded}）`)

  // ---- 汇总 ----

  console.log('')
  if (failed === 0) {
    console.log('\x1b[32m✅ 全部通过 — 含多用户隔离验证，同步码机制工作正常\x1b[0m\n')
  } else {
    console.error(`\x1b[31m❌ 有 ${failed} 项未通过\x1b[0m\n`)
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
