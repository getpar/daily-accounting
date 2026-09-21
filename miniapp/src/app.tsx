import { PropsWithChildren, useEffect } from 'react'
import { syncNow } from './utils/storage'
import './app.scss'

function App({ children }: PropsWithChildren): JSX.Element {
  // 小程序冷启动时后台静默同步一次，不等页面 show
  useEffect(() => { syncNow().catch(() => { /* 同步失败不阻塞启动 */ }) }, [])
  return <>{children}</>
}

export default App
