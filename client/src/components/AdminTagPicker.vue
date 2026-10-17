<template>
  <div
    ref="root"
    class="tag-combobox"
    :class="{ 'is-open': open, 'is-disabled': disabled, 'is-creating': creating }"
  >
    <div v-if="selectedTags.length" class="tag-combobox__selected" aria-label="已选标签">
      <span v-for="tag in selectedTags" :key="tag.id" class="tag-pill">
        <span class="tag-pill__hash">#</span>
        <span class="tag-pill__name">{{ tag.name }}</span>
        <button
          v-if="!disabled"
          class="tag-pill__remove"
          type="button"
          :aria-label="`移除标签 ${tag.name}`"
          @click="removeTag(tag)"
        >
          <X :size="11" />
        </button>
      </span>
    </div>

    <div class="tag-control" :class="{ 'is-open': open, 'is-creating': creating }">
      <Search :size="14" class="tag-control__icon" />
      <input
        ref="searchInput"
        v-model="query"
        class="tag-control__input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="question-tag-options"
        :aria-expanded="open"
        :disabled="disabled || creating"
        :placeholder="searchPlaceholder"
        maxlength="40"
        autocomplete="off"
        @focus="openDropdown"
        @click="openDropdown"
        @input="handleInput"
        @keydown="handleSearchKeydown"
      />
      <button
        v-if="query && !disabled && !creating"
        class="tag-control__clear"
        type="button"
        aria-label="清空标签搜索"
        @click="clearQuery"
      >
        <X :size="13" />
      </button>
      <ChevronDown v-else :size="14" class="tag-control__chevron" />
    </div>

    <Transition name="tag-drop">
      <div v-if="open" class="tag-dropdown">
        <div v-if="creating" class="tag-create">
          <div class="tag-create__head">
            <div>
              <strong>新建标签</strong>
              <span>创建后会立即添加到本题</span>
            </div>
            <button class="link-button tag-create__back" type="button" @click="cancelCreate">
              <ArrowLeft :size="12" />
              返回
            </button>
          </div>

          <div class="tag-create__row">
            <div class="tag-create__input-wrap">
              <span>#</span>
              <input
                ref="newTagInput"
                v-model="newTagName"
                class="tag-create__input"
                type="text"
                maxlength="40"
                placeholder="输入标签名称"
                :disabled="creatingSaving"
                @keydown.enter.prevent="submitCreate"
                @keydown.esc.prevent.stop="cancelCreate"
              />
            </div>
            <button
              class="btn btn--primary btn--sm"
              type="button"
              :disabled="creatingSaving || !newTagName.trim()"
              @click="submitCreate"
            >
              <LoaderCircle v-if="creatingSaving" :size="13" class="btn__spinner" />
              {{ creatingSaving ? '创建中…' : '创建并添加' }}
            </button>
          </div>

          <p v-if="createError" class="tag-create__error" role="alert">{{ createError }}</p>
          <p v-else class="tag-create__hint">名称长度为 1–40 个字符，同名标签会自动复用。</p>
        </div>

        <template v-else>
          <div v-if="filteredTags.length" id="question-tag-options" class="tag-options" role="listbox">
            <button
              v-for="(tag, index) in filteredTags"
              :key="tag.id"
              class="tag-option"
              :class="{ 'is-active': activeIndex === index }"
              type="button"
              role="option"
              aria-selected="false"
              @mouseenter="activeIndex = index"
              @click="selectTag(tag)"
            >
              <span class="tag-option__name"><span>#</span>{{ tag.name }}</span>
              <span class="tag-option__usage">{{ usageLabel(tag) }}</span>
            </button>
          </div>

          <p v-else class="tag-dropdown__empty">{{ emptyText }}</p>

          <button
            v-if="showCreateOption"
            class="tag-create-option"
            :class="{ 'is-active': activeIndex === filteredTags.length }"
            type="button"
            @mouseenter="activeIndex = filteredTags.length"
            @click="beginCreate"
          >
            <span class="tag-create-option__icon"><Plus :size="14" /></span>
            <span class="tag-create-option__copy">
              <strong>
                新建标签
                <template v-if="trimmedQuery">「{{ trimmedQuery }}」</template>
              </strong>
              <small>创建后自动选中并用于本题</small>
            </span>
            <ArrowUpRight :size="13" class="tag-create-option__arrow" />
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script>
import { ArrowLeft, ArrowUpRight, ChevronDown, LoaderCircle, Plus, Search, X } from 'lucide-vue-next';
import { post, getErrorMessage } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

export default {
  name: 'AdminTagPicker',
  components: {
    ArrowLeft,
    ArrowUpRight,
    ChevronDown,
    LoaderCircle,
    Plus,
    Search,
    X,
  },
  props: {
    modelValue: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'created'],
  data() {
    return {
      query: '',
      open: false,
      creating: false,
      newTagName: '',
      creatingSaving: false,
      createError: '',
      activeIndex: -1,
    };
  },
  computed: {
    selectedIds() {
      return new Set(this.modelValue.map((id) => String(id)));
    },
    selectedTags() {
      const byId = new Map(this.tags.map((tag) => [String(tag.id), tag]));
      return this.modelValue.map((id) => byId.get(String(id))).filter(Boolean);
    },
    normalizedQuery() {
      return normalized(this.query);
    },
    trimmedQuery() {
      return this.query.trim();
    },
    availableTags() {
      return this.tags.filter((tag) => !this.selectedIds.has(String(tag.id)));
    },
    filteredTags() {
      if (!this.normalizedQuery) return this.availableTags;
      return this.availableTags.filter((tag) =>
        normalized(tag.name).includes(this.normalizedQuery),
      );
    },
    exactTag() {
      if (!this.normalizedQuery) return null;
      return this.tags.find((tag) => normalized(tag.name) === this.normalizedQuery) || null;
    },
    showCreateOption() {
      return (
        !this.disabled &&
        !this.creating &&
        !this.exactTag &&
        (Boolean(this.normalizedQuery) || this.tags.length === 0)
      );
    },
    searchPlaceholder() {
      return this.tags.length ? '搜索已有标签，或输入新名称' : '输入名称，新建第一个标签';
    },
    emptyText() {
      if (!this.tags.length) return '还没有标签，输入名称或直接新建。';
      if (this.normalizedQuery) {
        if (this.exactTag && this.selectedIds.has(String(this.exactTag.id))) {
          return '该标签已添加，可继续搜索其他标签。';
        }
        return '没有匹配的已有标签。';
      }
      if (!this.availableTags.length) return '全部标签都已添加。';
      return '没有可添加的标签。';
    },
  },
  watch: {
    disabled(value) {
      if (!value) return;
      this.open = false;
      this.creating = false;
      this.createError = '';
    },
  },
  mounted() {
    document.addEventListener('pointerdown', this.handleOutside);
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.handleOutside);
  },
  methods: {
    usageLabel(tag) {
      return tag.usageCount ? `已用 ${tag.usageCount}` : '未使用';
    },
    openDropdown() {
      if (this.disabled || this.creating) return;
      this.open = true;
      this.$nextTick(() => {
        if (this.activeIndex >= this.filteredTags.length + (this.showCreateOption ? 1 : 0)) {
          this.activeIndex = -1;
        }
      });
    },
    closeDropdown() {
      this.open = false;
      this.activeIndex = -1;
      if (this.creating) this.resetCreate();
    },
    handleOutside(event) {
      if (!this.open) return;
      if (this.$refs.root?.contains(event.target)) return;
      this.closeDropdown();
    },
    handleInput() {
      if (this.disabled) return;
      this.open = true;
      this.activeIndex = -1;
      this.createError = '';
    },
    handleSearchKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeDropdown();
        this.$refs.searchInput?.blur();
        return;
      }
      if (event.key === 'Tab') {
        this.closeDropdown();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const total = this.filteredTags.length + (this.showCreateOption ? 1 : 0);
        if (!total) return;
        this.open = true;
        if (this.activeIndex < 0) {
          this.activeIndex = event.key === 'ArrowDown' ? 0 : total - 1;
        } else {
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          this.activeIndex = (this.activeIndex + delta + total) % total;
        }
        return;
      }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!this.open) {
        this.openDropdown();
        return;
      }
      if (this.activeIndex >= 0 && this.activeIndex < this.filteredTags.length) {
        this.selectTag(this.filteredTags[this.activeIndex]);
        return;
      }
      if (this.activeIndex === this.filteredTags.length && this.showCreateOption) {
        this.beginCreate();
        return;
      }
      if (this.filteredTags.length === 1) {
        this.selectTag(this.filteredTags[0]);
        return;
      }
      if (!this.filteredTags.length && this.showCreateOption) this.beginCreate();
    },
    clearQuery() {
      this.query = '';
      this.activeIndex = -1;
      this.open = true;
      this.$nextTick(() => this.$refs.searchInput?.focus());
    },
    selectTag(tag) {
      if (this.disabled || this.selectedIds.has(String(tag.id))) return;
      this.$emit('update:modelValue', [...this.modelValue, String(tag.id)]);
      this.query = '';
      this.activeIndex = -1;
      this.open = true;
      this.$nextTick(() => this.$refs.searchInput?.focus());
    },
    removeTag(tag) {
      if (this.disabled) return;
      this.$emit(
        'update:modelValue',
        this.modelValue.filter((id) => String(id) !== String(tag.id)),
      );
    },
    beginCreate() {
      if (this.disabled) return;
      this.creating = true;
      this.createError = '';
      this.newTagName = this.query.trim();
      this.activeIndex = -1;
      this.open = true;
      this.$nextTick(() => {
        this.$refs.newTagInput?.focus();
        this.$refs.newTagInput?.select();
      });
    },
    resetCreate() {
      this.creating = false;
      this.newTagName = '';
      this.createError = '';
    },
    cancelCreate() {
      this.resetCreate();
      this.open = true;
      this.$nextTick(() => this.$refs.searchInput?.focus());
    },
    async submitCreate() {
      if (this.disabled || this.creatingSaving) return;
      const name = this.newTagName.trim();
      if (!name) {
        this.createError = '请输入标签名称。';
        this.$refs.newTagInput?.focus();
        return;
      }
      if (name.length > 40) {
        this.createError = '标签名称不能超过 40 个字符。';
        return;
      }

      const existing = this.tags.find((tag) => normalized(tag.name) === normalized(name));
      if (existing) {
        this.selectTag(existing);
        this.resetCreate();
        this.open = false;
        return;
      }

      this.creatingSaving = true;
      this.createError = '';
      try {
        const data = await post('/admin/tags', { name });
        const tag = {
          id: String(data.id),
          name: data.name,
          publishedUsage: 0,
          draftUsage: 0,
          usageCount: 0,
        };
        this.$emit('created', tag);
        this.$emit('update:modelValue', [...this.modelValue, tag.id]);
        this.query = '';
        this.resetCreate();
        this.open = false;
        toast.success(`已创建并添加标签 #${tag.name}`);
      } catch (error) {
        this.createError = getErrorMessage(error, '新建标签失败，请稍后再试。');
      } finally {
        this.creatingSaving = false;
      }
    },
  },
};
</script>

<style scoped>
.tag-combobox {
  position: relative;
  min-width: 0;
}

.tag-combobox.is-open {
  z-index: 40;
}

.tag-combobox__selected {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 8px;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 26px;
  padding: 0 4px 0 9px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 10.5px;
}

.tag-pill__hash {
  margin-right: 1px;
  color: var(--text-tertiary);
}

.tag-pill__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-pill__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 19px;
  height: 19px;
  margin-left: 3px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  color: var(--text-tertiary);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.tag-pill__remove:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tag-control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.tag-control:hover {
  border-color: var(--border-strong);
}

.tag-control.is-open {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.tag-combobox.is-disabled .tag-control {
  opacity: 0.7;
  background: var(--bg-subtle);
}

.tag-control__icon,
.tag-control__chevron {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.tag-control__input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.tag-control__input::placeholder {
  color: var(--text-tertiary);
}

.tag-control__input:disabled {
  cursor: not-allowed;
}

.tag-control__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  color: var(--text-tertiary);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.tag-control__clear:hover {
  color: var(--text-primary);
  background: var(--bg-subtle);
}

.tag-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 60;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
}

.tag-options {
  max-height: 218px;
  padding: 5px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tag-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: 34px;
  padding: 0 9px;
  border-radius: 6px;
  color: var(--text-secondary);
  text-align: left;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.tag-option.is-active,
.tag-option:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.tag-option__name {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-option__name > span {
  margin-right: 2px;
  color: var(--text-tertiary);
}

.tag-option__usage {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.tag-dropdown__empty {
  padding: 18px 12px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
}

.tag-create-option {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px 11px;
  border-top: 1px solid var(--border-default);
  text-align: left;
  transition: background var(--transition-fast);
}

.tag-create-option.is-active,
.tag-create-option:hover {
  background: var(--bg-subtle);
}

.tag-create-option__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.tag-create-option__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.tag-create-option__copy strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-create-option__copy small {
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.tag-create-option__arrow {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.tag-create {
  padding: 12px;
}

.tag-create__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tag-create__head strong {
  display: block;
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 580;
}

.tag-create__head span {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.tag-create__back {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.tag-create__back:hover {
  color: var(--text-primary);
}

.tag-create__row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
}

.tag-create__input-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  flex: 1;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.tag-create__input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.tag-create__input-wrap > span {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 11px;
}

.tag-create__input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 11.5px;
}

.tag-create__input::placeholder {
  color: var(--text-tertiary);
}

.tag-create__error {
  margin-top: 8px;
  color: var(--danger);
  font-size: 10px;
  line-height: 1.5;
}

.tag-create__hint {
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 9.5px;
  line-height: 1.5;
}

.tag-drop-enter-active,
.tag-drop-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
  transform-origin: top;
}

.tag-drop-enter-from,
.tag-drop-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (max-width: 640px) {
  .tag-create__row {
    align-items: stretch;
    flex-direction: column;
  }

  .tag-create__row .btn {
    width: 100%;
  }
}
</style>
