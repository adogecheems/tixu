<template>
  <div class="admin-page">
    <header class="admin-page-header">
      <div>
        <p class="admin-eyebrow">Taxonomy</p>
        <h1>标签管理</h1>
        <p class="admin-page-header__description">标签跨分类关联知识点。题库筛选多个标签时，题目需要同时包含所有标签。</p>
      </div>
      <div class="admin-page-header__actions">
        <button class="btn btn--primary btn--sm" type="button" @click="openCreate">
          <Plus :size="14" />
          新建标签
        </button>
      </div>
    </header>

    <div class="tags-toolbar">
      <div class="tags-search">
        <Search :size="14" />
        <input v-model="search" type="search" placeholder="搜索标签…" aria-label="搜索标签" />
        <button v-if="search" type="button" aria-label="清空搜索" @click="search = ''">
          <X :size="13" />
        </button>
      </div>
      <span class="tags-count">共 <strong>{{ filteredTags.length }}</strong> 个标签</span>
    </div>

    <div v-if="error" class="alert alert--danger tags-error" role="alert">
      <AlertCircle :size="16" class="alert__icon" />
      <span>{{ error }}</span>
      <button class="link-button" type="button" @click="loadTags">重试</button>
    </div>

    <div class="tags-card">
      <div v-if="loading" class="tags-loading">
        <div v-for="index in 7" :key="index" class="tags-skeleton-row">
          <span class="skeleton" style="width: 110px; height: 22px" />
          <span class="skeleton" style="width: 50px; height: 12px" />
          <span class="skeleton" style="width: 110px; height: 12px" />
        </div>
      </div>
      <table v-else-if="filteredTags.length" class="data-table tags-table">
        <thead>
          <tr>
            <th>标签</th>
            <th>题目引用</th>
            <th>草稿引用</th>
            <th>总引用</th>
            <th class="actions-head">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tag in filteredTags" :key="tag.id">
            <td>
              <div class="tag-name-cell">
                <span class="tag-hash">#</span>
                <div>
                  <strong>{{ tag.name }}</strong>
                  <span>ID {{ tag.id }}</span>
                </div>
              </div>
            </td>
            <td><span class="usage-value">{{ tag.publishedUsage }}</span></td>
            <td><span class="usage-value">{{ tag.draftUsage }}</span></td>
            <td>
              <span class="usage-total" :class="{ 'is-unused': !tag.usageCount }">
                {{ tag.usageCount || '未使用' }}
              </span>
            </td>
            <td>
              <div class="tag-actions">
                <button class="text-action" type="button" @click="openRename(tag)">重命名</button>
                <button
                  class="text-action"
                  type="button"
                  :disabled="tags.length < 2"
                  @click="openMerge(tag)"
                >
                  合并
                </button>
                <button
                  class="text-action text-action--danger"
                  type="button"
                  :disabled="tag.usageCount > 0"
                  :title="tag.usageCount > 0 ? '标签仍在使用中，不能删除' : '删除未使用标签'"
                  @click="requestDelete(tag)"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="!loading" class="tags-empty">
        <EmptyState
          :title="search ? '没有找到标签' : '还没有标签'"
          :description="search ? '试试更短的关键词。' : '标签用于跨分类关联知识点，可以随时重命名或合并。'"
        >
          <template #icon><Tags :size="23" :stroke-width="1.7" /></template>
          <template #actions>
            <button v-if="search" class="btn btn--secondary btn--sm" type="button" @click="search = ''">清除搜索</button>
            <button v-else class="btn btn--primary btn--sm" type="button" @click="openCreate">新建标签</button>
          </template>
        </EmptyState>
      </div>
    </div>

    <ModalDialog
      v-model="formOpen"
      :title="editingId ? '重命名标签' : '新建标签'"
      :description="editingId ? '改名后，题目上的标签关联会保留。' : '标签名称在系统中不区分大小写。'"
      size="sm"
    >
      <form class="tag-form" @submit.prevent="saveTag">
        <label class="field">
          <span class="field__label">标签名称</span>
          <input
            ref="nameInput"
            v-model="form.name"
            class="input"
            type="text"
            maxlength="40"
            placeholder="例如：易错题"
          />
        </label>
        <p v-if="formError" class="field__error">{{ formError }}</p>
      </form>
      <template #footer>
        <button class="btn btn--secondary" type="button" :disabled="saving" @click="formOpen = false">取消</button>
        <button class="btn btn--primary" type="button" :disabled="saving" @click="saveTag">
          <LoaderCircle v-if="saving" :size="14" class="btn__spinner" />
          {{ editingId ? '保存修改' : '创建标签' }}
        </button>
      </template>
    </ModalDialog>

    <ModalDialog
      v-model="mergeOpen"
      title="合并标签"
      description="合并后，源标签会被删除，所有题目与草稿引用会转移到目标标签。此操作不可撤销。"
      size="sm"
    >
      <div class="merge-form">
        <div class="merge-source">
          <span class="merge-label">源标签</span>
          <span class="chip chip--static">#{{ mergeSource?.name }}</span>
        </div>
        <label class="field">
          <span class="field__label">合并到</span>
          <select v-model="mergeTargetId" class="select">
            <option value="">选择目标标签</option>
            <option v-for="tag in mergeTargets" :key="tag.id" :value="tag.id">#{{ tag.name }}</option>
          </select>
        </label>
        <div class="merge-warning">
          <AlertTriangle :size="14" />
          <span>源标签的所有引用会被合并，源标签随后被永久删除。</span>
        </div>
        <p v-if="mergeError" class="field__error">{{ mergeError }}</p>
      </div>
      <template #footer>
        <button class="btn btn--secondary" type="button" :disabled="merging" @click="mergeOpen = false">取消</button>
        <button class="btn btn--danger" type="button" :disabled="!mergeTargetId || merging" @click="confirmMerge">
          <LoaderCircle v-if="merging" :size="14" class="btn__spinner" />
          合并标签
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      v-model="deleteOpen"
      title="删除标签"
      description="这个标签没有任何题目或草稿引用，可以安全删除。删除后不可恢复。"
      confirm-text="删除标签"
      tone="danger"
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script>
import {
  AlertCircle,
  AlertTriangle,
  LoaderCircle,
  Plus,
  Search,
  Tags,
  X,
} from 'lucide-vue-next';
import EmptyState from '@/components/EmptyState.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { get, post, put, del, getErrorMessage } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';

export default {
  name: 'AdminTagsView',
  components: {
    AlertCircle,
    AlertTriangle,
    ConfirmDialog,
    EmptyState,
    LoaderCircle,
    ModalDialog,
    Plus,
    Search,
    Tags,
    X,
  },
  data() {
    return {
      loading: true,
      error: '',
      tags: [],
      search: '',
      formOpen: false,
      editingId: null,
      form: { name: '' },
      formError: '',
      saving: false,
      mergeOpen: false,
      mergeSource: null,
      mergeTargetId: '',
      mergeError: '',
      merging: false,
      deleteOpen: false,
      deleteTarget: null,
      deleting: false,
    };
  },
  computed: {
    filteredTags() {
      const keyword = this.search.trim().toLowerCase();
      if (!keyword) return this.tags;
      return this.tags.filter((tag) => tag.name.toLowerCase().includes(keyword));
    },
    mergeTargets() {
      return this.tags.filter((tag) => String(tag.id) !== String(this.mergeSource?.id));
    },
  },
  created() {
    this.loadTags();
  },
  methods: {
    async loadTags() {
      this.loading = true;
      this.error = '';
      try {
        const data = await get('/admin/tags');
        this.tags = data.tags || [];
      } catch (error) {
        this.error = getErrorMessage(error, '标签加载失败。');
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      this.editingId = null;
      this.form = { name: '' };
      this.formError = '';
      this.formOpen = true;
      this.$nextTick(() => this.$refs.nameInput?.focus());
    },
    openRename(tag) {
      this.editingId = String(tag.id);
      this.form = { name: tag.name };
      this.formError = '';
      this.formOpen = true;
      this.$nextTick(() => this.$refs.nameInput?.focus());
    },
    async saveTag() {
      const name = this.form.name.trim();
      if (!name || name.length > 40) {
        this.formError = '标签名称需为 1–40 个字符。';
        return;
      }
      this.saving = true;
      this.formError = '';
      try {
        if (this.editingId) {
          await put(`/admin/tags/${this.editingId}`, { name });
          toast.success('标签已更新。');
        } else {
          await post('/admin/tags', { name });
          toast.success('标签已创建。');
        }
        this.formOpen = false;
        await this.loadTags();
      } catch (error) {
        this.formError = getErrorMessage(error, '标签保存失败。');
      } finally {
        this.saving = false;
      }
    },
    openMerge(tag) {
      this.mergeSource = tag;
      this.mergeTargetId = '';
      this.mergeError = '';
      this.mergeOpen = true;
    },
    async confirmMerge() {
      if (!this.mergeSource || !this.mergeTargetId) return;
      this.merging = true;
      this.mergeError = '';
      try {
        await post(`/admin/tags/${this.mergeSource.id}/merge`, {
          targetId: this.mergeTargetId,
        });
        toast.success('标签已合并。');
        this.mergeOpen = false;
        await this.loadTags();
      } catch (error) {
        this.mergeError = getErrorMessage(error, '标签合并失败。');
      } finally {
        this.merging = false;
      }
    },
    requestDelete(tag) {
      if (tag.usageCount > 0) return;
      this.deleteTarget = tag;
      this.deleteOpen = true;
    },
    async confirmDelete() {
      if (!this.deleteTarget) return;
      this.deleting = true;
      try {
        await del(`/admin/tags/${this.deleteTarget.id}`);
        toast.success('标签已删除。');
        this.deleteOpen = false;
        await this.loadTags();
      } catch (error) {
        toast.error(getErrorMessage(error, '标签删除失败。'));
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>

<style scoped>
.admin-page {
  max-width: 1120px;
  margin: 0 auto;
}

.admin-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
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
  max-width: 660px;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.65;
}

.admin-page-header__actions {
  flex-shrink: 0;
}

.tags-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  padding: 9px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.tags-search {
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

.tags-search svg {
  position: absolute;
  left: 9px;
  pointer-events: none;
}

.tags-search input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
}

.tags-search input::placeholder {
  color: var(--text-tertiary);
}

.tags-search input::-webkit-search-cancel-button {
  display: none;
}

.tags-search button {
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

.tags-search button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tags-count {
  margin-left: auto;
  padding-right: 4px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.tags-count strong {
  color: var(--text-secondary);
  font-weight: 600;
}

.tags-error {
  margin-bottom: 12px;
  align-items: center;
}

.tags-card {
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.tags-table {
  min-width: 760px;
}

.tags-table th {
  padding: 10px 16px;
  background: var(--bg-subtle);
  font-size: 11.5px;
}

.tags-table td {
  padding: 13px 16px;
}

.tag-name-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}

.tag-hash {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: 11px;
}

.tag-name-cell strong {
  display: block;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 550;
}

.tag-name-cell span:last-child {
  display: block;
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.usage-value {
  color: var(--text-secondary);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.usage-total {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 7px;
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.usage-total.is-unused {
  background: transparent;
  color: var(--text-tertiary);
}

.actions-head {
  text-align: right !important;
}

.tag-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.text-action {
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.text-action:hover:not(:disabled) {
  color: var(--text-primary);
}

.text-action:disabled {
  opacity: 0.3;
}

.text-action--danger {
  color: var(--danger);
}

.text-action--danger:hover:not(:disabled) {
  color: var(--danger);
}

.tags-loading {
  border: 0;
}

.tags-skeleton-row {
  display: flex;
  gap: 70px;
  padding: 17px 16px;
  border-bottom: 1px solid var(--border-default);
}

.tags-skeleton-row:last-child {
  border-bottom: 0;
}

.tags-empty {
  border: 0;
}

.tag-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.merge-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.merge-source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.merge-label {
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.merge-warning {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 10px 11px;
  border-radius: 7px;
  background: var(--warning-bg);
  color: var(--warning);
  font-size: 10.5px;
  line-height: 1.6;
}

.merge-warning svg {
  flex-shrink: 0;
  margin-top: 1px;
}

@media (max-width: 760px) {
  .admin-page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .tags-card {
    overflow-x: auto;
  }

  .tags-table {
    min-width: 720px;
  }

  .tags-count {
    display: none;
  }
}
</style>
