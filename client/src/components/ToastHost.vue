<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="item in toastState.items"
          :key="item.id"
          class="toast"
          :class="`toast--${item.tone}`"
        >
          <component :is="iconFor(item.tone)" :size="16" class="toast__icon" />
          <span class="toast__message">{{ item.message }}</span>
          <button class="toast__close" type="button" aria-label="关闭提示" @click="toast.dismiss(item.id)">
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script>
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-vue-next';
import { toast, toastState } from '@/stores/toast.js';

export default {
  name: 'ToastHost',
  components: { AlertTriangle, CheckCircle2, Info, X, XCircle },
  data() {
    return { toastState, toast };
  },
  methods: {
    iconFor(tone) {
      if (tone === 'success') return CheckCircle2;
      if (tone === 'danger') return XCircle;
      if (tone === 'warning') return AlertTriangle;
      return Info;
    },
  },
};
</script>

<style scoped>
.toast-stack {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 300;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, calc(100vw - 32px));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.55;
  pointer-events: auto;
}

.toast__icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--text-secondary);
}

.toast--success .toast__icon {
  color: var(--success);
}

.toast--danger .toast__icon {
  color: var(--danger);
}

.toast--warning .toast__icon {
  color: var(--warning);
}

.toast__message {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.toast__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 6px;
  color: var(--text-tertiary);
}

.toast__close:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 600px) {
  .toast-stack {
    right: 16px;
    bottom: 16px;
  }
}
</style>
