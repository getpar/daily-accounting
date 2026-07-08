import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getMergedCategories, addCustomCategory, deleteCustomCategory, isCustomCategory } from '../../utils/storage'
import './index.scss'

const MAJORS = [
  { key: 'food', name: '餐饮饮食' }, { key: 'transport', name: '交通出行' },
  { key: 'shopping', name: '购物消费' }, { key: 'housing', name: '住房居家' },
  { key: 'entertainment', name: '娱乐休闲' }, { key: 'medical', name: '医疗健康' },
  { key: 'education', name: '教育学习' }, { key: 'social', name: '人情往来' },
  { key: 'finance', name: '金融保险' }, { key: 'other', name: '其他杂项' },
]

export default function Categories(): JSX.Element {
  const [cats, setCats] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [major, setMajor] = useState('food')
  const [subName, setSubName] = useState('')
  const [customKeys, setCustomKeys] = useState<Set<string>>(new Set())

  async function loadCats(): Promise<void> {
    const merged = await getMergedCategories()
    setCats(merged)
    const keys = new Set<string>()
    for (const c of merged) {
      for (const s of c.subs) {
        if (await customKeys.has(s.key)) keys.add(s.key)
      }
    }
    setCustomKeys(keys)
  }

  useEffect(() => { loadCats() }, [])
  useDidShow(() => { loadCats() })

  async function handleAdd(): Promise<void> {
    if (!subName.trim()) { Taro.showToast({ title: '请输入分类名', icon: 'none' }); return }
    const m = MAJORS.find((m) => m.key === major)!
    const subKey = `${major}_${Date.now()}`
    await addCustomCategory(major, m.name, subKey, subName.trim())
    await loadCats(); setShowAdd(false); setSubName('')
    Taro.eventCenter.trigger('dataChanged')
  }

  async function handleDelete(subKey: string): Promise<void> {
    if (!customKeys.has(subKey)) { Taro.showToast({ title: '默认分类不可删', icon: 'none' }); return }
    Taro.showModal({ title: '确定删除？', success: async (res) => {
      if (res.confirm) { await deleteCustomCategory(subKey); await loadCats(); Taro.eventCenter.trigger('dataChanged') }
    }})
  }

  return (
    <View className='wrap'>
      <View className='header-row'>
        <Text className='page-title'>🏷️ 自定义分类</Text>
        <Text className='add-btn' onClick={() => setShowAdd(true)}>+ 添加</Text>
      </View>

      {showAdd && (
        <View className='add-card'>
          <View className='form-row'>
            <Text className='label'>所属大类</Text>
            <Picker mode='selector' range={MAJORS} rangeKey='name' onChange={(e) => setMajor(MAJORS[Number(e.detail.value)].key)}>
              <View className='picker'><Text>{MAJORS.find((m) => m.key === major)?.name}</Text><Text className='arrow'>▼</Text></View>
            </Picker>
          </View>
          <View className='form-row'>
            <Text className='label'>分类名称</Text>
            <Input className='sub-input' placeholder='例如：猫粮' value={subName} onInput={(e) => setSubName(e.detail.value)} maxlength={10} />
          </View>
          <View className='add-actions'>
            <Text className='cancel-btn' onClick={() => { setShowAdd(false); setSubName('') }}>取消</Text>
            <Text className='ok-btn' onClick={handleAdd}>确认添加</Text>
          </View>
        </View>
      )}

      {cats.map((cat) => (
        <View key={cat.key} className='cat-group'>
          <Text className='group-title'>{cat.name}</Text>
          <View className='sub-list'>
            {cat.subs.map((s) => (
              <View key={s.key} className={`sub-tag ${customKeys.has(s.key) ? 'custom' : ''}`}>
                <Text>{s.name}</Text>
                {customKeys.has(s.key) && <Text className='del-icon' onClick={() => handleDelete(s.key)}>×</Text>}
              </View>
            ))}
          </View>
        </View>
      ))}

      <View className='tip'><Text>💡 自定义分类带 × 号可删除，默认分类受保护</Text></View>
    </View>
  )
}
