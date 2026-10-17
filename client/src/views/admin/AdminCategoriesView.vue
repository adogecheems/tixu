<template>
  <div class="admin-page">
    <header class="admin-page-header">
      <div>
        <p class="admin-eyebrow">Taxonomy</p>
        <h1>分类管理</h1>
        <p class="admin-page-header__description">维护最多两级的题目分类。一级分类会包含其下所有二级分类的题目。</p>
      </div>
      <div class="admin-page-header__actions">
        <button class="btn btn--primary btn--sm" type="button" @click="openCreate()">
          <Plus :size="14" />
          新建分类
        </button>
      </div>
    </header>

    <div class="category-notice">
      <Info :size="14" />
      <span>每道题只能归属一个分类。删除分类前，需要先确保它没有子分类，也没有被任何题目或历史版本引用。</span>
    </div>

    <div v-if="error" class="alert alert--danger category-error" role="alert">
      <AlertCircle :size="16" class="alert__icon" />
      <span>{{ error }}</span>
      <button class="link-button" type="button" @click="loadCategories">重试</button>
    </div>

    <div class="category-card">
      <div v-if="loading" class="category-loading">
        <div v-for="index in 5" :key="index" class="category-skeleton-row">
          <span class="skeleton" style="width: 160px; height: 14px" />
          <span class="skeleton" style="width: 90px; height: 12px" />
          <span class="skeleton" style="width: 80px; height: 12px" />
        </div>
      </div>

      <table v-else-if="categories.length" class="data-table category-table">
        <thead>
          <tr>
            <th>分类</th>
            <th>题目总数</th>
            <th>已发布</th>
            <th>排序权重</th>
            <th class="actions-head">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="root in categories" :key="root.id">
            <tr class="root-row">
              <td>
                <div class="category-name-cell">
                  <span class="category-folder"><Folder :size="15" /></span>
                  <div>
                    <strong>{{ root.name }}</strong>
                    <span>一级分类 · ID {{ root.id }}</span>
                  </div>
                </div>
              </td>
              <td><span class="count-value">{{ root.totalCount }}</span></td>
              <td><span class="count-value">{{ root.publishedTotal }}</span></td>
              <td><span class="sort-value mono">{{ root.sortOrder }}</span></td>
              <td>
                <div class="category-actions">
                  <button class="text-action" type="button" @click="openCreate(root)">
                    <Plus :size="12" />
                    子分类
                  </button>
                  <button class="text-action" type="button" @click="openRename(root)">重命名</button>
                  <button class="text-action text-action--danger" type="button" @click="requestDelete(root)">
                    删除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-for="child in root.children" :key="child.id" class="child-row">
              <td>
                <div class="category-name-cell category-name-cell--child">
                  <span class="child-line"><CornerDownRight :size="14" /></span>
                  <div>
                    <strong>{{ child.name }}</strong>
                    <span>二级分类 · ID {{ child.id }}</span>
                  </div>
                </div>
              </td>
              <td><span class="count-value">{{ child.directCount }}</span></td>
              <td><span class="count-value">{{ child.publishedCount }}</span></td>
              <td><span class="sort-value mono">{{ child.sortOrder }}</span></td>
              <td>
                <div class="category-actions">
                  <button class="text-action" type="button" @click="openRename(child, root)">重命名</button>
                  <button class="text-action text-action--danger" type="button" @click="requestDelete(child, root)">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div v-else-if="!loading" class="category-empty">
        <EmptyState
          title="还没有创建分类"
          description="先创建一级分类，再按需要添加二级分类。题目发布前必须选择一个分类。"
        >
          <template #icon><FolderTree :size="23" :stroke-width="1.7" /></template>
          <template #actions>
            <button class="btn btn--primary btn--sm" type="button" @click="openCreate()">新建分类</button>
          </template>
        </EmptyState>
      </div>
    </div>

    <ModalDialog
      v-model="formOpen"
      :title="editingId ? '重命名分类' : parentForForm ? '新建子分类' : '新建分类'"
      :description="editingId ? '分类重命名后，现有题目会保持不变。' : '分类最多支持两级。创建后可以在题目编辑器中使用。'"
      size="sm"
    >
      <form class="category-form" @submit.prevent="saveCategory">
        <label class="field">
          <span class="field__label">分类名称</span>
          <input
            ref="nameInput"
            v-model="form.name"
            class="input"
            type="text"
            maxlength="40"
            placeholder="例如：线性代数"
          />
        </label>
        <label v-if="!editingId" class="field">
          <span class="field__label">父级分类</span>
          <select v-model="form.parentId" class="select" :disabled="Boolean(parentForForm)">
            <option value="">无 · 创建一级分类</option>
            <option v-for="root in categories" :key="root.id" :value="root.id">
              {{ root.name }}
            </option>
          </select>
          <span class="field__hint">选择父级分类时，将创建二级分类。</span>
        </label>
        <label class="field">
          <span class="field__label">
            排序权重
            <span class="field__label-hint">数字越小越靠前</span>
          </span>
          <input v-model.number="form.sortOrder" class="input" type="number" min="-9999" max="9999" />
        </label>
        <p v-if="formError" class="field__error">{{ formError }}</p>
      </form>
      <template #footer>
        <button class="btn btn--secondary" type="button" :disabled="saving" @click="formOpen = false">取消</button>
        <button class="btn btn--primary" type="button" :disabled="saving" @click="saveCategory">
          <LoaderCircle v-if="saving" :size="14" class="btn__spinner" />
          {{ editingId ? '保存修改' : '创建分类' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      v-model="deleteOpen"
      title="删除分类"
      :description="deleteDescription"
      confirm-text="删除分类"
      tone="danger"
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script>
import {
  AlertCircle,
  CornerDownRight,
  Folder,
  FolderTree,
  Info,
  LoaderCircle,
  Plus,
} from 'lucide-vue-next';
import EmptyState from '@/components/EmptyState.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { get, post, put, del, getErrorMessage } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';

export default {
  name: 'AdminCategoriesView',
  components: {
    AlertCircle,
    ConfirmDialog,
    CornerDownRight,
    EmptyState,
    Folder,
    FolderTree,
    Info,
    LoaderCircle,
    ModalDialog,
    Plus,
  },
  data() {
    return {
      loading: true,
      error: '',
      categories: [],
      formOpen: false,
      editingId: null,
      parentForForm: null,
      form: { name: '', parentId: '', sortOrder: 0 },
      formError: '',
      saving: false,
      deleteOpen: false,
      deleteTarget: null,
      deleteParent: null,
      deleting: false,
    };
  },
  computed: {
    deleteDescription() {
      if (!this.deleteTarget) return '';
      const usage =
        Number(this.deleteTarget.totalCount || this.deleteTarget.directCount || 0) +
        (this.deleteTarget.children?.length || 0);
      if (usage > 0) {
        return `分类「${this.deleteTarget.name}」仍包含子分类或关联题目，删除将被阻止。请先处理这些引用。`;
      }
      return `将永久删除分类「${this.deleteTarget.name}」。此操作不可撤销，但只有未被任何题目或历史版本引用的分类才会被删除。`;
    },
  },
  created() {
    this.loadCategories();
  },
  methods: {
    async loadCategories() {
      this.loading = true;
      this.error = '';
      try {
        const data = await get('/admin/categories');
        this.categories = data.categories || [];
      } catch (error) {
        this.error = getErrorMessage(error, '分类加载失败。');
      } finally {
        this.loading = false;
      }
    },
    openCreate(parent = null) {
      this.editingId = null;
      this.parentForForm = parent;
      this.form = {
        name: '',
        parentId: parent ? String(parent.id) : '',
        sortOrder: 0,
      };
      this.formError = '';
      this.formOpen = true;
      this.$nextTick(() => this.$refs.nameInput?.focus());
    },
    openRename(category, parent = null) {
      this.editingId = String(category.id);
      this.parentForForm = parent;
      this.form = {
        name: category.name,
        parentId: parent ? String(parent.id) : '',
        sortOrder: category.sortOrder ?? 0,
      };
      this.formError = '';
      this.formOpen = true;
      this.$nextTick(() => this.$refs.nameInput?.focus());
    },
    async saveCategory() {
      const name = this.form.name.trim();
      if (!name || name.length > 40) {
        this.formError = '分类名称需为 1–40 个字符。';
        return;
      }
      this.saving = true;
      this.formError = '';
      try {
        if (this.editingId) {
          await put(`/admin/categories/${this.editingId}`, {
            name,
            sortOrder: this.form.sortOrder,
          });
          toast.success('分类已更新。');
        } else {
          await post('/admin/categories', {
            name,
            parentId: this.form.parentId || null,
            sortOrder: this.form.sortOrder,
          });
          toast.success('分类已创建。');
        }
        this.formOpen = false;
        await this.loadCategories();
      } catch (error) {
        this.formError = getErrorMessage(error, '分类保存失败。');
      } finally {
        this.saving = false;
      }
    },
    requestDelete(category, parent = null) {
      this.deleteTarget = category;
      this.deleteParent = parent;
      this.deleteOpen = true;
    },
    async confirmDelete() {
      if (!this.deleteTarget) return;
      this.deleting = true;
      try {
        await del(`/admin/categories/${this.deleteTarget.id}`);
        toast.success('分类已删除。');
        this.deleteOpen = false;
        await this.loadCategories();
      } catch (error) {
        toast.error(getErrorMessage(error, '分类删除失败。'));
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
  max-width: 620px;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.65;
}

.admin-page-header__actions {
  flex-shrink: 0;
}

.category-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 13px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-tertiary);
  font-size: 11.5px;
  line-height: 1.65;
}

.category-notice svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.category-error {
  margin-bottom: 12px;
  align-items: center;
}

.category-card {
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.category-table {
  min-width: 720px;
}

.category-table th {
  padding: 10px 16px;
  background: var(--bg-subtle);
  font-size: 11.5px;
}

.category-table td {
  padding: 13px 16px;
}

.root-row {
  background: var(--bg-surface);
}

.root-row td {
  border-top: 1px solid var(--border-default);
}

.root-row:first-child td {
  border-top: 0;
}

.child-row {
  background: color-mix(in srgb, var(--bg-subtle) 42%, transparent);
}

.child-row td {
  border-top: 1px solid color-mix(in srgb, var(--border-default) 65%, transparent);
}

.category-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-folder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  border-radius: 7px;
  color: var(--text-secondary);
  background: var(--bg-subtle);
}

.category-name-cell strong {
  display: block;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 550;
}

.category-name-cell span:not(.category-folder):not(.child-line) {
  display: block;
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.category-name-cell--child {
  padding-left: 22px;
}

.child-line {
  color: var(--border-strong);
}

.count-value {
  color: var(--text-secondary);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.sort-value {
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.actions-head {
  text-align: right !important;
}

.category-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.text-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.text-action:hover {
  color: var(--text-primary);
}

.text-action--danger {
  color: var(--danger);
  opacity: 0.85;
}

.text-action--danger:hover {
  color: var(--danger);
  opacity: 1;
}

.category-loading {
  border: 0;
}

.category-skeleton-row {
  display: flex;
  gap: 50px;
  padding: 19px 16px;
  border-bottom: 1px solid var(--border-default);
}

.category-skeleton-row:last-child {
  border-bottom: 0;
}

.category-empty {
  border: 0;
}

.category-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

@media (max-width: 700px) {
  .admin-page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .category-table {
    min-width: 680px;
  }

  .category-card {
    overflow-x: auto;
  }
}
</style>
