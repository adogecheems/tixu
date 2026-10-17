<template>
  <ModalDialog
    :model-value="modelValue"
    title="发现登录前的学习记录"
    description="登录前的作答与收藏还在当前浏览器中。要现在合并到账户吗？"
    :prevent-close="merging"
    :close-on-overlay="!merging"
    size="md"
    @update:model-value="close"
  >
    <div v-if="loadingCounts" class="merge-loading">
      <span class="skeleton" style="width: 60%; height: 42px" />
      <span class="skeleton" style="width: 100%; height: 76px; margin-top: 14px" />
    </div>
    <template v-else>
      <div class="merge-summary">
        <div class="merge-stat">
          <span class="merge-stat__label">作答记录</span>
          <strong>{{ counts.attempts }}</strong>
          <span>条</span>
        </div>
        <div class="merge-stat">
          <span class="merge-stat__label">收藏题目</span>
          <strong>{{ counts.favorites }}</strong>
          <span>道</span>
        </div>
      </div>

      <div class="merge-note">
        <Info :size="16" class="merge-note__icon" />
        <div>
          <p>合并后会同步作答、错题与收藏，账户已有的收藏不会被覆盖。</p>
          <p class="merge-note__muted">未提交的草稿不会上传；合并失败时，记录会保留。</p>
        </div>
      </div>

      <div v-if="errorMessage" class="alert alert--danger" role="alert">
        <AlertCircle :size="16" class="alert__icon" />
        <span>{{ errorMessage }}</span>
      </div>

      <p v-if="!counts.total" class="merge-empty">当前没有可合并的学习记录。</p>
    </template>

    <template #footer>
      <button class="btn btn--secondary" type="button" :disabled="merging" @click="close">
        暂不合并
      </button>
      <button
        class="btn btn--primary"
        type="button"
        :disabled="merging || loadingCounts || !counts.total"
        @click="merge"
      >
        <LoaderCircle v-if="merging" :size="15" class="btn__spinner" />
        {{ merging ? '正在合并…' : `合并到 ${username}` }}
      </button>
    </template>
  </ModalDialog>
</template>

<script>
import { AlertCircle, Info, LoaderCircle } from 'lucide-vue-next';
import ModalDialog from './ModalDialog.vue';
import {
  clearGuestLearningData,
  getGuestDataCount,
  getGuestMergeData,
} from '@/lib/guestDb.js';
import { post, getErrorMessage } from '@/lib/api.js';
import { authState } from '@/stores/auth.js';
import { toast } from '@/stores/toast.js';
import { notifyStudyChange } from '@/stores/study.js';

export default {
  name: 'MergeDialog',
  components: { AlertCircle, Info, LoaderCircle, ModalDialog },
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'merged'],
  data() {
    return {
      loadingCounts: false,
      merging: false,
      counts: { attempts: 0, favorites: 0, total: 0 },
      errorMessage: '',
    };
  },
  computed: {
    username() {
      return authState.user?.username || '当前账户';
    },
  },
  watch: {
    modelValue(value) {
      if (value) this.loadCounts();
    },
  },
  methods: {
    async loadCounts() {
      this.loadingCounts = true;
      this.errorMessage = '';
      try {
        this.counts = await getGuestDataCount();
      } finally {
        this.loadingCounts = false;
      }
    },
    close() {
      if (this.merging) return;
      this.$emit('update:modelValue', false);
    },
    async merge() {
      if (this.merging || !authState.user) return;
      this.merging = true;
      this.errorMessage = '';
      try {
        const payload = await getGuestMergeData();
        const result = await post('/auth/merge', payload);
        await clearGuestLearningData();
        notifyStudyChange();
        toast.success(
          `已合并 ${result.attemptsImported} 条作答与 ${result.favoritesAdded} 道收藏${
            result.attemptsUnverified ? `，其中 ${result.attemptsUnverified} 条记录未验证` : ''
          }。`,
          6000,
        );
        this.$emit('merged', result);
        this.$emit('update:modelValue', false);
      } catch (error) {
        this.errorMessage = getErrorMessage(error, '合并失败，记录已保留。');
      } finally {
        this.merging = false;
      }
    },
  },
};
</script>

<style scoped>
.merge-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.merge-stat {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 12px;
}

.merge-stat__label {
  margin-right: auto;
  color: var(--text-secondary);
}

.merge-stat strong {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.merge-note {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  padding: 13px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.68;
}

.merge-note__icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.merge-note p + p {
  margin-top: 5px;
}

.merge-note__muted {
  color: var(--text-tertiary);
}

.merge-empty {
  margin-top: 16px;
  color: var(--text-tertiary);
  font-size: 12.5px;
}

.alert {
  margin-top: 14px;
}

.merge-loading {
  display: block;
}

@media (max-width: 520px) {
  .merge-summary {
    grid-template-columns: 1fr;
  }
}
</style>
