<template>
  <div class="admin-page">
    <header class="admin-page-header">
      <div>
        <p class="admin-eyebrow">Questions</p>
        <h1>题目管理</h1>
        <p class="admin-page-header__description">创建、编辑、发布与归档题目。已发布内容不会因为保存草稿而改变。</p>
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

    <section class="question-filter-bar">
      <div class="status-tabs" role="tablist" aria-label="按状态筛选">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          class="status-tab"
          :class="{ 'is-active': status === tab.value && !pendingOnly }"
          type="button"
          role="tab"
          :aria-selected="status === tab.value && !pendingOnly"
          @click="setStatus(tab.value)"
        >
          {{ tab.label }}
        </button>
        <span class="status-tabs__divider" />
        <button
          class="status-tab status-tab--pending"
          :class="{ 'is-active': pendingOnly }"
          type="button"
          @click="togglePending"
        >
          <Clock3 :size="12" />
          待发布修改
        </button>
      </div>

      <div class="filter-row">
        <form class="admin-search" role="search" @submit.prevent="submitSearch">
          <Search :size="14" />
          <input v-model="searchInput" type="search" placeholder="搜索题目…" aria-label="搜索题目" />
          <button v-if="searchInput" type="button" aria-label="清空搜索" @click="clearSearch">
            <X :size="13" />
          </button>
        </form>

        <select v-model="type" class="admin-select" aria-label="按题型筛选" @change="applyFilters">
          <option value="">全部题型</option>
          <option value="single">单选题</option>
          <option value="multiple">多选题</option>
          <option value="truefalse">判断题</option>
          <option value="fill">填空题</option>
          <option value="essay">简答题</option>
        </select>

        <span class="filter-result">
          共 <strong>{{ pagination.total }}</strong> 道
        </span>
      </div>
    </section>

    <div v-if="selectedCount" class="batch-bar">
      <span class="batch-bar__count">已选择 <strong>{{ selectedCount }}</strong> 道题目</span>
      <div class="batch-bar__actions">
        <button class="btn btn--secondary btn--sm" type="button" @click="requestBatch('batch-publish')">
          <Send :size="13" />
          批量发布
        </button>
        <button class="btn btn--secondary btn--sm" type="button" @click="requestBatch('batch-archive')">
          <Archive :size="13" />
          批量归档
        </button>
        <button class="btn btn--ghost btn--sm" type="button" @click="clearSelection">取消选择</button>
      </div>
    </div>

    <div v-if="error" class="alert alert--danger table-error" role="alert">
      <AlertCircle :size="16" class="alert__icon" />
      <span>{{ error }}</span>
      <button class="link-button" type="button" @click="loadQuestions">重试</button>
    </div>

    <div class="question-table-card">
      <div v-if="loading && !items.length" class="table-loading">
        <div v-for="index in 7" :key="index" class="table-skeleton-row">
          <span class="skeleton" style="width: 14px; height: 14px" />
          <span class="skeleton" style="width: 36%; height: 14px" />
          <span class="skeleton" style="width: 80px; height: 12px" />
          <span class="skeleton" style="width: 60px; height: 20px" />
          <span class="skeleton" style="width: 80px; height: 12px" />
        </div>
      </div>
      <div v-else-if="items.length" class="table-scroll">
        <table class="data-table question-table">
          <thead>
            <tr>
              <th class="checkbox-cell">
                <input
                  type="checkbox"
                  class="table-checkbox"
                  :checked="allPageSelected"
                  aria-label="选择当前页全部题目"
                  @change="togglePageSelection"
                />
              </th>
              <th>题目</th>
              <th>分类 / 题型</th>
              <th>难度</th>
              <th>状态</th>
              <th>更新时间</th>
              <th class="actions-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" :class="{ 'is-selected': selectedIds.has(item.id) }">
              <td class="checkbox-cell">
                <input
                  type="checkbox"
                  class="table-checkbox"
                  :checked="selectedIds.has(item.id)"
                  :aria-label="`选择题目 ${item.title}`"
                  @change="toggleSelection(item.id)"
                />
              </td>
              <td class="question-cell">
                <button class="table-question-title" type="button" @click="editQuestion(item)">
                  {{ item.title }}
                </button>
                <p class="table-question-summary">{{ item.summary || '暂无内容摘要' }}</p>
                <div class="table-question-meta">
                  <span class="mono">#{{ item.id }}</span>
                  <span v-if="item.currentVersionNo">v{{ item.currentVersionNo }}</span>
                </div>
              </td>
              <td>
                <span class="table-category">{{ item.category ? categoryPath(item.category) : '未分类' }}</span>
                <span class="table-type">{{ typeLabel(item.type) }}</span>
              </td>
              <td>
                <span class="difficulty-label" :class="`is-${item.difficulty}`">
                  <span class="difficulty-dot" />
                  {{ difficultyLabel(item.difficulty) }}
                </span>
              </td>
              <td>
                <div class="status-cell">
                  <span class="badge" :class="statusBadgeClass(item)">
                    {{ statusText(item) }}
                  </span>
                  <span v-if="item.hasPendingDraft && item.status === 'published'" class="pending-note">
                    <span /> 待发布修改
                  </span>
                </div>
              </td>
              <td>
                <span class="table-date">{{ formatDate(item.updatedAt) }}</span>
                <span class="table-time">{{ formatTime(item.updatedAt) }}</span>
              </td>
              <td class="actions-cell">
                <div class="row-actions">
                  <button class="table-icon-button" type="button" title="编辑" aria-label="编辑" @click="editQuestion(item)">
                    <PenLine :size="14" />
                  </button>
                  <a
                    v-if="item.status === 'published'"
                    class="table-icon-button"
                    :href="`/questions/${item.id}`"
                    target="_blank"
                    rel="noopener"
                    title="在前台查看"
                    aria-label="在前台查看"
                  >
                    <ExternalLink :size="14" />
                  </a>
                  <button
                    class="table-icon-button"
                    type="button"
                    title="复制为新草稿"
                    aria-label="复制为新草稿"
                    @click="duplicateQuestion(item)"
                  >
                    <Copy :size="14" />
                  </button>
                  <button
                    v-if="item.status === 'published'"
                    class="table-icon-button"
                    type="button"
                    title="归档"
                    aria-label="归档"
                    @click="requestRow('archive', item)"
                  >
                    <Archive :size="14" />
                  </button>
                  <button
                    v-if="item.status === 'archived'"
                    class="table-icon-button"
                    type="button"
                    title="恢复公开"
                    aria-label="恢复公开"
                    @click="requestRow('restore', item)"
                  >
                    <RotateCcw :size="14" />
                  </button>
                  <button
                    v-if="item.status === 'draft'"
                    class="table-icon-button table-icon-button--danger"
                    type="button"
                    title="删除草稿"
                    aria-label="删除草稿"
                    @click="requestRow('delete', item)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="table-empty">
        <EmptyState
          :title="hasFilters ? '没有符合条件的题目' : '还没有创建题目'"
          :description="hasFilters ? '试试调整状态、题型或搜索关键词。' : '新建一道题目，或通过 JSON / ZIP 批量导入。'"
        >
          <template #icon><ListChecks :size="23" :stroke-width="1.7" /></template>
          <template #actions>
            <button v-if="hasFilters" class="btn btn--secondary btn--sm" type="button" @click="resetFilters">
              清除筛选
            </button>
            <RouterLink class="btn btn--primary btn--sm" :to="{ name: 'admin-question-new' }">新建题目</RouterLink>
          </template>
        </EmptyState>
      </div>

      <div v-if="pagination.totalPages > 1" class="table-pagination">
        <PaginationBar :page="pagination.page" :total-pages="pagination.totalPages" @update:page="goPage" />
      </div>
    </div>

    <ConfirmDialog
      v-model="confirm.open"
      :title="confirm.title"
      :description="confirm.description"
      :confirm-text="confirm.confirmText"
      :tone="confirm.tone"
      :loading="confirm.loading"
      @confirm="executeConfirmed"
    />

    <ModalDialog
      v-model="batchErrorOpen"
      title="本批次没有执行"
      description="任意题目未通过校验时，整批操作都不会生效。"
      size="md"
    >
      <div v-if="batchErrors.length" class="batch-errors">
        <div v-for="failure in batchErrors" :key="failure.key" class="batch-error-item">
          <strong>{{ failure.title }}</strong>
          <ul>
            <li v-for="message in failure.messages" :key="message">{{ message }}</li>
          </ul>
        </div>
      </div>
      <p v-else class="batch-error-fallback">操作未能执行，请刷新后重试。</p>
      <template #footer>
        <button class="btn btn--secondary" type="button" @click="batchErrorOpen = false">关闭</button>
        <button class="btn btn--primary" type="button" @click="reloadAfterBatchError">刷新列表</button>
      </template>
    </ModalDialog>
  </div>
</template>

<script>
import {
  AlertCircle,
  Archive,
  Clock3,
  Copy,
  ExternalLink,
  ListChecks,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-vue-next';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import PaginationBar from '@/components/PaginationBar.vue';
import EmptyState from '@/components/EmptyState.vue';
import { get, post, del, getErrorMessage } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';
import {
  categoryPath,
  difficultyLabel,
  formatDate,
  formatTime,
  typeLabel,
} from '@/lib/format.js';

const PAGE_SIZE = 20;
const allowedStatuses = new Set(['', 'draft', 'published', 'archived']);

export default {
  name: 'AdminQuestionsView',
  components: {
    AlertCircle,
    Archive,
    Clock3,
    ConfirmDialog,
    Copy,
    EmptyState,
    ExternalLink,
    ListChecks,
    ModalDialog,
    PaginationBar,
    PenLine,
    Plus,
    RotateCcw,
    Search,
    Send,
    Trash2,
    UploadCloud,
    X,
  },
  data() {
    return {
      statusTabs: [
        { value: '', label: '全部' },
        { value: 'published', label: '已发布' },
        { value: 'draft', label: '草稿' },
        { value: 'archived', label: '已归档' },
      ],
      status: '',
      pendingOnly: false,
      type: '',
      searchInput: '',
      searchQuery: '',
      page: 1,
      items: [],
      pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 },
      loading: true,
      error: '',
      selectedIds: new Set(),
      confirm: {
        open: false,
        title: '',
        description: '',
        confirmText: '确认',
        tone: 'default',
        loading: false,
        kind: '',
        ids: [],
      },
      batchErrorOpen: false,
      batchErrors: [],
      requestToken: 0,
    };
  },
  computed: {
    selectedCount() {
      return this.selectedIds.size;
    },
    allPageSelected() {
      return this.items.length > 0 && this.items.every((item) => this.selectedIds.has(item.id));
    },
    hasFilters() {
      return Boolean(this.status || this.pendingOnly || this.type || this.searchQuery);
    },
  },
  created() {
    const query = this.$route.query || {};
    this.status = allowedStatuses.has(String(query.status || '')) ? String(query.status || '') : '';
    this.pendingOnly = query.pending === '1';
    if (query.type) this.type = String(query.type);
    this.loadQuestions();
  },
  methods: {
    categoryPath,
    difficultyLabel,
    formatDate,
    formatTime,
    typeLabel,
    statusText(item) {
      if (item.status === 'draft') return '草稿';
      if (item.status === 'archived') return '已归档';
      return '已发布';
    },
    statusBadgeClass(item) {
      if (item.status === 'published') return 'badge--success';
      if (item.status === 'archived') return 'badge--subtle';
      return '';
    },
    setStatus(value) {
      this.status = value;
      this.pendingOnly = false;
      this.page = 1;
      this.loadQuestions();
    },
    togglePending() {
      this.pendingOnly = !this.pendingOnly;
      if (this.pendingOnly) this.status = 'published';
      this.page = 1;
      this.loadQuestions();
    },
    submitSearch() {
      this.searchQuery = this.searchInput.trim();
      this.page = 1;
      this.loadQuestions();
    },
    clearSearch() {
      this.searchInput = '';
      this.searchQuery = '';
      this.page = 1;
      this.loadQuestions();
    },
    applyFilters() {
      this.page = 1;
      this.loadQuestions();
    },
    resetFilters() {
      this.status = '';
      this.pendingOnly = false;
      this.type = '';
      this.searchInput = '';
      this.searchQuery = '';
      this.page = 1;
      this.loadQuestions();
    },
    goPage(page) {
      this.page = page;
      this.loadQuestions();
    },
    async loadQuestions() {
      const token = ++this.requestToken;
      this.loading = true;
      this.error = '';
      try {
        const data = await get('/admin/questions', {
          page: this.page,
          pageSize: PAGE_SIZE,
          status: this.status || undefined,
          pending: this.pendingOnly ? '1' : undefined,
          type: this.type || undefined,
          q: this.searchQuery || undefined,
        });
        if (token !== this.requestToken) return;
        this.items = data.items || [];
        this.pagination = data.pagination;
        this.selectedIds = new Set([...this.selectedIds].filter((id) => this.items.some((item) => item.id === id)));
      } catch (error) {
        if (token !== this.requestToken) return;
        this.error = getErrorMessage(error, '题目列表加载失败。');
        this.items = [];
      } finally {
        if (token === this.requestToken) this.loading = false;
      }
    },
    toggleSelection(id) {
      if (this.selectedIds.has(id)) this.selectedIds.delete(id);
      else this.selectedIds.add(id);
    },
    togglePageSelection() {
      if (this.allPageSelected) {
        for (const item of this.items) this.selectedIds.delete(item.id);
      } else {
        for (const item of this.items) this.selectedIds.add(item.id);
      }
    },
    clearSelection() {
      this.selectedIds = new Set();
    },
    editQuestion(item) {
      this.$router.push({ name: 'admin-question-edit', params: { id: item.id } });
    },
    requestBatch(kind) {
      const ids = [...this.selectedIds];
      if (!ids.length) return;
      if (kind === 'batch-publish') {
        this.confirm = {
          open: true,
          title: '批量发布题目',
          description: `将校验全部 ${ids.length} 道题目并统一发布。任意一道未通过校验，整批都不会执行。发布成功后前台会立即可见。`,
          confirmText: '校验并发布',
          tone: 'default',
          loading: false,
          kind,
          ids,
        };
      } else {
        this.confirm = {
          open: true,
          title: '批量归档题目',
          description: `将归档 ${ids.length} 道题目。题目会立即从公开题库移除，但版本历史与作答记录会保留。只有已发布题目可以归档。`,
          confirmText: '归档所选题目',
          tone: 'danger',
          loading: false,
          kind,
          ids,
        };
      }
    },
    requestRow(kind, item) {
      const descriptions = {
        archive: '归档后，这道题会立即从公开题库移除。历史版本与作答记录会保留，可以随时恢复公开。',
        restore: '恢复公开后，这道题会重新出现在前台题库中，并保留原有版本与历史作答。',
        delete: '这道题从未发布且没有历史引用，将被永久删除。此操作不可撤销。',
      };
      const titles = {
        archive: '归档这道题',
        restore: '恢复公开',
        delete: '删除题目草稿',
      };
      this.confirm = {
        open: true,
        title: titles[kind],
        description: descriptions[kind],
        confirmText: kind === 'delete' ? '永久删除' : kind === 'restore' ? '恢复公开' : '归档题目',
        tone: kind === 'archive' || kind === 'delete' ? 'danger' : 'default',
        loading: false,
        kind,
        ids: [item.id],
      };
    },
    async executeConfirmed() {
      if (this.confirm.loading) return;
      const { kind, ids } = this.confirm;
      this.confirm.loading = true;
      try {
        if (kind === 'batch-publish') {
          await post('/admin/questions/batch-publish', { ids });
          toast.success(`已发布 ${ids.length} 道题目。`);
        } else if (kind === 'batch-archive') {
          await post('/admin/questions/batch-archive', { ids });
          toast.success(`已归档 ${ids.length} 道题目。`);
        } else if (kind === 'archive') {
          await post(`/admin/questions/${ids[0]}/archive`, {});
          toast.success('题目已归档。');
        } else if (kind === 'restore') {
          await post(`/admin/questions/${ids[0]}/restore`, {});
          toast.success('题目已恢复公开。');
        } else if (kind === 'delete') {
          await del(`/admin/questions/${ids[0]}`);
          toast.success('题目草稿已删除。');
        }
        this.confirm.open = false;
        this.selectedIds = new Set();
        await this.loadQuestions();
      } catch (error) {
        this.confirm.open = false;
        if (String(error?.code || '').startsWith('BATCH_')) {
          this.showBatchErrors(error);
        } else {
          toast.error(getErrorMessage(error, '操作未能完成。'));
        }
      } finally {
        this.confirm.loading = false;
      }
    },
    showBatchErrors(error) {
      const details = Array.isArray(error.details) ? error.details : [];
      this.batchErrors = details.map((item, index) => ({
        key: `${item.questionId || index}-${index}`,
        title: item.title || (item.questionId ? `题目 #${item.questionId}` : `第 ${index + 1} 项`),
        messages:
          Array.isArray(item.errors) && item.errors.length
            ? item.errors.map((detail) => detail.message || String(detail))
            : [item.message || '未通过校验。'],
      }));
      this.batchErrorOpen = true;
    },
    reloadAfterBatchError() {
      this.batchErrorOpen = false;
      this.selectedIds = new Set();
      this.loadQuestions();
    },
    async duplicateQuestion(item) {
      try {
        const data = await post(`/admin/questions/${item.id}/duplicate`, {});
        toast.success('已复制为新的题目草稿。');
        this.$router.push({ name: 'admin-question-edit', params: { id: data.questionId } });
      } catch (error) {
        toast.error(getErrorMessage(error, '复制题目失败。'));
      }
    },
  },
};
</script>

<style scoped>
.admin-page {
  max-width: 1320px;
  margin: 0 auto;
}

.admin-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
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

.question-filter-bar {
  margin-bottom: 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.status-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 7px 9px;
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
}

.status-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12.5px;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.status-tab:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.status-tab.is-active {
  background: var(--accent);
  color: var(--accent-foreground);
  font-weight: 550;
}

.status-tab--pending {
  color: var(--warning);
}

.status-tab--pending.is-active {
  background: var(--warning-bg);
  color: var(--warning);
}

.status-tabs__divider {
  width: 1px;
  height: 16px;
  margin: 0 5px;
  background: var(--border-default);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px;
}

.admin-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 360px;
  height: 32px;
  padding: 0 28px 0 30px;
  border-radius: 7px;
  background: var(--bg-subtle);
  color: var(--text-tertiary);
}

.admin-search svg {
  position: absolute;
  left: 9px;
  pointer-events: none;
}

.admin-search input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
}

.admin-search input::placeholder {
  color: var(--text-tertiary);
}

.admin-search input::-webkit-search-cancel-button {
  display: none;
}

.admin-search button {
  position: absolute;
  right: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--text-tertiary);
}

.admin-search button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.admin-select {
  height: 32px;
  padding: 0 28px 0 9px;
  border: 1px solid var(--border-default);
  border-radius: 7px;
  background-color: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m6 9 6 6 6-6' stroke='%23888883' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
}

.filter-result {
  margin-left: auto;
  padding-right: 4px;
  color: var(--text-tertiary);
  font-size: 11.5px;
  white-space: nowrap;
}

.filter-result strong {
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  padding: 8px 10px 8px 14px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.batch-bar__count {
  color: var(--text-secondary);
  font-size: 12px;
}

.batch-bar__count strong {
  color: var(--text-primary);
  font-weight: 600;
}

.batch-bar__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.table-error {
  margin-bottom: 10px;
  align-items: center;
}

.question-table-card {
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.table-scroll {
  overflow-x: auto;
}

.question-table {
  min-width: 950px;
}

.question-table th {
  padding: 10px 12px;
  font-size: 11.5px;
  background: var(--bg-subtle);
}

.question-table td {
  padding: 12px;
}

.question-table tbody tr.is-selected {
  background: color-mix(in srgb, var(--bg-subtle) 72%, transparent);
}

.checkbox-cell {
  width: 42px;
  padding-right: 2px !important;
  text-align: center;
}

.table-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
  cursor: pointer;
}

.actions-cell {
  width: 160px;
  text-align: right !important;
}

.question-cell {
  max-width: 330px;
}

.table-question-title {
  display: block;
  overflow: hidden;
  max-width: 100%;
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.45;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-question-title:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.table-question-summary {
  overflow: hidden;
  max-width: 310px;
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 11.5px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-question-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 4px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.table-category {
  display: block;
  overflow: hidden;
  max-width: 180px;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-type {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.difficulty-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 11.5px;
  white-space: nowrap;
}

.difficulty-dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--text-tertiary);
}

.difficulty-label.is-easy .difficulty-dot {
  background: var(--success);
}

.difficulty-label.is-medium .difficulty-dot {
  background: var(--warning);
}

.difficulty-label.is-hard .difficulty-dot {
  background: var(--danger);
}

.status-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.pending-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--warning);
  font-size: 10px;
  line-height: 1.4;
}

.pending-note span {
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--warning);
}

.table-date {
  display: block;
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.table-time {
  display: block;
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10px;
  white-space: nowrap;
}

.question-table td {
  padding: 13px 12px;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1px;
}

.table-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  color: var(--text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.table-icon-button:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.table-icon-button--danger:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

.table-loading {
  padding: 0;
}

.table-skeleton-row {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 18px;
  border-bottom: 1px solid var(--border-default);
}

.table-skeleton-row:last-child {
  border-bottom: 0;
}

.table-pagination {
  padding: 14px;
  border-top: 1px solid var(--border-default);
}

.table-empty {
  border: 0;
}

.batch-errors {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
}

.batch-error-item {
  padding: 11px 13px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.batch-error-item strong {
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 550;
}

.batch-error-item ul {
  margin-top: 4px;
  padding-left: 16px;
  color: var(--text-secondary);
  font-size: 10.5px;
  line-height: 1.65;
}

.batch-error-fallback {
  color: var(--text-secondary);
  font-size: 12px;
}

@media (max-width: 700px) {
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

  .filter-row {
    flex-wrap: wrap;
  }

  .admin-search {
    flex-basis: 100%;
    max-width: none;
  }

  .filter-result {
    margin-left: 0;
  }

  .batch-bar {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .batch-bar__actions {
    width: 100%;
  }
}
</style>
