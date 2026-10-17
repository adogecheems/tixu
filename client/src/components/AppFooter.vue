<template>
  <footer class="site-footer">
    <div class="container">
      <div class="site-footer__top">
        <div class="site-footer__brand">
          <AppLogo />
          <p class="site-footer__tagline">把每一道题，练成自己的秩序。</p>
        </div>

        <div class="site-footer__aside">
          <nav class="site-footer__nav" aria-label="页脚导航">
            <RouterLink to="/questions">题库</RouterLink>
            <span aria-hidden="true">/</span>
            <RouterLink to="/wrong">错题</RouterLink>
            <span aria-hidden="true">/</span>
            <RouterLink to="/favorites">收藏</RouterLink>
          </nav>
          <p class="site-footer__powered">Powered by Vue.js and Fastify</p>
        </div>
      </div>

      <div class="site-footer__bottom">
        <p>© adogecheems</p>
        <p class="site-footer__signature">TIXU — A space to practice.</p>
      </div>
    </div>
  </footer>
</template>

<script>
import AppLogo from './AppLogo.vue';

export default {
  name: 'AppFooter',
  components: { AppLogo },
};
</script>

<style scoped>
.site-footer {
  border-top: 1px solid var(--border-default);
  background: var(--bg-page);
}

.site-footer__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding: 26px 0 22px;
}

.site-footer__brand {
  min-width: 0;
}

.site-footer__tagline {
  margin-top: 11px;
  color: var(--text-secondary);
  font-size: 13.5px;
  line-height: 1.6;
}

.site-footer__aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 11px;
  flex-shrink: 0;
}

.site-footer__nav {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text-secondary);
  font-size: 13px;
}

.site-footer__nav a {
  transition: color var(--transition-fast);
}

.site-footer__nav a:hover {
  color: var(--text-primary);
}

.site-footer__nav span {
  color: var(--border-strong);
  font-size: 11px;
}

.site-footer__powered {
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.site-footer__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 13px 0 20px;
  border-top: 1px solid var(--border-default);
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.site-footer__signature {
  color: var(--text-tertiary);
  letter-spacing: 0.01em;
}

@media (max-width: 780px) {
  .site-footer__top {
    align-items: flex-start;
    flex-direction: column;
    gap: 20px;
    padding: 24px 0 20px;
  }

  .site-footer__aside {
    align-items: flex-start;
    gap: 9px;
  }

  .site-footer__bottom {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
    padding: 12px 0 22px;
  }
}
</style>
