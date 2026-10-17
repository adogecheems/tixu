<template>
  <div class="container page profile-page">
    <header class="page-header">
      <div>
        <p class="eyebrow"><span class="eyebrow__dot" />Study space</p>
        <h1 class="page-header__title">学习中心</h1>
        <p class="page-header__description">查看学习概览与账户信息，调整界面偏好。</p>
      </div>
      <div class="page-header__actions">
        <RouterLink class="btn btn--primary btn--sm" to="/questions">
          继续练习
          <ArrowRight :size="14" />
        </RouterLink>
      </div>
    </header>

    <div v-if="error" class="alert alert--danger profile-error" role="alert">
      <AlertCircle :size="16" class="alert__icon" />
      <span>{{ error }}</span>
      <button class="link-button" type="button" @click="loadProfile">重试</button>
    </div>

    <div v-if="loading && !summary" class="profile-loading">
      <span class="skeleton" style="width: 100%; height: 140px" />
      <span class="skeleton" style="width: 100%; height: 96px; margin-top: 14px" />
    </div>

    <template v-else-if="summary">
      <section class="profile-hero">
        <div class="profile-identity">
          <span class="profile-avatar">{{ initial }}</span>
          <div>
            <div class="profile-name-row">
              <h2>{{ authState.user.username }}</h2>
              <span v-if="isAdmin" class="badge">管理员</span>
              <span v-else class="badge">学习账户</span>
            </div>
            <p class="profile-meta">
              加入于 {{ formatDate(authState.user.createdAt) }}
            </p>
          </div>
        </div>
        <div class="profile-hero__actions">
          <RouterLink v-if="isAdmin" class="btn btn--secondary btn--sm" to="/admin">
            <LayoutDashboard :size="14" />
            管理后台
          </RouterLink>
          <button class="btn btn--ghost btn--sm" type="button" @click="handleLogout">
            <LogOut :size="14" />
            退出登录
          </button>
        </div>
      </section>

      <section class="profile-stats">
        <RouterLink class="profile-stat" to="/history">
          <span class="profile-stat__label"><History :size="14" /> 累计作答</span>
          <strong>{{ formatNumber(stats.attempts) }}</strong>
          <span class="profile-stat__meta">次有效提交</span>
        </RouterLink>
        <RouterLink class="profile-stat" to="/wrong">
          <span class="profile-stat__label"><NotebookTabs :size="14" /> 当前错题</span>
          <strong>{{ formatNumber(stats.wrong) }}</strong>
          <span class="profile-stat__meta">道待复习</span>
        </RouterLink>
        <RouterLink class="profile-stat" to="/favorites">
          <span class="profile-stat__label"><Star :size="14" /> 收藏题目</span>
          <strong>{{ formatNumber(stats.favorites) }}</strong>
          <span class="profile-stat__meta">道已收藏</span>
        </RouterLink>
        <div class="profile-stat">
          <span class="profile-stat__label"><BadgeCheck :size="14" /> 自评掌握</span>
          <strong>{{ formatNumber(stats.mastered) }}</strong>
          <span class="profile-stat__meta">次简答题自评</span>
        </div>
      </section>

      <div class="profile-grid">
        <div class="profile-column">
          <section class="profile-card">
            <div class="profile-card__head">
              <div>
                <h2>最近作答</h2>
                <p>按提交时间倒序排列</p>
              </div>
              <RouterLink class="text-link" to="/history">
                全部历史
                <ChevronRight :size="13" />
              </RouterLink>
            </div>
            <div v-if="recentAttempts.length" class="recent-attempts">
              <RouterLink
                v-for="attempt in recentAttempts"
                :key="attempt.id"
                class="recent-attempt"
                :to="attempt.questionId ? { name: 'question', params: { id: attempt.questionId } } : '/history'"
              >
                <span class="recent-attempt__result" :class="`is-${attemptMeta(attempt).tone}`">
                  <component :is="attemptMeta(attempt).icon" :size="13" />
                </span>
                <span class="recent-attempt__main">
                  <span class="recent-attempt__title">{{ attempt.title }}</span>
                  <span class="recent-attempt__meta">
                    {{ typeLabel(attempt.type) }} · {{ formatRelative(attempt.submittedAt) }}
                  </span>
                </span>
                <span class="recent-attempt__badge" :class="`is-${attemptMeta(attempt).tone}`">
                  {{ attemptMeta(attempt).label }}
                </span>
                <ArrowUpRight :size="13" class="recent-attempt__arrow" />
              </RouterLink>
            </div>
            <p v-else class="profile-empty">还没有作答记录，去题库选一道题开始吧。</p>
          </section>

          <section class="profile-card">
            <div class="profile-card__head">
              <div>
                <h2>账户信息</h2>
                <p>你的账户基本信息</p>
              </div>
            </div>
            <dl class="account-details">
              <div>
                <dt>用户名</dt>
                <dd>{{ authState.user.username }}</dd>
              </div>
              <div>
                <dt>角色</dt>
                <dd>{{ isAdmin ? '管理员' : '普通用户' }}</dd>
              </div>
              <div>
                <dt>注册时间</dt>
                <dd>{{ formatDateTime(authState.user.createdAt) }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div class="profile-column">
          <section class="profile-card merge-card">
            <div class="profile-card__head">
              <div>
                <h2>登录前记录</h2>
                <p>可以合并到当前账户</p>
              </div>
              <GitMerge :size="18" class="card-head-icon" />
            </div>
            <div v-if="guestData.total" class="merge-pending">
              <div class="merge-pending__counts">
                <span><strong>{{ guestData.attempts }}</strong> 条作答</span>
                <span><strong>{{ guestData.favorites }}</strong> 道收藏</span>
              </div>
              <p>合并后会同步作答、错题与收藏。合并失败时，记录仍会保留。</p>
              <button class="btn btn--primary btn--sm btn--block" type="button" @click="openMerge">
                <GitMerge :size="14" />
                合并记录
              </button>
            </div>
            <div v-else class="merge-clear">
              <span class="merge-clear__icon"><Check :size="15" /></span>
              <div>
                <strong>暂无待合并的记录</strong>
                <p>已合并，或当前浏览器没有登录前的学习记录。</p>
              </div>
            </div>
          </section>

          <section class="profile-card">
            <div class="profile-card__head">
              <div>
                <h2>界面主题</h2>
                <p>选择你喜欢的界面外观</p>
              </div>
            </div>
            <div class="theme-options">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                class="theme-option"
                :class="{ 'is-active': themeState.preference === option.value }"
                type="button"
                @click="selectTheme(option.value)"
              >
                <span class="theme-option__icon"><component :is="option.icon" :size="17" /></span>
                <span class="theme-option__label">{{ option.label }}</span>
                <Check v-if="themeState.preference === option.value" :size="14" class="theme-option__check" />
              </button>
            </div>
            <p class="theme-note">默认跟随系统。手动选择会覆盖系统偏好，直到你再次修改。</p>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock3,
  GitMerge,
  History,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  NotebookTabs,
  Star,
  Sun,
  XCircle,
} from 'lucide-vue-next';
import { get, getErrorMessage } from '@/lib/api.js';
import { authState, logout, isAdmin } from '@/stores/auth.js';
import { themeState, setThemePreference } from '@/stores/theme.js';
import { studyState } from '@/stores/study.js';
import { toast } from '@/stores/toast.js';
import { getGuestDataCount } from '@/lib/guestDb.js';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  initials,
  resultMeta,
  typeLabel,
} from '@/lib/format.js';

export default {
  name: 'ProfileView',
  components: {
    AlertCircle,
    ArrowRight,
    ArrowUpRight,
    BadgeCheck,
    Check,
    ChevronRight,
    Clock3,
    GitMerge,
    History,
    LayoutDashboard,
    LogOut,
    Monitor,
    Moon,
    NotebookTabs,
    Star,
    Sun,
    XCircle,
  },
  data() {
    return {
      authState,
      themeState,
      studyState,
      loading: true,
      error: '',
      summary: null,
      stats: { attempts: 0, wrong: 0, favorites: 0, mastered: 0 },
      recentAttempts: [],
      guestData: { attempts: 0, favorites: 0, total: 0 },
      themeOptions: [
        { value: 'system', label: '跟随系统', icon: Monitor },
        { value: 'light', label: '浅色', icon: Sun },
        { value: 'dark', label: '深色', icon: Moon },
      ],
    };
  },
  computed: {
    initial() {
      return initials(authState.user?.username);
    },
    isAdmin() {
      return isAdmin();
    },
  },
  watch: {
    'studyState.version'() {
      this.loadProfile();
    },
    'authState.user.id'() {
      this.loadProfile();
    },
  },
  created() {
    this.loadProfile();
  },
  methods: {
    formatDate,
    formatDateTime,
    formatNumber,
    formatRelative,
    typeLabel,
    attemptMeta(attempt) {
      const meta = resultMeta(attempt);
      const icons = {
        success: BadgeCheck,
        danger: XCircle,
        warning: Clock3,
        neutral: History,
      };
      return { ...meta, icon: icons[meta.tone] || History };
    },
    async loadProfile() {
      if (!authState.user) return;
      this.loading = true;
      this.error = '';
      try {
        const [summaryData, attemptsData, guestData] = await Promise.all([
          get('/me/summary'),
          get('/me/attempts', { pageSize: 5, page: 1 }),
          getGuestDataCount(),
        ]);
        this.summary = summaryData;
        this.stats = summaryData.stats || this.stats;
        this.recentAttempts = attemptsData.items || [];
        this.guestData = guestData;
      } catch (error) {
        this.error = getErrorMessage(error, '学习中心加载失败，请稍后重试。');
      } finally {
        this.loading = false;
      }
    },
    selectTheme(value) {
      setThemePreference(value);
    },
    openMerge() {
      window.dispatchEvent(new CustomEvent('tixu:open-merge'));
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
.profile-page {
  padding-top: 40px;
}

.profile-error {
  margin-bottom: 16px;
  align-items: center;
}

.profile-loading {
  display: block;
}

.profile-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.profile-identity {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
  color: var(--text-primary);
  font-size: 21px;
  font-weight: 600;
  text-transform: uppercase;
}

.profile-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.profile-name-row h2 {
  font-size: 21px;
  font-weight: 630;
  letter-spacing: -0.025em;
}

.profile-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.profile-meta span {
  color: var(--border-strong);
}

.profile-hero__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.profile-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 17px 18px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  text-align: left;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

a.profile-stat:hover {
  border-color: var(--border-strong);
  background: var(--bg-subtle);
}

.profile-stat__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.profile-stat strong {
  margin-top: 9px;
  color: var(--text-primary);
  font-size: 27px;
  font-weight: 630;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.profile-stat__meta {
  margin-top: 4px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  align-items: start;
  gap: 14px;
  margin-top: 14px;
}

.profile-column {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.profile-card {
  padding: 20px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.profile-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-default);
}

.profile-card__head h2 {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.profile-card__head p {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.card-head-icon {
  color: var(--text-tertiary);
}

.text-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.text-link:hover {
  color: var(--text-primary);
}

.recent-attempts {
  display: flex;
  flex-direction: column;
}

.recent-attempt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--border-default);
  transition: background var(--transition-fast);
}

.recent-attempt:last-child {
  border-bottom: 0;
}

.recent-attempt:hover {
  background: var(--bg-subtle);
}

.recent-attempt__result {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.recent-attempt__result.is-success {
  background: var(--success-bg);
  color: var(--success);
}

.recent-attempt__result.is-danger {
  background: var(--danger-bg);
  color: var(--danger);
}

.recent-attempt__result.is-warning {
  background: var(--warning-bg);
  color: var(--warning);
}

.recent-attempt__main {
  flex: 1;
  min-width: 0;
}

.recent-attempt__title {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 520;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-attempt__meta {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.recent-attempt__badge {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 11px;
}

.recent-attempt__badge.is-success {
  color: var(--success);
}

.recent-attempt__badge.is-danger {
  color: var(--danger);
}

.recent-attempt__badge.is-warning {
  color: var(--warning);
}

.recent-attempt__arrow {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.profile-empty {
  padding: 22px 4px 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.account-details {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.account-details > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-default);
}

.account-details > div:last-child {
  border-bottom: 0;
}

.account-details dt {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.account-details dd {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: right;
}

.merge-pending {
  padding-top: 16px;
}

.merge-pending__counts {
  display: flex;
  gap: 8px;
}

.merge-pending__counts span {
  flex: 1;
  padding: 10px 11px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 10.5px;
}

.merge-pending__counts strong {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 620;
}

.merge-pending > p {
  margin: 12px 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.65;
}

.merge-clear {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-top: 16px;
}

.merge-clear__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  color: var(--success);
  background: var(--success-bg);
}

.merge-clear strong {
  display: block;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 550;
}

.merge-clear p {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.6;
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 11px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-align: left;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.theme-option:hover {
  background: var(--bg-subtle);
}

.theme-option.is-active {
  border-color: var(--border-strong);
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.theme-option__icon {
  display: inline-flex;
  color: var(--text-secondary);
}

.theme-option__label {
  flex: 1;
  font-size: 11.5px;
}

.theme-option__check {
  color: var(--text-primary);
}

.theme-note {
  margin-top: 10px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.6;
}

@media (max-width: 960px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .profile-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .profile-hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
  }

  .profile-identity {
    align-items: flex-start;
  }

  .profile-avatar {
    width: 44px;
    height: 44px;
    font-size: 17px;
  }

  .profile-name-row h2 {
    font-size: 18px;
  }

  .profile-stats {
    grid-template-columns: 1fr 1fr;
  }

  .profile-stat {
    padding: 14px;
  }

  .profile-stat strong {
    font-size: 23px;
  }

  .profile-hero__actions {
    width: 100%;
    justify-content: space-between;
  }

  .profile-card {
    padding: 16px;
  }

  .recent-attempt__badge {
    display: none;
  }
}
</style>
