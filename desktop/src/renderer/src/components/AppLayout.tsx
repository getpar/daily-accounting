import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Button, Switch, message, Modal } from 'antd'
import {
  HomeOutlined, PlusCircleOutlined, UnorderedListOutlined, BarChartOutlined,
  TagsOutlined, SyncOutlined, SunOutlined, MoonOutlined,
  DownloadOutlined, UploadOutlined, ThunderboltOutlined,
} from '@ant-design/icons'

const { Sider, Content } = Layout

const menuItems = [
  { key: '/home', icon: <HomeOutlined />, label: '首页' },
  { key: '/add', icon: <PlusCircleOutlined />, label: '记一笔' },
  { key: '/history', icon: <UnorderedListOutlined />, label: '账单明细' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计分析' },
  { key: '/categories', icon: <TagsOutlined />, label: '分类管理' },
  { key: '/recurring', icon: <SyncOutlined />, label: '周期账单' },
]

function AppLayout(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [shortcut, setShortcut] = useState('Ctrl+Shift+N')
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false)
  const [shortcutInput, setShortcutInput] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (localStorage.getItem('darkMode') === 'true') setDarkMode(true)
    loadShortcut()
  }, [])

  async function loadShortcut(): Promise<void> {
    try {
      const val = await window.electronAPI.getShortcut()
      if (val) { setShortcut(val); setShortcutInput(val) }
    } catch { /* ignore */ }
  }

  function handleKeyCapture(e: React.KeyboardEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const key = e.key
    // 忽略纯修饰键
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    // 特殊键名映射
    const keyMap: Record<string, string> = { ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right' }
    parts.push(keyMap[key] || (key.length === 1 ? key.toUpperCase() : key))
    setShortcutInput(parts.join('+'))
  }

  async function saveShortcut(): Promise<void> {
    try {
      await window.electronAPI.setShortcut(shortcutInput)
      setShortcut(shortcutInput)
      message.success(`快捷键已设为 ${shortcutInput}`)
      setShortcutModalOpen(false)
    } catch { message.error('快捷键设置失败') }
  }

  function toggleDarkMode(val: boolean): void {
    setDarkMode(val)
    localStorage.setItem('darkMode', String(val))
    document.documentElement.style.filter = val ? 'invert(0.9) hue-rotate(180deg)' : ''
    document.documentElement.style.background = val ? '#111' : ''
  }

  async function handleBackup(): Promise<void> {
    try {
      const result = await window.electronAPI.createBackup()
      if (result.success) message.success(`备份已保存到：${result.path}`)
    } catch { message.error('备份失败') }
  }

  async function handleRestore(): Promise<void> {
    try {
      const result = await window.electronAPI.restoreBackup()
      if (result.success) {
        message.success('数据已恢复，请重启应用')
        setTimeout(() => window.close(), 1500)
      } else if (result.error) {
        message.error(result.error)
      }
    } catch { message.error('恢复失败') }
  }

  const selectedKey = '/' + location.pathname.split('/')[1]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0', boxShadow: '2px 0 8px rgba(0,0,0,0.06)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Typography.Title level={4} style={{ margin: 0, color: '#1677ff' }}>
              {collapsed ? '📒' : '📒 每日小记'}
            </Typography.Title>
          </div>
          <Menu
            mode="inline" selectedKeys={[selectedKey]} items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0, marginTop: 8, flex: 1, overflow: 'auto' }}
          />
          <div style={{ padding: 10, borderTop: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0 }}>
            {!collapsed ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11 }}>{darkMode ? <MoonOutlined /> : <SunOutlined />} {darkMode ? '暗色' : '亮色'}</span>
                  <Switch size="small" checked={darkMode} onChange={toggleDarkMode} />
                </div>
                <Button icon={<ThunderboltOutlined />} size="small" block style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  onClick={() => { setShortcutModalOpen(true); setShortcutInput(shortcut) }}
                  title={`当前快捷键：${shortcut}`}>快捷键</Button>
                <Button icon={<DownloadOutlined />} size="small" block style={{ marginBottom: 4 }} onClick={handleBackup}>备份数据</Button>
                <Button icon={<UploadOutlined />} size="small" block onClick={handleRestore}>恢复数据</Button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Button icon={<ThunderboltOutlined />} size="small" type="text"
                  onClick={() => { setShortcutModalOpen(true); setShortcutInput(shortcut) }} />
                <Button icon={<DownloadOutlined />} size="small" type="text" onClick={handleBackup} />
                <Button icon={<UploadOutlined />} size="small" type="text" onClick={handleRestore} />
                <Switch size="small" checked={darkMode} onChange={toggleDarkMode} />
              </div>
            )}
          </div>
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: 24, minHeight: '100vh', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>

      {/* 快捷键设置弹窗 */}
      <Modal title="自定义快捷键" open={shortcutModalOpen} onOk={saveShortcut}
        onCancel={() => setShortcutModalOpen(false)} okText="保存" cancelText="取消" width={420}>
        <p style={{ color: '#666', marginBottom: 16, wordBreak: 'break-all' }}>
          输入想要的快捷键组合，修改后立即生效。常用格式：
          <code style={{ marginLeft: 4 }}>Ctrl+Shift+N</code>、
          <code>Alt+Space</code>、
          <code>Ctrl+Shift+K</code>
        </p>
        <div
          tabIndex={0}
          onKeyDown={handleKeyCapture}
          onClick={(e) => (e.target as HTMLElement).focus()}
          style={{
            border: '2px solid #1677ff', borderRadius: 8, padding: '10px 16px',
            fontSize: 18, fontFamily: 'monospace', cursor: 'pointer',
            minHeight: 48, display: 'flex', alignItems: 'center',
            background: '#fafafa', outline: 'none',
          }}
        >
          {shortcutInput || <span style={{ color: '#bbb' }}>点击这里，然后按下组合键…</span>}
        </div>
      </Modal>
    </Layout>
  )
}

export default AppLayout
