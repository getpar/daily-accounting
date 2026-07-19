import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#FF6B35',
          colorSuccess: '#10B981',
          colorWarning: '#F59E0B',
          colorError: '#EF4444',
          colorInfo: '#FF6B35',
          borderRadius: 12,
          borderRadiusLG: 16,
          borderRadiusSM: 8,
          fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
          fontSize: 14,
          colorBgContainer: '#FFFFFF',
          colorBorderSecondary: '#E2E8F0',
          colorText: '#1E293B',
          colorTextSecondary: '#64748B',
          controlHeight: 40,
          paddingContentHorizontal: 20,
          lineHeight: 1.6,
        },
      }}
    >
      <HashRouter>
        <App />
      </HashRouter>
    </ConfigProvider>
  </React.StrictMode>
)
