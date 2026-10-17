<template>
  <nav v-if="totalPages > 1" class="pagination" aria-label="分页">
    <button
      class="pagination__arrow"
      type="button"
      :disabled="page <= 1"
      aria-label="上一页"
      @click="go(page - 1)"
    >
      <ChevronLeft :size="16" />
    </button>
    <div class="pagination__pages">
      <button
        v-for="item in pageItems"
        :key="item.key"
        class="pagination__page"
        :class="{ 'is-current': item.page === page }"
        type="button"
        :disabled="item.ellipsis"
        :aria-current="item.page === page ? 'page' : undefined"
        @click="!item.ellipsis && go(item.page)"
      >
        {{ item.ellipsis ? '…' : item.page }}
      </button>
    </div>
    <span class="pagination__mobile-label">{{ page }} / {{ totalPages }}</span>
    <button
      class="pagination__arrow"
      type="button"
      :disabled="page >= totalPages"
      aria-label="下一页"
      @click="go(page + 1)"
    >
      <ChevronRight :size="16" />
    </button>
  </nav>
</template>

<script>
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

export default {
  name: 'PaginationBar',
  components: { ChevronLeft, ChevronRight },
  props: {
    page: { type: Number, default: 1 },
    totalPages: { type: Number, default: 1 },
  },
  emits: ['update:page'],
  computed: {
    pageItems() {
      const total = this.totalPages;
      const current = this.page;
      if (total <= 7) {
        return Array.from({ length: total }, (_, index) => ({
          key: index + 1,
          page: index + 1,
          ellipsis: false,
        }));
      }
      const items = [{ key: 1, page: 1, ellipsis: false }];
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      if (start > 2) items.push({ key: 'start-ellipsis', page: null, ellipsis: true });
      for (let value = start; value <= end; value += 1) {
        items.push({ key: value, page: value, ellipsis: false });
      }
      if (end < total - 1) items.push({ key: 'end-ellipsis', page: null, ellipsis: true });
      items.push({ key: total, page: total, ellipsis: false });
      return items;
    },
  },
  methods: {
    go(page) {
      if (page < 1 || page > this.totalPages || page === this.page) return;
      this.$emit('update:page', page);
    },
  },
};
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.pagination__pages {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination__arrow,
.pagination__page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  min-width: 34px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.pagination__arrow {
  border-color: var(--border-default);
  background: var(--bg-surface);
}

.pagination__arrow:hover:not(:disabled),
.pagination__page:hover:not(:disabled):not(.is-current) {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.pagination__arrow:disabled,
.pagination__page:disabled {
  opacity: 0.4;
}

.pagination__page.is-current {
  background: var(--accent);
  color: var(--accent-foreground);
  font-weight: 600;
}

.pagination__mobile-label {
  display: none;
  color: var(--text-secondary);
  font-size: 13px;
}

@media (max-width: 640px) {
  .pagination__pages {
    display: none;
  }

  .pagination__mobile-label {
    display: inline;
  }
}
</style>
