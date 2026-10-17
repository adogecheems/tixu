<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <slot name="icon">
        <FileQuestion :size="24" :stroke-width="1.7" />
      </slot>
    </div>
    <h3 class="empty-state__title">{{ title }}</h3>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <div v-if="$slots.actions" class="empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script>
import { FileQuestion } from 'lucide-vue-next';

export default {
  name: 'EmptyState',
  components: { FileQuestion },
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
  },
};
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 58px 24px;
  text-align: center;
}

.empty-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.empty-state__title {
  font-size: 16px;
  letter-spacing: -0.01em;
}

.empty-state__description {
  max-width: 420px;
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}
</style>
