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

// 分类 emoji
const catEmoji: Record<string, string> = {
  food: '🍜', transport: '🚗', shopping: '🛒', housing: '🏠',
  entertainment: '🎮', medical: '💊', education: '📚', social: '🎁',
  finance: '💰', other: '📦',
}

export default function Index(): JSX.Element {
  const [month, setMonth] = useState(THIS_MONTH)
  const [exp, setExp] = useState(0)
  const [inc, setInc] = useState(0)
  const [recent, setRecent] = useState<any[]>([])
  const [budget, setBudget] = useState(0)
  const [showBudget, setShowBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  const isCurrentMonth = month === THIS_MONTH

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
    setExp(expVal); setInc(incVal); setRecent(records.filter((r) => r.date.startsWith(month)).slice(0, 8))
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

  async function clearAll(): Promise<void> {
    Taro.showModal({
      title: '清除所有数据？',
      content: '将删除全部记账记录和预算',
      success: (res) => {
        if (res.confirm) { Taro.clearStorageSync(); setExp(0); setInc(0); setRecent([]); setBudget(0); Taro.eventCenter.trigger('dataChanged') }
      },
    })
  }

  const balance = inc - exp
  const pct = budget > 0 ? Math.round((exp / budget) * 100) : 0
  const over = budget > 0 && exp > budget

  // 预算颜色
  const barColor = over ? '#FEE2E2' : pct >= 80 ? '#FEF3C7' : '#D1FAE5'

  return (
    <View className='wrap'>
      {/* ====== 深色头部区域 ====== */}
      <View className='hero'>
        <View className='hero-glow1' />
        <View className='hero-glow2' />
        {/* 顶栏 */}
        <View className='hero-top'>
          <Text className='hero-brand'>📒 每日小记</Text>
          <Picker mode='selector' range={monthOptions} onChange={(e) => setMonth(monthOptions[Number(e.detail.value)])}>
            <View className='hero-month'>
              <Text>{month}</Text>
              <Text className='hero-arrow'>▼</Text>
            </View>
          </Picker>
        </View>

        {/* 结余大字 */}
        <View className='hero-balance'>
          <Text className='hero-balance-label'>本月结余</Text>
          <Text className={`hero-balance-value ${balance >= 0 ? 'green' : 'red'}`}>
            {balance >= 0 ? '+' : '-'}¥{formatAmount(Math.abs(balance))}
          </Text>
        </View>

        {/* 收支双栏 */}
        <View className='hero-row'>
          <View className='hero-stat' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>
            <Text className='hero-stat-label'>📤 支出</Text>
            <Text className='hero-stat-val red'>¥{formatAmount(exp)}</Text>
          </View>
          <View className='hero-divider' />
          <View className='hero-stat'>
            <Text className='hero-stat-label'>📥 收入</Text>
            <Text className='hero-stat-val green'>¥{formatAmount(inc)}</Text>
          </View>
        </View>

        {/* 预算条 */}
        {isCurrentMonth && budget > 0 && (
          <View className='hero-budget'>
            <View className='hero-budget-header'>
              <Text className='hero-budget-label'>{over ? '⚠️ 已超支' : `月度预算 ${pct}%`}</Text>
              <Text className='hero-budget-num'>¥{formatAmount(budget)}</Text>
            </View>
            <View className='hero-bar'>
              <View className='hero-bar-fill' style={`width:${Math.min(pct, 100)}%;background:${barColor}`} />
            </View>
          </View>
        )}
      </View>

      {/* ====== 快捷操作 ====== */}
      <View className='actions'>
        <View className='action-item' onClick={() => Taro.switchTab({ url: '/pages/add/index' })}>
          <View className='action-icon action-add'>✏️</View>
          <Text className='action-text'>记一笔</Text>
        </View>
        <View className='action-item' onClick={() => { setShowBudget(true); setBudgetInput(budget > 0 ? String(Math.round(budget)) : '') }}>
          <View className='action-icon action-budget'>🎯</View>
          <Text className='action-text'>{budget > 0 ? '调预算' : '设预算'}</Text>
        </View>
        <View className='action-item' onClick={() => Taro.navigateTo({ url: '/pages/categories/index' })}>
          <View className='action-icon action-cat'>🏷️</View>
          <Text className='action-text'>分类</Text>
        </View>
        <View className='action-item' onClick={() => Taro.switchTab({ url: '/pages/stats/index' })}>
          <View className='action-icon action-stats'>📊</View>
          <Text className='action-text'>统计</Text>
        </View>
      </View>

      {/* ====== 最近记录 ====== */}
      <View className='section'>
        <View className='section-header'>
          <Text className='section-title'>📋 最近记录</Text>
          <Text className='section-more' onClick={() => Taro.switchTab({ url: '/pages/history/index' })}>全部 ›</Text>
        </View>

        {recent.length === 0 ? (
          <View className='empty'>
            <Text className='empty-icon'>📝</Text>
            <Text>暂无记录，去记一笔吧</Text>
          </View>
        ) : (
          <View className='record-list'>
            {recent.map((r, i) => (
              <View key={r.id} className={`record-card ${i === recent.length - 1 ? 'last' : ''}`}>
                <View className='record-icon' style={`background:${r.type === 'income' ? '#ECFDF5' : '#FFF0E8'}`}>
                  <Text>{catEmoji[r.categoryKey] || '📌'}</Text>
                </View>
                <View className='record-body'>
                  <View className='record-top'>
                    <Text className='record-cat'>{r.subcategoryName}</Text>
                    <Text className={`record-amt ${r.type === 'income' ? 'green' : 'red'}`}>
                      {r.type === 'income' ? '+' : '-'}¥{r.amount.toFixed(2)}
                    </Text>
                  </View>
                  <View className='record-btm'>
                    <Text className='record-date'>{r.date}</Text>
                    {r.note ? <Text className='record-note'>· {r.note}</Text> : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 清除数据 */}
      <View className='clear-btn' onClick={clearAll}>
        <Text className='clear-text'>清除所有数据</Text>
      </View>

      {/* ====== 预算弹窗 ====== */}
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

      <View style='height:20rpx' />
    </View>
  )
}
