import { useState, useEffect } from 'react'
import { Card, Form, InputNumber, Select, Input, DatePicker, Button, Typography, message, Segmented } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title } = Typography

interface CategoryGroup { category_key: string; category_name: string; subcategories: { subcategory_key: string; subcategory_name: string }[] }

function QuickAddPage(): JSX.Element {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [recordType, setRecordType] = useState<string>('expense')

  useEffect(() => { loadCategories() }, [])

  async function loadCategories(): Promise<void> {
    const raw = await window.electronAPI.getCategories()
    const grouped: Record<string, CategoryGroup> = {}
    for (const cat of raw) {
      if (!grouped[cat.category_key]) grouped[cat.category_key] = { category_key: cat.category_key, category_name: cat.category_name, subcategories: [] }
      grouped[cat.category_key].subcategories.push({ subcategory_key: cat.subcategory_key, subcategory_name: cat.subcategory_name })
    }
    setCategories(Object.values(grouped))
  }

  async function onFinish(v: any): Promise<void> {
    setLoading(true)
    try {
      await window.electronAPI.addRecord({
        type: recordType, amount: v.amount, category_key: v.category_key,
        subcategory_key: v.subcategory_key, note: v.note || '',
        record_date: v.record_date.format('YYYY-MM-DD'),
      })
      message.success('记录成功！')
      form.resetFields(); setSelectedCat(null)
    } catch { message.error('保存失败') }
    finally { setLoading(false) }
  }

  const subs = selectedCat ? categories.find(c => c.category_key === selectedCat)?.subcategories.map(s => ({ value: s.subcategory_key, label: s.subcategory_name })) || [] : []

  return (
    <div style={{ padding: 16 }}>
      <Title level={4} style={{ marginBottom: 16 }}>⚡ 快速记账 (Ctrl+Shift+N)</Title>
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ record_date: dayjs() }}>
        <Form.Item label="类型">
          <Segmented block value={recordType} onChange={v => setRecordType(v as string)}
            options={[{ label: '💰 支出', value: 'expense' }, { label: '💵 收入', value: 'income' }]} />
        </Form.Item>
        <Form.Item label="金额" name="amount" rules={[{ required: true, message: '请输入金额' }, { type: 'number', min: 0.01 }]}>
          <InputNumber prefix="¥" placeholder="0.00" style={{ width: '100%' }} size="large" precision={2} min={0.01} autoFocus />
        </Form.Item>
        <Form.Item label="日期" name="record_date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} size="large" allowClear={false} />
        </Form.Item>
        <Form.Item label="一级分类" name="category_key" rules={[{ required: true }]}>
          <Select placeholder="选择大类" size="large" onChange={v => { setSelectedCat(v); form.setFieldValue('subcategory_key', undefined) }}
            options={categories.map(c => ({ value: c.category_key, label: c.category_name }))} />
        </Form.Item>
        <Form.Item label="二级分类" name="subcategory_key" rules={[{ required: true }]}>
          <Select placeholder={selectedCat ? '选择小类' : '请先选择大类'} size="large" disabled={!selectedCat} options={subs} />
        </Form.Item>
        <Form.Item label="备注" name="note">
          <Input placeholder="可选" maxLength={200} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" block>保存</Button>
      </Form>
    </div>
  )
}

export default QuickAddPage
