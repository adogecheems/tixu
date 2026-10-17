<template>
  <header class="site-header">
    <div class="container site-header__inner">
      <AppLogo :to="brandTarget" />

      <nav class="site-nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="site-nav__link"
          :class="{ 'is-active': navActive(item) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="site-header__actions">
        <ThemeSwitcher />

        <div v-if="authState.user" ref="userMenuRoot" class="user-menu">
          <button
            class="user-trigger"
            type="button"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            @click.stop="userMenuOpen = !userMenuOpen"
          >
            <span class="avatar">{{ userInitial }}</span>
            <span class="user-trigger__name">{{ authState.user.username }}</span>
            <ChevronDown :size="14" class="user-trigger__chevron" />
          </button>
          <Transition name="pop">
            <div v-if="userMenuOpen" class="popover user-popover" role="menu">
              <div class="user-popover__header">
                <span class="avatar avatar--large">{{ userInitial }}</span>
                <div>
                  <p class="user-popover__name">{{ authState.user.username }}</p>
                  <p class="user-popover__role">{{ authState.user.role === 'admin' ? '管理员' : '学习账户' }}</p>
                </div>
              </div>
              <div class="menu-divider" />
              <RouterLink class="menu-item" to="/profile" role="menuitem" @click="userMenuOpen = false">
                <CircleUserRound :size="16" />
                学习中心
              </RouterLink>
              <RouterLink class="menu-item" to="/history" role="menuitem" @click="userMenuOpen = false">
                <History :size="16" />
                作答历史
              </RouterLink>
              <RouterLink
                v-if="authState.user.role === 'admin'"
                class="menu-item"
                to="/admin"
                role="menuitem"
                @click="userMenuOpen = false"
              >
                <LayoutDashboard :size="16" />
                管理后台
              </RouterLink>
              <div class="menu-divider" />
              <button class="menu-item menu-item--danger" type="button" role="menuitem" @click="handleLogout">
                <LogOut :size="16" />
                退出登录
              </button>
            </div>
          </Transition>
        </div>

        <template v-else>
          <RouterLink class="btn btn--ghost btn--sm header-login" to="/login">登录</RouterLink>
          <RouterLink class="btn btn--primary btn--sm header-register" to="/register">免费注册</RouterLink>
        </template>

        <button
          class="mobile-trigger"
          type="button"
          :aria-expanded="mobileOpen"
          aria-label="打开导航"
          @click="mobileOpen = !mobileOpen"
        >
          <X v-if="mobileOpen" :size="20" />
          <Menu v-else :size="20" />
        </button>
      </div>
    </div>

    <Transition name="drawer">
      <div v-if="mobileOpen" class="mobile-drawer">
        <div class="mobile-drawer__inner">
          <nav class="mobile-nav" aria-label="移动端导航">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="mobile-nav__link"
              :class="{ 'is-active': navActive(item) }"
            >
              <span>{{ item.label }}</span>
              <ArrowUpRight :size="16" />
            </RouterLink>
          </nav>
          <div class="mobile-drawer__account">
            <template v-if="authState.user">
              <RouterLink to="/profile" class="mobile-account">
                <span class="avatar">{{ userInitial }}</span>
                <span>
                  <strong>{{ authState.user.username }}</strong>
                  <small>进入学习中心</small>
                </span>
              </RouterLink>
              <RouterLink
                v-if="authState.user.role === 'admin'"
                to="/admin"
                class="btn btn--secondary btn--block"
              >
                <LayoutDashboard :size="15" /> 管理后台
              </RouterLink>
              <button class="btn btn--ghost btn--block" type="button" @click="handleLogout">
                退出登录
              </button>
            </template>
            <template v-else>
              <RouterLink to="/login" class="btn btn--secondary btn--block">登录账户</RouterLink>
              <RouterLink to="/register" class="btn btn--primary btn--block">免费注册</RouterLink>
              <p class="mobile-drawer__note">不登录也可以直接刷题，学习记录会保存在当前浏览器。</p>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>

<script>
import {
  ArrowUpRight,
  ChevronDown,
  CircleUserRound,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-vue-next';
import AppLogo from './AppLogo.vue';
import ThemeSwitcher from './ThemeSwitcher.vue';
import { authState, logout } from '@/stores/auth.js';
import { toast } from '@/stores/toast.js';
import { initials } from '@/lib/format.js';

export default {
  name: 'AppHeader',
  components: {
    AppLogo,
    ThemeSwitcher,
    ArrowUpRight,
    ChevronDown,
    CircleUserRound,
    History,
    LayoutDashboard,
    LogOut,
    Menu,
    X,
  },
  data() {
    return {
      authState,
      mobileOpen: false,
      userMenuOpen: false,
    };
  },
  computed: {
    userInitial() {
      return initials(authState.user?.username);
    },
    brandTarget() {
      return authState.user ? '/questions' : '/';
    },
    navItems() {
      const items = [
        { label: '题库', to: '/questions', match: '/questions' },
        { label: '错题本', to: '/wrong' },
        { label: '收藏夹', to: '/favorites' },
        { label: '作答历史', to: '/history' },
      ];
      if (!authState.user) items.unshift({ label: '开始', to: '/', exact: true });
      return items;
    },
  },
  watch: {
    userMenuOpen(value) {
      if (value) this.$nextTick(() => document.addEventListener('pointerdown', this.onOutside));
      else document.removeEventListener('pointerdown', this.onOutside);
    },
    '$route.fullPath'() {
      this.mobileOpen = false;
      this.userMenuOpen = false;
    },
  },
  mounted() {
    document.addEventListener('keydown', this.onEscape);
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.onOutside);
    document.removeEventListener('keydown', this.onEscape);
  },
  methods: {
    navActive(item) {
      if (item.exact) return this.$route.path === item.to;
      if (item.match) return this.$route.path.startsWith(item.match);
      return this.$route.path === item.to;
    },
    onOutside(event) {
      if (!this.$refs.userMenuRoot?.contains(event.target)) this.userMenuOpen = false;
    },
    onEscape(event) {
      if (event.key === 'Escape') {
        this.userMenuOpen = false;
        this.mobileOpen = false;
      }
    },
    async handleLogout() {
      this.userMenuOpen = false;
      this.mobileOpen = false;
      try {
        await logout();
        toast.success('已退出登录');
        this.$router.push('/');
      } catch {
        toast.error('退出登录失败，请稍后再试。');
      }
    },
  },
};
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-page);
  border-bottom: 1px solid var(--border-default);
}

.site-header__inner {
  display: flex;
  align-items: center;
  gap: 36px;
  height: var(--header-height);
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
}

.site-nav__link {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 11px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.site-nav__link:hover {
  color: var(--text-primary);
  background: var(--bg-subtle);
}

.site-nav__link.is-active {
  color: var(--text-primary);
  background: var(--bg-subtle);
  font-weight: 560;
}

.site-header__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.user-menu {
  position: relative;
  margin-left: 4px;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 7px 0 4px;
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
}

.user-trigger:hover {
  background: var(--bg-subtle);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.avatar--large {
  width: 36px;
  height: 36px;
  font-size: 14px;
}

.user-trigger__name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 540;
}

.user-trigger__chevron {
  color: var(--text-tertiary);
}

.user-popover {
  top: calc(100% + 8px);
  right: 0;
  min-width: 214px;
}

.user-popover__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px 10px;
}

.user-popover__name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
}

.user-popover__role {
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.5;
}

.mobile-trigger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.mobile-trigger:hover {
  background: var(--bg-subtle);
}

.mobile-drawer {
  display: none;
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (max-width: 1020px) {
  .site-nav {
    display: none;
  }

  .site-header__inner {
    gap: 18px;
  }

  .mobile-trigger {
    display: inline-flex;
  }

  .mobile-drawer {
    display: block;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-page);
    box-shadow: var(--shadow-sm);
    max-height: calc(100vh - var(--header-height));
    overflow-y: auto;
  }

  .mobile-drawer__inner {
    max-width: var(--container-width);
    margin: 0 auto;
    padding: 14px 22px 24px;
  }

  .mobile-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mobile-nav__link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
    padding: 0 10px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 14px;
  }

  .mobile-nav__link:hover,
  .mobile-nav__link.is-active {
    background: var(--bg-subtle);
    color: var(--text-primary);
  }

  .mobile-nav__link.is-active {
    font-weight: 560;
  }

  .mobile-drawer__account {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
    padding-top: 18px;
    border-top: 1px solid var(--border-default);
  }

  .mobile-account {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px 14px;
  }

  .mobile-account strong {
    display: block;
    font-size: 13px;
    font-weight: 600;
  }

  .mobile-account small {
    display: block;
    color: var(--text-tertiary);
    font-size: 11px;
    margin-top: 1px;
  }

  .mobile-drawer__note {
    color: var(--text-tertiary);
    font-size: 11.5px;
    line-height: 1.6;
    text-align: center;
    padding: 4px 8px;
  }

  .drawer-enter-active,
  .drawer-leave-active {
    transition: opacity 140ms ease, transform 140ms ease;
  }

  .drawer-enter-from,
  .drawer-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (max-width: 600px) {
  .header-login {
    display: none;
  }

  .header-register {
    display: none;
  }

  .user-trigger__name,
  .user-trigger__chevron {
    display: none;
  }

  .site-header__actions {
    gap: 2px;
  }

  .mobile-drawer__inner {
    padding: 10px 16px 20px;
  }
}
</style>
