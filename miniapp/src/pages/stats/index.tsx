import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getMonthTotal, getMonthStats, getDailyTrend } from '../../utils/storage'
import './index.scss'

function getMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Stats(): JSX.Element {
  const [month] = useState(getMonth())
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [, setTick] = useState(0)

  useEffect(() => { loadData() }, [month, type])
  useDidShow(() => { setTick((t) => t + 1); loadData() })

  async function loadData(): Promise<void> {
    const [t, s, d] = await Promise.all([
      getMonthTotal(month, type), getMonthStats(month, type), getDailyTrend(month, type),
    ])
    setTotal(t); setStats(s); setTrend(d)
  }

  return (
    <View className='wrap'>
      <View className='type-switch'>
        <View className={`type-btn ${type === 'expense' ? 'active expense' : ''}`} onClick={() => setType('expense')}><Text>支出</Text></View>
        <View className={`type-btn ${type === 'income' ? 'active income' : ''}`} onClick={() => setType('income')}><Text>收入</Text></View>
      </View>

      <View className='card'>
        <Text className='total-label'>合计</Text>
        <Text className={`total-value ${type === 'income' ? 'green' : 'red'}`}>¥{total.toFixed(2)}</Text>
        <Text className='total-sub'>{stats.length} 个类别</Text>
      </View>

      {stats.length === 0 ? (
        <View className='empty'><Text>暂无数据</Text></View>
      ) : (
        <>
          <View className='card'>
            <Text className='section-title'>分类占比</Text>
            {stats.map((s) => (
              <View key={s.categoryKey} className='stat-row'>
                <View className='stat-row-header'>
                  <Text className='stat-name'>{s.categoryName}</Text>
                  <Text className='stat-amount'>¥{s.total.toFixed(2)}（{total > 0 ? Math.round((s.total / total) * 100) : 0}%）</Text>
                </View>
                <View className='bar'><View className='bar-fill' style={{ width: `${total > 0 ? (s.total / total) * 100 : 0}%`, background: `hsl(${stats.indexOf(s) * 40}, 70%, 55%)` }} /></View>
              </View>
            ))}
          </View>

          {trend.length > 1 && (
            <View className='card'>
              <Text className='section-title'>每日趋势</Text>
              {trend.map((d) => (
                <View key={d.date} className='trend-row'>
                  <Text className='trend-date'>{d.date.slice(5)}</Text>
                  <Text className='trend-amount'>¥{d.total.toFixed(2)}</Text>
                  <View className='trend-bar'><View className='trend-fill' style={{ width: `${Math.max((d.total / Math.max(...trend.map((t: any) => t.total))) * 100, 2)}%` }} /></View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  )
}
