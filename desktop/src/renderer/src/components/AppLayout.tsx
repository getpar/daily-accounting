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
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
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

  // 侧边栏样式
  const siderStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
    borderRight: 'none',
    boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
  }

  const logoStyle: React.CSSProperties = {
    height: 68,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  }

  const footerStyle: React.CSSProperties = {
    padding: 12,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.15)',
    flexShrink: 0,
  }

  const contentStyle: React.CSSProperties = {
    padding: 28,
    minHeight: '100vh',
    overflow: 'auto',
    background: '#F1F5F9',
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={siderStyle}
        trigger={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo */}
          <div style={logoStyle}>
            {collapsed ? (
              <span style={{ fontSize: 24 }}>📒</span>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35', letterSpacing: 1 }}>
                  每日小记
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, letterSpacing: 2 }}>
                  DAILY NOTES
                </div>
              </div>
            )}
          </div>

          {/* 菜单 */}
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{
              background: 'transparent',
              borderRight: 0,
              marginTop: 12,
              flex: 1,
              overflow: 'auto',
            }}
            theme="dark"
          />

          {/* 底部操作区 */}
          <div style={footerStyle}>
            {!collapsed ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10, padding: '0 4px',
                }}>
                  <span style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {darkMode ? <MoonOutlined /> : <SunOutlined />}
                    {darkMode ? '暗色模式' : '亮色模式'}
                  </span>
                  <Switch
                    size="small"
                    checked={darkMode}
                    onChange={toggleDarkMode}
                  />
                </div>
                <Button
                  ghost
                  size="small"
                  block
                  icon={<ThunderboltOutlined />}
                  onClick={() => { setShortcutModalOpen(true); setShortcutInput(shortcut) }}
                  style={{ marginBottom: 6, borderRadius: 8, borderColor: 'rgba(255,255,255,0.15)', color: '#CBD5E1' }}
                >
                  快捷键
                </Button>
                <Button
                  ghost
                  size="small"
                  block
                  icon={<DownloadOutlined />}
                  onClick={handleBackup}
                  style={{ marginBottom: 6, borderRadius: 8, borderColor: 'rgba(255,255,255,0.15)', color: '#CBD5E1' }}
                >
                  备份数据
                </Button>
                <Button
                  ghost
                  size="small"
                  block
                  icon={<UploadOutlined />}
                  onClick={handleRestore}
                  style={{ borderRadius: 8, borderColor: 'rgba(255,255,255,0.15)', color: '#CBD5E1' }}
                >
                  恢复数据
                </Button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Switch size="small" checked={darkMode} onChange={toggleDarkMode} />
                <Button ghost size="small" type="text" icon={<ThunderboltOutlined />}
                  onClick={() => { setShortcutModalOpen(true); setShortcutInput(shortcut) }}
                  style={{ color: '#CBD5E1' }} />
                <Button ghost size="small" type="text" icon={<DownloadOutlined />}
                  onClick={handleBackup} style={{ color: '#CBD5E1' }} />
                <Button ghost size="small" type="text" icon={<UploadOutlined />}
                  onClick={handleRestore} style={{ color: '#CBD5E1' }} />
              </div>
            )}
          </div>
        </div>
      </Sider>

      {/* 收起按钮 */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'fixed',
          left: collapsed ? 64 : 204,
          bottom: 32,
          zIndex: 100,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#FF6B35',
          color: '#FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(255,107,53,0.4)',
          transition: 'all 0.2s ease',
          fontSize: 14,
          fontWeight: 700,
          userSelect: 'none',
        }}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? '☰' : '✕'}
      </div>

      {/* 内容区 */}
      <Layout>
        <Content style={contentStyle}>
          <Outlet />
        </Content>
      </Layout>

      {/* 快捷键设置弹窗 */}
      <Modal
        title="自定义快捷键"
        open={shortcutModalOpen}
        onOk={saveShortcut}
        onCancel={() => setShortcutModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={420}
      >
        <p style={{ color: '#64748B', marginBottom: 16, lineHeight: 1.8 }}>
          输入想要的快捷键组合，修改后立即生效。常用格式：
          <code style={{ margin: '0 4px', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>Ctrl+Shift+N</code>
          <code style={{ margin: '0 4px', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>Alt+Space</code>
          <code style={{ marginLeft: 4, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>Ctrl+Shift+K</code>
        </p>
        <div
          tabIndex={0}
          onKeyDown={handleKeyCapture}
          onClick={(e) => (e.target as HTMLElement).focus()}
          style={{
            border: '2px solid #FF6B35',
            borderRadius: 12,
            padding: '12px 18px',
            fontSize: 18,
            fontFamily: 'monospace',
            cursor: 'pointer',
            minHeight: 50,
            display: 'flex',
            alignItems: 'center',
            background: '#FFFBF8',
            outline: 'none',
            transition: 'box-shadow 0.2s',
          }}
        >
          {shortcutInput || <span style={{ color: '#bbb' }}>点击这里，然后按下组合键…</span>}
        </div>
      </Modal>
    </Layout>
  )
}

export default AppLayout
