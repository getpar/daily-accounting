import { PropsWithChildren, useEffect } from 'react'
import { enableCloud } from './utils/storage'
import './app.scss'

function App({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => { enableCloud() }, [])
  return <>{children}</>
}

export default App
