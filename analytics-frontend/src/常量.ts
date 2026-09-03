export const 常量 = {
  API基础地址: import.meta.env.VITE_API_BASE ?? 'http://localhost:8080',
  AI基础地址: import.meta.env.VITE_AI_BASE ?? 'http://localhost:8000',
  本地存储键: {
    令牌: 'lianai_admin_token',
  },
  演示账号: {
    用户名: 'admin',
    密码: 'admin123',
  },
  统计天数: 30,
  人设榜数量: 10,
  挑战榜数量: 20,
  同步日志显示条数: 10,
  AI历史保留轮数: 10,
  请求超时毫秒: 15000,
  Toast持续毫秒: 3000,
}
