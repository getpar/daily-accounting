import { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Modal, Form, InputNumber, Select, Input, DatePicker, Switch, Typography, Popconfirm, message, Space } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface CategoryGroup { category_key: string; category_name: string; subcategories: { subcategory_key: string; subcategory_name: string }[] }

function RecurringPage(): JSX.Element {
  const [bills, setBills] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [form] = Form.useForm()

  useEffect(() => { loadData(); loadCategories() }, [])

  async function loadData(): Promise<void> {
    setBills(await window.electronAPI.getRecurringBills())
  }

  async function loadCategories(): Promise<void> {
    const raw = await window.electronAPI.getCategories()
    const grouped: Record<string, CategoryGroup> = {}
    for (const cat of raw) {
      if (!grouped[cat.category_key]) grouped[cat.category_key] = { category_key: cat.category_key, category_name: cat.category_name, subcategories: [] }
      grouped[cat.category_key].subcategories.push({ subcategory_key: cat.subcategory_key, subcategory_name: cat.subcategory_name })
    }
    setCategories(Object.values(grouped))
  }

  async function handleAdd(): Promise<void> {
    const v = await form.validateFields()
    await window.electronAPI.addRecurring({
      type: v.type || 'expense', amount: v.amount, category_key: v.category_key,
      subcategory_key: v.subcategory_key, note: v.note || '', cycle: v.cycle,
      next_date: v.next_date.format('YYYY-MM-DD'),
    })
    message.success('添加成功')
    setModalOpen(false); form.resetFields(); loadData()
  }

  async function handleToggle(id: number, active: boolean): Promise<void> {
    await window.electronAPI.toggleRecurring(id, active)
    loadData()
  }

  async function handleDelete(id: number): Promise<void> {
    await window.electronAPI.deleteRecurring(id)
    message.success('已删除'); loadData()
  }

  async function handleExecute(bill: any): Promise<void> {
    await window.electronAPI.executeRecurring(bill.id)
    message.success(`已记录：${bill.category_name}-${bill.subcategory_name} ¥${bill.amount.toFixed(2)}`)
    loadData()
  }

  const subs = selectedCat ? categories.find(c => c.category_key === selectedCat)?.subcategories.map(s => ({ value: s.subcategory_key, label: s.subcategory_name })) || [] : []

  const columns = [
    { title: '类型', dataIndex: 'type', key: 'type', width: 70, render: (t: string) => <Tag color={t === 'income' ? 'green' : 'red'}>{t === 'income' ? '收入' : '支出'}</Tag> },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 100, render: (a: number) => <span style={{ fontWeight: 600 }}>¥{a.toFixed(2)}</span> },
    { title: '分类', key: 'cat', width: 170, render: (_: any, r: any) => <span><Tag color="blue">{r.category_name}</Tag><Tag>{r.subcategory_name}</Tag></span> },
    { title: '周期', dataIndex: 'cycle', key: 'cycle', width: 80, render: (c: string) => ({ daily: '每天', weekly: '每周', monthly: '每月', yearly: '每年' } as any)[c] || c },
    { title: '下次日期', dataIndex: 'next_date', key: 'next_date', width: 110 },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
    { title: '启用', key: 'active', width: 60, render: (_: any, r: any) => <Switch size="small" checked={!!r.is_active} onChange={v => handleToggle(r.id, v)} /> },
    { title: '操作', key: 'act', width: 160, render: (_: any, r: any) => (
      <Space>
        <Button type="link" size="small" onClick={() => handleExecute(r)}>立即记录</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    )},
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>🔁 周期账单</Title>
      <Space direction="vertical" style={{ marginBottom: 16, width: '100%' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalOpen(true); setSelectedCat(null); form.resetFields() }}>添加周期账单</Button>
        <Text type="secondary">周期性账单会在到期日自动生成记录，让固定开销不用手动记</Text>
      </Space>

      <Card>
        <Table columns={columns} dataSource={bills} rowKey="id" pagination={false} size="middle" />
      </Card>

      <Modal title="添加周期账单" open={modalOpen} onOk={handleAdd} onCancel={() => setModalOpen(false)} okText="添加" width={500}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ type: 'expense', cycle: 'monthly', next_date: dayjs() }}>
          <Form.Item label="类型" name="type">
            <Select options={[{ value: 'expense', label: '💰 支出' }, { value: 'income', label: '💵 收入' }]} />
          </Form.Item>
          <Form.Item label="金额" name="amount" rules={[{ required: true }, { type: 'number', min: 0.01 }]}>
            <InputNumber prefix="¥" style={{ width: '100%' }} size="large" precision={2} />
          </Form.Item>
          <Form.Item label="周期" name="cycle">
            <Select options={[{ value: 'monthly', label: '每月' }, { value: 'weekly', label: '每周' }, { value: 'daily', label: '每天' }, { value: 'yearly', label: '每年' }]} />
          </Form.Item>
          <Form.Item label="下次日期" name="next_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} allowClear={false} />
          </Form.Item>
          <Form.Item label="一级分类" name="category_key" rules={[{ required: true }]}>
            <Select placeholder="选择大类" size="large" onChange={v => { setSelectedCat(v); form.setFieldValue('subcategory_key', undefined) }}
              options={categories.map(c => ({ value: c.category_key, label: c.category_name }))} />
          </Form.Item>
          <Form.Item label="二级分类" name="subcategory_key" rules={[{ required: true }]}>
            <Select placeholder={selectedCat ? '选择小类' : '请先选择大类'} size="large" disabled={!selectedCat} options={subs} />
          </Form.Item>
          <Form.Item label="备注" name="note"><Input placeholder="例如：房租、Netflix订阅" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RecurringPage
