import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import HomePage from './pages/HomePage'
import AddExpensePage from './pages/AddExpensePage'
import HistoryPage from './pages/HistoryPage'
import StatsPage from './pages/StatsPage'
import CategoryPage from './pages/CategoryPage'
import RecurringPage from './pages/RecurringPage'
import QuickAddPage from './pages/QuickAddPage'

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="add" element={<AddExpensePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="categories" element={<CategoryPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="quick-add" element={<QuickAddPage />} />
      </Route>
    </Routes>
  )
}

export default App
