import { View, Text, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useEffect } from 'react'
import { getMonthTotal, getRecords, getBudget, setBudget as saveBudgetToStorage } from '../../utils/storage'
import './index.scss'

const THIS_MONTH = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()

function formatAmount(val: number): string {
  const abs = Math.abs(val)
  if (abs >= 100000000) return (abs / 100000000).toFixed(2) + '亿'
  if (abs >= 10000) return (abs / 10000).toFixed(2) + '万'
  return abs.toFixed(2)
}

export default function Index(): JSX.Element {
  const [month, setMonth] = useState(THIS_MONTH)
  const [exp, setExp] = useState(0)
  const [inc, setInc] = useState(0)
  const [recent, setRecent] = useState<any[]>([])
  const [budget, setBudget] = useState(0)
  const [showBudget, setShowBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  const isCurrentMonth = month === THIS_MONTH

  // 月份选项
  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return opts
  }, [])

  async function refresh(): Promise<void> {
    const [expVal, incVal, records] = await Promise.all([
      getMonthTotal(month, 'expense'), getMonthTotal(month, 'income'), getRecords(),
    ])
    setExp(expVal); setInc(incVal); setRecent(records.filter((r) => r.date.startsWith(month)).slice(0, 5))
    if (isCurrentMonth) {
      const b = await getBudget()
      setBudget(b)
    } else { setBudget(0) }
  }

  useDidShow(() => { refresh() })
  useEffect(() => { refresh() }, [month])
  Taro.eventCenter.on('dataChanged', refresh)

  async function saveBudget(): Promise<void> {
    const val = Number(budgetInput)
    if (val >= 0 && budgetInput.trim() !== '') {
      setBudget(val)
      await saveBudgetToStorage(val)
      setShowBudget(false)
    }
  }

  const balance = inc - exp
  const pct = budget > 0 ? Math.round((exp / budget) * 100) : 0
  const over = budget > 0 && exp > budget

  return (
    <View className='wrap'>
      <View className='header'>
        <Text className='header-title'>每日小记</Text>
        <Picker mode='selector' range={monthOptions} onChange={(e) => { setMonth(monthOptions[Number(e.detail.value)]); setShowMonthPicker(false) }}>
          <View className='header-month' onClick={() => setShowMonthPicker(true)}>
            <Text>{month}</Text>
            <Text className='month-arrow'>▼</Text>
          </View>
        </Picker>
      </View>

      <View className='stats'>
        <View className='stat'>
          <Text className='stat-label'>支出</Text>
          <Text className='stat-val red'>¥{formatAmount(exp)}</Text>
        </View>
        <View className='stat'>
          <Text className='stat-label'>收入</Text>
          <Text className='stat-val green'>¥{formatAmount(inc)}</Text>
        </View>
      </View>
      <View className='stats-single'>
        <View className='stat' style='border:none'>
          <Text className='stat-label'>结余</Text>
          <Text className={`stat-val ${balance >= 0 ? 'green' : 'red'}`}>
            ¥{balance.toFixed(2)}
          </Text>
        </View>
      </View>

      {isCurrentMonth && budget > 0 && (
        <View className='card'>
          <View className='card-row'>
            <Text className='card-label'>预算 {pct > 999 ? '已超支' : `${pct}%`}</Text>
            <Text className='card-sub'>预算 ¥{formatAmount(budget)} / 已用 ¥{formatAmount(exp)}</Text>
          </View>
          <View className='bar'><View className='bar-fill' style={`width:${Math.min(pct, 100)}%;background:${over ? '#ff4d4f' : pct >= 80 ? '#faad14' : '#52c41a'}`} /></View>
        </View>
      )}

      <View className='card'>
        <View className='card-row'>
          <Text className='card-label'>最近记录</Text>
          <View className='card-actions'>
            {isCurrentMonth && <Text className='link' onClick={() => { setShowBudget(true); setBudgetInput(budget > 0 ? String(Math.round(budget)) : '') }}>预算</Text>}
            <Text className='link' onClick={() => Taro.navigateTo({ url: '/pages/categories/index' })}>分类</Text>
            <Text className='link danger' onClick={() => {
              Taro.showModal({ title: '清除所有数据？', content: '将删除全部记账记录和预算', success: (res) => {
                if (res.confirm) { Taro.clearStorageSync(); setExp(0); setInc(0); setRecent([]); setBudget(0); Taro.eventCenter.trigger('dataChanged') }
              }})
            }}>清数据</Text>
          </View>
        </View>
        {recent.length === 0 ? (
          <View className='empty'><Text>暂无记录</Text></View>
        ) : recent.map((r) => (
          <View key={r.id} className='record-item'>
            <View className='record-left'>
              <Text className='tag blue'>{r.categoryName}</Text>
              <Text className='tag'>{r.subcategoryName}</Text>
              <Text className='record-note'>{r.date}{r.note ? ' ' + r.note : ''}</Text>
            </View>
            <Text className={`record-amount ${r.type === 'income' ? 'green' : 'red'}`}>{r.type === 'income' ? '+' : '-'}¥{r.amount.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {showBudget && (
        <View className='modal' onClick={() => setShowBudget(false)}>
          <View className='modal-box' onClick={(e) => e.stopPropagation()}>
            <Text className='modal-title'>设置月度预算</Text>
            <View className='input-wrap'>
              <Text className='input-prefix'>¥</Text>
              <Input className='input' type='digit' placeholder='输入金额' value={budgetInput} onInput={(e) => setBudgetInput(e.detail.value)} maxlength={10} />
            </View>
            <View className='modal-btns'>
              <View className='btn btn-cancel' onClick={() => setShowBudget(false)}><Text>取消</Text></View>
              <View className='btn btn-ok' onClick={saveBudget}><Text className='btn-ok-text'>保存</Text></View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
