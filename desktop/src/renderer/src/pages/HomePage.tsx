import { useState, useEffect } from 'react'
import { Card, Statistic, Row, Col, Typography, List, Tag, Progress, InputNumber, Button, Modal, Alert } from 'antd'
import { WalletOutlined, CalendarOutlined, EditOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography

function HomePage(): JSX.Element {
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [incomeTotal, setIncomeTotal] = useState(0)
  const [recentRecords, setRecentRecords] = useState<any[]>([])
  const [budget, setBudget] = useState<number | null>(null)
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetInput, setBudgetInput] = useState<number | null>(null)
  const currentMonth = dayjs().format('YYYY-MM')

  useEffect(() => { loadData(); loadBudget() }, [])

  async function loadData(): Promise<void> {
    const [expTotal, incTotal, records] = await Promise.all([
      window.electronAPI.getMonthlyTotal(currentMonth, 'expense'),
      window.electronAPI.getMonthlyTotal(currentMonth, 'income'),
      window.electronAPI.getRecordList({ page: 1, pageSize: 10, month: currentMonth }),
    ])
    setExpenseTotal(expTotal)
    setIncomeTotal(incTotal)
    setRecentRecords(records.rows)
  }

  async function loadBudget(): Promise<void> {
    const val = await window.electronAPI.getSetting('monthly_budget')
    if (val) { setBudget(parseFloat(val)); setBudgetInput(parseFloat(val)) }
  }

  async function saveBudget(): Promise<void> {
    if (budgetInput && budgetInput > 0) {
      await window.electronAPI.setSetting('monthly_budget', String(budgetInput))
      setBudget(budgetInput)
      setBudgetModalOpen(false)
    }
  }

  const balance = incomeTotal - expenseTotal
  const budgetPercent = budget && budget > 0 ? Math.round((expenseTotal / budget) * 100) : 0
  const isOverBudget = budget ? expenseTotal > budget : false

  function getBudgetColor(): string {
    if (!budget) return '#1677ff'
    if (budgetPercent > 100) return '#ff4d4f'
    if (budgetPercent >= 80) return '#ff4d4f'
    if (budgetPercent >= 50) return '#faad14'
    return '#52c41a'
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>本月概览 — {dayjs().format('YYYY年M月')}</Title>

      {budget && isOverBudget && (
        <Alert message={`⚠️ 已超支 ¥${(expenseTotal - budget).toFixed(2)}（预算 ¥${budget.toFixed(0)}，本月已用 ¥${expenseTotal.toFixed(2)}）`} type="error" showIcon style={{ marginBottom: 16 }} />
      )}
      {budget && budgetPercent >= 80 && !isOverBudget && (
        <Alert message={`⚡ 已用预算的 ${budgetPercent}%，剩余 ¥${(budget - expenseTotal).toFixed(2)}（预算 ¥${budget.toFixed(0)}）`} type="warning" showIcon style={{ marginBottom: 16 }} />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="本月支出" value={expenseTotal} precision={2} prefix="¥" valueStyle={{ color: '#ff4d4f', fontSize: 26 }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="本月收入" value={incomeTotal} precision={2} prefix="¥" valueStyle={{ color: '#52c41a', fontSize: 26 }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="收支结余" value={balance} precision={2} prefix={balance >= 0 ? '¥' : '-¥'} valueStyle={{ color: balance >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 26 }} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Statistic title={budget ? '月度预算' : '设置预算'} value={budget ? `¥${budget.toFixed(0)}` : '未设置'} valueStyle={{ fontSize: 22, color: budget ? '#1677ff' : '#999' }} />
              <Button type="link" icon={<EditOutlined />} onClick={() => { setBudgetInput(budget); setBudgetModalOpen(true) }} />
            </div>
          </Card>
        </Col>
      </Row>

      {budget && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span><Text strong>预算使用进度</Text><Tag color={getBudgetColor()} style={{ marginLeft: 8 }}>{budgetPercent}%</Tag></span>
            <Text type="secondary">剩余 ¥{Math.max(budget - expenseTotal, 0).toFixed(2)}</Text>
          </div>
          <Progress percent={Math.min(budgetPercent, 100)} strokeColor={getBudgetColor()} trailColor="#f0f0f0" strokeWidth={14} format={() => `${budgetPercent}%`} />
        </Card>
      )}

      <Card title="最近记录">
        {recentRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <WalletOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <br /><Text type="secondary">本月还没有记录</Text>
          </div>
        ) : (
          <List dataSource={recentRecords} renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                title={<span><Tag color={item.type === 'income' ? 'green' : 'blue'}>{item.type === 'income' ? '收入' : '支出'}</Tag><Tag color="blue">{item.category_name}</Tag><Tag>{item.subcategory_name}</Tag></span>}
                description={`${item.expense_date || item.record_date} ${item.note || ''}`}
              />
              <span style={{ fontSize: 16, fontWeight: 600, color: item.type === 'income' ? '#52c41a' : '#ff4d4f' }}>
                {item.type === 'income' ? '+' : '-'}¥{item.amount.toFixed(2)}
              </span>
            </List.Item>
          )} />
        )}
      </Card>

      <Modal title="设置月度支出预算" open={budgetModalOpen} onOk={saveBudget} onCancel={() => setBudgetModalOpen(false)} okText="保存" cancelText="取消">
        <div style={{ padding: '16px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>设置每月支出上限</Text>
          <InputNumber prefix="¥" placeholder="例如：5000" style={{ width: '100%' }} size="large" value={budgetInput} onChange={(v) => setBudgetInput(v)} min={0} precision={2} />
        </div>
      </Modal>
    </div>
  )
}

export default HomePage
