<template>
  <div class="editor-page">
    <div v-if="loading" class="editor-loading">
      <span class="skeleton" style="width: 220px; height: 14px" />
      <span class="skeleton" style="display: block; width: 46%; height: 26px; margin-top: 15px" />
      <div class="editor-loading-grid">
        <div>
          <span v-for="index in 3" :key="index" class="skeleton editor-loading-card" />
        </div>
        <span class="skeleton" style="height: 340px" />
      </div>
    </div>

    <div v-else-if="loadError" class="editor-state">
      <div class="editor-state__card">
        <AlertCircle :size="24" :stroke-width="1.6" />
        <h1>无法打开题目编辑页</h1>
        <p>{{ loadError }}</p>
        <div class="editor-state__actions">
          <button class="btn btn--secondary" type="button" @click="loadEditor">重新加载</button>
          <RouterLink class="btn btn--primary" :to="{ name: 'admin-questions' }">返回题目管理</RouterLink>
        </div>
      </div>
    </div>

    <template v-else>
      <header class="editor-header">
        <div class="editor-header__left">
          <RouterLink class="back-link" :to="{ name: 'admin-questions' }">
            <ArrowLeft :size="13" />
            题目管理
          </RouterLink>
          <div class="editor-title-row">
            <h1>{{ isNew ? '新建题目' : form.title || '未命名题目' }}</h1>
            <span class="badge" :class="statusBadgeClass">{{ statusLabel }}</span>
            <span v-if="hasPendingDraft && status === 'published'" class="badge badge--warning">
              <Clock3 :size="11" />
              待发布修改
            </span>
          </div>
          <p class="editor-subtitle">
            <template v-if="isNew">创建一份新草稿。保存草稿不会校验全部字段，发布时才进行完整校验。</template>
            <template v-else-if="status === 'archived'">已归档题目为只读状态。恢复公开后才能继续编辑和发布。</template>
            <template v-else-if="currentVersion">当前公开版本 v{{ currentVersion.versionNo }}。保存修改会形成独立草稿，前台不会立即变化。</template>
            <template v-else>这是一道尚未发布的草稿，只有管理员可以看到。</template>
          </p>
        </div>

        <div class="editor-header__actions">
          <span class="save-state">
            <span v-if="dirty" class="save-state__dot" />
            {{ saving ? '保存中…' : publishing ? '发布中…' : dirty ? '有未保存的修改' : lastSavedAt ? '已保存' : '尚未保存' }}
          </span>
          <button class="btn btn--secondary btn--sm" type="button" :disabled="isReadOnly || saving || publishing" @click="handleSave">
            <LoaderCircle v-if="saving" :size="14" class="btn__spinner" />
            <Save v-else :size="14" />
            保存草稿
          </button>
          <button
            class="btn btn--primary btn--sm"
            type="button"
            :disabled="isReadOnly || saving || publishing || !canPublish"
            @click="requestPublish"
          >
            <LoaderCircle v-if="publishing" :size="14" class="btn__spinner" />
            <Send v-else :size="14" />
            {{ publishLabel }}
          </button>
        </div>
      </header>

      <div v-if="isReadOnly" class="alert alert--warning editor-banner">
        <Archive :size="16" class="alert__icon" />
        <div>
          <p>这道题已归档，当前页面为只读。恢复公开后可以继续编辑、保存草稿与发布修订。</p>
          <button class="link-button" type="button" @click="requestLifecycle('restore')">恢复公开</button>
        </div>
      </div>

      <div v-else-if="editConflict" class="alert alert--warning editor-banner">
        <AlertTriangle :size="16" class="alert__icon" />
        <div>
          <p>{{ editorError || '草稿已在其他位置被更新，请刷新后再编辑。' }}</p>
          <button class="link-button" type="button" @click="reloadAfterConflict">放弃本地修改并重新载入</button>
        </div>
      </div>

      <div v-else-if="editorError" class="alert alert--danger editor-banner" role="alert">
        <AlertCircle :size="16" class="alert__icon" />
        <span>{{ editorError }}</span>
      </div>

      <div v-if="serverErrors.length" class="alert alert--danger editor-banner editor-validation" role="alert">
        <AlertCircle :size="16" class="alert__icon" />
        <div>
          <strong>题目尚未通过校验</strong>
          <ul>
            <li v-for="(error, index) in serverErrors" :key="`${error.field}-${index}`">
              <span v-if="error.field">{{ fieldLabel(error.field) }}：</span>{{ error.message }}
            </li>
          </ul>
        </div>
      </div>

      <div v-if="!isNew && !categories.length && !loading" class="alert alert--warning editor-banner">
        <FolderTree :size="16" class="alert__icon" />
        <span>还没有可用分类。发布题目之前，请先在 <RouterLink class="link-button" :to="{ name: 'admin-categories' }">分类管理</RouterLink> 中创建分类。</span>
      </div>

      <div class="editor-layout">
        <div class="editor-form">
          <section class="editor-card editor-card--basic">
            <header class="editor-card__head">
              <span class="editor-step">01</span>
              <div>
                <h2>基本信息</h2>
                <p>题目的身份、分类与展示属性。</p>
              </div>
            </header>
            <div class="editor-card__body">
              <label class="field">
                <span class="field__label">题目标题<span class="required-mark">*</span></span>
                <input
                  v-model="form.title"
                  class="input"
                  type="text"
                  maxlength="200"
                  placeholder="用一句话概括这道题，例如「函数求值：二次函数」"
                  :disabled="isReadOnly"
                />
                <span class="field__hint">标题用于列表与导航，不参与判题。</span>
              </label>

              <div class="field-grid field-grid--3">
                <label class="field">
                  <span class="field__label">分类<span class="required-mark">*</span></span>
                  <select v-model="form.categoryId" class="select" :disabled="isReadOnly">
                    <option value="">选择分类</option>
                    <template v-for="root in categories" :key="root.id">
                      <option :value="root.id">{{ root.name }}（一级分类）</option>
                      <option v-for="child in root.children" :key="child.id" :value="child.id">
                        {{ root.name }} / {{ child.name }}
                      </option>
                    </template>
                  </select>
                </label>

                <label class="field">
                  <span class="field__label">题型<span class="required-mark">*</span></span>
                  <select
                    v-model="form.type"
                    class="select"
                    :disabled="isReadOnly"
                    @change="onTypeChange"
                  >
                    <option value="single">单选题</option>
                    <option value="multiple">多选题</option>
                    <option value="truefalse">判断题</option>
                    <option value="fill">填空题</option>
                    <option value="essay">简答题</option>
                  </select>
                </label>

                <label class="field">
                  <span class="field__label">难度<span class="required-mark">*</span></span>
                  <select v-model="form.difficulty" class="select" :disabled="isReadOnly">
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">困难</option>
                  </select>
                </label>
              </div>

              <div class="field">
                <div class="field__label">
                  <span>标签</span>
                  <span class="field__label-hint">搜索添加，没有时可直接新建</span>
                </div>
                <AdminTagPicker
                  v-model="form.tagIds"
                  :tags="tags"
                  :disabled="isReadOnly"
                  @created="handleTagCreated"
                />
              </div>

              <label class="field sort-order-field">
                <span class="field__label">
                  默认排序权重
                  <span class="field__label-hint">数字越小，默认顺序越靠前</span>
                </span>
                <input
                  v-model.number="form.sortOrder"
                  class="input sort-order-input"
                  type="number"
                  min="-99999"
                  max="99999"
                  step="1"
                  :disabled="isReadOnly"
                />
              </label>
            </div>
          </section>

          <section class="editor-card">
            <header class="editor-card__head">
              <span class="editor-step">02</span>
              <div>
                <h2>题干内容</h2>
                <p>支持 Markdown、LaTeX 公式和图片。右侧会实时预览。</p>
              </div>
            </header>
            <div class="editor-card__body editor-card__body--flush">
              <MarkdownEditor
                v-model="form.stemMarkdown"
                label=""
                placeholder="输入题干。例如：已知函数 $f(x)=x^2-1$，求 $f(2)$。"
                :rows="9"
                :disabled="isReadOnly"
              />
            </div>
          </section>

          <section class="editor-card">
            <header class="editor-card__head">
              <span class="editor-step">03</span>
              <div>
                <h2>题型配置</h2>
                <p>{{ typeConfigDescription }}</p>
              </div>
            </header>
            <div class="editor-card__body">
              <template v-if="['single', 'multiple'].includes(form.type)">
                <div class="option-editor-list">
                  <div v-for="(option, index) in form.options" :key="`${option.id}-${index}`" class="option-editor">
                    <span class="option-editor__letter">{{ option.id }}</span>
                    <textarea
                      v-model="option.text"
                      class="textarea option-editor__input"
                      rows="2"
                      :disabled="isReadOnly"
                      :placeholder="`选项 ${option.id} 的内容，支持 Markdown 与公式`"
                    />
                    <button
                      class="icon-button"
                      type="button"
                      :disabled="isReadOnly || form.options.length <= 2"
                      title="删除此选项"
                      aria-label="删除此选项"
                      @click="removeOption(index)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
                <button
                  v-if="form.options.length < 10"
                  class="btn btn--ghost btn--sm add-option-btn"
                  type="button"
                  :disabled="isReadOnly"
                  @click="addOption"
                >
                  <Plus :size="14" />
                  添加选项
                </button>
                <p class="field__hint">选项标识会按 A、B、C… 自动重排，删除选项后请重新确认标准答案。</p>
              </template>

              <template v-else-if="form.type === 'truefalse'">
                <div class="type-note">
                  <span class="type-note__icon"><ListChecks :size="17" /></span>
                  <div>
                    <strong>判断题使用固定的「正确 / 错误」两个选择。</strong>
                    <p>标准答案在下方「标准答案」区域设置。</p>
                  </div>
                </div>
              </template>

              <template v-else-if="form.type === 'fill'">
                <div class="fill-config-list">
                  <div v-for="(blank, index) in form.judgeConfig.blanks" :key="index" class="fill-config-row">
                    <div class="fill-config-head">
                      <span>第 {{ index + 1 }} 空</span>
                      <button
                        class="icon-button"
                        type="button"
                        :disabled="isReadOnly || form.judgeConfig.blanks.length <= 1"
                        title="删除此空"
                        aria-label="删除此空"
                        @click="removeBlank(index)"
                      >
                        <Trash2 :size="13" />
                      </button>
                    </div>
                    <div class="fill-config-grid">
                      <label class="field">
                        <span class="field__label">输入框提示</span>
                        <input
                          v-model="blank.placeholder"
                          class="input"
                          type="text"
                          maxlength="80"
                          :disabled="isReadOnly"
                          placeholder="例如：输入极限值"
                        />
                      </label>
                      <label class="field">
                        <span class="field__label">可接受答案 <span class="field__label-hint">每行一个</span></span>
                        <textarea
                          class="textarea fill-answer-input"
                          rows="3"
                          :value="acceptedText(index)"
                          :disabled="isReadOnly"
                          placeholder="例如：&#10;3&#10;3.0"
                          @input="updateAccepted(index, $event.target.value)"
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <button
                  v-if="form.judgeConfig.blanks.length < 10"
                  class="btn btn--ghost btn--sm add-option-btn"
                  type="button"
                  :disabled="isReadOnly"
                  @click="addBlank"
                >
                  <Plus :size="14" />
                  添加一个空
                </button>
                <div class="normalization-row">
                  <label class="normalization-option">
                    <input v-model="form.judgeConfig.caseSensitive" type="checkbox" :disabled="isReadOnly" />
                    区分大小写
                  </label>
                  <label class="normalization-option">
                    <input v-model="form.judgeConfig.trimWhitespace" type="checkbox" :disabled="isReadOnly" />
                    忽略首尾空白
                  </label>
                  <label class="normalization-option">
                    <input v-model="form.judgeConfig.collapseWhitespace" type="checkbox" :disabled="isReadOnly" />
                    合并连续空白
                  </label>
                </div>
                <p class="field__hint">填空判题只做标准化字符串匹配，不使用正则表达式或模糊匹配。</p>
              </template>

              <template v-else>
                <div class="type-note">
                  <span class="type-note__icon"><BookOpenText :size="17" /></span>
                  <div>
                    <strong>简答题不自动判题。</strong>
                    <p>用户提交后查看参考答案，并自行选择「已掌握」或「未掌握」。</p>
                  </div>
                </div>
              </template>
            </div>
          </section>

          <section class="editor-card">
            <header class="editor-card__head">
              <span class="editor-step">04</span>
              <div>
                <h2>标准答案与判题规则</h2>
                <p>发布时会校验标准答案是否完整、有效。</p>
              </div>
            </header>
            <div class="editor-card__body">
              <template v-if="form.type === 'single'">
                <div class="answer-option-list">
                  <label
                    v-for="option in form.options"
                    :key="option.id"
                    class="answer-option"
                    :class="{ 'is-selected': form.answer.optionId === option.id }"
                  >
                    <input
                      v-model="form.answer.optionId"
                      type="radio"
                      :value="option.id"
                      :disabled="isReadOnly"
                    />
                    <span class="answer-option__letter">{{ option.id }}</span>
                    <span class="answer-option__content">
                      <MarkdownContent inline :source="option.text || '（选项内容为空）'" />
                    </span>
                    <Check v-if="form.answer.optionId === option.id" :size="15" />
                  </label>
                </div>
                <p v-if="!form.answer.optionId" class="field__hint">请选择一个正确选项。</p>
              </template>

              <template v-else-if="form.type === 'multiple'">
                <div class="answer-option-list">
                  <label
                    v-for="option in form.options"
                    :key="option.id"
                    class="answer-option"
                    :class="{ 'is-selected': form.answer.optionIds.includes(option.id) }"
                  >
                    <input
                      type="checkbox"
                      :value="option.id"
                      :checked="form.answer.optionIds.includes(option.id)"
                      :disabled="isReadOnly"
                      @change="toggleCorrectOption(option.id)"
                    />
                    <span class="answer-option__letter">{{ option.id }}</span>
                    <span class="answer-option__content">
                      <MarkdownContent inline :source="option.text || '（选项内容为空）'" />
                    </span>
                    <Check v-if="form.answer.optionIds.includes(option.id)" :size="15" />
                  </label>
                </div>
                <p class="field__hint">多选题按集合完全一致判题，不提供部分分数。</p>
              </template>

              <template v-else-if="form.type === 'truefalse'">
                <div class="boolean-answer-row">
                  <label class="answer-option" :class="{ 'is-selected': form.answer.value === true }">
                    <input v-model="form.answer.value" type="radio" :value="true" :disabled="isReadOnly" />
                    <span class="answer-option__letter">T</span>
                    <span class="answer-option__content">正确</span>
                    <Check v-if="form.answer.value === true" :size="15" />
                  </label>
                  <label class="answer-option" :class="{ 'is-selected': form.answer.value === false }">
                    <input v-model="form.answer.value" type="radio" :value="false" :disabled="isReadOnly" />
                    <span class="answer-option__letter">F</span>
                    <span class="answer-option__content">错误</span>
                    <Check v-if="form.answer.value === false" :size="15" />
                  </label>
                </div>
                <p v-if="form.answer.value === null || form.answer.value === undefined" class="field__hint">请选择正确答案。</p>
              </template>

              <template v-else-if="form.type === 'fill'">
                <div class="fill-answer-summary">
                  <p class="field__hint">每个空的答案配置在上方的「题型配置」中完成。发布校验要求每个空至少有一个可接受答案。</p>
                  <ul>
                    <li v-for="(blank, index) in form.judgeConfig.blanks" :key="index">
                      第 {{ index + 1 }} 空：
                      <span v-if="form.answer.blanks[index]?.filter(Boolean).length">
                        {{ form.answer.blanks[index].filter(Boolean).join(' / ') }}
                      </span>
                      <em v-else>尚未填写可接受答案</em>
                    </li>
                  </ul>
                </div>
              </template>

              <template v-else>
                <MarkdownEditor
                  v-model="form.answer.referenceMarkdown"
                  label="参考答案"
                  placeholder="输入供用户自评对照的参考答案，支持 Markdown 与 LaTeX。"
                  :rows="8"
                  :disabled="isReadOnly"
                />
                <p class="field__hint">参考答案只会在用户提交后展示，不会通过公开题目接口返回。</p>
              </template>
            </div>
          </section>

          <section class="editor-card">
            <header class="editor-card__head">
              <span class="editor-step">05</span>
              <div>
                <h2>解析</h2>
                <p>用户提交后展开显示，支持 Markdown 与公式。</p>
              </div>
            </header>
            <div class="editor-card__body editor-card__body--flush">
              <MarkdownEditor
                v-model="form.analysisMarkdown"
                label=""
                placeholder="解释答案与关键思路。这个字段可以为空。"
                :rows="7"
                :disabled="isReadOnly"
              />
            </div>
          </section>

          <div class="editor-bottom-actions">
            <span class="save-state">
              <span v-if="dirty" class="save-state__dot" />
              {{ dirty ? '有未保存的修改' : lastSavedAt ? `上次保存 ${formatTime(lastSavedAt)}` : '尚未保存' }}
            </span>
            <div class="editor-bottom-actions__buttons">
              <button class="btn btn--secondary" type="button" :disabled="isReadOnly || saving || publishing" @click="handleSave">
                保存草稿
              </button>
              <button class="btn btn--primary" type="button" :disabled="isReadOnly || saving || publishing || !canPublish" @click="requestPublish">
                {{ publishLabel }}
              </button>
            </div>
          </div>
        </div>

        <aside class="editor-aside">
          <section class="preview-card">
            <header class="preview-card__head">
              <div>
                <span class="preview-card__label"><Eye :size="13" /> 实时预览</span>
                <p>发布前确认题干、选项和解析的实际展示效果</p>
              </div>
              <span class="badge badge--subtle">预览</span>
            </header>
            <div class="preview-card__body">
              <div class="preview-meta">
                <span class="badge">{{ typeLabel(form.type) }}</span>
                <span class="badge badge--subtle">{{ difficultyLabel(form.difficulty) }}</span>
              </div>
              <h2 class="preview-title">{{ form.title || '未命名题目' }}</h2>
              <div class="preview-question">
                <QuestionAnswerArea
                  :question="previewQuestion"
                  :model-value="previewAnswer"
                  readonly
                />
              </div>
              <div v-if="form.analysisMarkdown" class="preview-analysis">
                <p class="preview-analysis__label">解析（发布后展开显示）</p>
                <MarkdownContent :source="form.analysisMarkdown" />
              </div>
            </div>
            <footer class="preview-card__foot">
              预览只展示题目外观，不包含标准答案。
            </footer>
          </section>

          <section v-if="!isNew" class="side-card">
            <div class="side-card__head">
              <h2>版本与操作</h2>
              <span class="side-card__status" :class="{ 'is-published': status === 'published' }">
                {{ statusLabel }}
              </span>
            </div>
            <div class="version-info">
              <div>
                <span>题目 ID</span>
                <strong class="mono">#{{ questionId }}</strong>
              </div>
              <div>
                <span>当前发布版本</span>
                <strong>{{ currentVersion ? `v${currentVersion.versionNo}` : '尚未发布' }}</strong>
              </div>
              <div v-if="currentVersion">
                <span>最近发布</span>
                <strong>{{ formatDate(currentVersion.createdAt) }}</strong>
              </div>
              <div>
                <span>草稿状态</span>
                <strong>{{ hasPendingDraft ? '有待发布修改' : isReadOnly ? '只读' : '与当前版本一致' }}</strong>
              </div>
            </div>
            <div class="side-actions">
              <a
                v-if="status === 'published'"
                class="side-action"
                :href="`/questions/${questionId}`"
                target="_blank"
                rel="noopener"
              >
                <ExternalLink :size="14" />
                在前台查看
              </a>
              <button v-if="status === 'published'" class="side-action" type="button" @click="requestLifecycle('archive')">
                <Archive :size="14" />
                归档题目
              </button>
              <button v-if="status === 'archived'" class="side-action" type="button" @click="requestLifecycle('restore')">
                <RotateCcw :size="14" />
                恢复公开
              </button>
              <button class="side-action" type="button" @click="handleDuplicate">
                <Copy :size="14" />
                复制为新草稿
              </button>
              <button
                v-if="!currentVersion"
                class="side-action side-action--danger"
                type="button"
                @click="requestLifecycle('delete')"
              >
                <Trash2 :size="14" />
                删除这道草稿
              </button>
            </div>
            <div v-if="versions.length" class="version-history">
              <p class="version-history__label">历史版本</p>
              <div v-for="version in versions" :key="version.id" class="version-row">
                <span class="version-row__no mono">v{{ version.versionNo }}</span>
                <span class="version-row__title">{{ version.title }}</span>
                <span class="version-row__date">{{ formatDate(version.createdAt) }}</span>
              </div>
            </div>
          </section>

          <section v-else class="side-card side-card--note">
            <Info :size="15" />
            <p>新建题目会在第一次保存草稿后获得题目 ID。发布前可以随时回来继续编辑。</p>
          </section>
        </aside>
      </div>
    </template>

    <ConfirmDialog
      v-model="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-text="confirmText"
      :tone="confirmTone"
      :loading="confirmLoading"
      @confirm="executeConfirm"
    />
  </div>
</template>

<script>
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  BookOpenText,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  FolderTree,
  Info,
  ListChecks,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-vue-next';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import AdminTagPicker from '@/components/AdminTagPicker.vue';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import MarkdownContent from '@/components/MarkdownContent.vue';
import QuestionAnswerArea from '@/components/QuestionAnswerArea.vue';
import { get, post, put, del, getErrorMessage } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';
import {
  categoryPath,
  defaultAnswerFor,
  difficultyLabel,
  formatDate,
  formatTime,
  typeLabel,
} from '@/lib/format.js';

const OPTION_LETTERS = 'ABCDEFGHIJ';
const FIELD_LABELS = {
  title: '标题',
  stemMarkdown: '题干',
  type: '题型',
  difficulty: '难度',
  categoryId: '分类',
  options: '选项',
  answer: '标准答案',
  judgeConfig: '判题规则',
  tagIds: '标签',
  analysisMarkdown: '解析',
};

function letterAt(index) {
  return OPTION_LETTERS[index] || String(index + 1);
}

function defaultBlanks() {
  return [{ placeholder: '第 1 空' }];
}

function emptyForm() {
  return {
    title: '',
    stemMarkdown: '',
    type: 'single',
    difficulty: 'medium',
    categoryId: '',
    tagIds: [],
    sortOrder: 0,
    options: [0, 1, 2, 3].map((index) => ({ id: letterAt(index), text: '' })),
    answer: { optionId: null },
    judgeConfig: {},
    analysisMarkdown: '',
  };
}

export default {
  name: 'AdminQuestionEditorView',
  components: {
    AlertCircle,
    AlertTriangle,
    Archive,
    ArrowLeft,
    AdminTagPicker,
    BookOpenText,
    Check,
    Clock3,
    ConfirmDialog,
    Copy,
    ExternalLink,
    Eye,
    FolderTree,
    Info,
    ListChecks,
    LoaderCircle,
    MarkdownContent,
    MarkdownEditor,
    Plus,
    QuestionAnswerArea,
    RotateCcw,
    Save,
    Send,
    Trash2,
  },
  data() {
    return {
      loading: true,
      loadError: '',
      isNew: this.$route.name === 'admin-question-new',
      questionId: this.isNew ? null : String(this.$route.params.id),
      status: 'draft',
      hasPendingDraft: false,
      currentVersion: null,
      versions: [],
      baseUpdatedAt: null,
      form: emptyForm(),
      categories: [],
      tags: [],
      initializing: true,
      dirty: false,
      saving: false,
      publishing: false,
      lastSavedAt: null,
      editorError: '',
      editConflict: false,
      serverErrors: [],
      allowLeave: false,
      confirmOpen: false,
      confirmLoading: false,
      confirmKind: '',
      confirmTitle: '',
      confirmDescription: '',
      confirmText: '确认',
      confirmTone: 'default',
      pageRequestToken: 0,
    };
  },
  computed: {
    isReadOnly() {
      return this.status === 'archived';
    },
    statusLabel() {
      if (this.isNew) return '新草稿';
      return { draft: '草稿', published: '已发布', archived: '已归档' }[this.status] || '草稿';
    },
    statusBadgeClass() {
      if (this.status === 'published') return 'badge--success';
      if (this.status === 'archived') return 'badge--subtle';
      return '';
    },
    publishLabel() {
      if (!this.currentVersion) return '发布题目';
      return '发布修订';
    },
    canPublish() {
      if (this.isReadOnly) return false;
      if (this.isNew) return true;
      if (this.status === 'draft') return true;
      return this.dirty || this.hasPendingDraft;
    },
    typeConfigDescription() {
      return {
        single: '设置可选项。用户只能选择一个答案。',
        multiple: '设置可选项。用户需要选中所有正确选项，按集合完全一致判题。',
        truefalse: '判断题使用固定的两个判断项。',
        fill: '配置填空数量、提示和每个空的可接受答案。',
        essay: '简答题由用户提交后对照参考答案自评。',
      }[this.form.type] || '';
    },
    previewQuestion() {
      const blanks = Array.isArray(this.form.judgeConfig?.blanks) ? this.form.judgeConfig.blanks : [];
      return {
        id: this.questionId || 'preview',
        title: this.form.title,
        type: this.form.type,
        difficulty: this.form.difficulty,
        stemMarkdown: this.form.stemMarkdown,
        options: this.form.options,
        fillConfig: this.form.type === 'fill' ? { blanks } : null,
      };
    },
    previewAnswer() {
      return defaultAnswerFor(this.previewQuestion);
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.initializing) return;
        this.dirty = true;
        if (this.serverErrors.length) this.serverErrors = [];
      },
    },
    '$route.fullPath'() {
      const name = this.$route.name;
      if (!String(name).startsWith('admin-question')) return;
      const targetId = name === 'admin-question-new' ? null : String(this.$route.params.id);
      if (targetId === this.questionId) return;
      this.loadEditor();
    },
  },
  created() {
    this.loadEditor();
  },
  mounted() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  },
  beforeRouteLeave(to, from, next) {
    if (!this.dirty || this.allowLeave) {
      next();
      return;
    }
    const shouldLeave = window.confirm('当前题目还有未保存的修改。确定要离开吗？');
    next(shouldLeave);
  },
  methods: {
    typeLabel,
    difficultyLabel,
    formatDate,
    formatTime,
    fieldLabel(field) {
      return FIELD_LABELS[field] || field;
    },
    handleBeforeUnload(event) {
      if (!this.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    },
    initializeForm() {
      this.form = emptyForm();
      this.initializing = true;
    },
    resetDirty() {
      this.$nextTick(() => {
        this.initializing = false;
        this.dirty = false;
      });
    },
    applyQuestionData(question) {
      this.questionId = question.id;
      this.isNew = false;
      this.status = question.status;
      this.hasPendingDraft = question.hasPendingDraft;
      this.currentVersion = question.currentVersion;
      this.versions = question.versions || [];
      this.baseUpdatedAt = question.baseUpdatedAt;
      this.lastSavedAt = question.updatedAt || null;
      this.initializing = true;
      const source = question.draft || {};
      const form = emptyForm();
      form.title = source.title || '';
      form.stemMarkdown = source.stemMarkdown || '';
      form.type = source.type || 'single';
      form.difficulty = source.difficulty || 'medium';
      form.categoryId = source.categoryId ? String(source.categoryId) : '';
      form.tagIds = (source.tagIds || []).map(String);
      form.sortOrder = Number.isFinite(Number(source.sortOrder)) ? Number(source.sortOrder) : 0;
      form.options = (source.options || []).map((option, index) => ({
        id: option.id || letterAt(index),
        text: option.text || '',
      }));
      if (['single', 'multiple'].includes(form.type) && form.options.length < 2) {
        form.options = [0, 1, 2, 3].map((index) => ({ id: letterAt(index), text: '' }));
      }
      form.answer = source.answer && typeof source.answer === 'object' ? { ...source.answer } : {};
      form.judgeConfig = source.judgeConfig && typeof source.judgeConfig === 'object' ? { ...source.judgeConfig } : {};
      form.analysisMarkdown = source.analysisMarkdown || '';
      if (form.type === 'single') form.answer = { optionId: form.answer.optionId || null };
      if (form.type === 'multiple') {
        form.answer = {
          optionIds: Array.isArray(form.answer.optionIds) ? form.answer.optionIds.map(String) : [],
        };
      }
      if (form.type === 'truefalse') {
        form.answer = { value: typeof form.answer.value === 'boolean' ? form.answer.value : null };
      }
      if (form.type === 'fill') {
        const blanks = Array.isArray(form.judgeConfig.blanks) && form.judgeConfig.blanks.length
          ? form.judgeConfig.blanks.map((blank, index) => ({
              placeholder: (typeof blank === 'string' ? blank : blank?.placeholder) || `第 ${index + 1} 空`,
            }))
          : defaultBlanks();
        form.judgeConfig = {
          blanks,
          caseSensitive: Boolean(form.judgeConfig.caseSensitive),
          trimWhitespace: form.judgeConfig.trimWhitespace !== false,
          collapseWhitespace: Boolean(form.judgeConfig.collapseWhitespace),
        };
        form.answer = {
          blanks: blanks.map((_, index) =>
            Array.isArray(form.answer.blanks?.[index]) ? form.answer.blanks[index].map(String) : [''],
          ),
        };
      }
      if (form.type === 'essay') {
        form.answer = {
          referenceMarkdown: String(form.answer.referenceMarkdown || ''),
        };
      }
      this.form = form;
      this.resetDirty();
    },
    async loadEditor() {
      const token = ++this.pageRequestToken;
      this.loading = true;
      this.loadError = '';
      this.editorError = '';
      this.editConflict = false;
      this.serverErrors = [];
      this.initializing = true;
      try {
        const [categoryData, tagData] = await Promise.all([get('/admin/categories'), get('/admin/tags')]);
        if (token !== this.pageRequestToken) return;
        this.categories = categoryData.categories || [];
        this.tags = tagData.tags || [];
        if (this.$route.name === 'admin-question-new') {
          this.isNew = true;
          this.questionId = null;
          this.status = 'draft';
          this.hasPendingDraft = false;
          this.currentVersion = null;
          this.versions = [];
          this.baseUpdatedAt = null;
          this.form = emptyForm();
          this.lastSavedAt = null;
          this.$nextTick(() => {
            this.initializing = false;
            this.dirty = false;
          });
          return;
        }
        this.isNew = false;
        this.questionId = String(this.$route.params.id);
        const data = await get(`/admin/questions/${this.questionId}`);
        if (token !== this.pageRequestToken) return;
        this.applyQuestionData(data.question);
      } catch (error) {
        if (token !== this.pageRequestToken) return;
        this.loadError = getErrorMessage(error, '题目内容加载失败。');
      } finally {
        if (token === this.pageRequestToken) this.loading = false;
      }
    },
    formPayload() {
      return {
        title: this.form.title,
        stemMarkdown: this.form.stemMarkdown,
        type: this.form.type,
        difficulty: this.form.difficulty,
        categoryId: this.form.categoryId || null,
        options: this.form.options,
        answer: this.form.answer,
        judgeConfig: this.form.judgeConfig,
        analysisMarkdown: this.form.analysisMarkdown,
        tagIds: this.form.tagIds,
        sortOrder: this.form.sortOrder,
      };
    },
    handleApiError(error) {
      this.editorError = getErrorMessage(error, '保存题目时发生错误。');
      this.serverErrors = Array.isArray(error?.details) ? error.details : [];
      this.editConflict = error?.code === 'EDIT_CONFLICT';
      if (error?.code === 'VALIDATION_FAILED') {
        this.editorError = '题目尚未通过发布校验，请根据以下提示补充或修正内容。';
      }
    },
    async performSave({ silent = false } = {}) {
      if (this.isReadOnly) return false;
      this.saving = true;
      this.editorError = '';
      this.editConflict = false;
      this.serverErrors = [];
      try {
        if (this.isNew) {
          const data = await post('/admin/questions', this.formPayload());
          this.questionId = data.questionId;
          this.isNew = false;
          this.status = 'draft';
          this.hasPendingDraft = true;
          this.baseUpdatedAt = data.updatedAt;
          this.lastSavedAt = data.updatedAt;
          this.dirty = false;
          await this.$router.replace({
            name: 'admin-question-edit',
            params: { id: data.questionId },
          });
        } else {
          const payload = { ...this.formPayload(), baseUpdatedAt: this.baseUpdatedAt };
          const data = await put(`/admin/questions/${this.questionId}/draft`, payload);
          this.baseUpdatedAt = data.updatedAt;
          this.hasPendingDraft = true;
          this.lastSavedAt = data.updatedAt;
        }
        this.dirty = false;
        if (!silent) toast.success('草稿已保存。');
        return true;
      } catch (error) {
        this.handleApiError(error);
        if (!silent) toast.error(getErrorMessage(error, '草稿保存失败。'));
        return false;
      } finally {
        this.saving = false;
      }
    },
    async handleSave() {
      await this.performSave();
    },
    requestPublish() {
      if (this.isReadOnly || !this.canPublish) return;
      const nextVersionNo = (this.currentVersion?.versionNo || 0) + 1;
      this.confirmKind = 'publish';
      this.confirmTitle = this.currentVersion ? '发布题目修订' : '发布题目';
      this.confirmDescription = this.currentVersion
        ? `保存当前修改并发布为 version ${nextVersionNo}。发布后前台会立即更新，旧版本和已有作答历史保持不变。`
        : '保存当前内容并发布。发布后题目会立即出现在前台题库，且会经过完整内容校验。';
      this.confirmText = this.currentVersion ? '发布修订' : '发布题目';
      this.confirmTone = 'default';
      this.confirmOpen = true;
    },
    async executeConfirm() {
      if (this.confirmLoading) return;
      this.confirmLoading = true;
      try {
        if (this.confirmKind === 'publish') {
          await this.executePublish();
        } else if (this.confirmKind === 'archive') {
          await this.executeArchive();
        } else if (this.confirmKind === 'restore') {
          await this.executeRestore();
        } else if (this.confirmKind === 'delete') {
          await this.executeDelete();
        }
      } finally {
        this.confirmLoading = false;
        this.confirmOpen = false;
      }
    },
    async executePublish() {
      if (!this.questionId && this.isNew) {
        const saved = await this.performSave({ silent: true });
        if (!saved) return;
      } else {
        const saved = await this.performSave({ silent: true });
        if (!saved) return;
      }
      this.publishing = true;
      try {
        const result = await post(`/admin/questions/${this.questionId}/publish`, {});
        this.dirty = false;
        this.serverErrors = [];
        this.editorError = '';
        toast.success(`题目已发布为 v${result.versionNo}。`);
        this.confirmOpen = false;
        await this.refreshEditorData();
        this.$nextTick(() => {
          this.initializing = false;
          this.dirty = false;
        });
      } catch (error) {
        this.handleApiError(error);
        if (error?.code === 'VALIDATION_FAILED' || Array.isArray(error?.details)) {
          this.editorError = '题目尚未通过发布校验，请修正后再次发布。';
        } else {
          toast.error(getErrorMessage(error, '发布失败。'));
        }
      } finally {
        this.publishing = false;
      }
    },
    async refreshEditorData() {
      if (!this.questionId) return;
      try {
        const data = await get(`/admin/questions/${this.questionId}`);
        this.applyQuestionData(data.question);
      } catch (error) {
        toast.warning('题目已更新，但页面数据刷新失败。请手动刷新页面。');
      }
    },
    requestLifecycle(kind) {
      if (this.isNew) return;
      const config = {
        archive: {
          title: '归档这道题',
          description: '归档后题目会立即从公开题库移除。历史版本与作答记录会保留，之后可以恢复公开。',
          confirmText: '归档题目',
          tone: 'danger',
        },
        restore: {
          title: '恢复公开',
          description: '恢复后题目会重新出现在公开题库中，并保留现有版本与历史作答。',
          confirmText: '恢复公开',
          tone: 'default',
        },
        delete: {
          title: '删除题目草稿',
          description: '这道题从未发布，也没有历史引用，将被永久删除。此操作不可撤销。',
          confirmText: '永久删除',
          tone: 'danger',
        },
      }[kind];
      if (!config) return;
      this.confirmKind = kind;
      this.confirmTitle = config.title;
      this.confirmDescription = config.description;
      this.confirmText = config.confirmText;
      this.confirmTone = config.tone;
      this.confirmOpen = true;
    },
    async executeArchive() {
      if (this.isReadOnly) return;
      if (this.dirty) {
        const saved = await this.performSave({ silent: true });
        if (!saved) return;
      }
      try {
        await post(`/admin/questions/${this.questionId}/archive`, {});
        toast.success('题目已归档。');
        await this.refreshEditorData();
      } catch (error) {
        toast.error(getErrorMessage(error, '归档失败。'));
      }
    },
    async executeRestore() {
      try {
        await post(`/admin/questions/${this.questionId}/restore`, {});
        toast.success('题目已恢复公开。');
        await this.refreshEditorData();
      } catch (error) {
        toast.error(getErrorMessage(error, '恢复公开失败。'));
      }
    },
    async executeDelete() {
      try {
        await del(`/admin/questions/${this.questionId}`);
        this.allowLeave = true;
        this.dirty = false;
        toast.success('题目草稿已删除。');
        this.confirmOpen = false;
        await this.$router.push({ name: 'admin-questions' });
      } catch (error) {
        toast.error(getErrorMessage(error, '删除题目失败。'));
      }
    },
    async handleDuplicate() {
      if (this.isNew) {
        toast.info('请先保存草稿，再复制题目。');
        return;
      }
      if (this.dirty) {
        const saved = await this.performSave({ silent: true });
        if (!saved) return;
      }
      try {
        const data = await post(`/admin/questions/${this.questionId}/duplicate`, {});
        this.allowLeave = true;
        this.dirty = false;
        toast.success('已复制为新的草稿。');
        await this.$router.push({ name: 'admin-question-edit', params: { id: data.questionId } });
      } catch (error) {
        toast.error(getErrorMessage(error, '复制题目失败。'));
      }
    },
    async reloadAfterConflict() {
      if (this.dirty && !window.confirm('重新载入会放弃当前未保存的修改，确定继续吗？')) return;
      this.initializing = true;
      this.loading = true;
      try {
        const data = await get(`/admin/questions/${this.questionId}`);
        this.applyQuestionData(data.question);
        this.dirty = false;
      } catch (error) {
        toast.error(getErrorMessage(error, '重新载入失败。'));
      } finally {
        this.loading = false;
      }
    },
    onTypeChange() {
      const type = this.form.type;
      if (['single', 'multiple'].includes(type)) {
        if (this.form.options.length < 2) {
          this.form.options = [0, 1, 2, 3].map((index) => ({ id: letterAt(index), text: '' }));
        }
        if (type === 'single') {
          const previousMultiple = Array.isArray(this.form.answer.optionIds);
          this.form.answer = {
            optionId: previousMultiple
              ? this.form.answer.optionIds.find((id) => this.form.options.some((option) => option.id === id)) || null
              : this.form.answer.optionId || null,
          };
        } else {
          const previousSingle = this.form.answer.optionId;
          this.form.answer = {
            optionIds:
              previousSingle && this.form.options.some((option) => option.id === previousSingle)
                ? [previousSingle]
                : [],
          };
        }
      } else if (type === 'truefalse') {
        this.form.answer = { value: typeof this.form.answer.value === 'boolean' ? this.form.answer.value : null };
      } else if (type === 'fill') {
        if (!Array.isArray(this.form.judgeConfig?.blanks) || !this.form.judgeConfig.blanks.length) {
          this.form.judgeConfig = {
            blanks: defaultBlanks(),
            caseSensitive: false,
            trimWhitespace: true,
            collapseWhitespace: false,
          };
        }
        this.form.answer = {
          blanks: this.form.judgeConfig.blanks.map((_, index) =>
            Array.isArray(this.form.answer?.blanks?.[index]) ? this.form.answer.blanks[index].map(String) : [''],
          ),
        };
      } else if (type === 'essay') {
        this.form.answer = { referenceMarkdown: String(this.form.answer?.referenceMarkdown || '') };
      }
    },
    handleTagCreated(tag) {
      const id = String(tag.id);
      if (this.tags.some((existing) => String(existing.id) === id)) return;
      this.tags = [...this.tags, { ...tag, id }].sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-Hans-CN'),
      );
    },
    toggleCorrectOption(optionId) {
      if (this.isReadOnly) return;
      const values = new Set(this.form.answer.optionIds || []);
      if (values.has(optionId)) values.delete(optionId);
      else values.add(optionId);
      this.form.answer = { ...this.form.answer, optionIds: [...values] };
    },
    addOption() {
      if (this.isReadOnly || this.form.options.length >= 10) return;
      this.form.options.push({ id: letterAt(this.form.options.length), text: '' });
    },
    removeOption(index) {
      if (this.isReadOnly || this.form.options.length <= 2) return;
      const selectedIndices = this.form.options
        .map((option, optionIndex) => (this.form.answer.optionIds?.includes(option.id) || this.form.answer.optionId === option.id ? optionIndex : -1))
        .filter((optionIndex) => optionIndex >= 0)
        .filter((optionIndex) => optionIndex !== index)
        .map((optionIndex) => (optionIndex > index ? optionIndex - 1 : optionIndex));
      this.form.options.splice(index, 1);
      this.form.options = this.form.options.map((option, optionIndex) => ({
        ...option,
        id: letterAt(optionIndex),
      }));
      if (this.form.type === 'single') {
        this.form.answer = { optionId: selectedIndices.length ? letterAt(selectedIndices[0]) : null };
      } else if (this.form.type === 'multiple') {
        this.form.answer = { optionIds: selectedIndices.map((optionIndex) => letterAt(optionIndex)) };
      }
    },
    addBlank() {
      if (this.isReadOnly || this.form.judgeConfig.blanks.length >= 10) return;
      const index = this.form.judgeConfig.blanks.length;
      this.form.judgeConfig.blanks.push({ placeholder: `第 ${index + 1} 空` });
      this.form.answer.blanks.push(['']);
    },
    removeBlank(index) {
      if (this.isReadOnly || this.form.judgeConfig.blanks.length <= 1) return;
      this.form.judgeConfig.blanks.splice(index, 1);
      this.form.answer.blanks.splice(index, 1);
    },
    acceptedText(index) {
      return (this.form.answer.blanks[index] || []).join('\n');
    },
    updateAccepted(index, value) {
      if (this.isReadOnly) return;
      const blanks = [...(this.form.answer.blanks || [])];
      blanks[index] = value.split(/\r?\n/);
      this.form.answer = { ...this.form.answer, blanks };
    },
  },
};
</script>

<style scoped>
.editor-page {
  max-width: 1380px;
  margin: 0 auto;
}

.editor-loading {
  padding-top: 8px;
}

.editor-loading-grid {
  display: grid;
  grid-template-columns: 1fr 390px;
  gap: 12px;
  margin-top: 22px;
}

.editor-loading-card {
  display: block;
  height: 180px;
  margin-bottom: 12px;
}

.editor-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.editor-state__card {
  width: min(480px, 100%);
  padding: 36px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-secondary);
  text-align: center;
}

.editor-state__card > svg {
  margin: 0 auto;
  color: var(--text-tertiary);
}

.editor-state__card h1 {
  margin-top: 14px;
  color: var(--text-primary);
  font-size: 19px;
  letter-spacing: -0.02em;
}

.editor-state__card p {
  margin-top: 7px;
  font-size: 12px;
}

.editor-state__actions {
  display: flex;
  justify-content: center;
  gap: 9px;
  margin-top: 20px;
}

.editor-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}

.editor-header__left {
  min-width: 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 9px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.back-link:hover {
  color: var(--text-primary);
}

.editor-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.editor-title-row h1 {
  overflow: hidden;
  max-width: 540px;
  margin-right: 2px;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 630;
  letter-spacing: -0.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-subtitle {
  max-width: 700px;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 10.5px;
  line-height: 1.65;
}

.editor-header__actions {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.save-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  color: var(--text-tertiary);
  font-size: 9.5px;
  white-space: nowrap;
}

.save-state__dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--warning);
}

.editor-banner {
  margin-bottom: 11px;
  align-items: flex-start;
  font-size: 11.5px;
}

.editor-banner .link-button {
  margin-top: 4px;
  font-size: 11px;
}

.editor-validation ul {
  margin-top: 5px;
  padding-left: 16px;
  line-height: 1.7;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 392px;
  align-items: start;
  gap: 12px;
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-width: 0;
}

.editor-card {
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.editor-card--basic {
  overflow: visible;
}

.editor-card--basic > .editor-card__head {
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.editor-card__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 15px 17px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-subtle);
}

.editor-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  border-radius: 5px;
  background: var(--bg-surface);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 8.5px;
}

.editor-card__head h2 {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.editor-card__head p {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.editor-card__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 17px;
}

.editor-card__body--flush {
  padding: 15px;
}

.field-grid {
  display: grid;
  gap: 12px;
}

.field-grid--3 {
  grid-template-columns: repeat(3, 1fr);
}

.required-mark {
  margin-left: 2px;
  color: var(--danger);
}

.sort-order-field {
  max-width: 280px;
}

.sort-order-input {
  height: 36px;
}

.option-editor-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.option-editor {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.option-editor__letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  margin-top: 6px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 10.5px;
  font-weight: 600;
}

.option-editor__input {
  min-height: 58px;
  font-size: 12px;
  line-height: 1.6;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  margin-top: 4px;
  border-radius: 6px;
  color: var(--text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.icon-button:hover:not(:disabled) {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.icon-button:disabled {
  opacity: 0.3;
}

.add-option-btn {
  align-self: flex-start;
  margin-top: 2px;
}

.type-note {
  display: flex;
  gap: 10px;
  padding: 13px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.type-note__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  border-radius: 7px;
  color: var(--text-secondary);
  background: var(--bg-surface);
}

.type-note strong {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 550;
}

.type-note p {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.6;
}

.fill-config-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fill-config-row {
  padding: 11px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.fill-config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: 10.5px;
  font-weight: 550;
}

.fill-config-head .icon-button {
  margin-top: 0;
  width: 24px;
  height: 24px;
}

.fill-config-grid {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 9px;
}

.fill-config-row .field__label {
  font-size: 10px;
}

.fill-config-row .input {
  height: 34px;
  font-size: 11.5px;
  background: var(--bg-surface);
}

.fill-answer-input {
  min-height: 74px;
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg-surface);
}

.normalization-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 2px;
}

.normalization-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 10.5px;
  cursor: pointer;
}

.normalization-option input {
  width: 13px;
  height: 13px;
  accent-color: var(--accent);
}

.answer-option-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.answer-option {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 11px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 11.5px;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.answer-option:hover {
  background: var(--bg-subtle);
}

.answer-option.is-selected {
  border-color: var(--border-strong);
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.answer-option input {
  width: 13px;
  height: 13px;
  margin-top: 3px;
  flex-shrink: 0;
  accent-color: var(--accent);
}

.answer-option__letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 600;
}

.answer-option__content {
  flex: 1;
  min-width: 0;
  line-height: 1.6;
}

.answer-option__content :deep(p) {
  display: inline;
  margin: 0;
}

.boolean-answer-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  max-width: 430px;
}

.fill-answer-summary {
  padding: 13px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}

.fill-answer-summary ul {
  margin-top: 8px;
  padding-left: 15px;
  color: var(--text-secondary);
  font-size: 10.5px;
  line-height: 1.8;
}

.fill-answer-summary em {
  color: var(--text-tertiary);
  font-style: normal;
}

.editor-bottom-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.editor-bottom-actions__buttons {
  display: flex;
  gap: 7px;
}

.editor-aside {
  position: sticky;
  top: 74px;
  display: flex;
  flex-direction: column;
  gap: 11px;
  max-height: calc(100vh - 92px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.preview-card {
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.preview-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 15px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-subtle);
}

.preview-card__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-primary);
  font-size: 10.5px;
  font-weight: 600;
}

.preview-card__head p {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 8.5px;
}

.preview-card__body {
  padding: 20px 18px;
}

.preview-meta {
  display: flex;
  gap: 5px;
}

.preview-title {
  margin-top: 12px;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 620;
  line-height: 1.45;
  letter-spacing: -0.02em;
  word-break: break-word;
}

.preview-question {
  margin-top: 15px;
}

.preview-question :deep(.stem) {
  font-size: 13.5px;
  line-height: 1.72;
}

.preview-question :deep(.choice-list) {
  margin-top: 15px;
  gap: 6px;
}

.preview-question :deep(.choice-option) {
  padding: 8px 9px;
}

.preview-question :deep(.choice-content) {
  font-size: 11.5px;
}

.preview-question :deep(.choice-marker) {
  width: 20px;
  height: 20px;
  font-size: 9px;
}

.preview-question :deep(.fill-area),
.preview-question :deep(.essay-area) {
  margin-top: 15px;
}

.preview-analysis {
  margin-top: 18px;
  padding-top: 13px;
  border-top: 1px solid var(--border-default);
}

.preview-analysis__label {
  margin-bottom: 8px;
  color: var(--text-tertiary);
  font-size: 9px;
}

.preview-analysis :deep(.prose) {
  font-size: 11.5px;
  line-height: 1.7;
}

.preview-card__foot {
  padding: 9px 15px;
  border-top: 1px solid var(--border-default);
  color: var(--text-tertiary);
  font-size: 8.5px;
  background: var(--bg-subtle);
}

.side-card {
  padding: 15px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.side-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-default);
}

.side-card__head h2 {
  font-size: 11px;
  font-weight: 600;
}

.side-card__status {
  color: var(--text-tertiary);
  font-size: 9px;
}

.side-card__status.is-published {
  color: var(--success);
}

.version-info {
  display: flex;
  flex-direction: column;
  padding: 5px 0;
}

.version-info > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border-default) 55%, transparent);
}

.version-info > div:last-child {
  border-bottom: 0;
}

.version-info span {
  color: var(--text-tertiary);
  font-size: 9.5px;
}

.version-info strong {
  color: var(--text-secondary);
  font-size: 9.5px;
  font-weight: 500;
  text-align: right;
}

.side-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border-default);
}

.side-action {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 31px;
  padding: 0 6px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 10px;
  text-align: left;
}

.side-action:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.side-action--danger {
  color: var(--danger);
}

.side-action--danger:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

.version-history {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-default);
}

.version-history__label {
  margin-bottom: 6px;
  color: var(--text-tertiary);
  font-size: 9px;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 0;
  font-size: 9px;
}

.version-row__no {
  color: var(--text-tertiary);
}

.version-row__title {
  overflow: hidden;
  flex: 1;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-row__date {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 8px;
}

.side-card--note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-size: 9.5px;
  line-height: 1.65;
}

.side-card--note svg {
  flex-shrink: 0;
  margin-top: 1px;
}

@media (max-width: 1280px) {
  .editor-layout {
    grid-template-columns: minmax(0, 1fr) 350px;
  }
}

@media (max-width: 1150px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }

  .editor-aside {
    position: static;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    max-height: none;
    overflow: visible;
  }

  .side-card--note {
    grid-column: 1 / -1;
  }

  .editor-loading-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 800px) {
  .editor-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .editor-header__actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .editor-header__actions .save-state {
    width: 100%;
    margin-bottom: 1px;
  }

  .editor-title-row h1 {
    max-width: calc(100vw - 80px);
    font-size: 20px;
  }

  .field-grid--3 {
    grid-template-columns: 1fr;
  }

  .editor-aside {
    grid-template-columns: 1fr;
  }

  .fill-config-grid {
    grid-template-columns: 1fr;
  }

  .editor-bottom-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .editor-bottom-actions__buttons {
    width: 100%;
  }

  .editor-bottom-actions__buttons .btn {
    flex: 1;
  }
}

@media (max-width: 520px) {
  .editor-card__body {
    padding: 14px;
  }

  .editor-header__actions .btn {
    flex: 1;
  }

  .boolean-answer-row {
    grid-template-columns: 1fr;
  }

  .preview-card__body {
    padding: 16px 14px;
  }
}
</style>
