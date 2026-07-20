export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/add/index',
    'pages/history/index',
    'pages/stats/index',
    'pages/categories/index',
    'pages/recurring/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FF6B35',
    navigationBarTitleText: '每日小记',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#94A3B8',
    selectedColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/add/index', text: '记一笔' },
      { pagePath: 'pages/history/index', text: '账单' },
      { pagePath: 'pages/stats/index', text: '统计' },
    ],
  },
})
