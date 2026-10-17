<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>

  <template v-if="isAdminLayout">
    <RouterView />
  </template>
  <template v-else>
    <div class="public-shell">
      <AppHeader />
      <main id="main-content" class="site-main">
        <RouterView />
      </main>
      <AppFooter v-if="showFooter" />
    </div>
  </template>

  <MergeDialog v-if="authState.user" v-model="mergeOpen" @merged="onMerged" />
  <ToastHost />
</template>

<script>
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import ToastHost from '@/components/ToastHost.vue';
import MergeDialog from '@/components/MergeDialog.vue';
import { authState, clearAuthState } from '@/stores/auth.js';
import { toast } from '@/stores/toast.js';
import { getGuestDataCount } from '@/lib/guestDb.js';

export default {
  name: 'App',
  components: { AppHeader, AppFooter, ToastHost, MergeDialog },
  data() {
    return {
      authState,
      mergeOpen: false,
      initialPromptChecked: false,
      sessionExpiryHandled: false,
      loginPromptTimer: null,
    };
  },
  computed: {
    isAdminLayout() {
      return this.$route.meta.layout === 'admin';
    },
    showFooter() {
      return !this.$route.meta.hideFooter;
    },
  },
  mounted() {
    window.addEventListener('tixu:login', this.onLogin);
    window.addEventListener('tixu:logout', this.onLogout);
    window.addEventListener('tixu:unauthorized', this.onUnauthorized);
    window.addEventListener('tixu:open-merge', this.onOpenMerge);
    this.checkInitialPrompt();
  },
  beforeUnmount() {
    window.removeEventListener('tixu:login', this.onLogin);
    window.removeEventListener('tixu:logout', this.onLogout);
    window.removeEventListener('tixu:unauthorized', this.onUnauthorized);
    window.removeEventListener('tixu:open-merge', this.onOpenMerge);
    if (this.loginPromptTimer) clearTimeout(this.loginPromptTimer);
  },
  methods: {
    promptSeenKey() {
      return authState.user ? `tixu.merge-prompt-seen.${authState.user.id}` : null;
    },
    async checkInitialPrompt() {
      if (this.initialPromptChecked) return;
      this.initialPromptChecked = true;
      if (!authState.user) return;
      const key = this.promptSeenKey();
      try {
        if (key && sessionStorage.getItem(key) === '1') return;
      } catch {
        // sessionStorage may be unavailable; the prompt can still be shown.
      }
      await this.openMergeIfData();
    },
    async openMergeIfData({ force = false } = {}) {
      if (!authState.user || this.mergeOpen) return;
      const key = this.promptSeenKey();
      if (force && key) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // Ignore.
        }
      }
      const counts = await getGuestDataCount();
      if (!counts.total) return;
      if (key) {
        try {
          sessionStorage.setItem(key, '1');
        } catch {
          // Ignore.
        }
      }
      this.mergeOpen = true;
    },
    onLogin() {
      this.sessionExpiryHandled = false;
      this.initialPromptChecked = true;
      if (this.loginPromptTimer) clearTimeout(this.loginPromptTimer);
      this.loginPromptTimer = window.setTimeout(() => {
        this.openMergeIfData({ force: true });
      }, 280);
    },
    onLogout() {
      this.mergeOpen = false;
      this.initialPromptChecked = true;
    },
    onMerged() {
      this.mergeOpen = false;
    },
    onOpenMerge() {
      if (!authState.user) {
        this.$router.push({ name: 'login', query: { redirect: this.$route.fullPath } });
        return;
      }
      this.openMergeIfData({ force: true });
    },
    onUnauthorized() {
      if (this.sessionExpiryHandled) return;
      this.sessionExpiryHandled = true;
      clearAuthState();
      this.mergeOpen = false;
      toast.warning('登录状态已失效，请重新登录。');
      const requiresAuth = this.$route.meta.requiresAuth || this.$route.meta.requiresAdmin;
      if (requiresAuth) {
        this.$router.replace({
          name: 'login',
          query: { redirect: this.$route.fullPath, expired: '1' },
        });
      }
      window.setTimeout(() => {
        this.sessionExpiryHandled = false;
      }, 1500);
    },
  },
};
</script>

<style scoped>
.public-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.site-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 500;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-foreground);
  font-size: 12px;
  transform: translateY(-160%);
  transition: transform var(--transition-fast);
}

.skip-link:focus {
  transform: translateY(0);
}
</style>
