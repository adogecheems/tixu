<template>
  <div class="container page collection-page">
    <header class="page-header">
      <div>
        <p class="eyebrow"><span class="eyebrow__dot" />{{ mode === 'wrong' ? 'Review' : 'Saved' }}</p>
        <h1 class="page-header__title">{{ title }}</h1>
        <p class="page-header__description">{{ description }}</p>
      </div>
      <div class="page-header__actions">
        <RouterLink class="btn btn--secondary btn--sm" to="/questions">
          <Library :size="14" />
          去题库
        </RouterLink>
      </div>
    </header>

    <div v-if="!authState.user" class="guest-banner">
      <Monitor :size="15" />
      <p>当前为游客模式，作答与收藏仅保存在当前浏览器。登录后可合并记录并跨设备同步。</p>
      <RouterLink class="guest-banner__link" :to="{ name: 'login', query: { redirect: $route.fullPath } }">
        登录账户
        <ArrowRight :size="13" />
      </RouterLink>
    </div>

    <div class="collection-layout">
      <div v-if="filtersOpen" class="filter-backdrop" @click="filtersOpen = false" />
      <aside class="filter-column" :class="{ 'is-open': filtersOpen }">
        <div class="filter-column__mobile-head">
          <span>筛选{{ title }}</span>
          <button class="btn btn--ghost btn--sm btn--icon" type="button" aria-label="关闭筛选" @click="filtersOpen = false">
            <X :size="17" />
          </button>
        </div>
        <FilterPanel
          :categories="categories"
          :model-value="filters"
          :show-difficulty="false"
          :show-tags="false"
          @update:model-value="applyFilters"
        />
        <div class="collection-tip">
          <component :is="mode === 'wrong' ? RotateCcw : Bookmark" :size="15" />
          <p v-if="mode === 'wrong'">再次答对客观题，或对简答题自评「已掌握」，题目会自动移出当前错题本。</p>
          <p v-else>收藏与作答状态相互独立。你可以在未作答时收藏，也可以在提交后继续保留收藏。</p>
        </div>
      </aside>

      <section class="collection-main">
        <div class="collection-toolbar">
          <div>
            <h2 class="section-title">{{ filteredLabel }}</h2>
            <p class="collection-meta">
              <template v-if="loading && !items.length">正在加载…</template>
              <template v-else>
                共 {{ formatNumber(pagination.total) }} 道题
                <span v-if="mode === 'wrong'"> · 按{{ sortLabel }}排序</span>
              </template>
            </p>
          </div>
          <div class="collection-toolbar__actions">
            <label v-if="mode === 'wrong'" class="sort-control">
              <span>排序</span>
              <select :value="sort" class="toolbar-select" @change="changeSort($event.target.value)">
                <option value="recent">最近错误优先</option>
                <option value="count">错误次数优先</option>
              </select>
            </label>
            <button class="btn btn--secondary btn--sm mobile-filter-btn" type="button" @click="filtersOpen = true">
              <SlidersHorizontal :size="14" />
              筛选
              <span v-if="filterCount" class="filter-count">{{ filterCount }}</span>
            </button>
          </div>
        </div>

        <div v-if="error" class="alert alert--danger collection-error" role="alert">
          <AlertCircle :size="16" class="alert__icon" />
          <span>{{ error }}</span>
          <button class="link-button" type="button" @click="reload">重试</button>
        </div>

        <div v-if="loading && !items.length" class="collection-grid">
          <div v-for="index in 4" :key="index" class="collection-skeleton">
            <span class="skeleton" style="width: 56px; height: 22px" />
            <span class="skeleton" style="display: block; width: 78%; height: 18px; margin-top: 20px" />
            <span class="skeleton" style="display: block; width: 92%; height: 12px; margin-top: 12px" />
            <span class="skeleton" style="display: block; width: 42%; height: 11px; margin-top: 28px" />
          </div>
        </div>

        <template v-else-if="items.length">
          <div class="collection-grid" :class="{ 'is-loading': loading }">
            <QuestionCard
              v-for="item in items"
              :key="item.id"
              :question="item"
              :favorite-pending="pendingFavorites.has(item.id)"
              @toggle-favorite="toggleFavorite(item)"
              @open="openQuestion(item)"
            />
          </div>
          <div class="collection-pagination">
            <PaginationBar :page="pagination.page" :total-pages="pagination.totalPages" @update:page="goPage" />
          </div>
        </template>

        <div v-else-if="!loading" class="collection-empty">
          <EmptyState
            :title="emptyTitle"
            :description="emptyDescription"
          >
            <template #icon>
              <SearchX v-if="filterCount" :size="23" :stroke-width="1.7" />
              <NotebookTabs v-else-if="mode === 'wrong'" :size="23" :stroke-width="1.7" />
              <Star v-else :size="23" :stroke-width="1.7" />
            </template>
            <template #actions>
              <button v-if="filterCount" class="btn btn--secondary btn--sm" type="button" @click="resetFilters">
                清除筛选
              </button>
              <RouterLink class="btn btn--primary btn--sm" to="/questions">
                去题库练习
                <ArrowRight :size="14" />
              </RouterLink>
            </template>
          </EmptyState>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  Library,
  Monitor,
  NotebookTabs,
  RotateCcw,
  SearchX,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-vue-next';
import FilterPanel from '@/components/FilterPanel.vue';
import QuestionCard from '@/components/QuestionCard.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import EmptyState from '@/components/EmptyState.vue';
import { get, put, getErrorMessage } from '@/lib/api.js';
import { authState } from '@/stores/auth.js';
import { studyState } from '@/stores/study.js';
import { toast } from '@/stores/toast.js';
import { notifyStudyChange } from '@/stores/study.js';
import {
  getGuestStudyState,
  setGuestFavorite,
} from '@/lib/guestDb.js';
import { formatNumber } from '@/lib/format.js';
import { openQuestionWithContext } from '@/lib/navContext.js';

const PAGE_SIZE = 20;
const emptyFilters = () => ({ category: '', types: [] });

export default {
  name: 'CollectionView',
  components: {
    AlertCircle,
    ArrowRight,
    Bookmark,
    EmptyState,
    FilterPanel,
    Library,
    Monitor,
    NotebookTabs,
    PaginationBar,
    QuestionCard,
    RotateCcw,
    SearchX,
    SlidersHorizontal,
    Star,
    X,
  },
  props: {
    mode: { type: String, required: true, validator: (value) => ['wrong', 'favorites'].includes(value) },
  },
  data() {
    return {
      authState,
      studyState,
      categories: [],
      filters: emptyFilters(),
      sort: 'recent',
      page: 1,
      items: [],
      guestBaseItems: [],
      pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 },
      loading: true,
      error: '',
      filtersOpen: false,
      pendingFavorites: new Set(),
      requestToken: 0,
      openingId: null,
    };
  },
  computed: {
    title() {
      return this.mode === 'wrong' ? '错题本' : '收藏夹';
    },
    description() {
      return this.mode === 'wrong'
        ? '错题本记录当前需要复习的题目，而不是全部错误历史。再次答对后，题目会自动移出。'
        : '你主动收藏的题目会汇总在这里。无论是否作答，都可以随时回来查看。';
    },
    filterCount() {
      return (this.filters.category ? 1 : 0) + (this.filters.types?.length || 0);
    },
    filteredLabel() {
      if (this.filterCount) return '筛选结果';
      return this.mode === 'wrong' ? '待复习题目' : '我的收藏';
    },
    sortLabel() {
      return this.sort === 'count' ? '错误次数' : '最近错误';
    },
    emptyTitle() {
      if (this.filterCount) return '没有符合筛选条件的题目';
      return this.mode === 'wrong' ? '错题本还是空的' : '还没有收藏题目';
    },
    emptyDescription() {
      if (this.filterCount) return '试试切换分类或减少题型筛选。';
      return this.mode === 'wrong'
        ? '客观题答错，或简答题自评未掌握后，题目会自动出现在这里。'
        : '在题目页点击右上角的收藏按钮，题目就会保存在这里。';
    },
  },
  watch: {
    mode() {
      this.filters = emptyFilters();
      this.sort = 'recent';
      this.page = 1;
      this.items = [];
      this.guestBaseItems = [];
      this.reload();
    },
    'authState.user.id'() {
      this.page = 1;
      this.reload();
    },
    'studyState.version'() {
      this.reload();
    },
  },
  async created() {
    await this.loadTaxonomy();
    await this.reload();
  },
  methods: {
    formatNumber,
    async loadTaxonomy() {
      try {
        const data = await get('/categories');
        this.categories = data.categories || [];
      } catch {
        this.categories = [];
      }
    },
    endpoint() {
      return this.mode === 'wrong' ? '/me/wrong' : '/me/favorites';
    },
    async reload() {
      const token = ++this.requestToken;
      this.loading = true;
      this.error = '';
      try {
        if (!authState.user) {
          await this.loadGuestBase(token);
          if (token !== this.requestToken) return;
          this.applyGuestPage();
        } else {
          const data = await get(this.endpoint(), {
            page: this.page,
            pageSize: PAGE_SIZE,
            category: this.filters.category || undefined,
            types: this.filters.types,
            sort: this.mode === 'wrong' ? this.sort : undefined,
          });
          if (token !== this.requestToken) return;
          this.items = data.items || [];
          this.pagination = data.pagination;
        }
      } catch (error) {
        if (token !== this.requestToken) return;
        this.error = getErrorMessage(error, '学习记录加载失败，请稍后重试。');
        this.items = [];
      } finally {
        if (token === this.requestToken) this.loading = false;
      }
    },
    async loadGuestBase(token) {
      const state = await getGuestStudyState();
      let entries;
      let ids;
      if (this.mode === 'wrong') {
        entries = [...state.wrongEntries].sort((a, b) => {
          const recent = String(b.lastWrongAt || '').localeCompare(String(a.lastWrongAt || ''));
          return this.sort === 'count' ? b.wrongCount - a.wrongCount || recent : recent;
        });
        ids = entries.map((entry) => entry.questionId);
      } else {
        entries = [...state.favorites].sort((a, b) =>
          String(b.favoritedAt || '').localeCompare(String(a.favoritedAt || '')),
        );
        ids = entries.map((entry) => entry.questionId);
      }
      if (!ids.length) {
        this.guestBaseItems = [];
        return;
      }
      const chunks = [];
      for (let index = 0; index < ids.length; index += 100) chunks.push(ids.slice(index, index + 100));
      const responses = await Promise.all(
        chunks.map((chunk) => get('/questions/lookup', { ids: chunk.join(',') })),
      );
      if (token !== this.requestToken) return;
      const questionMap = new Map();
      for (const response of responses) {
        for (const item of response.items || []) questionMap.set(String(item.id), item);
      }
      const meta = new Map(entries.map((entry) => [String(entry.questionId), entry]));
      this.guestBaseItems = ids
        .map((id) => {
          const item = questionMap.get(String(id));
          if (!item) return null;
          const entry = meta.get(String(id));
          return {
            ...item,
            isFavorited: state.favoriteIds.has(String(id)),
            wrongCount: entry?.wrongCount || 0,
            lastWrongAt: entry?.lastWrongAt || null,
            lastAnsweredAt: entry?.lastAnsweredAt || null,
            favoritedAt: entry?.favoritedAt || null,
          };
        })
        .filter(Boolean);
    },
    filteredGuestItems() {
      const filtered = this.guestBaseItems.filter((item) => {
        if (this.filters.category) {
          const matchesCategory =
            String(item.category?.id) === String(this.filters.category) ||
            String(item.category?.parent?.id) === String(this.filters.category);
          if (!matchesCategory) return false;
        }
        if (this.filters.types?.length && !this.filters.types.includes(item.type)) return false;
        return true;
      });
      if (this.mode === 'wrong') {
        filtered.sort((a, b) => {
          if (this.sort === 'count') {
            return (
              (b.wrongCount || 0) - (a.wrongCount || 0) ||
              String(b.lastWrongAt || '').localeCompare(String(a.lastWrongAt || ''))
            );
          }
          return String(b.lastWrongAt || '').localeCompare(String(a.lastWrongAt || ''));
        });
      } else {
        filtered.sort((a, b) =>
          String(b.favoritedAt || '').localeCompare(String(a.favoritedAt || '')),
        );
      }
      return filtered;
    },
    applyGuestPage() {
      const filtered = this.filteredGuestItems();
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = Math.min(this.page, totalPages);
      this.page = page;
      this.items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      this.pagination = { page, pageSize: PAGE_SIZE, total, totalPages };
    },
    applyFilters(filters) {
      this.filters = { ...filters };
      this.page = 1;
      if (authState.user) this.reload();
      else {
        this.pagination = { ...this.pagination };
        this.applyGuestPage();
        this.loading = false;
      }
    },
    resetFilters() {
      this.applyFilters(emptyFilters());
    },
    changeSort(value) {
      this.sort = value;
      this.page = 1;
      this.reload();
    },
    goPage(page) {
      this.page = page;
      if (authState.user) this.reload();
      else this.applyGuestPage();
      window.scrollTo({ top: 160, behavior: 'smooth' });
    },
    async openQuestion(item) {
      if (this.openingId) return;
      this.openingId = item.id;
      try {
        let ids;
        if (authState.user) {
          const data = await get(`${this.endpoint()}/ids`, {
            category: this.filters.category || undefined,
            types: this.filters.types,
            sort: this.mode === 'wrong' ? this.sort : undefined,
          });
          ids = data.ids || [];
        } else {
          ids = this.filteredGuestItems().map((question) => question.id);
        }
        await openQuestionWithContext(this.$router, item.id, {
          ids,
          source: this.title,
          label: this.title,
        });
      } catch (error) {
        toast.error(getErrorMessage(error, '暂时无法打开题目。'));
      } finally {
        this.openingId = null;
      }
    },
    async toggleFavorite(item) {
      if (this.pendingFavorites.has(item.id)) return;
      const next = !item.isFavorited;
      this.pendingFavorites.add(item.id);
      try {
        if (authState.user) {
          await put(`/me/favorites/${item.id}`, { favorited: next });
          notifyStudyChange();
        } else {
          await setGuestFavorite(item.id, next);
          notifyStudyChange();
        }
        toast.success(next ? '已加入收藏夹。' : '已取消收藏。');
        if (!next && this.mode === 'favorites') {
          this.items = this.items.filter((question) => question.id !== item.id);
          this.guestBaseItems = this.guestBaseItems.filter((question) => question.id !== item.id);
          this.reload();
        } else {
          item.isFavorited = next;
        }
      } catch (error) {
        toast.error(getErrorMessage(error, '收藏状态未能更新。'));
      } finally {
        this.pendingFavorites.delete(item.id);
      }
    },
  },
};
</script>

<style scoped>
.collection-page {
  padding-top: 40px;
}

.guest-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
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

.collection-layout {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}

.filter-column {
  position: sticky;
  top: calc(var(--header-height) + 24px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-column__mobile-head {
  display: none;
}

.collection-tip {
  display: flex;
  gap: 8px;
  padding: 13px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-size: 11px;
  line-height: 1.65;
}

.collection-tip svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.collection-main {
  min-width: 0;
}

.collection-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.collection-toolbar .section-title {
  font-size: 17px;
}

.collection-meta {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.collection-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

.toolbar-select {
  height: 34px;
  padding: 0 30px 0 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background-color: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12px;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m6 9 6 6 6-6' stroke='%23888883' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  appearance: none;
}

.mobile-filter-btn {
  display: none;
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--accent);
  color: var(--accent-foreground);
  font-size: 9.5px;
  line-height: 1;
}

.collection-error {
  margin-bottom: 16px;
  align-items: center;
}

.collection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  transition: opacity var(--transition-fast);
}

.collection-grid.is-loading {
  opacity: 0.55;
  pointer-events: none;
}

.collection-skeleton {
  min-height: 200px;
  padding: 18px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.collection-empty {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.collection-pagination {
  margin-top: 28px;
}

.filter-backdrop {
  display: none;
}

@media (max-width: 1160px) {
  .collection-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .collection-layout {
    grid-template-columns: 1fr;
  }

  .filter-column {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 150;
    width: min(330px, calc(100vw - 40px));
    padding: 14px;
    gap: 12px;
    overflow-y: auto;
    background: var(--bg-page);
    border-right: 1px solid var(--border-default);
    transform: translateX(-102%);
    transition: transform 200ms ease;
  }

  .filter-column.is-open {
    transform: translateX(0);
  }

  .filter-column :deep(.filter-panel) {
    border: 0;
    padding: 0;
  }

  .filter-column__mobile-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 4px 14px;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .filter-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 140;
    background: var(--overlay);
    animation: fade-in 160ms ease;
  }

  .mobile-filter-btn {
    display: inline-flex;
  }

  .collection-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .collection-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .collection-toolbar__actions {
    width: 100%;
    justify-content: space-between;
  }

  .collection-grid {
    grid-template-columns: 1fr;
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
}

@media (max-width: 540px) {
  .sort-control {
    flex: 1;
  }

  .sort-control .toolbar-select {
    flex: 1;
  }
}
</style>
