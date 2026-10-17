<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        role="presentation"
        @mousedown.self="handleOverlay"
      >
        <div
          ref="panel"
          class="modal-panel"
          :class="`modal-panel--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="title || '对话框'"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <header v-if="title || $slots.header" class="modal-header">
            <div class="modal-heading">
              <slot name="header">
                <h2 class="modal-title">{{ title }}</h2>
                <p v-if="description" class="modal-description">{{ description }}</p>
              </slot>
            </div>
            <button class="modal-close" type="button" aria-label="关闭" @click="close">
              <X :size="18" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { X } from 'lucide-vue-next';

export default {
  name: 'ModalDialog',
  components: { X },
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    size: { type: String, default: 'md' },
    closeOnOverlay: { type: Boolean, default: true },
    preventClose: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'close'],
  watch: {
    modelValue: {
      immediate: true,
      handler(value) {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('modal-open', Boolean(value));
        if (value) {
          this.previousActive = document.activeElement;
          this.$nextTick(() => {
            this.$refs.panel?.focus?.();
          });
        } else if (this.previousActive?.focus) {
          this.previousActive.focus();
        }
      },
    },
  },
  beforeUnmount() {
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', this.handleDocumentKeydown);
  },
  mounted() {
    document.addEventListener('keydown', this.handleDocumentKeydown);
  },
  methods: {
    close() {
      if (this.preventClose) return;
      this.$emit('update:modelValue', false);
      this.$emit('close');
    },
    handleOverlay() {
      if (this.closeOnOverlay) this.close();
    },
    handleDocumentKeydown(event) {
      if (event.key === 'Escape' && this.modelValue) this.close();
    },
    onKeydown(event) {
      if (event.key !== 'Tab' || !this.modelValue) return;
      const focusable = this.$refs.panel?.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay);
  backdrop-filter: blur(2px);
}

.modal-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(86vh, 900px);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.modal-panel--sm {
  max-width: 440px;
}

.modal-panel--md {
  max-width: 620px;
}

.modal-panel--lg {
  max-width: 880px;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px 0;
}

.modal-heading {
  min-width: 0;
}

.modal-title {
  font-size: 18px;
  letter-spacing: -0.02em;
}

.modal-description {
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.modal-close:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.modal-body {
  overflow-y: auto;
  padding: 20px 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-default);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 160ms ease;
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 180ms ease, opacity 160ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
}

@media (max-width: 600px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .modal-panel {
    max-height: 92vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    border-bottom: 0;
  }

  .modal-header {
    padding: 20px 20px 0;
  }

  .modal-body {
    padding: 18px 20px;
  }

  .modal-footer {
    padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  }
}
</style>
