export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/add/index',
    'pages/history/index',
    'pages/stats/index',
    'pages/categories/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTitleText: '每日小记',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#999',
    selectedColor: '#1677ff',
    backgroundColor: '#fff',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/add/index', text: '记一笔' },
      { pagePath: 'pages/history/index', text: '账单' },
      { pagePath: 'pages/stats/index', text: '统计' },
    ],
  },
})
