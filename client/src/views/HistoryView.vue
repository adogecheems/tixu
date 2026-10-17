<template>
  <div class="container page history-page">
    <header class="page-header">
      <div>
        <p class="eyebrow"><span class="eyebrow__dot" />History</p>
        <h1 class="page-header__title">作答历史</h1>
        <p class="page-header__description">
          每一次正式提交都会留下独立记录。历史会保留当时的题目版本与判题结果，不受后续修订影响。
        </p>
      </div>
      <div class="page-header__actions">
        <RouterLink class="btn btn--secondary btn--sm" to="/questions">
          继续练习
          <ArrowRight :size="14" />
        </RouterLink>
      </div>
    </header>

    <div v-if="!authState.user" class="guest-banner">
      <Monitor :size="15" />
      <p>当前展示游客作答记录，仅保存在当前浏览器。登录后可合并到账户。</p>
      <RouterLink class="guest-banner__link" :to="{ name: 'login', query: { redirect: $route.fullPath } }">
        登录账户
        <ArrowRight :size="13" />
      </RouterLink>
    </div>

    <div class="history-toolbar">
      <form class="history-search" role="search" @submit.prevent="submitSearch">
        <Search :size="15" />
        <input
          v-model="searchInput"
          type="search"
          placeholder="按题目标题筛选…"
          aria-label="按题目标题筛选"
        />
        <button v-if="searchInput" type="button" class="history-search__clear" aria-label="清空搜索" @click="clearSearch">
          <X :size="13" />
        </button>
      </form>
      <div class="history-filters">
        <label class="filter-select">
          <span>题型</span>
          <select v-model="filterType" @change="applyFilters">
            <option value="">全部题型</option>
            <option value="single">单选题</option>
            <option value="multiple">多选题</option>
            <option value="truefalse">判断题</option>
            <option value="fill">填空题</option>
            <option value="essay">简答题</option>
          </select>
        </label>
        <label class="filter-select">
          <span>结果</span>
          <select v-model="filterResult" @change="applyFilters">
            <option value="">全部结果</option>
            <option value="correct">回答正确</option>
            <option value="wrong">回答错误</option>
            <option value="self_mastered">自评已掌握</option>
            <option value="self_not_mastered">自评未掌握</option>
            <option value="pending">待自评</option>
            <option value="unverified">未验证</option>
          </select>
        </label>
        <button v-if="hasFilters" class="btn btn--ghost btn--sm" type="button" @click="resetFilters">
          重置
        </button>
      </div>
    </div>

    <div class="history-summary">
      <p>
        <template v-if="loading && !items.length">正在加载作答记录…</template>
        <template v-else>共 {{ formatNumber(pagination.total) }} 条记录 <span>· 按提交时间倒序</span></template>
      </p>
    </div>

    <div v-if="error" class="alert alert--danger history-error" role="alert">
      <AlertCircle :size="16" class="alert__icon" />
      <span>{{ error }}</span>
      <button class="link-button" type="button" @click="loadHistory">重试</button>
    </div>

    <div v-if="loading && !items.length" class="history-loading card">
      <div v-for="index in 5" :key="index" class="history-skeleton-row">
        <span class="skeleton" style="width: 120px; height: 12px" />
        <span class="skeleton" style="width: 44%; height: 16px" />
        <span class="skeleton" style="width: 64px; height: 22px; margin-left: auto" />
      </div>
    </div>

    <div v-else-if="items.length" class="history-list card">
      <div class="history-list__head">
        <span>提交时间</span>
        <span>题目</span>
        <span>结果</span>
        <span class="history-list__head-action">详情</span>
      </div>
      <article
        v-for="item in items"
        :key="item.id"
        class="history-row"
        :class="{ 'is-loading': loading }"
      >
        <div class="history-row__time">
          <span>{{ formatDate(item.submittedAt) }}</span>
          <span class="history-row__time-detail">{{ formatTime(item.submittedAt) }}</span>
        </div>
        <button class="history-row__main" type="button" @click="openDetail(item)">
          <span class="history-row__title">{{ item.title }}</span>
          <span class="history-row__meta">
            <span>{{ typeLabel(item.type) }}</span>
            <span v-if="item.versionNo">版本 v{{ item.versionNo }}</span>
            <span v-if="item.source === 'merge'">游客合并</span>
            <span class="history-row__answer">{{ item.answerSummary }}</span>
          </span>
        </button>
        <div class="history-row__result">
          <span class="badge" :class="`badge--${rowResult(item).tone}`">
            <component :is="rowResult(item).icon" :size="12" :stroke-width="2" />
            {{ rowResult(item).label }}
          </span>
        </div>
        <button class="history-row__action" type="button" @click="openDetail(item)">
          查看
          <ChevronRight :size="14" />
        </button>
      </article>
    </div>

    <div v-else-if="!loading" class="history-empty card">
      <EmptyState
        :title="hasFilters ? '没有符合条件的作答记录' : '还没有作答历史'"
        :description="
          hasFilters
            ? '试试调整题型或结果筛选。'
            : '完成一次正式提交后，答题结果与解析会记录在这里。'
        "
      >
        <template #icon><History :size="23" :stroke-width="1.7" /></template>
        <template #actions>
          <button v-if="hasFilters" class="btn btn--secondary btn--sm" type="button" @click="resetFilters">
            清除筛选
          </button>
          <RouterLink class="btn btn--primary btn--sm" to="/questions">
            去刷题
            <ArrowRight :size="14" />
          </RouterLink>
        </template>
      </EmptyState>
    </div>

    <div v-if="pagination.totalPages > 1" class="history-pagination">
      <PaginationBar :page="pagination.page" :total-pages="pagination.totalPages" @update:page="goPage" />
    </div>

    <ModalDialog
      v-model="detailOpen"
      :title="detail?.title || '作答详情'"
      :description="detail ? `${typeLabel(detail.type)} · 提交于 ${formatDateTime(detail.submittedAt)}` : ''"
      size="lg"
    >
      <div v-if="detailLoading" class="detail-loading">
        <span class="skeleton" style="width: 100%; height: 110px" />
        <span class="skeleton" style="width: 100%; height: 160px; margin-top: 14px" />
      </div>
      <div v-else-if="detailError" class="alert alert--danger">
        <AlertCircle :size="16" class="alert__icon" />
        <span>{{ detailError }}</span>
      </div>
      <template v-else-if="detail">
        <div class="detail-result" :class="`detail-result--${detailStatus.tone}`">
          <component :is="detailStatus.icon" :size="18" />
          <div>
            <strong>{{ detailStatus.label }}</strong>
            <p>{{ detailStatus.description }}</p>
          </div>
          <span v-if="detail.versionNo" class="detail-version">v{{ detail.versionNo }}</span>
        </div>

        <div v-if="detail.unavailable" class="alert alert--warning detail-unavailable">
          <AlertTriangle :size="16" class="alert__icon" />
          <div>
            <p>这条记录引用的题目版本已不可用，系统保留了原始作答数据，但无法重新验证或展示当时的题目内容。</p>
            <p class="detail-unavailable__status">状态：未验证 · 不计入已验证判题统计</p>
          </div>
        </div>
        <div v-if="detail.unavailable" class="detail-raw-answer">
          <p class="detail-section-label">保留的原始作答</p>
          <pre>{{ JSON.stringify(detail.userAnswer, null, 2) }}</pre>
        </div>

        <template v-else>
          <div class="detail-question">
            <p class="detail-section-label">题目</p>
            <QuestionAnswerArea
              :question="detailQuestion"
              :model-value="detail.userAnswer"
              submitted
              readonly
              :correct-answer="detail.verified ? detail.correctAnswer : null"
            />
          </div>

          <div class="detail-answers">
            <div class="detail-answer">
              <p class="detail-section-label">你的作答</p>
              <div class="detail-answer__text">{{ answerText(detail.type, detail.userAnswer, detailQuestion) || '（空）' }}</div>
            </div>
            <div v-if="detail.verified" class="detail-answer">
              <p class="detail-section-label">
                {{ detail.type === 'essay' ? '参考答案' : '正确答案' }}
              </p>
              <div v-if="detail.type === 'essay'" class="detail-answer__text detail-answer__markdown">
                <MarkdownContent :source="detail.correctAnswer?.referenceMarkdown || ''" />
              </div>
              <div v-else class="detail-answer__text">
                {{ correctAnswerText(detail.type, detail.correctAnswer, detailQuestion) }}
              </div>
            </div>
          </div>

          <div v-if="detail.analysisMarkdown" class="detail-answer-block">
            <p class="detail-section-label">解析</p>
            <div class="detail-prose">
              <MarkdownContent :source="detail.analysisMarkdown" />
            </div>
          </div>

          <div v-if="isPendingAssessment" class="detail-assessment">
            <div>
              <p class="detail-section-label">简答题自评</p>
              <p class="detail-assessment__hint">对照参考答案后，判断自己是否已经掌握这道题。</p>
            </div>
            <div class="detail-assessment__actions">
              <button
                class="btn btn--secondary btn--sm"
                type="button"
                :disabled="assessing"
                @click="assess('not_mastered')"
              >
                未掌握
              </button>
              <button class="btn btn--primary btn--sm" type="button" :disabled="assessing" @click="assess('mastered')">
                <LoaderCircle v-if="assessing" :size="14" class="btn__spinner" />
                已掌握
              </button>
            </div>
          </div>
        </template>
      </template>

      <template #footer>
        <button class="btn btn--secondary" type="button" @click="detailOpen = false">关闭</button>
        <button
          v-if="detail && !detail.unavailable && detail.questionStatus === 'published'"
          class="btn btn--primary"
          type="button"
          @click="practiceAgain"
        >
          重新练习这道题
          <ArrowUpRight :size="15" />
        </button>
      </template>
    </ModalDialog>
  </div>
</template>

<script>
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
  LoaderCircle,
  Monitor,
  Search,
  X,
  XCircle,
} from 'lucide-vue-next';
import EmptyState from '@/components/EmptyState.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import MarkdownContent from '@/components/MarkdownContent.vue';
import QuestionAnswerArea from '@/components/QuestionAnswerArea.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import { get, patch, getErrorMessage } from '@/lib/api.js';
import { authState } from '@/stores/auth.js';
import { studyState } from '@/stores/study.js';
import { notifyStudyChange } from '@/stores/study.js';
import { toast } from '@/stores/toast.js';
import {
  getGuestAttempts,
  updateGuestAttempt,
} from '@/lib/guestDb.js';
import {
  answerText,
  correctAnswerText,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  resultMeta,
  typeLabel,
} from '@/lib/format.js';

const PAGE_SIZE = 20;

export default {
  name: 'HistoryView',
  components: {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    ChevronRight,
    Clock3,
    EmptyState,
    History,
    LoaderCircle,
    MarkdownContent,
    ModalDialog,
    Monitor,
    PaginationBar,
    QuestionAnswerArea,
    Search,
    X,
    XCircle,
  },
  data() {
    return {
      authState,
      studyState,
      filterType: '',
      filterResult: '',
      searchInput: '',
      searchQuery: '',
      page: 1,
      items: [],
      pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 },
      loading: true,
      error: '',
      detailOpen: false,
      detailLoading: false,
      detailError: '',
      detail: null,
      assessing: false,
      requestToken: 0,
    };
  },
  computed: {
    hasFilters() {
      return Boolean(this.filterType || this.filterResult || this.searchQuery);
    },
    detailQuestion() {
      if (!this.detail) return null;
      return {
        id: this.detail.questionId,
        type: this.detail.type,
        stemMarkdown: this.detail.stemMarkdown,
        options: this.detail.options || [],
        fillConfig: this.detail.fillConfig || null,
        difficulty: this.detail.difficulty,
      };
    },
    detailStatus() {
      if (!this.detail) return { label: '', tone: 'neutral', description: '', icon: AlertCircle };
      if (!this.detail.verified) {
        return {
          label: '未验证记录',
          tone: 'warning',
          description: '这条记录无法与有效题目版本对应，未计入学习统计。',
          icon: AlertTriangle,
        };
      }
      if (this.detail.type === 'essay') {
        if (this.detail.selfAssessment === 'mastered') {
          return { label: '自评已掌握', tone: 'success', description: '你已确认掌握这道简答题。', icon: CheckCircle2 };
        }
        if (this.detail.selfAssessment === 'not_mastered') {
          return { label: '自评未掌握', tone: 'danger', description: '这道题目前保留在错题本中。', icon: XCircle };
        }
        return { label: '等待自评', tone: 'warning', description: '提交已记录，完成自评后会更新错题状态。', icon: Clock3 };
      }
      if (this.detail.isCorrect) {
        return { label: '回答正确', tone: 'success', description: '本次提交的答案与标准答案一致。', icon: CheckCircle2 };
      }
      return { label: '回答错误', tone: 'danger', description: '本次提交已计入错题历史，可重新练习。', icon: XCircle };
    },
    isPendingAssessment() {
      return Boolean(
        this.detail &&
          this.detail.type === 'essay' &&
          this.detail.verified &&
          !this.detail.selfAssessment,
      );
    },
  },
  watch: {
    'authState.user.id'() {
      this.page = 1;
      this.detailOpen = false;
      this.loadHistory();
    },
    'studyState.version'() {
      this.loadHistory();
    },
  },
  created() {
    this.loadHistory();
  },
  methods: {
    formatDate,
    formatDateTime,
    formatNumber,
    formatTime,
    typeLabel,
    answerText,
    correctAnswerText,
    rowResult(item) {
      const meta = resultMeta(item);
      const icons = {
        success: CheckCircle2,
        danger: XCircle,
        warning: Clock3,
        neutral: AlertCircle,
      };
      return { ...meta, icon: icons[meta.tone] || AlertCircle };
    },
    async loadHistory() {
      const token = ++this.requestToken;
      this.loading = true;
      this.error = '';
      try {
        if (authState.user) {
          const data = await get('/me/attempts', {
            page: this.page,
            pageSize: PAGE_SIZE,
            type: this.filterType || undefined,
            result: this.filterResult || undefined,
            q: this.searchQuery || undefined,
          });
          if (token !== this.requestToken) return;
          this.items = data.items || [];
          this.pagination = data.pagination;
        } else {
          const all = await getGuestAttempts();
          const rows = all
            .map((attempt) => this.guestRow(attempt))
            .filter((row) => this.matchesGuestFilters(row, all))
            .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
          if (token !== this.requestToken) return;
          const total = rows.length;
          const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
          const page = Math.min(this.page, totalPages);
          this.page = page;
          this.pagination = { page, pageSize: PAGE_SIZE, total, totalPages };
          this.items = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        }
      } catch (error) {
        if (token !== this.requestToken) return;
        this.error = getErrorMessage(error, '作答历史加载失败，请稍后重试。');
        this.items = [];
      } finally {
        if (token === this.requestToken) this.loading = false;
      }
    },
    guestRow(attempt) {
      const snapshot = attempt.snapshot || {};
      return {
        id: attempt.clientEventId,
        questionId: attempt.questionId,
        versionId: attempt.versionId,
        versionNo: attempt.versionNo || null,
        title: snapshot.title || '未命名题目',
        type: snapshot.type || attempt.type || 'single',
        difficulty: snapshot.difficulty || attempt.difficulty || 'medium',
        isCorrect: attempt.isCorrect ?? null,
        selfAssessment: attempt.selfAssessment || null,
        requiresSelfAssessment: Boolean(attempt.requiresSelfAssessment),
        verified: attempt.verified !== false,
        source: 'local',
        answerSummary: attempt.answerSummary || '',
        submittedAt: attempt.submittedAt,
        subjectType: snapshot.type || attempt.type,
      };
    },
    matchesGuestFilters(row, all) {
      if (this.filterType && row.type !== this.filterType) return false;
      if (this.searchQuery && !String(row.title).toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }
      if (this.filterResult === 'correct') return row.isCorrect === true;
      if (this.filterResult === 'wrong') return row.isCorrect === false;
      if (this.filterResult === 'self_mastered') return row.selfAssessment === 'mastered';
      if (this.filterResult === 'self_not_mastered') return row.selfAssessment === 'not_mastered';
      if (this.filterResult === 'pending') {
        return row.type === 'essay' && !row.selfAssessment && row.verified;
      }
      if (this.filterResult === 'unverified') return !row.verified;
      return true;
    },
    submitSearch() {
      this.searchQuery = this.searchInput.trim();
      this.page = 1;
      this.loadHistory();
    },
    clearSearch() {
      this.searchInput = '';
      this.searchQuery = '';
      this.page = 1;
      this.loadHistory();
    },
    applyFilters() {
      this.page = 1;
      this.loadHistory();
    },
    resetFilters() {
      this.filterType = '';
      this.filterResult = '';
      this.searchInput = '';
      this.searchQuery = '';
      this.page = 1;
      this.loadHistory();
    },
    goPage(page) {
      this.page = page;
      this.loadHistory();
      window.scrollTo({ top: 160, behavior: 'smooth' });
    },
    async openDetail(item) {
      this.detailOpen = true;
      this.detailError = '';
      this.detail = null;
      this.detailLoading = Boolean(authState.user);
      if (!authState.user) {
        const all = await getGuestAttempts();
        const attempt = all.find((entry) => entry.clientEventId === item.id);
        if (!attempt) {
          this.detailError = '找不到这条作答记录。';
          this.detailLoading = false;
          return;
        }
        this.detail = this.guestDetail(attempt);
        this.detailLoading = false;
        return;
      }
      this.detailLoading = true;
      try {
        const data = await get(`/me/attempts/${item.id}`);
        this.detail = data.attempt;
      } catch (error) {
        this.detailError = getErrorMessage(error, '作答详情加载失败。');
      } finally {
        this.detailLoading = false;
      }
    },
    guestDetail(attempt) {
      const snapshot = attempt.snapshot || {};
      return {
        id: attempt.clientEventId,
        questionId: attempt.questionId,
        versionId: attempt.versionId,
        versionNo: attempt.versionNo || null,
        title: snapshot.title || '未命名题目',
        type: snapshot.type || attempt.type || 'single',
        difficulty: snapshot.difficulty || 'medium',
        category: snapshot.category || null,
        tags: snapshot.tags || [],
        stemMarkdown: snapshot.stemMarkdown || '',
        options: snapshot.options || [],
        fillConfig: snapshot.fillConfig || null,
        userAnswer: attempt.submittedAnswer || {},
        correctAnswer: attempt.correctAnswer || {},
        analysisMarkdown: snapshot.analysisMarkdown || attempt.analysisMarkdown || '',
        isCorrect: attempt.isCorrect ?? null,
        selfAssessment: attempt.selfAssessment || null,
        verified: attempt.verified !== false,
        source: 'local',
        submittedAt: attempt.submittedAt,
        receivedAt: attempt.receivedAt,
        questionStatus: snapshot.questionStatus || 'published',
        unavailable: false,
      };
    },
    async assess(assessment) {
      if (!this.detail || this.assessing) return;
      this.assessing = true;
      try {
        if (authState.user) {
          await patch(`/me/attempts/${this.detail.id}/assessment`, { assessment });
        } else {
          await updateGuestAttempt(this.detail.id, {
            selfAssessment: assessment,
            requiringAssessment: false,
          });
        }
        this.detail.selfAssessment = assessment;
        const item = this.items.find((row) => String(row.id) === String(this.detail.id));
        if (item) item.selfAssessment = assessment;
        notifyStudyChange();
        toast.success(assessment === 'mastered' ? '已标记为「已掌握」。' : '已标记为「未掌握」。');
      } catch (error) {
        toast.error(getErrorMessage(error, '自评状态未能更新。'));
      } finally {
        this.assessing = false;
      }
    },
    practiceAgain() {
      if (!this.detail?.questionId) return;
      const id = this.detail.questionId;
      this.detailOpen = false;
      this.$router.push({ name: 'question', params: { id } });
    },
  },
};
</script>

<style scoped>
.history-page {
  padding-top: 40px;
}

.guest-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 11px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.guest-banner p {
  flex: 1;
}

.guest-banner__link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 550;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
  padding: 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.history-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 360px;
  height: 36px;
  padding: 0 30px 0 32px;
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-tertiary);
}

.history-search svg {
  position: absolute;
  left: 10px;
  pointer-events: none;
}

.history-search input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
}

.history-search input::placeholder {
  color: var(--text-tertiary);
}

.history-search input::-webkit-search-cancel-button {
  display: none;
}

.history-search__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  color: var(--text-tertiary);
}

.history-search__clear:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.history-filters {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-select {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-tertiary);
  font-size: 11.5px;
  white-space: nowrap;
}

.filter-select select {
  height: 34px;
  padding: 0 28px 0 9px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m6 9 6 6 6-6' stroke='%23888883' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
}

.history-summary {
  margin-bottom: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}

.history-summary span {
  color: var(--text-tertiary);
}

.history-error {
  margin-bottom: 16px;
  align-items: center;
}

.history-list {
  overflow: hidden;
}

.history-list__head {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 130px 72px;
  gap: 18px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-tertiary);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.history-list__head-action {
  text-align: right;
}

.history-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 130px 72px;
  align-items: center;
  gap: 18px;
  padding: 17px 20px;
  border-bottom: 1px solid var(--border-default);
  transition: background var(--transition-fast);
}

.history-row:last-child {
  border-bottom: 0;
}

.history-row:hover {
  background: color-mix(in srgb, var(--bg-subtle) 58%, transparent);
}

.history-row.is-loading {
  opacity: 0.55;
}

.history-row__time {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.history-row__time-detail {
  color: var(--text-tertiary);
  font-size: 11px;
}

.history-row__main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
  text-align: left;
}

.history-row__title {
  overflow: hidden;
  width: 100%;
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-row__main:hover .history-row__title {
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.history-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.history-row__meta > span + span::before {
  content: '·';
  margin-right: 7px;
  color: var(--border-strong);
}

.history-row__answer {
  overflow: hidden;
  max-width: 100%;
  color: var(--text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-row__result {
  min-width: 0;
}

.history-row__action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}

.history-row__action:hover {
  color: var(--text-primary);
}

.history-empty {
  margin-top: 0;
}

.history-pagination {
  margin-top: 28px;
}

.history-loading {
  overflow: hidden;
}

.history-skeleton-row {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 22px 20px;
  border-bottom: 1px solid var(--border-default);
}

.history-skeleton-row:last-child {
  border-bottom: 0;
}

.detail-loading {
  display: block;
}

.detail-result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.detail-result strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.detail-result p {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.6;
}

.detail-result--success {
  border-color: var(--success-border);
  background: var(--success-bg);
  color: var(--success);
}

.detail-result--success p {
  color: var(--success);
  opacity: 0.8;
}

.detail-result--danger {
  border-color: var(--danger-border);
  background: var(--danger-bg);
  color: var(--danger);
}

.detail-result--danger p {
  color: var(--danger);
  opacity: 0.8;
}

.detail-result--warning {
  border-color: var(--warning-border);
  background: var(--warning-bg);
  color: var(--warning);
}

.detail-result--warning p {
  color: var(--warning);
  opacity: 0.8;
}

.detail-result svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.detail-version {
  margin-left: auto;
  align-self: center;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 10px;
}

.detail-unavailable {
  margin-top: 16px;
}

.detail-unavailable__status {
  margin-top: 5px;
  opacity: 0.75;
}

.detail-raw-answer {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.detail-raw-answer pre {
  margin: 0;
  overflow-x: auto;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.detail-question {
  margin-top: 22px;
  padding: 22px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.detail-question :deep(.stem) {
  font-size: 15px;
}

.detail-section-label {
  margin-bottom: 8px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.detail-question > .detail-section-label {
  margin-bottom: 12px;
}

.detail-answers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.detail-answer {
  padding: 13px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.detail-answer__text {
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.65;
  word-break: break-word;
  white-space: pre-wrap;
}

.detail-answer__markdown :deep(.prose) {
  font-size: 12.5px;
}

.detail-answer-block {
  margin-top: 20px;
  padding-top: 17px;
  border-top: 1px solid var(--border-default);
}

.detail-prose :deep(.prose) {
  font-size: 13.5px;
  line-height: 1.75;
}

.detail-assessment {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-top: 20px;
  padding: 15px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.detail-assessment__hint {
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.6;
}

.detail-assessment .detail-section-label {
  margin-bottom: 3px;
}

.detail-assessment__actions {
  display: flex;
  gap: 7px;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .history-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .history-search {
    max-width: none;
  }

  .history-filters {
    justify-content: space-between;
  }

  .filter-select {
    flex: 1;
  }

  .filter-select select {
    flex: 1;
  }

  .history-list__head {
    display: none;
  }

  .history-row {
    grid-template-columns: 1fr auto;
    gap: 8px 14px;
    padding: 15px 16px;
  }

  .history-row__time {
    grid-column: 1;
    grid-row: 1;
  }

  .history-row__main {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .history-row__result {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }

  .history-row__action {
    grid-column: 2;
    grid-row: 3;
    align-self: end;
  }

  .detail-answers {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .history-filters {
    flex-wrap: wrap;
  }

  .filter-select {
    flex-basis: calc(50% - 6px);
  }

  .guest-banner {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .guest-banner p {
    flex-basis: calc(100% - 28px);
  }

  .guest-banner__link {
    margin-left: 25px;
  }

  .detail-question {
    padding: 16px;
  }

  .detail-assessment {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .detail-assessment__actions .btn {
    flex: 1;
  }

  .detail-context {
    display: none;
  }
}
</style>
