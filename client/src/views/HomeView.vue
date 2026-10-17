<template>
  <div class="home">
    <section class="landing">
      <div class="container landing__inner">
        <div class="landing__copy">
          <p class="eyebrow"><span class="eyebrow__dot" />在线题库 · 随时开始</p>
          <h1 class="landing__title">
            把每一道题，<br />
            <span class="landing__title-accent">练成自己的秩序。</span>
          </h1>
          <p class="landing__description">
            题序是一个安静、专注的在线刷题空间。五种题型、即时反馈、错题沉淀，
            让每一次练习都有迹可循。
          </p>
          <div class="landing__actions">
            <RouterLink class="btn btn--primary btn--lg" to="/questions">
              开始刷题
              <ArrowRight :size="16" />
            </RouterLink>
            <RouterLink class="btn btn--secondary btn--lg" to="/wrong">
              查看错题本
            </RouterLink>
          </div>

          <ul class="landing__features">
            <li>
              <span class="landing__feature-index">01</span>
              <span class="landing__feature-copy">
                <strong>五种题型</strong>
                <span>单选、多选、判断、填空与简答</span>
              </span>
            </li>
            <li>
              <span class="landing__feature-index">02</span>
              <span class="landing__feature-copy">
                <strong>公式与图片</strong>
                <span>支持 Markdown、LaTeX 与图片内容</span>
              </span>
            </li>
            <li>
              <span class="landing__feature-index">03</span>
              <span class="landing__feature-copy">
                <strong>记录有迹可循</strong>
                <span>沉淀作答历史、错题与收藏</span>
              </span>
            </li>
          </ul>
        </div>

        <aside class="landing__aside">
          <div class="study-card">
            <div class="study-card__head">
              <div>
                <p class="study-card__eyebrow">学习概览</p>
                <h2 class="study-card__title">{{ cardTitle }}</h2>
              </div>
              <span class="badge">
                <span class="badge__dot" />
                游客模式
              </span>
            </div>

            <div class="study-stats">
              <RouterLink class="study-stat" to="/history">
                <span class="study-stat__label">累计作答</span>
                <strong class="study-stat__value">
                  <span v-if="loadingStats" class="skeleton stat-skeleton" />
                  <template v-else>{{ formatNumber(displayStats.attempts) }}</template>
                </strong>
                <span class="study-stat__unit">次</span>
              </RouterLink>
              <RouterLink class="study-stat" to="/wrong">
                <span class="study-stat__label">待复习</span>
                <strong class="study-stat__value">
                  <span v-if="loadingStats" class="skeleton stat-skeleton" />
                  <template v-else>{{ formatNumber(displayStats.wrong) }}</template>
                </strong>
                <span class="study-stat__unit">题</span>
              </RouterLink>
              <RouterLink class="study-stat" to="/favorites">
                <span class="study-stat__label">已收藏</span>
                <strong class="study-stat__value">
                  <span v-if="loadingStats" class="skeleton stat-skeleton" />
                  <template v-else>{{ formatNumber(displayStats.favorites) }}</template>
                </strong>
                <span class="study-stat__unit">题</span>
              </RouterLink>
            </div>

            <div class="study-card__divider" />

            <button
              v-if="recent[0]"
              class="continue-row"
              type="button"
              @click="openRecent(recent[0])"
            >
              <span class="continue-row__icon"><Play :size="14" fill="currentColor" /></span>
              <span class="continue-row__content">
                <span class="continue-row__label">最近浏览 · {{ formatRelative(recent[0].viewedAt) }}</span>
                <strong>{{ recent[0].title }}</strong>
              </span>
              <ArrowUpRight :size="16" class="continue-row__arrow" />
            </button>
            <RouterLink v-else class="continue-row" to="/questions">
              <span class="continue-row__icon"><Play :size="14" fill="currentColor" /></span>
              <span class="continue-row__content">
                <span class="continue-row__label">准备好了吗</span>
                <strong>挑一道题，开始今天的练习</strong>
              </span>
              <ArrowUpRight :size="16" class="continue-row__arrow" />
            </RouterLink>

            <div class="study-card__foot">
              <span>
                <Monitor :size="13" />
                记录保存在当前浏览器
              </span>
              <RouterLink to="/login" class="study-card__login">登录同步</RouterLink>
            </div>
          </div>

          <RouterLink
            v-if="featuredQuestion"
            class="featured-card"
            :to="{ name: 'question', params: { id: featuredQuestion.id } }"
            :aria-label="`开始作答：${featuredQuestion.title}`"
          >
            <span class="featured-card__head">
              <span class="featured-card__eyebrow">从这道开始</span>
              <span class="featured-card__count">共 {{ formatNumber(questionCount) }} 道题</span>
            </span>
            <span class="featured-card__meta">
              <span class="badge">{{ typeLabel(featuredQuestion.type) }}</span>
              <span class="badge badge--subtle">{{ difficultyLabel(featuredQuestion.difficulty) }}</span>
              <span class="featured-card__category">{{ categoryPath(featuredQuestion.category) }}</span>
            </span>
            <span class="featured-card__title">{{ featuredQuestion.title }}</span>
            <span v-if="featuredQuestion.summary" class="featured-card__summary">
              {{ featuredQuestion.summary }}
            </span>
            <span class="featured-card__foot">
              <span>无需登录，直接作答</span>
              <span class="featured-card__action">
                开始作答
                <ArrowUpRight :size="13" />
              </span>
            </span>
          </RouterLink>

          <div v-else-if="loadingFeatured" class="featured-skeleton" aria-hidden="true">
            <span class="skeleton" style="width: 90px; height: 12px" />
            <span class="skeleton" style="display: block; width: 68%; height: 18px; margin-top: 18px" />
            <span class="skeleton" style="display: block; width: 92%; height: 12px; margin-top: 10px" />
            <span class="skeleton" style="display: block; width: 74%; height: 12px; margin-top: 6px" />
          </div>
        </aside>

        <div v-if="categories.length" class="landing__overview">
          <dl class="landing__metrics" aria-label="题库数据">
            <div class="landing__metric">
              <dt>公开题目</dt>
              <dd>{{ formatNumber(questionCount) }}</dd>
            </div>
            <div class="landing__metric">
              <dt>学科分类</dt>
              <dd>{{ formatNumber(categoryCount) }}</dd>
            </div>
            <div class="landing__metric">
              <dt>知识标签</dt>
              <dd>{{ formatNumber(tagCount) }}</dd>
            </div>
            <div class="landing__metric">
              <dt>练习题型</dt>
              <dd>5</dd>
            </div>
          </dl>

          <nav class="landing__scope" aria-label="按学科浏览题目">
            <span class="landing__scope-label">按学科浏览</span>
            <RouterLink
              v-for="category in categories"
              :key="category.id"
              class="landing__scope-link"
              :to="{ name: 'questions', query: { category: String(category.id) } }"
            >
              {{ category.name }}
              <span>{{ category.questionCount }}</span>
            </RouterLink>
            <RouterLink class="landing__scope-all" :to="{ name: 'questions' }">
              全部题目
              <ArrowRight :size="12" />
            </RouterLink>
          </nav>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { ArrowRight, ArrowUpRight, Monitor, Play } from 'lucide-vue-next';
import { authState } from '@/stores/auth.js';
import { studyState } from '@/stores/study.js';
import { get } from '@/lib/api.js';
import { getGuestStudyState } from '@/lib/guestDb.js';
import { getRecentViewed } from '@/lib/recent.js';
import { openQuestionWithContext } from '@/lib/navContext.js';
import {
  categoryPath,
  difficultyLabel,
  formatNumber,
  formatRelative,
  typeLabel,
} from '@/lib/format.js';

export default {
  name: 'HomeView',
  components: {
    ArrowRight,
    ArrowUpRight,
    Monitor,
    Play,
  },
  data() {
    return {
      authState,
      studyState,
      loadingStats: true,
      loadingFeatured: true,
      guestStats: { attempts: 0, wrong: 0, favorites: 0 },
      recent: [],
      featuredQuestion: null,
      questionCount: 0,
      categories: [],
      categoryCount: 0,
      tagCount: 0,
    };
  },
  computed: {
    displayStats() {
      return this.guestStats;
    },
    cardTitle() {
      return this.guestStats.attempts > 0 ? '继续积累' : '从一题开始';
    },
  },
  watch: {
    'studyState.version'() {
      if (!authState.user) this.loadStats();
    },
    'authState.user.id'() {
      if (authState.user) this.$router.replace({ name: 'questions' });
    },
  },
  created() {
    if (authState.user) {
      this.$router.replace({ name: 'questions' });
      return;
    }
    this.recent = getRecentViewed(null);
    this.loadStats();
    this.loadFeatured();
    this.loadOverview();
  },
  methods: {
    formatNumber,
    formatRelative,
    typeLabel,
    difficultyLabel,
    categoryPath,
    async loadStats() {
      try {
        const state = await getGuestStudyState();
        this.guestStats = state.stats;
      } catch {
        this.guestStats = { attempts: 0, wrong: 0, favorites: 0 };
      } finally {
        this.loadingStats = false;
      }
    },
    async loadFeatured() {
      try {
        const data = await get('/questions', { pageSize: 1 });
        this.featuredQuestion = data.items?.[0] || null;
        this.questionCount = data.pagination?.total || 0;
      } catch {
        this.featuredQuestion = null;
      } finally {
        this.loadingFeatured = false;
      }
    },
    async loadOverview() {
      try {
        const data = await get('/home');
        this.categories = (data.categories || [])
          .filter((category) => category.questionCount > 0)
          .slice(0, 4);
        this.categoryCount = data.categoryCount || this.categories.length;
        this.tagCount = data.tagCount || 0;
        if (!this.questionCount) this.questionCount = data.questionCount || 0;
      } catch {
        this.categories = [];
      }
    },
    async openRecent(item) {
      const ids = this.recent
        .map((recentItem) => String(recentItem.id))
        .filter((id, index, list) => id && list.indexOf(id) === index);
      if (!ids.includes(String(item.id))) ids.unshift(String(item.id));
      await openQuestionWithContext(this.$router, item.id, {
        ids,
        source: '最近浏览',
        label: '最近浏览',
      });
    },
  },
};
</script>

<style scoped>
.home {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.landing {
  display: flex;
  flex: 1;
  align-items: center;
}

.landing__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(380px, 0.92fr);
  align-items: center;
  column-gap: clamp(48px, 6.5vw, 96px);
  row-gap: 0;
  padding-top: clamp(32px, 4.5vh, 56px);
  padding-bottom: clamp(32px, 4.5vh, 54px);
}

.landing__copy {
  max-width: 720px;
  animation: rise-in 420ms ease both;
}

.landing__title {
  margin-top: 20px;
  color: var(--text-primary);
  font-size: clamp(43px, 4.9vw, 64px);
  font-weight: 630;
  line-height: 1.18;
  letter-spacing: -0.048em;
}

.landing__title-accent {
  position: relative;
  display: inline-block;
  color: var(--text-primary);
}

.landing__title-accent::after {
  content: '';
  position: absolute;
  left: 1px;
  right: 8%;
  bottom: 3px;
  height: 8px;
  z-index: -1;
  border-radius: 3px;
  background: color-mix(in srgb, var(--border-strong) 52%, transparent);
}

.landing__description {
  max-width: 550px;
  margin-top: 23px;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.8;
}

.landing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 30px;
}

.landing__features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  max-width: 660px;
  margin-top: 32px;
  padding-top: 19px;
  border-top: 1px solid var(--border-default);
  list-style: none;
}

.landing__features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 0 15px;
  border-left: 1px solid var(--border-default);
}

.landing__features li:first-child {
  padding-left: 0;
  border-left: 0;
}

.landing__features li:last-child {
  padding-right: 0;
}

.landing__feature-index {
  flex-shrink: 0;
  padding-top: 1px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.5;
}

.landing__feature-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.landing__feature-copy strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 560;
  line-height: 1.5;
}

.landing__feature-copy > span {
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.6;
}

.landing__aside {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  animation: rise-in 520ms 70ms ease both;
}

.study-card {
  padding: 24px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  background: var(--bg-surface);
  box-shadow: var(--shadow-xs);
}

.study-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.study-card__eyebrow {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 550;
  letter-spacing: 0.05em;
}

.study-card__title {
  margin-top: 5px;
  font-size: 20px;
  font-weight: 630;
  letter-spacing: -0.025em;
}

.study-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 22px;
  border-top: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
}

.study-stat {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  padding: 16px 12px;
  border-right: 1px solid var(--border-default);
  transition: background var(--transition-fast);
}

.study-stat:first-child {
  padding-left: 0;
}

.study-stat:last-child {
  border-right: 0;
}

.study-stat:hover {
  background: var(--bg-subtle);
}

.study-stat__label {
  flex-basis: 100%;
  margin-bottom: 4px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.study-stat__value {
  color: var(--text-primary);
  font-size: 26px;
  font-weight: 630;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.study-stat__unit {
  color: var(--text-tertiary);
  font-size: 11px;
}

.stat-skeleton {
  display: inline-block;
  width: 36px;
  height: 25px;
}

.study-card__divider {
  height: 15px;
}

.continue-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  text-align: left;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.continue-row:hover {
  background: var(--bg-subtle);
  border-color: var(--border-default);
}

.continue-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--accent);
  color: var(--accent-foreground);
}

.continue-row__content {
  flex: 1;
  min-width: 0;
}

.continue-row__label {
  display: block;
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.5;
}

.continue-row__content strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 560;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.continue-row__arrow {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.study-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  padding-top: 14px;
  border-top: 1px solid var(--border-default);
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.study-card__foot span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.study-card__login {
  color: var(--text-secondary);
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.study-card__login:hover {
  color: var(--text-primary);
}

.featured-card {
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.featured-card:hover {
  border-color: var(--border-strong);
  background: color-mix(in srgb, var(--bg-surface) 94%, var(--bg-subtle));
}

.featured-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.featured-card__eyebrow {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.featured-card__count {
  color: var(--text-tertiary);
  font-size: 10px;
}

.featured-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 13px;
}

.featured-card__category {
  overflow: hidden;
  margin-left: 2px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured-card__title {
  margin-top: 13px;
  color: var(--text-primary);
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: -0.015em;
}

.featured-card__summary {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.65;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.featured-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
  color: var(--text-tertiary);
  font-size: 10px;
}

.featured-card__action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 520;
}

.featured-card:hover .featured-card__action {
  color: var(--text-primary);
}

.featured-skeleton {
  min-height: 174px;
  padding: 20px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.landing__overview {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 22px 32px;
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid var(--border-default);
}

.landing__metrics {
  display: flex;
  align-items: center;
  margin: 0;
}

.landing__metric {
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 0 19px;
  border-left: 1px solid var(--border-default);
}

.landing__metric:first-child {
  padding-left: 0;
  border-left: 0;
}

.landing__metric dt {
  color: var(--text-tertiary);
  font-size: 10.5px;
  letter-spacing: 0.025em;
}

.landing__metric dd {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 620;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.landing__scope {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.landing__scope-label {
  margin-right: 3px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  letter-spacing: 0.025em;
}

.landing__scope-link {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 9px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11.5px;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.landing__scope-link > span {
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.landing__scope-link:hover {
  border-color: var(--border-strong);
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.landing__scope-all {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 2px;
  color: var(--text-secondary);
  font-size: 11.5px;
}

.landing__scope-all:hover {
  color: var(--text-primary);
}

@media (max-width: 1100px) {
  .landing__inner {
    grid-template-columns: minmax(0, 1fr) minmax(350px, 0.82fr);
    column-gap: 38px;
    padding-top: 38px;
    padding-bottom: 40px;
  }

  .landing__features {
    margin-top: 28px;
  }

  .landing__features li {
    padding: 0 11px;
  }

  .landing__metric {
    padding: 0 13px;
  }

  .landing__scope-link {
    padding: 4px 7px;
  }
}

@media (min-width: 901px) and (max-height: 940px) {
  .landing__inner {
    padding-top: 24px;
    padding-bottom: 26px;
  }

  .landing__features {
    margin-top: 24px;
  }

  .landing__overview {
    margin-top: 18px;
    padding-top: 14px;
  }
}

@media (max-width: 900px) {
  .landing__inner {
    grid-template-columns: 1fr;
    justify-items: center;
    row-gap: 30px;
    padding-top: 38px;
    padding-bottom: 42px;
  }

  .landing__copy,
  .landing__aside {
    width: 100%;
    max-width: 680px;
  }

  .landing__overview {
    width: 100%;
    max-width: 680px;
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
    margin-top: 0;
    padding-top: 20px;
  }

  .landing__scope {
    gap: 7px;
  }
}

@media (min-width: 641px) and (max-width: 900px) {
  .landing__copy {
    text-align: center;
  }

  .landing__description {
    margin-left: auto;
    margin-right: auto;
  }

  .landing__actions {
    justify-content: center;
  }

  .landing__features {
    margin-left: auto;
    margin-right: auto;
    text-align: left;
  }

  .landing__overview {
    align-items: center;
  }

  .landing__metrics {
    justify-content: center;
  }

  .landing__scope {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .landing__inner {
    row-gap: 26px;
    padding-top: 28px;
    padding-bottom: 34px;
  }

  .landing__title {
    margin-top: 15px;
    font-size: 37px;
    letter-spacing: -0.04em;
  }

  .landing__description {
    margin-top: 18px;
    font-size: 14px;
  }

  .landing__actions {
    margin-top: 23px;
  }

  .landing__actions .btn {
    flex: 1;
  }

  .landing__features {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 27px;
    padding-top: 15px;
  }

  .landing__features li,
  .landing__features li:first-child,
  .landing__features li:last-child {
    gap: 9px;
    padding: 0;
    border-left: 0;
  }

  .landing__features li + li {
    padding-top: 10px;
    border-top: 1px solid color-mix(in srgb, var(--border-default) 68%, transparent);
  }

  .landing__feature-copy > span {
    font-size: 11px;
  }

  .landing__metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 11px 20px;
    width: 100%;
  }

  .landing__metric {
    padding: 0;
    border-left: 0;
  }

  .landing__scope-label {
    flex-basis: 100%;
    margin-bottom: 1px;
  }

  .study-card {
    padding: 18px;
    border-radius: var(--radius-lg);
  }

  .study-stat {
    padding: 14px 8px;
  }

  .study-stat__value {
    font-size: 22px;
  }

  .featured-card {
    padding: 16px;
  }
}

@media (max-width: 430px) {
  .landing__title {
    font-size: 33px;
  }

  .landing__actions {
    flex-direction: column;
  }
}
</style>
