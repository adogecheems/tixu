<template>
  <ModalDialog
    :model-value="modelValue"
    :title="title"
    size="sm"
    :close-on-overlay="!loading"
    :prevent-close="loading"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="confirm-content">
      <div class="confirm-icon" :class="`confirm-icon--${tone}`">
        <component :is="icon" :size="20" :stroke-width="1.8" />
      </div>
      <div>
        <p v-if="description" class="confirm-description">{{ description }}</p>
        <slot />
      </div>
    </div>
    <template #footer>
      <button class="btn btn--secondary" type="button" :disabled="loading" @click="cancel">
        {{ cancelText }}
      </button>
      <button
        class="btn"
        :class="tone === 'danger' ? 'btn--danger' : 'btn--primary'"
        type="button"
        :disabled="loading"
        @click="$emit('confirm')"
      >
        <LoaderCircle v-if="loading" :size="15" class="btn__spinner" />
        {{ loading ? loadingText : confirmText }}
      </button>
    </template>
  </ModalDialog>
</template>

<script>
import { AlertTriangle, LoaderCircle, ShieldQuestion } from 'lucide-vue-next';
import ModalDialog from './ModalDialog.vue';

export default {
  name: 'ConfirmDialog',
  components: { ModalDialog, AlertTriangle, LoaderCircle, ShieldQuestion },
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '确认操作' },
    description: { type: String, default: '' },
    confirmText: { type: String, default: '确认' },
    cancelText: { type: String, default: '取消' },
    loadingText: { type: String, default: '处理中…' },
    loading: { type: Boolean, default: false },
    tone: { type: String, default: 'default' },
  },
  emits: ['update:modelValue', 'confirm'],
  computed: {
    icon() {
      return this.tone === 'danger' ? AlertTriangle : ShieldQuestion;
    },
  },
  methods: {
    cancel() {
      if (this.loading) return;
      this.$emit('update:modelValue', false);
    },
  },
};
</script>

<style scoped>
.confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.confirm-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.confirm-icon--danger {
  background: var(--danger-bg);
  color: var(--danger);
}

.confirm-icon--warning {
  background: var(--warning-bg);
  color: var(--warning);
}

.confirm-description {
  color: var(--text-secondary);
  line-height: 1.7;
  padding-top: 2px;
}
</style>
