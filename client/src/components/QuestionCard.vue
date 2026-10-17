<template>
  <article class="question-card">
    <div class="question-card__top">
      <div class="question-card__badges">
        <span class="badge">{{ typeLabel(question.type) }}</span>
        <span class="badge badge--subtle">{{ difficultyLabel(question.difficulty) }}</span>
        <span v-if="question.wrongCount" class="badge badge--danger">
          错 {{ question.wrongCount }} 次
        </span>
      </div>
      <button
        v-if="showFavorite"
        class="favorite-button"
        type="button"
        :class="{ 'is-active': question.isFavorited }"
        :disabled="favoritePending"
        :aria-label="question.isFavorited ? '取消收藏' : '收藏题目'"
        :title="question.isFavorited ? '取消收藏' : '收藏'"
        @click.stop="$emit('toggle-favorite')"
      >
        <LoaderCircle v-if="favoritePending" :size="16" class="spin" />
        <Star v-else :size="16" :fill="question.isFavorited ? 'currentColor' : 'none'" />
      </button>
    </div>

    <button class="question-card__main" type="button" @click="$emit('open')">
      <h3 class="question-card__title">{{ question.title || '未命名题目' }}</h3>
      <p v-if="question.summary" class="question-card__summary">{{ question.summary }}</p>
    </button>

    <div class="question-card__bottom">
      <div class="question-card__meta">
        <span v-if="question.category" class="question-card__category">
          {{ categoryPath(question.category) }}
        </span>
        <div v-if="question.tags?.length" class="question-card__tags">
          <span v-for="tag in question.tags.slice(0, 2)" :key="tag.id" class="tag-text">#{{ tag.name }}</span>
        </div>
      </div>
      <button
        class="question-card__cta"
        type="button"
        :aria-label="`开始练习：${question.title || '未命名题目'}`"
        @click="$emit('open')"
      >
        练习
        <ArrowUpRight :size="14" />
      </button>
    </div>
  </article>
</template>

<script>
import { ArrowUpRight, LoaderCircle, Star } from 'lucide-vue-next';
import {
  categoryPath,
  difficultyLabel,
  formatRelative,
  typeLabel,
} from '@/lib/format.js';

export default {
  name: 'QuestionCard',
  components: { ArrowUpRight, LoaderCircle, Star },
  props: {
    question: { type: Object, required: true },
    showFavorite: { type: Boolean, default: true },
    favoritePending: { type: Boolean, default: false },
  },
  emits: ['open', 'toggle-favorite'],
  methods: {
    typeLabel,
    difficultyLabel,
    categoryPath,
    formatRelative,
  },
};
</script>

<style scoped>
.question-card {
  display: flex;
  flex-direction: column;
  min-height: 206px;
  padding: 18px 18px 15px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.question-card:hover {
  border-color: var(--border-strong);
  background: color-mix(in srgb, var(--bg-surface) 92%, var(--bg-subtle));
}

.question-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.question-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.favorite-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  margin: -3px -4px 0 0;
  border-radius: 8px;
  color: var(--text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.favorite-button:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.favorite-button.is-active {
  color: var(--text-primary);
}

.favorite-button:disabled {
  opacity: 0.5;
}

.spin {
  animation: spin 0.8s linear infinite;
}

.question-card__main {
  display: block;
  width: 100%;
  margin-top: 15px;
  padding: 0;
  text-align: left;
}

.question-card__title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 620;
  line-height: 1.45;
  letter-spacing: -0.012em;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.question-card__main:hover .question-card__title {
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.question-card__summary {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.question-card__bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 18px;
}

.question-card__meta {
  min-width: 0;
}

.question-card__category {
  display: block;
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 4px;
}

.tag-text {
  color: var(--text-secondary);
  font-size: 11.5px;
}

.question-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  margin: -4px -6px -4px 0;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 520;
  white-space: nowrap;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.question-card__cta:hover {
  color: var(--text-primary);
  background: var(--bg-subtle);
}

.question-card:hover .question-card__cta {
  color: var(--text-primary);
}

@media (max-width: 600px) {
  .question-card {
    min-height: 190px;
    padding: 16px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
