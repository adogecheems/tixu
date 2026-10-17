<template>
  <div class="admin-shell">
    <div v-if="sidebarOpen" class="admin-backdrop" @click="sidebarOpen = false" />
    <aside class="admin-sidebar" :class="{ 'is-open': sidebarOpen }">
      <div class="admin-sidebar__head">
        <AppLogo :to="{ name: 'admin-dashboard' }" inverse />
        <span class="admin-sidebar__badge">管理</span>
      </div>

      <nav class="admin-nav" aria-label="管理后台导航">
        <p class="admin-nav__label">工作台</p>
        <RouterLink
          v-for="item in primaryNav"
          :key="item.name"
          :to="{ name: item.name }"
          class="admin-nav__link"
          :class="{ 'is-active': isActive(item) }"
        >
          <component :is="item.icon" :size="16" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </RouterLink>
        <p class="admin-nav__label admin-nav__label--spaced">内容与数据</p>
        <RouterLink
          v-for="item in contentNav"
          :key="item.name"
          :to="{ name: item.name }"
          class="admin-nav__link"
          :class="{ 'is-active': isActive(item) }"
        >
          <component :is="item.icon" :size="16" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="admin-sidebar__foot">
        <RouterLink class="admin-sidebar__front" to="/" target="_blank">
          <ArrowUpRight :size="14" />
          查看前台
        </RouterLink>
        <div class="admin-user">
          <span class="admin-avatar">{{ initial }}</span>
          <div class="admin-user__info">
            <strong>{{ authState.user?.username }}</strong>
            <span>管理员</span>
          </div>
          <button class="admin-icon-button" type="button" title="退出登录" aria-label="退出登录" @click="handleLogout">
            <LogOut :size="15" />
          </button>
        </div>
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__left">
          <button class="admin-menu-button" type="button" aria-label="打开导航" @click="sidebarOpen = true">
            <Menu :size="19" />
          </button>
          <div class="admin-breadcrumb">
            <span>管理后台</span>
            <ChevronRight :size="12" />
            <strong>{{ currentTitle }}</strong>
          </div>
        </div>
        <div class="admin-topbar__right">
          <button class="admin-icon-button" type="button" :title="themeLabel" :aria-label="themeLabel" @click="toggleTheme">
            <Sun v-if="themeState.effective === 'dark'" :size="16" />
            <Moon v-else :size="16" />
          </button>
          <RouterLink class="admin-topbar__front" to="/" target="_blank">
            返回前台
            <ArrowUpRight :size="13" />
          </RouterLink>
        </div>
      </header>

      <main class="admin-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script>
import {
  ArrowUpRight,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Sun,
  Tags,
  UploadCloud,
} from 'lucide-vue-next';
import AppLogo from '@/components/AppLogo.vue';
import { authState, logout } from '@/stores/auth.js';
import { themeState, setThemePreference } from '@/stores/theme.js';
import { toast } from '@/stores/toast.js';
import { initials } from '@/lib/format.js';

export default {
  name: 'AdminLayout',
  components: {
    AppLogo,
    ArrowUpRight,
    ChevronRight,
    FolderTree,
    LayoutDashboard,
    ListChecks,
    LogOut,
    Menu,
    Moon,
    Sun,
    Tags,
    UploadCloud,
  },
  data() {
    return {
      authState,
      themeState,
      sidebarOpen: false,
      primaryNav: [
        { name: 'admin-dashboard', label: '概览', icon: LayoutDashboard },
        { name: 'admin-questions', label: '题目管理', icon: ListChecks, match: 'admin-question' },
      ],
      contentNav: [
        { name: 'admin-categories', label: '分类管理', icon: FolderTree },
        { name: 'admin-tags', label: '标签管理', icon: Tags },
        { name: 'admin-import', label: '批量导入', icon: UploadCloud },
      ],
    };
  },
  computed: {
    initial() {
      return initials(authState.user?.username);
    },
    currentTitle() {
      return this.$route.meta.title || '管理后台';
    },
    themeLabel() {
      return this.themeState.effective === 'dark' ? '切换到浅色主题' : '切换到深色主题';
    },
  },
  watch: {
    '$route.fullPath'() {
      this.sidebarOpen = false;
    },
  },
  methods: {
    isActive(item) {
      if (item.match) return this.$route.name?.startsWith(item.match);
      return this.$route.name === item.name;
    },
    toggleTheme() {
      setThemePreference(themeState.effective === 'dark' ? 'light' : 'dark');
    },
    async handleLogout() {
      try {
        await logout();
        toast.success('已退出登录');
        this.$router.push('/');
      } catch {
        toast.error('退出登录失败，请稍后重试。');
      }
    },
  },
};
</script>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: var(--bg-page);
}

.admin-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  width: 232px;
  padding: 20px 13px 14px;
  background: var(--admin-sidebar-bg);
  color: var(--admin-sidebar-text);
}

.admin-sidebar__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 8px 24px;
}

.admin-sidebar__badge {
  padding: 2px 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(250, 250, 249, 0.4);
  font-size: 9px;
  line-height: 1.4;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-nav__label {
  padding: 8px 10px 7px;
  color: rgba(250, 250, 249, 0.32);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.admin-nav__label--spaced {
  margin-top: 16px;
}

.admin-nav__link {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 36px;
  padding: 0 10px;
  border-radius: 7px;
  color: var(--admin-sidebar-text);
  font-size: 12.5px;
  font-weight: 500;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.admin-nav__link:hover {
  color: var(--admin-sidebar-text-active);
  background: var(--admin-sidebar-hover);
}

.admin-nav__link.is-active {
  color: var(--admin-sidebar-text-active);
  background: rgba(255, 255, 255, 0.09);
  font-weight: 550;
}

.admin-nav__link.is-active svg {
  color: rgba(255, 255, 255, 0.9);
}

.admin-sidebar__foot {
  margin-top: auto;
  padding-top: 16px;
}

.admin-sidebar__front {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 10px;
  border-radius: 7px;
  color: rgba(250, 250, 249, 0.48);
  font-size: 11.5px;
}

.admin-sidebar__front:hover {
  color: rgba(250, 250, 249, 0.85);
  background: var(--admin-sidebar-hover);
}

.admin-user {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 10px;
  padding: 11px 8px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(250, 250, 249, 0.88);
  font-size: 12px;
  font-weight: 600;
}

.admin-user__info {
  flex: 1;
  min-width: 0;
}

.admin-user__info strong {
  display: block;
  overflow: hidden;
  color: rgba(250, 250, 249, 0.82);
  font-size: 11.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-user__info span {
  display: block;
  color: rgba(250, 250, 249, 0.35);
  font-size: 9.5px;
}

.admin-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 7px;
  color: var(--text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.admin-sidebar .admin-icon-button {
  color: rgba(250, 250, 249, 0.38);
}

.admin-icon-button:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.admin-sidebar .admin-icon-button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(250, 250, 249, 0.8);
}

.admin-main {
  min-height: 100vh;
  margin-left: 232px;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  height: 58px;
  padding: 0 28px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-page);
}

.admin-topbar__left,
.admin-topbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-breadcrumb {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.admin-breadcrumb strong {
  color: var(--text-secondary);
  font-weight: 550;
}

.admin-topbar__front {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--border-default);
  border-radius: 7px;
  color: var(--text-secondary);
  font-size: 10.5px;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.admin-topbar__front:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.admin-menu-button {
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: -6px;
  border-radius: 7px;
  color: var(--text-secondary);
}

.admin-menu-button:hover {
  background: var(--bg-subtle);
}

.admin-content {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px;
}

.admin-backdrop {
  display: none;
}

@media (max-width: 940px) {
  .admin-sidebar {
    z-index: 120;
    transform: translateX(-102%);
    transition: transform 200ms ease;
    box-shadow: var(--shadow-lg);
  }

  .admin-sidebar.is-open {
    transform: translateX(0);
  }

  .admin-main {
    margin-left: 0;
  }

  .admin-menu-button {
    display: inline-flex;
  }

  .admin-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 110;
    background: var(--overlay);
  }

  .admin-topbar {
    padding: 0 20px;
  }

  .admin-content {
    padding: 22px 20px 50px;
  }
}

@media (max-width: 600px) {
  .admin-topbar {
    padding: 0 16px;
  }

  .admin-breadcrumb span,
  .admin-breadcrumb svg {
    display: none;
  }

  .admin-topbar__front {
    display: none;
  }

  .admin-content {
    padding: 18px 16px 44px;
  }
}
</style>
