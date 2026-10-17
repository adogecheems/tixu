<template>
  <aside class="filter-panel">
    <div class="filter-panel__header">
      <div class="filter-panel__heading">
        <SlidersHorizontal :size="15" />
        <span>筛选</span>
      </div>
      <button v-if="hasFilters" class="filter-clear" type="button" @click="clearAll">重置</button>
    </div>

    <section class="filter-section">
      <h3 class="filter-section__title">分类</h3>
      <div class="category-list">
        <button
          class="category-item"
          :class="{ 'is-active': !local.category }"
          type="button"
          @click="setCategory('')"
        >
          <span>全部分类</span>
        </button>
        <div v-for="root in categories" :key="root.id" class="category-group">
          <button
            class="category-item category-item--root"
            :class="{ 'is-active': local.category === root.id }"
            type="button"
            @click="setCategory(root.id)"
          >
            <span>{{ root.name }}</span>
            <span class="category-count">{{ root.questionCount }}</span>
          </button>
          <div v-if="root.children?.length" class="category-children">
            <button
              v-for="child in root.children"
              :key="child.id"
              class="category-item category-item--child"
              :class="{ 'is-active': local.category === child.id }"
              type="button"
              @click="setCategory(child.id)"
            >
              <span>{{ child.name }}</span>
              <span class="category-count">{{ child.questionCount }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="filter-section">
      <h3 class="filter-section__title">题型</h3>
      <div class="check-list">
        <label v-for="item in typeOptions" :key="item.value" class="check-row">
          <span class="custom-checkbox" :class="{ 'is-checked': local.types.includes(item.value) }">
            <Check v-if="local.types.includes(item.value)" :size="12" :stroke-width="2.4" />
          </span>
          <input
            class="sr-only"
            type="checkbox"
            :checked="local.types.includes(item.value)"
            @change="toggleType(item.value)"
          />
          <span>{{ item.label }}</span>
        </label>
      </div>
    </section>

    <section v-if="showDifficulty" class="filter-section">
      <h3 class="filter-section__title">难度</h3>
      <div class="segmented-list">
        <button
          v-for="item in difficultyOptions"
          :key="item.value"
          class="segmented-item"
          :class="{ 'is-active': local.difficulty === item.value }"
          type="button"
          @click="setDifficulty(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section v-if="showTags && tags.length" class="filter-section">
      <div class="filter-section__title-row">
        <h3 class="filter-section__title">标签</h3>
        <span class="filter-hint">需同时包含</span>
      </div>
      <div class="tag-filter">
        <button
          v-for="tag in tags"
          :key="tag.id"
          class="chip"
          :class="{ 'is-active': local.tags.includes(tag.id) }"
          type="button"
          @click="toggleTag(tag.id)"
        >
          {{ tag.name }}
        </button>
      </div>
    </section>
  </aside>
</template>

<script>
import { Check, SlidersHorizontal } from 'lucide-vue-next';

const emptyFilters = () => ({
  category: '',
  types: [],
  difficulty: '',
  tags: [],
});

export default {
  name: 'FilterPanel',
  components: { Check, SlidersHorizontal },
  props: {
    categories: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
    modelValue: { type: Object, default: () => emptyFilters() },
    showDifficulty: { type: Boolean, default: true },
    showTags: { type: Boolean, default: true },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      typeOptions: [
        { value: 'single', label: '单选题' },
        { value: 'multiple', label: '多选题' },
        { value: 'truefalse', label: '判断题' },
        { value: 'fill', label: '填空题' },
        { value: 'essay', label: '简答题' },
      ],
      difficultyOptions: [
        { value: '', label: '全部' },
        { value: 'easy', label: '简单' },
        { value: 'medium', label: '中等' },
        { value: 'hard', label: '困难' },
      ],
    };
  },
  computed: {
    local() {
      return {
        ...emptyFilters(),
        ...(this.modelValue || {}),
        types: this.modelValue?.types || [],
        tags: this.modelValue?.tags || [],
      };
    },
    hasFilters() {
      return Boolean(this.local.category || this.local.types.length || this.local.difficulty || this.local.tags.length);
    },
  },
  methods: {
    emit(patch) {
      this.$emit('update:modelValue', { ...this.local, ...patch });
    },
    setCategory(id) {
      this.emit({ category: id });
    },
    toggleType(value) {
      const types = new Set(this.local.types);
      if (types.has(value)) types.delete(value);
      else types.add(value);
      this.emit({ types: [...types] });
    },
    setDifficulty(value) {
      this.emit({ difficulty: value });
    },
    toggleTag(id) {
      const tags = new Set(this.local.tags);
      if (tags.has(id)) tags.delete(id);
      else tags.add(id);
      this.emit({ tags: [...tags] });
    },
    clearAll() {
      this.$emit('update:modelValue', emptyFilters());
    },
  },
};
</script>

<style scoped>
.filter-panel {
  padding: 18px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.filter-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-default);
}

.filter-panel__heading {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.filter-clear {
  color: var(--text-tertiary);
  font-size: 11.5px;
  transition: color var(--transition-fast);
}

.filter-clear:hover {
  color: var(--text-primary);
}

.filter-section {
  padding-top: 16px;
}

.filter-section + .filter-section {
  margin-top: 16px;
  border-top: 1px solid var(--border-default);
}

.filter-section__title {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.filter-section__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.filter-hint {
  color: var(--text-tertiary);
  font-size: 10px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 9px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 5px 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12.5px;
  text-align: left;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.category-item:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.category-item.is-active {
  color: var(--text-primary);
  background: var(--bg-subtle);
  font-weight: 560;
}

.category-item--child {
  padding-left: 18px;
  font-size: 12px;
}

.category-count {
  color: var(--text-tertiary);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.category-children {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 8px;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 8px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 31px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.check-row:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.custom-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  color: var(--accent-foreground);
  background: var(--bg-surface);
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.custom-checkbox.is-checked {
  background: var(--accent);
  border-color: var(--accent);
}

.segmented-list {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 9px;
  padding: 3px;
  border-radius: 8px;
  background: var(--bg-subtle);
}

.segmented-item {
  flex: 1;
  min-width: 44px;
  height: 27px;
  padding: 0 7px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 11.5px;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.segmented-item.is-active {
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-xs);
  font-weight: 560;
}

.tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
}

.tag-filter .chip {
  height: 25px;
  font-size: 11px;
  padding: 0 8px;
}
</style>
