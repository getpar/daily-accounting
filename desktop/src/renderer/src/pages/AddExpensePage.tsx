import { useState, useEffect } from 'react'
import { Card, Form, InputNumber, Select, Input, DatePicker, Button, Typography, message, Segmented } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Title } = Typography

interface CategoryGroup { category_key: string; category_name: string; subcategories: { subcategory_key: string; subcategory_name: string }[] }

function AddExpensePage(): JSX.Element {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [recordType, setRecordType] = useState<string>('expense')
  const navigate = useNavigate()

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
      message.success('保存成功！')
      form.resetFields(); setSelectedCat(null); navigate('/home')
    } catch { message.error('保存失败') }
    finally { setLoading(false) }
  }

  const subs = selectedCat ? categories.find(c => c.category_key === selectedCat)?.subcategories.map(s => ({ value: s.subcategory_key, label: s.subcategory_name })) || [] : []

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>✏️ 记一笔</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ record_date: dayjs() }}>
          <Form.Item label="类型">
            <Segmented block size="large" value={recordType} onChange={v => setRecordType(v as string)}
              options={[{ label: '💰 支出', value: 'expense' }, { label: '💵 收入', value: 'income' }]} />
          </Form.Item>
          <Form.Item label="金额" name="amount" rules={[{ required: true, message: '请输入金额' }, { type: 'number', min: 0.01 }]}>
            <InputNumber prefix="¥" placeholder="0.00" style={{ width: '100%' }} size="large" precision={2} min={0.01} />
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
            <Input.TextArea placeholder="可选" rows={3} maxLength={200} showCount />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" block>保存记录</Button>
        </Form>
      </Card>
    </div>
  )
}

export default AddExpensePage
