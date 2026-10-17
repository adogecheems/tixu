<template>
  <div class="container question-page">
    <div v-if="loading" class="solve-layout question-loading">
      <aside class="question-aside">
        <div class="nav-panel">
          <span class="skeleton" style="width: 80px; height: 14px" />
          <span class="skeleton" style="display: block; width: 100%; height: 34px; margin-top: 18px" />
          <div class="skeleton-nav-grid">
            <span v-for="index in 12" :key="index" class="skeleton nav-skeleton-cell" />
          </div>
        </div>
      </aside>
      <main class="solve-main">
        <span class="skeleton" style="width: 160px; height: 12px" />
        <span class="skeleton" style="display: block; width: 68%; height: 28px; margin-top: 18px" />
        <div class="question-skeleton-card">
          <span class="skeleton" style="width: 84%; height: 15px" />
          <span class="skeleton" style="display: block; width: 72%; height: 15px; margin-top: 10px" />
          <span class="skeleton" style="display: block; width: 100%; height: 48px; margin-top: 28px" />
          <span class="skeleton" style="display: block; width: 100%; height: 48px; margin-top: 9px" />
          <span class="skeleton" style="display: block; width: 100%; height: 48px; margin-top: 9px" />
          <span class="skeleton" style="display: block; width: 104px; height: 38px; margin-top: 25px; margin-left: auto" />
        </div>
      </main>
    </div>

    <div v-else-if="error" class="question-state">
      <div class="question-state__card">
        <span class="question-state__icon">
          <Archive v-if="errorCode === 'QUESTION_ARCHIVED'" :size="24" :stroke-width="1.6" />
          <FileQuestion v-else :size="24" :stroke-width="1.6" />
        </span>
        <h1>{{ errorCode === 'QUESTION_ARCHIVED' ? '这道题已归档' : '题目暂时无法打开' }}</h1>
        <p>{{ error }}</p>
        <div class="question-state__actions">
          <button class="btn btn--secondary" type="button" @click="loadQuestion">重新加载</button>
          <RouterLink class="btn btn--primary" to="/questions">返回题库</RouterLink>
        </div>
      </div>
    </div>

    <div v-else-if="question" class="solve-layout">
      <div v-if="navOpen" class="nav-backdrop" @click="navOpen = false" />
      <aside class="question-aside" :class="{ 'is-open': navOpen }">
        <div class="nav-mobile-head">
          <span>题目导航</span>
          <button class="btn btn--ghost btn--sm btn--icon" type="button" aria-label="关闭题目导航" @click="navOpen = false">
            <X :size="17" />
          </button>
        </div>

        <div class="nav-panel">
          <div class="nav-panel__head">
            <div class="nav-panel__title">
              <ListTree :size="15" />
              <span>题目导航</span>
            </div>
            <span v-if="navContext" class="nav-panel__label">{{ navContext.source }}</span>
          </div>

          <template v-if="navContext">
            <p class="nav-source">
              来自
              <strong>{{ navContext.label }}</strong>
            </p>
            <div class="nav-progress">
              <span>第 {{ currentIndex + 1 }} / {{ navContext.ids.length }} 题</span>
              <span>{{ progressPercent }}%</span>
            </div>
            <div class="progress-track">
              <span :style="{ width: `${progressPercent}%` }" />
            </div>
            <div class="nav-grid">
              <template v-for="item in navWindow" :key="item.key">
                <span v-if="item.ellipsis" class="nav-ellipsis">…</span>
                <button
                  v-else
                  class="nav-cell"
                  :class="{ 'is-current': item.current }"
                  type="button"
                  :aria-current="item.current ? 'page' : undefined"
                  :title="`第 ${item.index + 1} 题`"
                  @click="navigateToIndex(item.index)"
                >
                  {{ item.index + 1 }}
                </button>
              </template>
            </div>
            <div class="nav-arrow-row">
              <button class="btn btn--secondary btn--sm" type="button" :disabled="!hasPrevious" @click="goPrevious">
                <ChevronLeft :size="14" />
                上一题
              </button>
              <button class="btn btn--secondary btn--sm" type="button" :disabled="!hasNext" @click="goNext">
                下一题
                <ChevronRight :size="14" />
              </button>
            </div>
            <p class="nav-hint">
              导航顺序在进入时固定。作答结果变化不会打乱本次浏览顺序。
            </p>
          </template>

          <template v-else>
            <div class="nav-direct">
              <Compass :size="21" :stroke-width="1.6" />
              <p>当前为独立浏览。从题库、错题本或收藏夹进入时，可以使用上一题与下一题。</p>
            </div>
            <RouterLink class="btn btn--secondary btn--sm btn--block" to="/questions">
              返回题库
              <ArrowRight :size="14" />
            </RouterLink>
          </template>
        </div>

        <div class="nav-tip">
          <Info :size="13" />
          <span>单题即时反馈，同一道题可以无限次重新作答。</span>
        </div>
      </aside>

      <main class="solve-main">
        <div class="solve-topbar">
          <button class="mobile-nav-trigger" type="button" @click="navOpen = true">
            <ListTree :size="15" />
            题目导航
            <span v-if="navContext">{{ currentIndex + 1 }}/{{ navContext.ids.length }}</span>
          </button>
          <nav class="breadcrumb" aria-label="面包屑">
            <RouterLink to="/questions">题库</RouterLink>
            <template v-if="question.category">
              <ChevronRight :size="11" />
              <RouterLink
                v-if="question.category.parent"
                :to="{ path: '/questions', query: { category: question.category.parent.id } }"
              >
                {{ question.category.parent.name }}
              </RouterLink>
              <ChevronRight v-if="question.category.parent" :size="11" />
              <RouterLink :to="{ path: '/questions', query: { category: question.category.id } }">
                {{ question.category.name }}
              </RouterLink>
            </template>
          </nav>
          <button
            class="favorite-btn"
            :class="{ 'is-active': isFavorited }"
            type="button"
            :disabled="favoritePending"
            @click="toggleFavorite"
          >
            <LoaderCircle v-if="favoritePending" :size="15" class="spin" />
            <Star v-else :size="15" :fill="isFavorited ? 'currentColor' : 'none'" />
            {{ isFavorited ? '已收藏' : '收藏' }}
          </button>
        </div>

        <header class="question-heading">
          <div class="question-meta">
            <span class="badge">{{ typeLabel(question.type) }}</span>
            <span class="badge badge--subtle">{{ difficultyLabel(question.difficulty) }}</span>
            <span v-if="navContext" class="question-index">第 {{ currentIndex + 1 }} / {{ navContext.ids.length }} 题</span>
            <span v-else class="question-index">独立题目</span>
          </div>
          <h1>{{ question.title }}</h1>
          <div v-if="question.tags?.length" class="question-tags">
            <RouterLink
              v-for="tag in question.tags"
              :key="tag.id"
              class="chip chip--static question-tag"
              :to="{ path: '/questions', query: { tags: tag.id } }"
            >
              #{{ tag.name }}
            </RouterLink>
          </div>
        </header>

        <section class="question-card">
          <QuestionAnswerArea
            :question="question"
            :model-value="answer"
            :submitted="Boolean(result)"
            :readonly="Boolean(result)"
            :correct-answer="result?.correctAnswer || null"
            @update:model-value="updateAnswer"
          />

          <div v-if="!result" class="submit-bar">
            <p class="submit-hint">
              <template v-if="versionConflict">
                <AlertTriangle :size="13" /> 题目版本已更新，请刷新后再提交。
              </template>
              <template v-else-if="!answerComplete">完成作答后即可提交。</template>
              <template v-else>提交后锁定本次答案，并展示判题结果与解析。</template>
            </p>
            <button
              class="btn btn--primary submit-button"
              type="button"
              :disabled="!answerComplete || submitting || versionConflict"
              @click="submit"
            >
              <LoaderCircle v-if="submitting" :size="15" class="btn__spinner" />
              {{ submitting ? '正在判题…' : '提交答案' }}
            </button>
          </div>

          <div v-if="submitError" class="alert alert--danger submit-error" role="alert">
            <AlertTriangle :size="16" class="alert__icon" />
            <div>
              <p>{{ submitError }}</p>
              <button v-if="versionConflict" class="link-button" type="button" @click="refreshQuestion">刷新题目</button>
            </div>
          </div>

          <div v-if="localSaveFailed" class="alert alert--warning submit-error" role="alert">
            <HardDrive :size="16" class="alert__icon" />
            <span>本次作答已完成，但记录未能保存。请检查浏览器存储空间，或登录后重试。</span>
          </div>

          <Transition name="feedback">
            <div v-if="result" ref="feedback" class="feedback" :class="`feedback--${resultStatus.tone}`">
              <div class="feedback__head">
                <span class="feedback__icon">
                  <component :is="resultStatus.icon" :size="21" :stroke-width="1.9" />
                </span>
                <div class="feedback__copy">
                  <h2>{{ resultStatus.label }}</h2>
                  <p>{{ resultStatus.description }}</p>
                </div>
                <span class="feedback__locked">
                  <Lock :size="12" />
                  本轮已提交
                </span>
              </div>

              <div v-if="question.type !== 'essay'" class="feedback__answer">
                <span class="feedback__answer-label">标准答案</span>
                <MarkdownContent inline :source="correctAnswerDisplay" />
              </div>

              <div v-if="result.requiresSelfAssessment" class="self-assessment">
                <template v-if="!result.selfAssessment">
                  <div>
                    <h3>对照参考答案，你掌握这道题了吗？</h3>
                    <p>自评结果会决定这道题是否保留在错题本中。每条作答只能自评一次。</p>
                  </div>
                  <div class="self-assessment__actions">
                    <button class="btn btn--secondary btn--sm" type="button" :disabled="assessing" @click="assess('not_mastered')">
                      <X :size="14" />
                      未掌握
                    </button>
                    <button class="btn btn--primary btn--sm" type="button" :disabled="assessing" @click="assess('mastered')">
                      <LoaderCircle v-if="assessing" :size="14" class="btn__spinner" />
                      <Check v-else :size="14" />
                      已掌握
                    </button>
                  </div>
                </template>
                <p v-else class="self-assessment__done">
                  <Check :size="14" />
                  已完成自评：{{ result.selfAssessment === 'mastered' ? '已掌握' : '未掌握' }}。自评结果已经同步到学习记录。
                </p>
              </div>
            </div>
          </Transition>
        </section>

        <section v-if="result?.requiresSelfAssessment && essayReference" class="content-section">
          <div class="content-section__head">
            <BookMarked :size="16" />
            <h2>参考答案</h2>
          </div>
          <div class="content-section__body">
            <MarkdownContent :source="essayReference" />
          </div>
        </section>

        <section v-if="result && result.analysisMarkdown" class="content-section">
          <div class="content-section__head">
            <BookOpenText :size="16" />
            <h2>解析</h2>
          </div>
          <div class="content-section__body">
            <MarkdownContent :source="result.analysisMarkdown" />
          </div>
        </section>

        <div v-if="result" class="post-submit-actions">
          <button class="btn btn--secondary" type="button" @click="retryQuestion">
            <RotateCcw :size="15" />
            重新作答
          </button>
          <button v-if="hasNext" class="btn btn--primary" type="button" @click="goNext">
            下一题
            <ArrowRight :size="15" />
          </button>
          <RouterLink v-else class="btn btn--primary" to="/questions">
            返回题库
            <ArrowRight :size="15" />
          </RouterLink>
        </div>

        <nav class="bottom-nav" aria-label="题目切换">
          <button class="bottom-nav__button" type="button" :disabled="!hasPrevious" @click="goPrevious">
            <ChevronLeft :size="16" />
            <span>
              <small>上一题</small>
              <strong>{{ hasPrevious ? '继续浏览' : '已是第一题' }}</strong>
            </span>
          </button>
          <span class="bottom-nav__position">
            <template v-if="navContext">{{ currentIndex + 1 }} / {{ navContext.ids.length }}</template>
            <template v-else>单题浏览</template>
          </span>
          <button class="bottom-nav__button bottom-nav__button--right" type="button" :disabled="!hasNext" @click="goNext">
            <span>
              <small>下一题</small>
              <strong>{{ hasNext ? '继续浏览' : '已是最后一题' }}</strong>
            </span>
            <ChevronRight :size="16" />
          </button>
        </nav>
      </main>
    </div>
  </div>
</template>

<script>
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BookMarked,
  BookOpenText,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  Compass,
  FileQuestion,
  HardDrive,
  Info,
  ListTree,
  LoaderCircle,
  Lock,
  RotateCcw,
  Star,
  X,
} from 'lucide-vue-next';
import QuestionAnswerArea from '@/components/QuestionAnswerArea.vue';
import MarkdownContent from '@/components/MarkdownContent.vue';
import { get, post, patch, put, getErrorMessage } from '@/lib/api.js';
import { authState } from '@/stores/auth.js';
import { studyState } from '@/stores/study.js';
import { notifyStudyChange } from '@/stores/study.js';
import { toast } from '@/stores/toast.js';
import {
  answerText,
  correctAnswerText,
  defaultAnswerFor,
  difficultyLabel,
  isAnswerComplete,
  typeLabel,
} from '@/lib/format.js';
import { readNavigationContext } from '@/lib/navContext.js';
import { recordRecentViewed } from '@/lib/recent.js';
import {
  deleteDraft,
  getDraft,
  getGuestFavoriteIds,
  guestDraftNamespace,
  saveDraft,
  saveGuestAttempt,
  setGuestFavorite,
  updateGuestAttempt,
} from '@/lib/guestDb.js';

function newEventId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAnswerForQuestion(question, input) {
  const base = defaultAnswerFor(question);
  if (!input || typeof input !== 'object') return base;
  if (question.type === 'single') {
    return { optionId: input.optionId || null };
  }
  if (question.type === 'multiple') {
    return { optionIds: Array.isArray(input.optionIds) ? input.optionIds.map(String) : [] };
  }
  if (question.type === 'truefalse') {
    return { value: typeof input.value === 'boolean' ? input.value : null };
  }
  if (question.type === 'fill') {
    const count = question.fillConfig?.blanks?.length || 1;
    const values = Array.isArray(input.blanks) ? input.blanks : [];
    return { blanks: Array.from({ length: count }, (_, index) => String(values[index] ?? '')) };
  }
  if (question.type === 'essay') {
    return { text: String(input.text || '') };
  }
  return base;
}

export default {
  name: 'QuestionDetailView',
  components: {
    AlertTriangle,
    Archive,
    ArrowRight,
    BookMarked,
    BookOpenText,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    CircleX,
    Clock3,
    Compass,
    FileQuestion,
    HardDrive,
    Info,
    ListTree,
    LoaderCircle,
    Lock,
    MarkdownContent,
    QuestionAnswerArea,
    RotateCcw,
    Star,
    X,
  },
  data() {
    return {
      authState,
      studyState,
      loading: true,
      error: '',
      errorCode: '',
      question: null,
      answer: {},
      result: null,
      attemptId: null,
      guestEventId: null,
      pendingEventId: null,
      submitting: false,
      submitError: '',
      versionConflict: false,
      assessing: false,
      favoritePending: false,
      isFavorited: false,
      navOpen: false,
      navContext: null,
      activeNamespace: 'guest',
      hydrating: false,
      draftTimer: null,
      requestToken: 0,
      localSaveFailed: false,
      localSubmissionData: null,
    };
  },
  computed: {
    currentIndex() {
      if (!this.navContext || !this.question) return -1;
      return this.navContext.ids.findIndex((id) => String(id) === String(this.question.id));
    },
    hasPrevious() {
      return this.currentIndex > 0;
    },
    hasNext() {
      return this.currentIndex >= 0 && this.currentIndex < (this.navContext?.ids.length || 0) - 1;
    },
    progressPercent() {
      if (!this.navContext?.ids?.length || this.currentIndex < 0) return 0;
      return Math.round(((this.currentIndex + 1) / this.navContext.ids.length) * 100);
    },
    navWindow() {
      if (!this.navContext || this.currentIndex < 0) return [];
      const total = this.navContext.ids.length;
      if (total <= 21) {
        return this.navContext.ids.map((id, index) => ({
          key: id + index,
          id,
          index,
          current: index === this.currentIndex,
        }));
      }
      const included = new Set([0, total - 1]);
      for (let offset = -5; offset <= 5; offset += 1) {
        const index = this.currentIndex + offset;
        if (index >= 0 && index < total) included.add(index);
      }
      const sorted = [...included].sort((a, b) => a - b);
      const items = [];
      let last = -1;
      for (const index of sorted) {
        if (last !== -1 && index > last + 1) {
          items.push({ key: `ellipsis-${last}-${index}`, ellipsis: true });
        }
        items.push({
          key: `${this.navContext.ids[index]}-${index}`,
          id: this.navContext.ids[index],
          index,
          current: index === this.currentIndex,
        });
        last = index;
      }
      return items;
    },
    answerComplete() {
      return this.question ? isAnswerComplete(this.question, this.answer) : false;
    },
    correctAnswerDisplay() {
      if (!this.result || !this.question || this.question.type === 'essay') return '';
      return correctAnswerText(this.question.type, this.result.correctAnswer, this.question);
    },
    essayReference() {
      return this.result?.correctAnswer?.referenceMarkdown || '';
    },
    resultStatus() {
      if (!this.result) {
        return { tone: 'neutral', label: '', description: '', icon: Clock3 };
      }
      if (this.result.requiresSelfAssessment) {
        if (!this.result.selfAssessment) {
          return {
            tone: 'warning',
            label: '已提交，等待自评',
            description: '对照参考答案后完成自评，系统会据此更新错题状态。',
            icon: Clock3,
          };
        }
        if (this.result.selfAssessment === 'mastered') {
          return {
            tone: 'success',
            label: '自评已掌握',
            description: '本次作答已完成，这道题已从当前错题本中移出。',
            icon: CircleCheck,
          };
        }
        return {
          tone: 'danger',
          label: '自评未掌握',
          description: '本次作答已完成，这道题会保留在当前错题本中。',
          icon: CircleX,
        };
      }
      if (this.result.isCorrect) {
        return {
          tone: 'success',
          label: '回答正确',
          description: '本次作答已记录，这道题已从当前错题本中移出。',
          icon: CircleCheck,
        };
      }
      return {
        tone: 'danger',
        label: '回答错误',
        description: '本次作答已记录，并进入当前错题本。可以查看解析后重新作答。',
        icon: CircleX,
      };
    },
  },
  watch: {
    answer: {
      deep: true,
      handler() {
        this.scheduleDraftSave();
      },
    },
    '$route.fullPath'() {
      if (this.$route.name !== 'question') return;
      this.handleRouteChange();
    },
    'authState.user.id'() {
      this.handleAuthChange();
    },
  },
  async created() {
    await this.loadQuestion();
  },
  beforeUnmount() {
    this.clearDraftTimer();
    if (this.question && !this.result && !this.loading) {
      this.persistDraft(this.activeNamespace, this.question.id, this.answer);
    }
  },
  methods: {
    typeLabel,
    difficultyLabel,
    clearDraftTimer() {
      if (this.draftTimer) {
        clearTimeout(this.draftTimer);
        this.draftTimer = null;
      }
    },
    scheduleDraftSave() {
      if (this.loading || this.hydrating || this.result || !this.question) return;
      this.clearDraftTimer();
      this.draftTimer = window.setTimeout(() => {
        this.persistDraft(this.activeNamespace, this.question?.id, this.answer);
      }, 320);
    },
    async persistDraft(namespace, questionId, answer) {
      if (!questionId) return;
      try {
        await saveDraft(namespace, questionId, answer);
      } catch {
        // Local draft persistence is best-effort; answer input is never lost in the page.
      }
    },
    async deleteCurrentDraft() {
      try {
        await deleteDraft(this.activeNamespace, this.question?.id);
      } catch {
        // Ignore.
      }
    },
    async loadQuestion() {
      const token = ++this.requestToken;
      this.loading = true;
      this.error = '';
      this.errorCode = '';
      this.navOpen = false;
      this.result = null;
      this.attemptId = null;
      this.guestEventId = null;
      this.pendingEventId = null;
      this.submitError = '';
      this.versionConflict = false;
      this.localSaveFailed = false;
      this.favoritePending = false;
      this.hydrating = true;
      this.clearDraftTimer();
      const questionId = this.$route.params.id;
      try {
        const data = await get(`/questions/${questionId}`);
        if (token !== this.requestToken) return;
        this.question = data.question;
        this.activeNamespace = guestDraftNamespace(authState.user);
        let context = readNavigationContext(this.$route.query.ctx);
        if (context && !context.ids.some((id) => String(id) === String(this.question.id))) {
          context = null;
        }
        this.navContext = context;

        if (authState.user) {
          this.isFavorited = Boolean(this.question.isFavorited);
        } else {
          try {
            const ids = await getGuestFavoriteIds();
            if (token !== this.requestToken) return;
            this.isFavorited = ids.has(String(this.question.id));
          } catch {
            this.isFavorited = false;
          }
        }

        let restored = null;
        try {
          const draft = await getDraft(this.activeNamespace, this.question.id);
          if (token !== this.requestToken) return;
          if (draft?.answer) restored = draft.answer;
        } catch {
          restored = null;
        }
        this.answer = normalizeAnswerForQuestion(this.question, restored || defaultAnswerFor(this.question));
        this.loading = false;
        await this.$nextTick();
        this.hydrating = false;

        recordRecentViewed(authState.user, this.question);
        document.title = `${this.question.title} · 题序`;
      } catch (error) {
        if (token !== this.requestToken) return;
        this.errorCode = error?.code || '';
        this.error = getErrorMessage(error, '题目加载失败，请稍后重试。');
        this.question = null;
      } finally {
        if (token === this.requestToken) {
          this.loading = false;
          this.hydrating = false;
        }
      }
    },
    async handleRouteChange() {
      this.clearDraftTimer();
      if (this.question && !this.result) {
        await this.persistDraft(this.activeNamespace, this.question.id, this.answer);
      }
      this.loadQuestion();
    },
    async handleAuthChange() {
      if (!this.question) {
        this.activeNamespace = guestDraftNamespace(authState.user);
        return;
      }
      this.clearDraftTimer();
      if (!this.result) {
        await this.persistDraft(this.activeNamespace, this.question.id, this.answer);
      }
      await this.loadQuestion();
    },
    updateAnswer(value) {
      if (this.result) return;
      this.answer = value;
    },
    navigateToIndex(index) {
      const contextId = this.navContext?.id || this.$route.query.ctx;
      const target = this.navContext?.ids?.[index];
      if (!target) return;
      this.navOpen = false;
      this.$router.push({
        name: 'question',
        params: { id: String(target) },
        query: contextId ? { ctx: contextId } : {},
      });
    },
    goPrevious() {
      if (this.hasPrevious) this.navigateToIndex(this.currentIndex - 1);
    },
    goNext() {
      if (this.hasNext) this.navigateToIndex(this.currentIndex + 1);
    },
    buildSubmitAnswer() {
      if (!this.question) return {};
      if (this.question.type === 'single') return { optionId: this.answer.optionId };
      if (this.question.type === 'multiple') {
        return { optionIds: [...(this.answer.optionIds || [])].sort() };
      }
      if (this.question.type === 'truefalse') return { value: this.answer.value };
      if (this.question.type === 'fill') return { blanks: [...(this.answer.blanks || [])].map(String) };
      return { text: this.answer.text || '' };
    },
    async submit() {
      if (this.submitting || this.result) return;
      if (!this.answerComplete) {
        this.submitError = '请完成作答后再提交。';
        return;
      }
      this.submitError = '';
      this.versionConflict = false;
      const eventId = this.pendingEventId || newEventId();
      this.pendingEventId = eventId;
      this.submitting = true;
      try {
        const data = await post(`/questions/${this.question.id}/submit`, {
          clientEventId: eventId,
          versionId: this.question.versionId,
          submittedAt: new Date().toISOString(),
          answer: this.buildSubmitAnswer(),
        });
        this.pendingEventId = null;
        this.attemptId = data.attempt?.id || null;
        this.guestEventId = authState.user ? null : eventId;
        this.result = data.result;
        this.answer = normalizeAnswerForQuestion(this.question, data.result.submittedAnswer);
        this.localSubmissionData = data;
        this.clearDraftTimer();
        await this.deleteCurrentDraft();
        if (!authState.user) {
          await this.persistLocalAttempt(data, eventId);
        }
        notifyStudyChange();
        this.$nextTick(() => {
          this.$refs.feedback?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        });
      } catch (error) {
        this.submitError = getErrorMessage(error, '提交失败，请保留当前答案后重试。');
        if (error?.code === 'VERSION_MISMATCH') {
          this.versionConflict = true;
        }
      } finally {
        this.submitting = false;
      }
    },
    async persistLocalAttempt(data, eventId) {
      if (authState.user || !this.question) return;
      const result = data.result;
      try {
        await saveGuestAttempt({
          clientEventId: eventId,
          questionId: String(this.question.id),
          versionId: String(this.question.versionId),
          versionNo: this.question.versionNo,
          submittedAnswer: result.submittedAnswer,
          correctAnswer: result.correctAnswer,
          isCorrect: result.isCorrect,
          selfAssessment: result.selfAssessment || null,
          requiresSelfAssessment: Boolean(result.requiresSelfAssessment),
          verified: true,
          answerSummary: answerText(this.question.type, result.submittedAnswer, this.question),
          submittedAt: data.attempt?.submittedAt || new Date().toISOString(),
          receivedAt: data.attempt?.receivedAt || new Date().toISOString(),
          snapshot: {
            title: this.question.title,
            type: this.question.type,
            difficulty: this.question.difficulty,
            stemMarkdown: this.question.stemMarkdown,
            options: this.question.options || [],
            fillConfig: this.question.fillConfig || null,
            analysisMarkdown: result.analysisMarkdown || '',
            category: this.question.category || null,
            tags: this.question.tags || [],
            questionStatus: 'published',
          },
        });
        this.localSaveFailed = false;
      } catch {
        this.localSaveFailed = true;
        toast.error('记录保存失败，请检查浏览器存储空间。');
      }
    },
    async assess(assessment) {
      if (!this.result || this.assessing || !this.result.requiresSelfAssessment) return;
      this.assessing = true;
      try {
        if (authState.user) {
          await patch(`/me/attempts/${this.attemptId}/assessment`, { assessment });
        } else if (this.guestEventId) {
          const updated = await updateGuestAttempt(this.guestEventId, { selfAssessment: assessment });
          if (!updated) throw new Error('本地作答记录不存在，请重新作答。');
        } else {
          throw new Error('作答记录尚未保存，请稍后重试。');
        }
        this.result = { ...this.result, selfAssessment: assessment };
        notifyStudyChange();
        toast.success(assessment === 'mastered' ? '已标记为「已掌握」。' : '已标记为「未掌握」。');
      } catch (error) {
        toast.error(getErrorMessage(error, '自评状态未能更新，请稍后重试。'));
      } finally {
        this.assessing = false;
      }
    },
    async refreshQuestion() {
      this.clearDraftTimer();
      if (this.question && !this.result) {
        await this.persistDraft(this.activeNamespace, this.question.id, this.answer);
      }
      await this.loadQuestion();
    },
    retryQuestion() {
      window.scrollTo({ top: 120, behavior: 'smooth' });
      this.result = null;
      this.attemptId = null;
      this.guestEventId = null;
      this.pendingEventId = null;
      this.submitError = '';
      this.versionConflict = false;
      this.localSaveFailed = false;
      this.localSubmissionData = null;
      this.answer = defaultAnswerFor(this.question);
    },
    async toggleFavorite() {
      if (!this.question || this.favoritePending) return;
      const next = !this.isFavorited;
      this.favoritePending = true;
      try {
        if (authState.user) {
          const data = await put(`/me/favorites/${this.question.id}`, { favorited: next });
          this.isFavorited = Boolean(data.isFavorited);
        } else {
          this.isFavorited = await setGuestFavorite(this.question.id, next).then(() => next);
        }
        notifyStudyChange();
        toast.success(next ? '已加入收藏夹。' : '已取消收藏。');
      } catch (error) {
        toast.error(getErrorMessage(error, '收藏状态未能更新。'));
      } finally {
        this.favoritePending = false;
      }
    },
  },
};
</script>

<style scoped>
.question-page {
  padding-top: 30px;
  padding-bottom: 64px;
}

.solve-layout {
  display: grid;
  grid-template-columns: 236px minmax(0, 860px);
  justify-content: center;
  align-items: start;
  gap: 38px;
}

.question-aside {
  position: sticky;
  top: calc(var(--header-height) + 26px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.nav-mobile-head {
  display: none;
}

.nav-panel {
  padding: 16px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.nav-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--border-default);
}

.nav-panel__title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 600;
}

.nav-panel__label {
  color: var(--text-tertiary);
  font-size: 9px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.nav-source {
  margin-top: 13px;
  color: var(--text-tertiary);
  font-size: 11.5px;
  line-height: 1.5;
}

.nav-source strong {
  color: var(--text-secondary);
  font-weight: 550;
}

.nav-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.nav-progress span:last-child {
  color: var(--text-tertiary);
}

.progress-track {
  height: 3px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 200ms ease;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 14px;
}

.nav-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.nav-cell:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.nav-cell.is-current {
  background: var(--accent);
  color: var(--accent-foreground);
  font-weight: 600;
}

.nav-ellipsis {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.nav-arrow-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 13px;
}

.nav-arrow-row .btn {
  padding: 0 8px;
}

.nav-hint {
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--border-default);
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.6;
}

.nav-direct {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 8px 18px;
  color: var(--text-tertiary);
  text-align: center;
}

.nav-direct p {
  font-size: 10.5px;
  line-height: 1.65;
}

.nav-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 9px 11px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.6;
}

.nav-tip svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.solve-main {
  min-width: 0;
}

.solve-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 30px;
  margin-bottom: 16px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.breadcrumb a:hover {
  color: var(--text-primary);
}

.breadcrumb svg {
  color: var(--border-strong);
}

.mobile-nav-trigger {
  display: none;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 11.5px;
  white-space: nowrap;
}

.mobile-nav-trigger span {
  color: var(--text-tertiary);
  font-size: 10px;
}

.favorite-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 11.5px;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.favorite-btn:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.favorite-btn.is-active {
  color: var(--text-primary);
  border-color: var(--border-strong);
  background: var(--bg-subtle);
}

.favorite-btn:disabled {
  opacity: 0.6;
}

.spin {
  animation: spin 0.8s linear infinite;
}

.question-heading {
  margin-bottom: 18px;
}

.question-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.question-index {
  margin-left: 4px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.question-heading h1 {
  margin-top: 14px;
  color: var(--text-primary);
  font-size: clamp(23px, 2.4vw, 27px);
  font-weight: 630;
  line-height: 1.4;
  letter-spacing: -0.032em;
  word-break: break-word;
}

.question-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 12px;
}

.question-tag {
  height: 24px;
  padding: 0 8px;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

a.question-tag:hover {
  color: var(--text-primary);
}

.question-card {
  padding: 30px 32px 26px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border-default);
}

.submit-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-tertiary);
  font-size: 11.5px;
  line-height: 1.5;
}

.submit-button {
  min-width: 112px;
}

.submit-error {
  margin-top: 14px;
  align-items: flex-start;
}

.submit-error p {
  line-height: 1.65;
}

.submit-error .link-button {
  margin-top: 6px;
  font-size: 11.5px;
}

.feedback {
  margin-top: 24px;
  padding: 18px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.feedback--success {
  border-color: var(--success-border);
  background: var(--success-bg);
}

.feedback--danger {
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.feedback--warning {
  border-color: var(--warning-border);
  background: var(--warning-bg);
}

.feedback__head {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}

.feedback__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  background: var(--bg-surface);
}

.feedback--success .feedback__icon {
  color: var(--success);
}

.feedback--danger .feedback__icon {
  color: var(--danger);
}

.feedback--warning .feedback__icon {
  color: var(--warning);
}

.feedback__copy {
  flex: 1;
  min-width: 0;
}

.feedback__copy h2 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.feedback--success .feedback__copy h2 {
  color: var(--success);
}

.feedback--danger .feedback__copy h2 {
  color: var(--danger);
}

.feedback--warning .feedback__copy h2 {
  color: var(--warning);
}

.feedback__copy p {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.65;
}

.feedback__locked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding-top: 4px;
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.feedback__answer {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.65;
}

.feedback__answer-label {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 11px;
}

.self-assessment {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-top: 15px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent);
}

.self-assessment h3 {
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 560;
}

.self-assessment p {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.6;
}

.self-assessment__actions {
  display: flex;
  gap: 7px;
  flex-shrink: 0;
}

.self-assessment__done {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.content-section {
  margin-top: 18px;
  padding: 24px 28px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.content-section__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.content-section__head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.content-section__body {
  padding-top: 16px;
}

.content-section__body :deep(.prose) {
  font-size: 14px;
  line-height: 1.78;
}

.post-submit-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.bottom-nav {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px solid var(--border-default);
}

.bottom-nav__button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 4px;
  border-radius: 8px;
  color: var(--text-secondary);
  text-align: left;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.bottom-nav__button:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-subtle);
}

.bottom-nav__button:disabled {
  opacity: 0.36;
}

.bottom-nav__button--right {
  text-align: right;
}

.bottom-nav__button span {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.bottom-nav__button small {
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}

.bottom-nav__button strong {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 540;
}

.bottom-nav__button:hover:not(:disabled) strong {
  color: var(--text-primary);
}

.bottom-nav__position {
  align-self: center;
  color: var(--text-tertiary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.nav-backdrop {
  display: none;
}

.question-loading {
  pointer-events: none;
}

.skeleton-nav-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 18px;
}

.nav-skeleton-cell {
  height: 30px;
}

.question-skeleton-card {
  margin-top: 22px;
  padding: 30px 32px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.question-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 58vh;
}

.question-state__card {
  width: min(500px, 100%);
  padding: 38px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  text-align: center;
}

.question-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.question-state__card h1 {
  margin-top: 17px;
  font-size: 20px;
  letter-spacing: -0.025em;
}

.question-state__card p {
  max-width: 360px;
  margin: 8px auto 0;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.7;
}

.question-state__actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 22px;
}

.feedback-enter-active,
.feedback-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.feedback-enter-from,
.feedback-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (max-width: 1100px) {
  .solve-layout {
    grid-template-columns: 210px minmax(0, 1fr);
    gap: 24px;
  }

  .question-card {
    padding: 26px;
  }
}

@media (max-width: 980px) {
  .solve-layout {
    grid-template-columns: minmax(0, 1fr);
    max-width: 860px;
    margin: 0 auto;
  }

  .question-aside {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 160;
    width: min(330px, calc(100vw - 40px));
    padding: 14px;
    overflow-y: auto;
    background: var(--bg-page);
    border-right: 1px solid var(--border-default);
    transform: translateX(-102%);
    transition: transform 200ms ease;
  }

  .question-aside.is-open {
    transform: translateX(0);
  }

  .nav-mobile-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 4px 10px;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .nav-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 150;
    background: var(--overlay);
    animation: fade-in 160ms ease;
  }

  .mobile-nav-trigger {
    display: inline-flex;
  }

  .solve-topbar {
    gap: 10px;
  }

  .breadcrumb {
    display: none;
  }

  .solve-topbar .favorite-btn {
    margin-left: auto;
  }
}

@media (max-width: 700px) {
  .question-page {
    padding-top: 18px;
    padding-bottom: 42px;
  }

  .question-heading h1 {
    font-size: 22px;
  }

  .question-card {
    padding: 20px 16px;
  }

  .submit-bar {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .submit-button {
    width: 100%;
  }

  .feedback {
    padding: 14px;
  }

  .feedback__locked {
    display: none;
  }

  .feedback__head {
    gap: 9px;
  }

  .feedback__icon {
    width: 32px;
    height: 32px;
  }

  .self-assessment {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .self-assessment__actions .btn {
    flex: 1;
  }

  .content-section {
    padding: 18px 16px;
  }

  .post-submit-actions .btn {
    flex: 1;
  }

  .bottom-nav {
    gap: 8px;
  }

  .bottom-nav__button strong {
    font-size: 10.5px;
  }

  .question-state__card {
    padding: 26px 20px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
