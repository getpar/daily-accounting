import { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Modal, Form, Input, Select, Typography, Popconfirm, message, Space } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// 预定义大类
const MAJOR_CATEGORIES = [
  { key: 'food', name: '餐饮饮食' }, { key: 'transport', name: '交通出行' },
  { key: 'shopping', name: '购物消费' }, { key: 'housing', name: '住房居家' },
  { key: 'entertainment', name: '娱乐休闲' }, { key: 'medical', name: '医疗健康' },
  { key: 'education', name: '教育学习' }, { key: 'social', name: '人情往来' },
  { key: 'finance', name: '金融保险' }, { key: 'other', name: '其他杂项' },
  { key: 'income', name: '收入来源' },
]

function CategoryPage(): JSX.Element {
  const [categories, setCategories] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [selectedMajor, setSelectedMajor] = useState<string | undefined>(undefined)

  useEffect(() => { loadData() }, [])

  async function loadData(): Promise<void> {
    const raw = await window.electronAPI.getCategories()
    setCategories(raw)
  }

  async function handleDelete(cat: any): Promise<void> {
    const result = await window.electronAPI.deleteCategory(cat.category_key, cat.subcategory_key)
    if (result.success) { message.success('已删除'); loadData() }
    else { message.error(result.error || '删除失败') }
  }

  async function handleAdd(): Promise<void> {
    try {
      const v = await form.validateFields()
      const major = MAJOR_CATEGORIES.find(c => c.key === v.category_key)
      const result = await window.electronAPI.addCategory({
        category_key: v.category_key, category_name: major?.name || v.category_key,
        subcategory_key: v.subcategory_key || `${v.category_key}_${Date.now()}`,
        subcategory_name: v.subcategory_name,
      })
      if (result.success) { message.success('添加成功'); setModalOpen(false); form.resetFields(); loadData() }
      else { message.error(result.error || '添加失败') }
    } catch { /* validation error */ }
  }

  // 归类
  const grouped: Record<string, { key: string; name: string; subs: any[] }> = {}
  for (const c of categories) {
    if (!grouped[c.category_key]) grouped[c.category_key] = { key: c.category_key, name: c.category_name, subs: [] }
    grouped[c.category_key].subs.push(c)
  }

  const columns = [
    { title: '二级分类', dataIndex: 'subcategory_name', key: 'name' },
    { title: '标识', dataIndex: 'subcategory_key', key: 'key', render: (v: string) => <Text code>{v}</Text> },
    { title: '类型', key: 'is_default', width: 80, render: (_: any, r: any) => r.is_default ? <Tag color="blue">默认</Tag> : <Tag color="orange">自定义</Tag> },
    { title: '操作', key: 'act', width: 80, render: (_: any, r: any) => (
      <Popconfirm title={r.is_default ? '默认分类不可删除' : '确定删除？'} disabled={!!r.is_default} onConfirm={() => handleDelete(r)}>
        <Button type="link" danger icon={<DeleteOutlined />} disabled={!!r.is_default} />
      </Popconfirm>
    )},
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>🏷️ 分类管理</Title>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加分类</Button>
        <Text type="secondary">默认分类不可删除，自定义分类可自由添加和删除</Text>
      </Space>

      {Object.values(grouped).map(g => (
        <Card key={g.key} title={<span><Tag color="blue">{g.name}</Tag></span>} style={{ marginBottom: 16 }} size="small">
          <Table columns={columns} dataSource={g.subs} rowKey="subcategory_key" pagination={false} size="small" />
        </Card>
      ))}

      <Modal title="添加自定义分类" open={modalOpen} onOk={handleAdd} onCancel={() => { setModalOpen(false); form.resetFields() }} okText="添加">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="所属大类" name="category_key" rules={[{ required: true }]}>
            <Select placeholder="选择大类" onChange={v => setSelectedMajor(v)}
              options={MAJOR_CATEGORIES.map(c => ({ value: c.key, label: c.name }))} />
          </Form.Item>
          <Form.Item label="分类名称" name="subcategory_name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="例如：猫粮猫砂、游戏周边" />
          </Form.Item>
          <Form.Item label="标识（英文，自动生成）" name="subcategory_key">
            <Input placeholder="自动生成可不填" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CategoryPage
