<template>
  <div class="answer-area">
    <div class="stem">
      <MarkdownContent v-if="question.stemMarkdown?.trim()" :source="question.stemMarkdown" />
      <p v-else class="missing-content">题干内容尚未填写。</p>
    </div>

    <div v-if="isChoice" class="choice-list" role="group" :aria-label="question.type === 'multiple' ? '选择所有正确选项' : '选择一个选项'">
      <label
        v-for="option in options"
        :key="option.id"
        class="choice-option"
        :class="optionClass(option)"
      >
        <input
          class="sr-only"
          :type="question.type === 'multiple' ? 'checkbox' : 'radio'"
          :name="inputName"
          :checked="isOptionSelected(option.id)"
          :disabled="locked"
          @change="toggleOption(option.id)"
        />
        <span class="choice-marker">
          <Check v-if="showOptionCheck(option)" :size="14" :stroke-width="2.2" />
          <span v-else>{{ option.id }}</span>
        </span>
        <span class="choice-content">
          <MarkdownContent inline :source="option.text" />
        </span>
        <span v-if="showOptionCross(option)" class="choice-state choice-state--wrong" aria-label="你选择了这个错误选项">
          <X :size="15" />
        </span>
        <span v-else-if="showOptionCheck(option)" class="choice-state choice-state--correct" aria-label="正确选项">
          <Check :size="15" />
        </span>
      </label>
      <p v-if="!options.length" class="missing-content">尚未设置选项。</p>
    </div>

    <div v-if="question.type === 'truefalse'" class="choice-list choice-list--boolean" role="radiogroup" aria-label="判断题答案">
      <label
        v-for="option in booleanOptions"
        :key="option.id"
        class="choice-option"
        :class="booleanClass(option.value)"
      >
        <input
          class="sr-only"
          type="radio"
          :name="inputName"
          :checked="answer.value === option.value"
          :disabled="locked"
          @change="setBoolean(option.value)"
        />
        <span class="choice-marker">
          <Check v-if="booleanShowCheck(option.value)" :size="14" :stroke-width="2.2" />
          <span v-else>{{ option.id }}</span>
        </span>
        <span class="choice-content">{{ option.label }}</span>
        <span v-if="booleanShowCross(option.value)" class="choice-state choice-state--wrong" aria-label="你选择了错误答案">
          <X :size="15" />
        </span>
        <span v-else-if="booleanShowCheck(option.value)" class="choice-state choice-state--correct" aria-label="正确答案">
          <Check :size="15" />
        </span>
      </label>
    </div>

    <div v-if="question.type === 'fill'" class="fill-area">
      <div v-for="(blank, index) in fillBlanks" :key="index" class="fill-row">
        <label class="fill-label" :for="`${inputName}-blank-${index}`">
          第 {{ index + 1 }} 空
          <span v-if="blank.placeholder" class="fill-placeholder">{{ blank.placeholder }}</span>
        </label>
        <div class="fill-input-wrap">
          <input
            :id="`${inputName}-blank-${index}`"
            class="input fill-input"
            :class="fillBlankClass(index)"
            type="text"
            autocomplete="off"
            :value="fillValues[index] || ''"
            :placeholder="blank.placeholder || '填写答案'"
            :disabled="locked"
            @input="updateFill(index, $event.target.value)"
          />
          <Check
            v-if="fillBlankState(index) === 'correct'"
            :size="16"
            class="fill-state fill-state--correct"
          />
          <X
            v-else-if="fillBlankState(index) === 'wrong'"
            :size="16"
            class="fill-state fill-state--wrong"
          />
        </div>
      </div>
      <p class="fill-note">
        {{ question.fillConfig?.caseSensitive ? '答案区分大小写。' : '答案不区分大小写。' }}
        <span v-if="question.fillConfig?.trimWhitespace">将忽略首尾空白。</span>
      </p>
    </div>

    <div v-if="question.type === 'essay'" class="essay-area">
      <label class="sr-only" :for="`${inputName}-essay`">填写简答题答案</label>
      <textarea
        :id="`${inputName}-essay`"
        class="textarea essay-textarea"
        :value="answer.text || ''"
        :disabled="locked"
        rows="7"
        maxlength="20000"
        placeholder="在这里写下你的思路与答案…"
        @input="updateEssay($event.target.value)"
      />
      <div class="essay-meta">
        <span>{{ readonly ? '预览模式' : submitted ? '已提交的答案' : '提交后可对照参考答案进行自评' }}</span>
        <span class="mono">{{ (answer.text || '').length }} 字</span>
      </div>
    </div>
  </div>
</template>

<script>
import { Check, X } from 'lucide-vue-next';
import MarkdownContent from './MarkdownContent.vue';
import { defaultAnswerFor } from '@/lib/format.js';

export default {
  name: 'QuestionAnswerArea',
  components: { Check, MarkdownContent, X },
  props: {
    question: { type: Object, required: true },
    modelValue: { type: Object, default: () => ({}) },
    readonly: { type: Boolean, default: false },
    submitted: { type: Boolean, default: false },
    correctAnswer: { type: Object, default: null },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      inputName: `question-${Math.random().toString(36).slice(2, 9)}`,
    };
  },
  computed: {
    answer() {
      const fallback = defaultAnswerFor(this.question);
      return { ...fallback, ...(this.modelValue || {}) };
    },
    options() {
      return Array.isArray(this.question.options) ? this.question.options : [];
    },
    isChoice() {
      return ['single', 'multiple'].includes(this.question.type);
    },
    locked() {
      return this.readonly || this.submitted;
    },
    fillBlanks() {
      const configured = this.question.fillConfig?.blanks;
      if (Array.isArray(configured) && configured.length) {
        return configured.map((blank) => ({
          placeholder: typeof blank === 'string' ? blank : blank?.placeholder || '',
        }));
      }
      const answerLength = Array.isArray(this.answer.blanks) ? this.answer.blanks.length : 1;
      return Array.from({ length: Math.max(1, answerLength) }, () => ({ placeholder: '' }));
    },
    fillValues() {
      return Array.isArray(this.answer.blanks) ? this.answer.blanks : [];
    },
    booleanOptions() {
      return [
        { id: 'T', label: '正确', value: true },
        { id: 'F', label: '错误', value: false },
      ];
    },
  },
  methods: {
    emitAnswer(patch) {
      this.$emit('update:modelValue', { ...this.answer, ...patch });
    },
    isOptionSelected(optionId) {
      if (this.question.type === 'multiple') {
        return (this.answer.optionIds || []).includes(optionId);
      }
      return this.answer.optionId === optionId;
    },
    toggleOption(optionId) {
      if (this.locked) return;
      if (this.question.type === 'multiple') {
        const current = new Set(this.answer.optionIds || []);
        if (current.has(optionId)) current.delete(optionId);
        else current.add(optionId);
        this.emitAnswer({ optionIds: [...current].sort() });
      } else {
        this.emitAnswer({ optionId });
      }
    },
    optionIsCorrect(option) {
      if (!this.submitted || !this.correctAnswer) return false;
      if (this.question.type === 'multiple') {
        return (this.correctAnswer.optionIds || []).includes(option.id);
      }
      return this.correctAnswer.optionId === option.id;
    },
    optionClass(option) {
      const selected = this.isOptionSelected(option.id);
      const correct = this.optionIsCorrect(option);
      return {
        'is-selected': selected,
        'is-answer': correct,
        'is-wrong': selected && this.submitted && !correct,
        'is-locked': this.locked,
      };
    },
    showOptionCheck(option) {
      return this.optionIsCorrect(option);
    },
    showOptionCross(option) {
      return this.submitted && this.isOptionSelected(option.id) && !this.optionIsCorrect(option);
    },
    setBoolean(value) {
      if (this.locked) return;
      this.emitAnswer({ value });
    },
    booleanIsCorrect(value) {
      return this.submitted && this.correctAnswer && this.correctAnswer.value === value;
    },
    booleanClass(value) {
      const selected = this.answer.value === value;
      const correct = this.booleanIsCorrect(value);
      return {
        'is-selected': selected,
        'is-answer': correct,
        'is-wrong': selected && this.submitted && !correct,
        'is-locked': this.locked,
      };
    },
    booleanShowCheck(value) {
      return this.booleanIsCorrect(value);
    },
    booleanShowCross(value) {
      return this.submitted && this.answer.value === value && !this.booleanIsCorrect(value);
    },
    updateFill(index, value) {
      if (this.locked) return;
      const blanks = [...(this.fillValues || [])];
      while (blanks.length < this.fillBlanks.length) blanks.push('');
      blanks[index] = value;
      this.emitAnswer({ blanks });
    },
    normalizeFill(value) {
      let normalized = String(value ?? '');
      const config = this.question.fillConfig || {};
      if (config.trimWhitespace !== false) normalized = normalized.trim();
      if (config.collapseWhitespace) normalized = normalized.replace(/\s+/g, ' ');
      if (!config.caseSensitive) normalized = normalized.toLowerCase();
      return normalized;
    },
    fillBlankState(index) {
      if (!this.submitted || !this.correctAnswer?.blanks) return null;
      const accepted = this.correctAnswer.blanks[index] || [];
      const value = this.fillValues[index] ?? '';
      return accepted.some((answer) => this.normalizeFill(answer) === this.normalizeFill(value))
        ? 'correct'
        : 'wrong';
    },
    fillBlankClass(index) {
      const state = this.fillBlankState(index);
      return state ? `is-${state}` : '';
    },
    updateEssay(value) {
      if (this.locked) return;
      this.emitAnswer({ text: value });
    },
  },
};
</script>

<style scoped>
.answer-area {
  min-width: 0;
}

.stem {
  font-size: 16.5px;
  line-height: 1.78;
}

.stem :deep(.prose) {
  font-size: inherit;
  line-height: inherit;
}

.missing-content {
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 12px 0;
}

.choice-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 24px;
}

.choice-list--boolean {
  max-width: 420px;
}

.choice-option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 12px 13px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.choice-option:hover:not(.is-locked) {
  border-color: var(--border-strong);
  background: var(--bg-subtle);
}

.choice-option:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.choice-option.is-locked {
  cursor: default;
}

.choice-option.is-selected {
  border-color: var(--border-strong);
  background: var(--bg-subtle);
}

.choice-option.is-answer {
  border-color: var(--success-border);
  background: var(--success-bg);
}

.choice-option.is-wrong {
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.choice-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-top: 1px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 620;
  line-height: 1;
  transition: all var(--transition-fast);
}

.choice-option.is-selected .choice-marker {
  color: var(--accent-foreground);
  background: var(--accent);
  border-color: var(--accent);
}

.choice-option.is-answer .choice-marker {
  color: var(--success);
  background: var(--bg-surface);
  border-color: var(--success-border);
}

.choice-option.is-wrong .choice-marker {
  color: var(--danger);
  background: var(--bg-surface);
  border-color: var(--danger-border);
}

.choice-content {
  flex: 1;
  min-width: 0;
  padding-top: 1px;
  color: var(--text-primary);
  font-size: 14.5px;
  line-height: 1.65;
  word-break: break-word;
}

.choice-content :deep(p) {
  display: inline;
  margin: 0;
}

.choice-content :deep(.katex-display) {
  margin: 0.35em 0;
}

.choice-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  margin-top: 1px;
}

.choice-state--correct {
  color: var(--success);
  background: var(--bg-surface);
}

.choice-state--wrong {
  color: var(--danger);
  background: var(--bg-surface);
}

.fill-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.fill-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fill-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 540;
}

.fill-placeholder {
  color: var(--text-tertiary);
  font-size: 11.5px;
  font-weight: 400;
}

.fill-input-wrap {
  position: relative;
  max-width: 520px;
}

.fill-input {
  padding-right: 38px;
}

.fill-input.is-correct {
  border-color: var(--success-border);
  background: var(--success-bg);
}

.fill-input.is-wrong {
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.fill-state {
  position: absolute;
  top: 50%;
  right: 13px;
  transform: translateY(-50%);
}

.fill-state--correct {
  color: var(--success);
}

.fill-state--wrong {
  color: var(--danger);
}

.fill-note {
  color: var(--text-tertiary);
  font-size: 11.5px;
  line-height: 1.6;
}

.essay-area {
  margin-top: 24px;
}

.essay-textarea {
  min-height: 180px;
  font-size: 14.5px;
  line-height: 1.75;
  resize: vertical;
}

.essay-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

@media (max-width: 720px) {
  .stem {
    font-size: 15.5px;
    line-height: 1.75;
  }

  .choice-list {
    margin-top: 20px;
  }

  .choice-option {
    padding: 11px;
  }

  .choice-content {
    font-size: 14px;
  }
}
</style>
