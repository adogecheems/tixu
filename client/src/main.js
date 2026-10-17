import { createApp } from 'vue';
import 'katex/dist/katex.min.css';
import '@/styles/tokens.css';
import '@/styles/base.css';
import App from './App.vue';
import router from './router.js';
import { loadSession } from './stores/auth.js';
import { initTheme } from './stores/theme.js';
import { toast } from './stores/toast.js';

async function boot() {
  initTheme();
  await loadSession();

  const app = createApp(App);
  app.use(router);

  app.config.errorHandler = (error, instance, info) => {
    console.error('[题序] 页面发生未捕获错误：', error, info);
    toast.error('页面遇到了一点问题，请刷新后重试。');
  };

  app.mount('#app');
}

boot();
