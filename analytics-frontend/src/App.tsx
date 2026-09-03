import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { 已登录 } from './api/认证接口'
import { ToastHost } from './components/ToastHost'
import { 登录页 } from './pages/登录页'
import { 大屏页 } from './pages/大屏页'
import { 助手页 } from './pages/助手页'

function 路由守卫({ children }: { children: ReactNode }) {
  if (!已登录()) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={已登录() ? '/dashboard' : '/login'} replace />}
        />
        <Route path="/login" element={<登录页 />} />
        <Route
          path="/dashboard"
          element={
            <路由守卫>
              <大屏页 />
            </路由守卫>
          }
        />
        <Route
          path="/assistant"
          element={
            <路由守卫>
              <助手页 />
            </路由守卫>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  )
}
