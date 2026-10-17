<template>
  <div class="admin-page">
    <header class="admin-page-header">
      <div>
        <p class="admin-eyebrow">Dashboard</p>
        <h1>管理概览</h1>
        <p class="admin-page-header__description">题库状态、作答趋势与最近编辑，一目了然。</p>
      </div>
      <div class="admin-page-header__actions">
        <RouterLink class="btn btn--secondary btn--sm" :to="{ name: 'admin-import' }">
          <UploadCloud :size="14" />
          批量导入
        </RouterLink>
        <RouterLink class="btn btn--primary btn--sm" :to="{ name: 'admin-question-new' }">
          <Plus :size="14" />
          新建题目
        </RouterLink>
      </div>
    </header>

    <div v-if="error" class="alert alert--danger dashboard-error" role="alert">
      <AlertCircle :size="16" class="alert__icon" />
      <span>{{ error }}</span>
      <button class="link-button" type="button" @click="loadStats">重试</button>
    </div>

    <div v-if="loading && !stats" class="dashboard-loading">
      <div class="metric-grid">
        <span v-for="index in 4" :key="index" class="skeleton" style="height: 106px" />
      </div>
      <span class="skeleton" style="display: block; height: 280px; margin-top: 14px" />
    </div>

    <template v-else-if="stats">
      <section class="metric-grid">
        <RouterLink
          class="metric-card"
          :to="{ name: 'admin-questions', query: { status: 'published' } }"
        >
          <div class="metric-card__top">
            <span class="metric-card__label">已发布</span>
            <span class="metric-card__icon"><Globe2 :size="15" /></span>
          </div>
          <strong>{{ formatNumber(stats.statusCounts.published) }}</strong>
          <span class="metric-card__meta">公开题库中可见</span>
        </RouterLink>
        <RouterLink
          class="metric-card"
          :to="{ name: 'admin-questions', query: { status: 'draft' } }"
        >
          <div class="metric-card__top">
            <span class="metric-card__label">草稿</span>
            <span class="metric-card__icon"><FilePenLine :size="15" /></span>
          </div>
          <strong>{{ formatNumber(stats.statusCounts.draft) }}</strong>
          <span class="metric-card__meta">尚未发布到前台</span>
        </RouterLink>
        <RouterLink
          class="metric-card"
          :to="{ name: 'admin-questions', query: { pending: '1' } }"
        >
          <div class="metric-card__top">
            <span class="metric-card__label">待发布修改</span>
            <span class="metric-card__icon metric-card__icon--warning"><Clock3 :size="15" /></span>
          </div>
          <strong>{{ formatNumber(stats.pendingDrafts) }}</strong>
          <span class="metric-card__meta">已发布题目的修订草稿</span>
        </RouterLink>
        <RouterLink
          class="metric-card"
          :to="{ name: 'admin-questions', query: { status: 'archived' } }"
        >
          <div class="metric-card__top">
            <span class="metric-card__label">已归档</span>
            <span class="metric-card__icon"><Archive :size="15" /></span>
          </div>
          <strong>{{ formatNumber(stats.statusCounts.archived) }}</strong>
          <span class="metric-card__meta">从前台移除，历史保留</span>
        </RouterLink>
      </section>

      <div class="dashboard-grid">
        <section class="dashboard-card chart-card">
          <div class="dashboard-card__head">
            <div>
              <h2>近 7 日作答</h2>
              <p>所有账户的有效提交记录</p>
            </div>
            <div class="chart-total">
              <strong>{{ formatNumber(weekTotal) }}</strong>
              <span>次提交</span>
            </div>
          </div>
          <div class="chart-area">
            <div class="chart-grid-lines" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
            <div class="bar-chart" role="img" :aria-label="`近 7 日共 ${weekTotal} 次提交`">
              <div v-for="day in stats.attemptDays" :key="day.date" class="bar-item">
                <span class="bar-value">{{ day.count || '' }}</span>
                <div class="bar-track">
                  <span class="bar-fill" :style="{ height: `${barHeight(day.count)}%` }" />
                </div>
                <span class="bar-label">周{{ weekdayShort(day.date) }}</span>
              </div>
            </div>
          </div>
          <div class="chart-foot">
            <span class="chart-legend"><span class="chart-legend__dot" /> 每日提交次数</span>
            <span>今日 {{ formatNumber(todayAttempts) }} 次</span>
          </div>
        </section>

        <section class="dashboard-card recent-card">
          <div class="dashboard-card__head">
            <div>
              <h2>最近编辑</h2>
              <p>最近更新的 5 道题目</p>
            </div>
            <RouterLink class="dashboard-link" :to="{ name: 'admin-questions' }">
              全部
              <ArrowRight :size="12" />
            </RouterLink>
          </div>
          <div v-if="stats.recentQuestions.length" class="recent-question-list">
            <RouterLink
              v-for="question in stats.recentQuestions"
              :key="question.id"
              class="recent-question"
              :to="{ name: 'admin-question-edit', params: { id: question.id } }"
            >
              <span class="recent-question__status" :class="`is-${question.status}`" />
              <span class="recent-question__main">
                <span class="recent-question__title">{{ question.title }}</span>
                <span class="recent-question__meta">
                  {{ statusLabel(question.status) }} · {{ formatRelative(question.updatedAt) }}
                </span>
              </span>
              <ChevronRight :size="13" class="recent-question__arrow" />
            </RouterLink>
          </div>
          <p v-else class="dashboard-empty">还没有题目。</p>
        </section>
      </div>

      <div class="dashboard-bottom">
        <section class="dashboard-card compact-metrics-card">
          <div class="compact-metric">
            <span class="compact-metric__icon"><Users :size="15" /></span>
            <div>
              <strong>{{ formatNumber(stats.users) }}</strong>
              <span>注册用户</span>
            </div>
          </div>
          <div class="compact-metric">
            <span class="compact-metric__icon"><ListChecks :size="15" /></span>
            <div>
              <strong>{{ formatNumber(stats.attempts) }}</strong>
              <span>累计作答</span>
            </div>
          </div>
          <div class="compact-metric">
            <span class="compact-metric__icon"><FolderTree :size="15" /></span>
            <div>
              <strong>{{ formatNumber(stats.categories) }}</strong>
              <span>分类</span>
            </div>
          </div>
          <div class="compact-metric">
            <span class="compact-metric__icon"><Tags :size="15" /></span>
            <div>
              <strong>{{ formatNumber(stats.tags) }}</strong>
              <span>标签</span>
            </div>
          </div>
        </section>

        <section class="dashboard-card quick-card">
          <div class="dashboard-card__head">
            <div>
              <h2>快捷操作</h2>
              <p>常用管理入口</p>
            </div>
          </div>
          <div class="quick-actions">
            <RouterLink :to="{ name: 'admin-question-new' }">
              <span class="quick-action__icon"><Plus :size="15" /></span>
              <span><strong>新建题目</strong><small>创建一份新草稿</small></span>
              <ChevronRight :size="13" />
            </RouterLink>
            <RouterLink :to="{ name: 'admin-import' }">
              <span class="quick-action__icon"><UploadCloud :size="15" /></span>
              <span><strong>批量导入</strong><small>JSON 或 ZIP 草稿导入</small></span>
              <ChevronRight :size="13" />
            </RouterLink>
            <RouterLink :to="{ name: 'admin-categories' }">
              <span class="quick-action__icon"><FolderTree :size="15" /></span>
              <span><strong>分类管理</strong><small>维护两级题目分类</small></span>
              <ChevronRight :size="13" />
            </RouterLink>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script>
import {
  AlertCircle,
  Archive,
  ArrowRight,
  ChevronRight,
  Clock3,
  FilePenLine,
  FolderTree,
  Globe2,
  ListChecks,
  Plus,
  Tags,
  UploadCloud,
  Users,
} from 'lucide-vue-next';
import { get, getErrorMessage } from '@/lib/api.js';
import { formatNumber, formatRelative, weekdayShort } from '@/lib/format.js';

export default {
  name: 'AdminDashboardView',
  components: {
    AlertCircle,
    Archive,
    ArrowRight,
    ChevronRight,
    Clock3,
    FilePenLine,
    FolderTree,
    Globe2,
    ListChecks,
    Plus,
    Tags,
    UploadCloud,
    Users,
  },
  data() {
    return {
      loading: true,
      error: '',
      stats: null,
    };
  },
  computed: {
    weekTotal() {
      return (this.stats?.attemptDays || []).reduce((sum, day) => sum + day.count, 0);
    },
    todayAttempts() {
      return this.stats?.attemptDays?.[this.stats.attemptDays.length - 1]?.count || 0;
    },
    maxAttempts() {
      return Math.max(1, ...(this.stats?.attemptDays || []).map((day) => day.count));
    },
  },
  created() {
    this.loadStats();
  },
  methods: {
    formatNumber,
    formatRelative,
    weekdayShort,
    statusLabel(status) {
      return { published: '已发布', draft: '草稿', archived: '已归档' }[status] || status;
    },
    barHeight(count) {
      if (!count) return 2;
      return Math.max(8, Math.round((count / this.maxAttempts) * 100));
    },
    async loadStats() {
      this.loading = true;
      this.error = '';
      try {
        this.stats = await get('/admin/stats');
      } catch (error) {
        this.error = getErrorMessage(error, '管理概览加载失败。');
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.admin-page {
  max-width: 1280px;
  margin: 0 auto;
}

.admin-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.admin-eyebrow {
  color: var(--text-tertiary);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.admin-page-header h1 {
  margin-top: 7px;
  font-size: 26px;
  font-weight: 630;
  letter-spacing: -0.03em;
}

.admin-page-header__description {
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12.5px;
}

.admin-page-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dashboard-error {
  margin-bottom: 16px;
  align-items: center;
}

.dashboard-loading {
  display: block;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  padding: 16px 17px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.metric-card:hover {
  border-color: var(--border-strong);
  background: var(--bg-subtle);
}

.metric-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.metric-card__label {
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 520;
}

.metric-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
}

.metric-card__icon--warning {
  color: var(--warning);
  background: var(--warning-bg);
}

.metric-card strong {
  margin-top: 14px;
  color: var(--text-primary);
  font-size: 29px;
  font-weight: 630;
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.metric-card__meta {
  margin-top: 5px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 12px;
  margin-top: 12px;
}

.dashboard-card {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.dashboard-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-default);
}

.dashboard-card__head h2 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.dashboard-card__head p {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.chart-total {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
}

.chart-total strong {
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 630;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
}

.chart-total span {
  color: var(--text-tertiary);
  font-size: 10px;
}

.chart-area {
  position: relative;
  height: 227px;
  padding: 24px 22px 12px;
}

.chart-grid-lines {
  position: absolute;
  inset: 24px 22px 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.chart-grid-lines span {
  display: block;
  height: 1px;
  background: var(--border-default);
  opacity: 0.55;
}

.bar-chart {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 10px;
  height: 100%;
}

.bar-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  gap: 5px;
}

.bar-value {
  height: 13px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.bar-track {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  max-width: 42px;
  height: calc(100% - 37px);
}

.bar-fill {
  display: block;
  width: 100%;
  min-height: 2px;
  border-radius: 4px 4px 2px 2px;
  background: var(--text-primary);
  opacity: 0.82;
  transition: height 380ms ease;
}

.bar-label {
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.4;
}

.chart-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 18px;
  border-top: 1px solid var(--border-default);
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.chart-legend {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.chart-legend__dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: var(--text-primary);
  opacity: 0.82;
}

.dashboard-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.dashboard-link:hover {
  color: var(--text-primary);
}

.recent-question-list {
  display: flex;
  flex-direction: column;
}

.recent-question {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 17px;
  border-bottom: 1px solid var(--border-default);
  transition: background var(--transition-fast);
}

.recent-question:last-child {
  border-bottom: 0;
}

.recent-question:hover {
  background: var(--bg-subtle);
}

.recent-question__status {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--text-tertiary);
}

.recent-question__status.is-published {
  background: var(--success);
}

.recent-question__status.is-archived {
  background: var(--border-strong);
}

.recent-question__main {
  flex: 1;
  min-width: 0;
}

.recent-question__title {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-question__meta {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.recent-question__arrow {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.dashboard-empty {
  padding: 30px 18px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.dashboard-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 12px;
  margin-top: 12px;
}

.compact-metrics-card {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: stretch;
  overflow: hidden;
}

.compact-metric {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 16px 15px;
  border-right: 1px solid var(--border-default);
}

.compact-metric:last-child {
  border-right: 0;
}

.compact-metric__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  border-radius: 7px;
  background: var(--bg-subtle);
  color: var(--text-tertiary);
}

.compact-metric strong {
  display: block;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 620;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.compact-metric span:last-child {
  display: block;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.quick-card .dashboard-card__head {
  padding-bottom: 12px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
}

.quick-actions a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 17px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-secondary);
  transition: background var(--transition-fast);
}

.quick-actions a:last-child {
  border-bottom: 0;
}

.quick-actions a:hover {
  background: var(--bg-subtle);
}

.quick-action__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-tertiary);
}

.quick-actions a > span:nth-child(2) {
  flex: 1;
}

.quick-actions strong {
  display: block;
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 550;
}

.quick-actions small {
  display: block;
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

@media (max-width: 1100px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid,
  .dashboard-bottom {
    grid-template-columns: 1fr;
  }

  .compact-metrics-card {
    grid-template-columns: repeat(2, 1fr);
  }

  .compact-metric:nth-child(2) {
    border-right: 0;
  }

  .compact-metric:nth-child(-n + 2) {
    border-bottom: 1px solid var(--border-default);
  }
}

@media (max-width: 640px) {
  .admin-page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }

  .admin-page-header__actions {
    width: 100%;
  }

  .admin-page-header__actions .btn {
    flex: 1;
  }

  .metric-grid {
    gap: 8px;
  }

  .metric-card {
    padding: 13px;
  }

  .metric-card strong {
    font-size: 24px;
  }

  .metric-card__meta {
    font-size: 9px;
  }

  .chart-area {
    height: 190px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .chart-grid-lines {
    left: 12px;
    right: 12px;
  }
}
</style>
