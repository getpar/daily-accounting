import { useState, useEffect } from 'react'
import { Card, DatePicker, Typography, Row, Col, Statistic, Empty, Spin, Space, Segmented } from 'antd'
import { PieChartOutlined } from '@ant-design/icons'
import { Pie, Column, Line } from '@ant-design/charts'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text } = Typography
const catColors: Record<string, string> = { food: '#ff4d4f', transport: '#1677ff', shopping: '#722ed1', housing: '#fa8c16', entertainment: '#52c41a', medical: '#eb2f96', education: '#13c2c2', social: '#faad14', finance: '#2f54eb', other: '#8c8c8c' }

function getColors(stats: any[]) { return stats.map(s => catColors[s.category_key] || '#8c8c8c') }

function StatsPage(): JSX.Element {
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [stats, setStats] = useState<any[]>([])
  const [dailyTrend, setDailyTrend] = useState<any[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [recordType, setRecordType] = useState<string>('expense')
  // 月度对比
  const [compareMonth, setCompareMonth] = useState<Dayjs>(dayjs().subtract(1, 'month'))
  const [compareData, setCompareData] = useState<any>(null)

  useEffect(() => { loadStats() }, [selectedMonth, recordType])
  useEffect(() => { loadCompare() }, [compareMonth, selectedMonth])

  async function loadStats(): Promise<void> {
    setLoading(true)
    try {
      const month = selectedMonth.format('YYYY-MM')
      const [ms, total, trend] = await Promise.all([
        window.electronAPI.getMonthlyStats(month, recordType),
        window.electronAPI.getMonthlyTotal(month, recordType),
        window.electronAPI.getDailyTrend(month, recordType),
      ])
      setStats(ms); setTotalAmount(total); setDailyTrend(trend)
    } finally { setLoading(false) }
  }

  async function loadCompare(): Promise<void> {
    const result = await window.electronAPI.compareMonths(selectedMonth.format('YYYY-MM'), compareMonth.format('YYYY-MM'))
    setCompareData(result)
  }

  const pieData = stats.map(i => ({ type: i.category_name, value: i.total }))
  const columnData = stats.map(i => ({ category: i.category_name, amount: i.total }))
  const lineData = dailyTrend.map(i => ({ date: i.date, amount: i.total }))

  const pieConfig = {
    data: pieData, angleField: 'value', colorField: 'type', radius: 0.8, innerRadius: 0.5,
    label: { text: (d: any) => `${d.type}\n¥${Number(d.value).toFixed(0)}`, position: 'outside' as const, style: { fontSize: 12 } },
    legend: { color: { position: 'bottom' as const } }, color: getColors(stats),
  }

  const columnConfig = {
    data: columnData, xField: 'category', yField: 'amount', colorField: 'category',
    label: { text: (d: any) => `¥${Number(d.amount).toFixed(0)}`, position: 'top' as const, style: { fontSize: 11 } },
    legend: false, color: getColors(stats), axis: { x: { labelAutoRotate: true } },
  }

  const lineConfig = {
    data: lineData, xField: 'date', yField: 'amount', point: { size: 5, shape: 'diamond' as const },
    label: { text: (d: any) => (Number(d.amount) > 0 ? `¥${Number(d.amount).toFixed(0)}` : ''), style: { fontSize: 10 } },
    smooth: true, style: { line: { stroke: '#1677ff' } },
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>📊 统计分析</Title>
      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <DatePicker picker="month" value={selectedMonth} onChange={d => setSelectedMonth(d || dayjs())} allowClear={false} format="YYYY年M月" size="large" />
          <Segmented value={recordType} onChange={v => setRecordType(v as string)}
            options={[{ label: '支出', value: 'expense' }, { label: '收入', value: 'income' }]} />
          <Text type="secondary" style={{ fontSize: 16 }}>
            合计：<span className="amount-text-large" style={{ fontSize: 28, color: recordType === 'income' ? '#52c41a' : '#ff4d4f' }}>¥{totalAmount.toFixed(2)}</span>
          </Text>
        </Space>
      </Card>

      {loading ? <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
      : stats.length === 0 ? <Card><Empty description="暂无数据" /></Card>
      : <>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card><Statistic title="合计" value={totalAmount} precision={2} prefix="¥" valueStyle={{ color: recordType === 'income' ? '#52c41a' : '#ff4d4f' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="类别数" value={stats.length} suffix="个" prefix={<PieChartOutlined />} /></Card></Col>
          <Col span={6}><Card><Statistic title="日均" value={totalAmount / Math.max(dayjs().date(), 1)} precision={2} prefix="¥" /></Card></Col>
          <Col span={6}><Card><Statistic title="最高类别" value={stats[0]?.category_name || '-'} suffix={stats[0] ? `¥${stats[0].total.toFixed(0)}` : ''} /></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={12}><Card title="📊 分类占比"><Pie {...pieConfig} height={360} /></Card></Col>
          <Col span={12}><Card title="📊 分类对比"><Column {...columnConfig} height={360} /></Card></Col>
          <Col span={24}>
            <Card title="📈 每日趋势">
              {lineData.length > 1 ? <Line {...lineConfig} height={300} />
                : <div style={{ textAlign: 'center', padding: 80, color: '#999' }}>需要至少2天有数据才能显示趋势图</div>}
            </Card>
          </Col>
        </Row>

        {/* 月度对比 */}
        <Card title="📅 月度对比" style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 16 }}>
            <DatePicker picker="month" value={compareMonth} onChange={d => setCompareMonth(d || dayjs())} allowClear={false} format="YYYY年M月" />
            <Text>{compareMonth.format('YYYY年M月')} 总支出：<Text strong style={{ color: '#ff4d4f' }}>¥{compareData?.month2?.total?.toFixed(2) || '0.00'}</Text></Text>
            <Text type="secondary">vs</Text>
            <Text>{selectedMonth.format('YYYY年M月')} 总支出：<Text strong style={{ color: '#ff4d4f' }}>¥{compareData?.month1?.total?.toFixed(2) || '0.00'}</Text></Text>
          </Space>
          {compareData && (
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title={`${compareMonth.format('M月')} 分类占比`}>
                  <Pie
                    data={compareData.month2.rows.map((i: any) => ({ type: i.category_name, value: i.total }))}
                    angleField="value" colorField="type" radius={0.8}
                    label={{ text: (d: any) => d.type, position: 'outside' as const, style: { fontSize: 11 } }}
                    legend={{ color: { position: 'bottom' as const } }}
                    color={getColors(compareData.month2.rows)}
                    height={260}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title={`${selectedMonth.format('M月')} 分类占比`}>
                  <Pie
                    data={compareData.month1.rows.map((i: any) => ({ type: i.category_name, value: i.total }))}
                    angleField="value" colorField="type" radius={0.8}
                    label={{ text: (d: any) => d.type, position: 'outside' as const, style: { fontSize: 11 } }}
                    legend={{ color: { position: 'bottom' as const } }}
                    color={getColors(compareData.month1.rows)}
                    height={260}
                  />
                </Card>
              </Col>
            </Row>
          )}
        </Card>
      </>}
    </div>
  )
}

export default StatsPage
