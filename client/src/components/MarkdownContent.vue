<template>
  <div v-if="block" class="prose markdown-content" v-html="rendered"></div>
  <span v-else class="markdown-inline" v-html="renderedInline"></span>
</template>

<script>
import { renderMarkdown, renderMarkdownInline } from '@/lib/markdown.js';

export default {
  name: 'MarkdownContent',
  props: {
    source: { type: String, default: '' },
    inline: { type: Boolean, default: false },
  },
  computed: {
    block() {
      return !this.inline;
    },
    rendered() {
      return renderMarkdown(this.source);
    },
    renderedInline() {
      return renderMarkdownInline(this.source);
    },
  },
  watch: {
    source() {
      this.$nextTick(this.attachImageFallbacks);
    },
  },
  mounted() {
    this.attachImageFallbacks();
  },
  updated() {
    this.attachImageFallbacks();
  },
  methods: {
    attachImageFallbacks() {
      const images = this.$el?.querySelectorAll?.('img:not([data-fallback-bound])') || [];
      images.forEach((image) => {
        image.dataset.fallbackBound = '1';
        image.addEventListener(
          'error',
          () => {
            const fallback = document.createElement('span');
            fallback.className = 'image-fallback';
            fallback.textContent = '图片加载失败';
            image.replaceWith(fallback);
          },
          { once: true },
        );
      });
    },
  },
};
</script>

<style scoped>
.markdown-inline :deep(p) {
  display: inline;
  margin: 0;
}

.image-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  height: 76px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-size: 12px;
}
</style>
