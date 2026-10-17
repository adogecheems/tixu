<template>
  <div class="markdown-editor" :class="{ 'is-disabled': disabled }">
    <div class="markdown-editor__header">
      <label v-if="label" class="field__label">{{ label }}</label>
      <div v-if="!disabled" class="markdown-toolbar" role="toolbar" aria-label="Markdown 工具栏">
        <button class="toolbar-btn" type="button" title="加粗" aria-label="加粗" @click="wrap('**', '**', '粗体')">
          <Bold :size="14" />
        </button>
        <button class="toolbar-btn" type="button" title="斜体" aria-label="斜体" @click="wrap('*', '*', '斜体')">
          <Italic :size="14" />
        </button>
        <button class="toolbar-btn" type="button" title="行内公式" aria-label="行内公式" @click="wrap('$', '$', 'x^2')">
          <Sigma :size="14" />
        </button>
        <button class="toolbar-btn" type="button" title="行间公式" aria-label="行间公式" @click="wrapBlock('$$\n', '\n$$', 'f(x)=x^2')">
          <SquareFunction :size="14" />
        </button>
        <button class="toolbar-btn" type="button" title="链接" aria-label="链接" @click="insertLink">
          <Link :size="14" />
        </button>
        <span class="toolbar-divider" />
        <button
          class="toolbar-btn"
          type="button"
          title="上传图片"
          aria-label="上传图片"
          :disabled="uploading"
          @click="$refs.imageInput?.click()"
        >
          <LoaderCircle v-if="uploading" :size="14" class="spin" />
          <ImagePlus v-else :size="14" />
        </button>
        <input
          ref="imageInput"
          class="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          @change="handleImageUpload"
        />
      </div>
    </div>
    <textarea
      ref="textarea"
      class="textarea markdown-editor__textarea"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <div class="markdown-editor__footer">
      <span>支持 Markdown、LaTeX 与图片</span>
      <span class="mono">{{ (modelValue || '').length }} 字符</span>
    </div>
  </div>
</template>

<script>
import {
  Bold,
  ImagePlus,
  Italic,
  Link,
  LoaderCircle,
  Sigma,
  SquareFunction,
} from 'lucide-vue-next';
import { uploadFile, getErrorMessage } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';

export default {
  name: 'MarkdownEditor',
  components: { Bold, ImagePlus, Italic, Link, LoaderCircle, Sigma, SquareFunction },
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '支持 Markdown 与 $LaTeX$ 公式…' },
    rows: { type: Number, default: 8 },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  data() {
    return { uploading: false };
  },
  methods: {
    currentSelection() {
      const textarea = this.$refs.textarea;
      const value = this.modelValue || '';
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      return { textarea, value, start, end, selected: value.slice(start, end) };
    },
    applyInsertion(nextValue, selectionStart, selectionEnd) {
      this.$emit('update:modelValue', nextValue);
      this.$nextTick(() => {
        const textarea = this.$refs.textarea;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd);
      });
    },
    wrap(before, after, placeholder) {
      const { value, start, end, selected } = this.currentSelection();
      const inner = selected || placeholder;
      const next = `${value.slice(0, start)}${before}${inner}${after}${value.slice(end)}`;
      this.applyInsertion(next, start + before.length, start + before.length + inner.length);
    },
    wrapBlock(before, after, placeholder) {
      const { value, start, end, selected } = this.currentSelection();
      const inner = selected || placeholder;
      const prefix = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
      const next = `${value.slice(0, start)}${prefix}${before}${inner}${after}${value.slice(end)}`;
      this.applyInsertion(
        next,
        start + prefix.length + before.length,
        start + prefix.length + before.length + inner.length,
      );
    },
    insertLink() {
      const { value, start, end, selected } = this.currentSelection();
      const label = selected || '链接文字';
      const snippet = `[${label}](https://)`;
      const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
      this.applyInsertion(next, start + label.length + 3, start + label.length + 3 + 8);
    },
    async handleImageUpload(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      this.uploading = true;
      try {
        const result = await uploadFile(file);
        const { value, start, end } = this.currentSelection();
        const markdown = `![图片](${result.url})`;
        const next = `${value.slice(0, start)}${markdown}${value.slice(end)}`;
        this.applyInsertion(next, start + markdown.length, start + markdown.length);
        toast.success('图片已上传并插入。');
      } catch (error) {
        toast.error(getErrorMessage(error, '图片上传失败。'));
      } finally {
        this.uploading = false;
      }
    },
  },
};
</script>

<style scoped>
.markdown-editor {
  width: 100%;
}

.markdown-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 7px;
}

.markdown-toolbar {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 2px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-subtle);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 25px;
  border-radius: 5px;
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.toolbar-btn:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-surface);
}

.toolbar-btn:disabled {
  opacity: 0.5;
}

.toolbar-divider {
  width: 1px;
  height: 14px;
  margin: 0 3px;
  background: var(--border-default);
}

.markdown-editor__textarea {
  min-height: 150px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.7;
  tab-size: 2;
}

.markdown-editor__footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 5px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.is-disabled .markdown-editor__textarea {
  background: var(--bg-subtle);
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
