import Taro from '@tarojs/taro'
import { initCloud, fetchRecords, addCloudRecord, updateCloudRecord, deleteCloudRecord,
         getCloudSetting, setCloudSetting, fetchCustomCategories, addCustomCategory as addCloudCat, deleteCustomCategory as delCloudCat } from './cloud'

// ========== 类型 ==========

export interface RecordItem {
  id: string
  type: 'expense' | 'income'
  amount: number
  categoryKey: string
  categoryName: string
  subcategoryKey: string
  subcategoryName: string
  note: string
  date: string
}

// ========== 云/本地 混合模式 ==========

let useCloud = false

export async function enableCloud(): Promise<boolean> {
  const ok = await initCloud()
  useCloud = ok
  return ok
}

export function isCloudEnabled(): boolean { return useCloud }

// ========== 记录 CRUD ==========

export async function getRecords(): Promise<RecordItem[]> {
  if (useCloud) {
    const rows = await fetchRecords()
    return rows.map((r) => ({
      id: r._id!, type: r.type, amount: r.amount,
      categoryKey: r.categoryKey, categoryName: r.categoryName,
      subcategoryKey: r.subcategoryKey, subcategoryName: r.subcategoryName,
      note: r.note || '', date: r.date,
    }))
  }
  // 本地存储
  const raw = Taro.getStorageSync('daily_records')
  return raw ? JSON.parse(raw) : []
}

function saveLocalRecords(list: RecordItem[]): void {
  Taro.setStorageSync('daily_records', JSON.stringify(list))
}

export async function addRecord(r: Omit<RecordItem, 'id'>): Promise<void> {
  if (useCloud) {
    await addCloudRecord(r)
    return
  }
  const list = await getRecords()
  list.unshift({ ...r, id: Date.now().toString() })
  saveLocalRecords(list)
}

export async function deleteRecord(id: string): Promise<void> {
  if (useCloud) { await deleteCloudRecord(id); return }
  saveLocalRecords((await getRecords()).filter((r) => r.id !== id))
}

export async function updateRecord(id: string, data: Partial<RecordItem>): Promise<void> {
  if (useCloud) { await updateCloudRecord(id, data); return }
  saveLocalRecords((await getRecords()).map((r) => (r.id === id ? { ...r, ...data } : r)))
}

// ========== 统计 ==========

export async function getMonthTotal(month: string, type?: string): Promise<number> {
  const records = await getRecords()
  return records
    .filter((r) => r.date.startsWith(month) && (!type || r.type === type))
    .reduce((s, r) => s + r.amount, 0)
}

export async function getMonthStats(month: string, type?: string): Promise<{ categoryKey: string; categoryName: string; total: number }[]> {
  const records = await getRecords()
  const map: Record<string, { categoryKey: string; categoryName: string; total: number }> = {}
  records
    .filter((r) => r.date.startsWith(month) && (!type || r.type === type))
    .forEach((r) => {
      if (!map[r.categoryKey]) map[r.categoryKey] = { categoryKey: r.categoryKey, categoryName: r.categoryName, total: 0 }
      map[r.categoryKey].total += r.amount
    })
  return Object.values(map).sort((a, b) => b.total - a.total)
}

export async function getDailyTrend(month: string, type?: string): Promise<{ date: string; total: number }[]> {
  const records = await getRecords()
  const map: Record<string, number> = {}
  records
    .filter((r) => r.date.startsWith(month) && (!type || r.type === type))
    .forEach((r) => { map[r.date] = (map[r.date] || 0) + r.amount })
  return Object.entries(map).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date))
}

// ========== 分类数据 ==========

export const DEFAULT_CATEGORIES = [
  { key: 'food', name: '餐饮饮食', subs: [
    { key: 'breakfast', name: '早餐' }, { key: 'lunch', name: '午餐' }, { key: 'dinner', name: '晚餐' },
    { key: 'snack', name: '零食饮料' }, { key: 'takeout', name: '外卖' }, { key: 'party', name: '聚餐聚会' },
  ]},
  { key: 'transport', name: '交通出行', subs: [
    { key: 'bus', name: '公交地铁' }, { key: 'taxi', name: '网约车' }, { key: 'fuel', name: '加油充电' },
    { key: 'parking', name: '停车费' }, { key: 'train', name: '火车高铁' }, { key: 'flight', name: '飞机' },
  ]},
  { key: 'shopping', name: '购物消费', subs: [
    { key: 'clothing', name: '服装鞋帽' }, { key: 'digital', name: '数码产品' }, { key: 'daily', name: '日用百货' },
    { key: 'beauty', name: '美妆护肤' }, { key: 'luxury', name: '奢侈品' },
  ]},
  { key: 'housing', name: '住房居家', subs: [
    { key: 'rent', name: '房租/房贷' }, { key: 'utility', name: '水电燃气' }, { key: 'property', name: '物业费' },
    { key: 'furniture', name: '家具家电' }, { key: 'repair', name: '维修保养' }, { key: 'household', name: '日用品' },
  ]},
  { key: 'entertainment', name: '娱乐休闲', subs: [
    { key: 'movie', name: '电影演出' }, { key: 'travel', name: '旅游度假' }, { key: 'fitness', name: '运动健身' },
    { key: 'game', name: '游戏充值' }, { key: 'bar', name: 'KTV酒吧' },
  ]},
  { key: 'medical', name: '医疗健康', subs: [
    { key: 'doctor', name: '看病就诊' }, { key: 'medicine', name: '药品购买' }, { key: 'checkup', name: '体检保健' },
  ]},
  { key: 'education', name: '教育学习', subs: [
    { key: 'course', name: '培训课程' }, { key: 'book', name: '书籍资料' }, { key: 'exam', name: '考试报名' }, { key: 'stationery', name: '文具用品' },
  ]},
  { key: 'social', name: '人情往来', subs: [
    { key: 'gift', name: '红包礼品' }, { key: 'treat', name: '请客吃饭' }, { key: 'wedding', name: '婚丧嫁娶' }, { key: 'donate', name: '捐款慈善' },
  ]},
  { key: 'finance', name: '金融保险', subs: [
    { key: 'insurance', name: '保险缴费' }, { key: 'invest', name: '投资理财' }, { key: 'loan', name: '贷款还款' }, { key: 'fee', name: '手续费' },
  ]},
  { key: 'other', name: '其他杂项', subs: [
    { key: 'express', name: '快递邮寄' }, { key: 'pet', name: '宠物开销' }, { key: 'misc', name: '其他' },
  ]},
]

export function getCategoryName(catKey: string): string {
  return DEFAULT_CATEGORIES.find((c) => c.key === catKey)?.name || catKey
}

export function getSubcategoryName(catKey: string, subKey: string): string {
  return DEFAULT_CATEGORIES.find((c) => c.key === catKey)?.subs.find((s) => s.key === subKey)?.name || subKey
}

// ========== 自定义分类（云端+本地混合）==========

type CustomCat = { categoryKey: string; categoryName: string; subcategoryKey: string; subcategoryName: string }

async function getCustomCategories(): Promise<CustomCat[]> {
  if (useCloud) {
    const rows = await fetchCustomCategories()
    return rows.map((r) => ({ categoryKey: r.categoryKey, categoryName: r.categoryName, subcategoryKey: r.subcategoryKey, subcategoryName: r.subcategoryName }))
  }
  const raw = Taro.getStorageSync('custom_categories')
  return raw ? JSON.parse(raw) : []
}

function saveLocalCustomCats(list: CustomCat[]): void {
  Taro.setStorageSync('custom_categories', JSON.stringify(list))
}

export async function getMergedCategories(): Promise<typeof DEFAULT_CATEGORIES> {
  const customs = await getCustomCategories()
  const merged = DEFAULT_CATEGORIES.map((c) => ({ ...c, subs: [...c.subs] }))
  for (const cc of customs) {
    let group = merged.find((m) => m.key === cc.categoryKey)
    if (!group) { group = { key: cc.categoryKey, name: cc.categoryName, subs: [] }; merged.push(group) }
    if (!group.subs.find((s) => s.key === cc.subcategoryKey)) {
      group.subs.push({ key: cc.subcategoryKey, name: cc.subcategoryName })
    }
  }
  return merged
}

export async function addCustomCategory(catKey: string, catName: string, subKey: string, subName: string): Promise<void> {
  if (useCloud) { await addCloudCat({ categoryKey: catKey, categoryName: catName, subcategoryKey: subKey, subcategoryName: subName }); return }
  const list = await getCustomCategories()
  list.push({ categoryKey: catKey, categoryName: catName, subcategoryKey: subKey, subcategoryName: subName })
  saveLocalCustomCats(list)
}

export async function deleteCustomCategory(subKey: string): Promise<void> {
  if (useCloud) { await delCloudCat(subKey); return }
  saveLocalCustomCats((await getCustomCategories()).filter((c) => c.subcategoryKey !== subKey))
}

export async function isCustomCategory(subKey: string): Promise<boolean> {
  return (await getCustomCategories()).some((c) => c.subcategoryKey === subKey)
}

// ========== 预算（云端+本地混合）==========

export async function getBudget(): Promise<number> {
  if (useCloud) { const v = await getCloudSetting('monthly_budget'); return v ? Number(v) : 0 }
  const b = Taro.getStorageSync('budget')
  return b ? Number(b) : 0
}

export async function setBudget(val: number): Promise<void> {
  if (useCloud) { if (val === 0) { await setCloudSetting('monthly_budget', ''); return } await setCloudSetting('monthly_budget', String(val)); return }
  if (val === 0) { Taro.removeStorageSync('budget'); return }
  Taro.setStorageSync('budget', String(val))
}

// ========== 周期账单 ==========

export interface RecurringBill {
  id: string
  type: 'expense' | 'income'
  amount: number
  categoryKey: string
  categoryName: string
  subcategoryKey: string
  subcategoryName: string
  note: string
  cycle: 'daily' | 'weekly' | 'monthly' | 'yearly'
  nextDate: string
  isActive: boolean
}

export async function getRecurringBills(): Promise<RecurringBill[]> {
  const raw = Taro.getStorageSync('recurring_bills')
  return raw ? JSON.parse(raw) : []
}

function saveRecurringBills(list: RecurringBill[]): void {
  Taro.setStorageSync('recurring_bills', JSON.stringify(list))
}

export async function addRecurringBill(bill: Omit<RecurringBill, 'id'>): Promise<void> {
  const list = await getRecurringBills()
  list.push({ ...bill, id: Date.now().toString() })
  saveRecurringBills(list)
}

export async function deleteRecurringBill(id: string): Promise<void> {
  saveRecurringBills((await getRecurringBills()).filter((b) => b.id !== id))
}

export async function toggleRecurringBill(id: string, active: boolean): Promise<void> {
  saveRecurringBills((await getRecurringBills()).map((b) => (b.id === id ? { ...b, isActive: active } : b)))
}

/** 执行周期账单：创建一笔记录，并自动更新下次日期 */
export async function executeRecurringBill(id: string): Promise<void> {
  const bills = await getRecurringBills()
  const bill = bills.find((b) => b.id === id)
  if (!bill || !bill.isActive) return

  // 1. 创建记账记录
  await addRecord({
    type: bill.type,
    amount: bill.amount,
    categoryKey: bill.categoryKey,
    categoryName: bill.categoryName,
    subcategoryKey: bill.subcategoryKey,
    subcategoryName: bill.subcategoryName,
    note: bill.note,
    date: new Date().toISOString().slice(0, 10),
  })

  // 2. 计算下一个日期
  const next = new Date(bill.nextDate)
  switch (bill.cycle) {
    case 'daily': next.setDate(next.getDate() + 1); break
    case 'weekly': next.setDate(next.getDate() + 7); break
    case 'monthly': next.setMonth(next.getMonth() + 1); break
    case 'yearly': next.setFullYear(next.getFullYear() + 1); break
  }
  bill.nextDate = next.toISOString().slice(0, 10)

  saveRecurringBills(bills)
}
