<template>
  <div class="container page not-found-page">
    <div class="not-found">
      <p class="not-found__code mono">404</p>
      <div class="not-found__icon">
        <Compass :size="24" :stroke-width="1.6" />
      </div>
      <h1>这道题不在题库里</h1>
      <p>你访问的页面不存在，或者已经被移动到别处。</p>
      <div class="not-found__actions">
        <RouterLink class="btn btn--secondary" to="/">返回首页</RouterLink>
        <RouterLink class="btn btn--primary" to="/questions">去题库看看</RouterLink>
      </div>
    </div>
  </div>
</template>

<script>
import { Compass } from 'lucide-vue-next';

export default {
  name: 'NotFoundView',
  components: { Compass },
};
</script>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--header-height) - 134px);
}

.not-found {
  text-align: center;
}

.not-found__code {
  color: var(--border-strong);
  font-size: 64px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.05em;
}

.not-found__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-top: 20px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.not-found h1 {
  margin-top: 18px;
  font-size: 24px;
  letter-spacing: -0.03em;
}

.not-found p {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.not-found__actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}
</style>
