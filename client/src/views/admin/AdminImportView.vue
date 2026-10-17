<template>
  <div class="import-page">
    <header class="admin-page-header">
      <div>
        <p class="admin-eyebrow">Import</p>
        <h1>批量导入</h1>
        <p class="admin-page-header__description">通过 JSON 或 ZIP 一次导入多道题目。全部校验通过后，才会创建为草稿。</p>
      </div>
      <div class="admin-page-header__actions">
        <button v-if="step === 'upload'" class="btn btn--secondary btn--sm" type="button" @click="downloadTemplate">
          <Download :size="14" />
          下载示例 JSON
        </button>
        <button v-if="step === 'preview'" class="btn btn--secondary btn--sm" type="button" @click="cancelPreview">
          取消导入
        </button>
        <RouterLink v-if="step === 'success'" class="btn btn--secondary btn--sm" :to="{ name: 'admin-questions' }">
          前往题目管理
        </RouterLink>
        <button v-if="step === 'success'" class="btn btn--primary btn--sm" type="button" @click="resetImport">
          <Plus :size="14" />
          继续导入
        </button>
      </div>
    </header>

    <div class="import-steps">
      <div
        v-for="(item, index) in steps"
        :key="item.value"
        class="import-step"
        :class="{ 'is-active': currentStep === item.value, 'is-done': currentStep > item.value }"
      >
        <span class="import-step__number">
          <Check v-if="currentStep > item.value" :size="12" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="import-step__label">{{ item.label }}</span>
        <span v-if="index < steps.length - 1" class="import-step__line" />
      </div>
    </div>

    <div v-if="step === 'upload'" class="import-upload-layout">
      <section class="upload-card">
        <div
          class="dropzone"
          :class="{ 'is-dragging': dragging, 'is-loading': uploading }"
          role="button"
          tabindex="0"
          @click="pickFile"
          @keydown.enter.prevent="pickFile"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept=".json,.zip,application/json,application/zip"
            @change="handleFileInput"
          />
          <span class="dropzone__icon">
            <LoaderCircle v-if="uploading" :size="25" class="spin" />
            <UploadCloud v-else :size="25" :stroke-width="1.6" />
          </span>
          <h2>{{ uploading ? '正在解析并校验…' : dragging ? '松开鼠标以导入' : '拖拽文件到这里，或点击选择' }}</h2>
          <p>支持 .json 和 .zip，单个文件不超过 15MB。ZIP 内需包含 questions.json 与可选的 assets/ 图片目录。</p>
          <button class="btn btn--primary btn--sm" type="button" :disabled="uploading">
            <FileUp :size="14" />
            选择文件
          </button>
        </div>

        <div v-if="uploadError" class="alert alert--danger upload-alert" role="alert">
          <AlertCircle :size="16" class="alert__icon" />
          <span>{{ uploadError }}</span>
        </div>

        <div v-if="importErrors.length" class="import-errors">
          <div class="import-errors__head">
            <div>
              <h2>校验未通过</h2>
              <p>整批题目均未创建。修正以下问题后可以重新上传。</p>
            </div>
            <span class="badge badge--danger">整批拒绝</span>
          </div>
          <div v-for="group in errorGroups" :key="group.key" class="error-group">
            <strong>{{ group.title }}</strong>
            <ul>
              <li v-for="(message, index) in group.messages" :key="index">{{ message }}</li>
            </ul>
          </div>
        </div>
      </section>

      <aside class="format-card">
        <div class="format-card__head">
          <Info :size="15" />
          <div>
            <h2>导入规则</h2>
            <p>先了解格式与边界，再开始导入。</p>
          </div>
        </div>
        <ul class="format-list">
          <li>导入只会创建新题目，不覆盖已有题目，也不会按标题去重。</li>
          <li>所有题目默认保存为草稿；导入完成后需在题库管理中检查并发布。</li>
          <li>分类路径与标签名称必须已经存在于系统中，不会自动创建。</li>
          <li>任意一道题校验失败，整批都会拒绝，不产生部分成功的草稿。</li>
          <li>ZIP 只允许 questions.json 与 assets/ 下的 PNG、JPEG、GIF、WebP 图片；会拒绝不安全的文件路径与超限文件。</li>
          <li>预览有效期为 15 分钟。确认前不会创建题目。</li>
        </ul>
        <div class="format-structure">
          <p class="format-structure__label">ZIP 结构</p>
          <pre><code>questions.json
assets/
  diagram-1.png
  formula.png</code></pre>
        </div>
        <details class="format-example">
          <summary>查看 JSON 字段示例</summary>
          <pre><code>{{ jsonExample }}</code></pre>
        </details>
      </aside>
    </div>

    <div v-else-if="step === 'preview' && preview" class="preview-layout">
      <section class="preview-main">
        <div class="preview-summary">
          <div>
            <p class="admin-eyebrow">Preview</p>
            <h2>预览导入内容</h2>
            <p>
              {{ preview.summary.filename }} · {{ preview.summary.total }} 道题
              <span v-if="preview.summary.imageCount"> · {{ preview.summary.imageCount }} 张图片</span>
            </p>
          </div>
          <div class="preview-summary__actions">
            <span class="preview-validity"><Clock3 :size="12" /> 预览 15 分钟内有效</span>
            <button class="btn btn--primary btn--sm" type="button" @click="requestConfirm">
              确认导入 {{ preview.summary.total }} 道题
            </button>
          </div>
        </div>

        <div class="preview-grid">
          <div class="preview-list-card">
            <div class="preview-list-card__head">
              <span>题目列表</span>
              <span>{{ preview.items.length }} 项</span>
            </div>
            <div class="preview-list">
              <button
                v-for="(item, index) in preview.items"
                :key="item.index"
                class="preview-list-item"
                :class="{ 'is-active': selectedIndex === index }"
                type="button"
                @click="selectedIndex = index"
              >
                <span class="preview-list-item__index mono">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="preview-list-item__main">
                  <span class="preview-list-item__title">{{ item.title }}</span>
                  <span class="preview-list-item__meta">
                    {{ typeLabel(item.type) }} · {{ difficultyLabel(item.difficulty) }}
                  </span>
                </span>
                <ChevronRight :size="13" />
              </button>
            </div>
          </div>

          <div class="preview-question-card">
            <div class="preview-question-card__head">
              <div>
                <span class="badge">{{ typeLabel(selectedItem.type) }}</span>
                <span class="badge badge--subtle">{{ difficultyLabel(selectedItem.difficulty) }}</span>
                <span class="badge badge--warning">草稿</span>
              </div>
              <span class="preview-question-number mono">{{ String(selectedIndex + 1).padStart(2, '0') }}</span>
            </div>
            <div class="preview-question-card__body">
              <h2>{{ selectedItem.title }}</h2>
              <div class="preview-classification">
                <span><FolderTree :size="12" /> {{ (selectedItem.categoryPath || []).join(' / ') || '未分类' }}</span>
                <span v-if="selectedItem.tags?.length">
                  <Tags :size="12" /> {{ selectedItem.tags.map((tag) => `#${tag}`).join(' ') }}
                </span>
              </div>
              <div class="preview-rendered">
                <QuestionAnswerArea
                  :question="previewQuestion"
                  :model-value="previewAnswer"
                  readonly
                />
              </div>
              <div v-if="selectedItem.type === 'essay' && selectedItem.answer?.referenceMarkdown" class="preview-block">
                <p class="preview-block__label">参考答案</p>
                <MarkdownContent :source="selectedItem.answer.referenceMarkdown" />
              </div>
              <div v-if="selectedItem.type !== 'essay'" class="preview-block">
                <p class="preview-block__label">标准答案</p>
                <p class="preview-answer-text">{{ correctAnswerText(selectedItem.type, selectedItem.answer, previewQuestion) }}</p>
              </div>
              <div v-if="selectedItem.analysisMarkdown" class="preview-block">
                <p class="preview-block__label">解析</p>
                <MarkdownContent :source="selectedItem.analysisMarkdown" />
              </div>
            </div>
          </div>
        </div>

        <div class="preview-foot-actions">
          <p>确认后，以上 {{ preview.summary.total }} 道题会一次性创建为草稿。</p>
          <div>
            <button class="btn btn--secondary" type="button" @click="cancelPreview">取消</button>
            <button class="btn btn--primary" type="button" @click="requestConfirm">
              确认导入
              <ArrowRight :size="14" />
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="step === 'success' && createdResult" class="import-success">
      <div class="success-card">
        <span class="success-card__icon"><CheckCircle2 :size="27" :stroke-width="1.7" /></span>
        <p class="admin-eyebrow">Imported</p>
        <h2>已创建 {{ createdResult.importedCount }} 道题目草稿</h2>
        <p class="success-card__description">
          导入完成。所有题目当前为草稿状态，需要经过检查和发布后才会出现在公开题库中。
        </p>
        <div class="imported-titles">
          <div v-for="(title, index) in createdResult.titles" :key="index">
            <span class="mono">{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ title }}</span>
          </div>
        </div>
        <div class="success-card__actions">
          <button class="btn btn--secondary" type="button" @click="resetImport">继续导入</button>
          <RouterLink
            v-if="createdResult.questionIds.length"
            class="btn btn--secondary"
            :to="{ name: 'admin-question-edit', params: { id: createdResult.questionIds[0] } }"
          >
            编辑第一道题
          </RouterLink>
          <RouterLink class="btn btn--primary" :to="{ name: 'admin-questions', query: { status: 'draft' } }">
            查看全部草稿
            <ArrowRight :size="14" />
          </RouterLink>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmOpen"
      title="确认导入题目"
      :description="confirmDescription"
      confirm-text="创建草稿"
      :loading="confirming"
      @confirm="confirmImport"
    />
  </div>
</template>

<script>
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileUp,
  FolderTree,
  Info,
  LoaderCircle,
  Plus,
  Tags,
  UploadCloud,
} from 'lucide-vue-next';
import QuestionAnswerArea from '@/components/QuestionAnswerArea.vue';
import MarkdownContent from '@/components/MarkdownContent.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { api, del, getErrorMessage, post } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';
import {
  correctAnswerText,
  defaultAnswerFor,
  difficultyLabel,
  typeLabel,
} from '@/lib/format.js';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_IMPORT_QUESTIONS = 100;

const jsonExample = `{
  "version": 1,
  "questions": [
    {
      "title": "函数求值",
      "type": "single",
      "difficulty": "easy",
      "categoryPath": ["高等数学", "函数与极限"],
      "tags": ["基础"],
      "stem": "已知 $f(x)=x^2-1$，求 $f(2)$。",
      "options": [
        { "id": "A", "text": "2" },
        { "id": "B", "text": "3" }
      ],
      "answer": { "optionId": "B" },
      "analysis": "代入 $x=2$ 得 3。"
    }
  ]
}`;

function safeFilename(name) {
  return String(name || '题目导入').replace(/[\\/:*?"<>|]/g, '-');
}

export default {
  name: 'AdminImportView',
  components: {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronRight,
    Clock3,
    ConfirmDialog,
    Download,
    FileUp,
    FolderTree,
    Info,
    LoaderCircle,
    MarkdownContent,
    Plus,
    QuestionAnswerArea,
    Tags,
    UploadCloud,
  },
  data() {
    return {
      step: 'upload',
      dragging: false,
      uploading: false,
      uploadError: '',
      importErrors: [],
      preview: null,
      selectedIndex: 0,
      pendingToken: null,
      confirmOpen: false,
      confirming: false,
      createdResult: null,
      steps: [
        { value: 1, label: '上传文件' },
        { value: 2, label: '校验与预览' },
        { value: 3, label: '创建草稿' },
      ],
      jsonExample,
    };
  },
  computed: {
    currentStep() {
      if (this.step === 'upload') return 1;
      if (this.step === 'preview') return 2;
      return 3;
    },
    selectedItem() {
      return this.preview?.items?.[this.selectedIndex] || null;
    },
    previewQuestion() {
      if (!this.selectedItem) return null;
      return {
        id: 'import-preview',
        title: this.selectedItem.title,
        type: this.selectedItem.type,
        difficulty: this.selectedItem.difficulty,
        stemMarkdown: this.selectedItem.stemMarkdown,
        options: this.selectedItem.options || [],
        fillConfig:
          this.selectedItem.type === 'fill'
            ? { blanks: this.selectedItem.judgeConfig?.blanks || [] }
            : null,
      };
    },
    previewAnswer() {
      return this.previewQuestion ? defaultAnswerFor(this.previewQuestion) : {};
    },
    errorGroups() {
      const groups = new Map();
      for (const error of this.importErrors) {
        const key = String(error.index ?? error.title ?? 'file');
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            title: error.title || (error.index !== undefined ? `第 ${error.index + 1} 题` : '文件检查'),
            messages: [],
          });
        }
        groups.get(key).messages.push(error.message || String(error));
      }
      return [...groups.values()];
    },
    confirmDescription() {
      if (!this.preview) return '';
      return `将创建 ${this.preview.summary.total} 道新题目草稿。任意内容变更都需要在草稿中手动修改后重新发布，导入不会覆盖任何已有题目。`;
    },
  },
  beforeUnmount() {
    if (this.pendingToken) {
      del(`/admin/import/${this.pendingToken}`).catch(() => {});
    }
  },
  methods: {
    typeLabel,
    difficultyLabel,
    correctAnswerText,
    pickFile() {
      if (!this.uploading) this.$refs.fileInput?.click();
    },
    handleFileInput(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) this.handleFile(file);
    },
    handleDrop(event) {
      this.dragging = false;
      if (this.uploading) return;
      const file = event.dataTransfer?.files?.[0];
      if (file) this.handleFile(file);
    },
    validateFile(file) {
      const name = String(file.name || '').toLowerCase();
      if (!name.endsWith('.json') && !name.endsWith('.zip')) {
        return '只支持 .json 或 .zip 文件。';
      }
      if (file.size > MAX_FILE_BYTES) {
        return '文件大小不能超过 15MB。';
      }
      if (!file.size) {
        return '文件为空，请选择有效文件。';
      }
      return '';
    },
    async handleFile(file) {
      const validationError = this.validateFile(file);
      this.uploadError = validationError;
      this.importErrors = [];
      if (validationError) return;
      this.uploading = true;
      this.importErrors = [];
      try {
        const formData = new FormData();
        formData.append('file', file);
        const data = await api('/admin/import/preview', { method: 'POST', body: formData });
        if (data.summary?.total > MAX_IMPORT_QUESTIONS) {
          throw new Error(`单次最多导入 ${MAX_IMPORT_QUESTIONS} 道题目。`);
        }
        this.preview = data;
        this.pendingToken = data.token;
        this.selectedIndex = 0;
        this.step = 'preview';
      } catch (error) {
        this.uploadError = getErrorMessage(error, '导入文件解析失败。');
        if (Array.isArray(error?.details)) {
          this.importErrors = error.details;
        }
      } finally {
        this.uploading = false;
      }
    },
    requestConfirm() {
      if (!this.preview || this.confirming) return;
      this.confirmOpen = true;
    },
    async confirmImport() {
      if (!this.pendingToken || this.confirming) return;
      this.confirming = true;
      try {
        const result = await post('/admin/import/confirm', { token: this.pendingToken });
        this.pendingToken = null;
        this.createdResult = result;
        this.confirmOpen = false;
        this.step = 'success';
        toast.success(`已创建 ${result.importedCount} 道题目草稿。`);
      } catch (error) {
        toast.error(getErrorMessage(error, '创建草稿失败。'));
        if (String(error?.code || '').includes('IMPORT_TOKEN_EXPIRED')) {
          this.pendingToken = null;
          this.preview = null;
          this.step = 'upload';
          this.uploadError = '导入预览已失效，请重新上传文件。';
        }
        this.confirmOpen = false;
      } finally {
        this.confirming = false;
      }
    },
    async cancelPreview() {
      const token = this.pendingToken;
      this.pendingToken = null;
      this.preview = null;
      this.step = 'upload';
      this.selectedIndex = 0;
      this.uploadError = '';
      this.importErrors = [];
      if (token) {
        try {
          await del(`/admin/import/${token}`);
        } catch {
          // Expired imports are cleaned up automatically.
        }
      }
    },
    resetImport() {
      this.preview = null;
      this.createdResult = null;
      this.pendingToken = null;
      this.step = 'upload';
      this.uploading = false;
      this.uploadError = '';
      this.importErrors = [];
      this.selectedIndex = 0;
      this.dragging = false;
    },
    downloadTemplate() {
      const blob = new Blob([`${JSON.stringify({
        version: 1,
        questions: [
          {
            title: '函数求值示例',
            type: 'single',
            difficulty: 'easy',
            categoryPath: ['高等数学', '函数与极限'],
            tags: ['基础'],
            stem: '已知函数 $f(x)=x^{2}-1$，则 $f(2)$ 的值为（ ）。',
            options: [
              { id: 'A', text: '2' },
              { id: 'B', text: '3' },
              { id: 'C', text: '4' },
              { id: 'D', text: '5' },
            ],
            answer: { optionId: 'B' },
            analysis: '将 $x=2$ 代入得 $f(2)=3$。',
          },
        ],
      }, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeFilename('题序-题目导入示例')}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  },
};
</script>

<style scoped>
.import-page {
  max-width: 1240px;
  margin: 0 auto;
}

.admin-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}

.admin-eyebrow {
  color: var(--text-tertiary);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.admin-page-header h1 {
  margin-top: 7px;
  font-size: 26px;
  font-weight: 630;
  letter-spacing: -0.03em;
}

.admin-page-header__description {
  max-width: 680px;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12.5px;
}

.admin-page-header__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.import-steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 16px;
  padding: 10px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.import-step {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.import-step:last-child {
  flex: 0;
}

.import-step__label {
  white-space: nowrap;
}

.import-step__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  color: var(--text-tertiary);
  font-size: 8.5px;
  font-variant-numeric: tabular-nums;
}

.import-step.is-active {
  color: var(--text-primary);
}

.import-step.is-active .import-step__label {
  white-space: nowrap;
}

.import-step__number {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-foreground);
}

.import-step.is-done {
  color: var(--success);
}

.import-step.is-done .import-step__label {
  white-space: nowrap;
}

.import-step__number {
  border-color: var(--success-border);
  background: var(--success-bg);
  color: var(--success);
}

.import-step__line {
  flex: 1;
  min-width: 16px;
  height: 1px;
  margin: 0 14px;
  background: var(--border-default);
}

.import-upload-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.7fr);
  align-items: start;
  gap: 12px;
}

.upload-card {
  min-width: 0;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 28px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.dropzone:hover,
.dropzone.is-dragging {
  border-color: var(--text-secondary);
  background: var(--bg-subtle);
}

.dropzone.is-loading {
  cursor: wait;
}

.dropzone__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 53px;
  height: 53px;
  margin-bottom: 17px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.dropzone h2 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.dropzone p {
  max-width: 500px;
  margin: 6px 0 17px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.7;
}

.upload-alert {
  margin-top: 12px;
  align-items: flex-start;
}

.import-errors {
  margin-top: 12px;
  padding: 15px;
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-md);
  background: var(--danger-bg);
}

.import-errors__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--danger-border);
}

.import-errors__head h2 {
  color: var(--danger);
  font-size: 11.5px;
  font-weight: 600;
}

.import-errors__head p {
  margin-top: 2px;
  color: var(--danger);
  opacity: 0.75;
  font-size: 9.5px;
}

.error-group {
  padding-top: 9px;
}

.error-group strong {
  color: var(--danger);
  font-size: 10px;
  font-weight: 550;
}

.error-group ul {
  margin-top: 3px;
  padding-left: 15px;
  color: var(--danger);
  opacity: 0.85;
  font-size: 9.5px;
  line-height: 1.7;
}

.format-card {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.format-card__head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 15px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-subtle);
  color: var(--text-tertiary);
}

.format-card__head svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.format-card__head h2 {
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 600;
}

.format-card__head p {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10.5px;
}

.format-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 15px;
  padding-left: 29px;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.65;
  list-style: disc;
}

.format-list li::marker {
  color: var(--text-tertiary);
}

.format-structure {
  margin: 0 15px 12px;
  padding: 11px;
  border-radius: 7px;
  background: var(--bg-subtle);
}

.format-structure__label {
  margin-bottom: 5px;
  color: var(--text-tertiary);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.format-structure pre,
.format-example pre {
  margin: 0;
  overflow-x: auto;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.65;
}

.format-example {
  margin: 0 15px 15px;
  border: 1px solid var(--border-default);
  border-radius: 7px;
}

.format-example summary {
  padding: 8px 10px;
  color: var(--text-secondary);
  font-size: 9.5px;
  cursor: pointer;
}

.format-example[open] summary {
  border-bottom: 1px solid var(--border-default);
}

.format-example pre {
  max-height: 250px;
  padding: 10px;
  background: var(--bg-subtle);
}

.spin {
  animation: spin 0.8s linear infinite;
}

/* Preview step */
.preview-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-summary {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 15px 17px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.preview-summary h2 {
  margin-top: 5px;
  font-size: 17px;
  font-weight: 620;
  letter-spacing: -0.02em;
}

.preview-summary p {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.preview-summary__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.preview-validity {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: 9px;
  white-space: nowrap;
}

.preview-grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}

.preview-list-card,
.preview-question-card {
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.preview-list-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 13px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  font-size: 9px;
}

.preview-list {
  display: flex;
  flex-direction: column;
  max-height: 550px;
  overflow-y: auto;
}

.preview-list-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-tertiary);
  text-align: left;
  transition: background var(--transition-fast);
}

.preview-list-item:last-child {
  border-bottom: 0;
}

.preview-list-item:hover {
  background: var(--bg-subtle);
}

.preview-list-item.is-active {
  background: var(--bg-subtle);
}

.preview-list-item.is-active .preview-list-item__title {
  color: var(--text-primary);
}

.preview-list-item__index {
  color: var(--text-tertiary);
  font-size: 8.5px;
}

.preview-list-item__main {
  flex: 1;
  min-width: 0;
}

.preview-list-item__title {
  display: block;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-list-item__meta {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.preview-question-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 15px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-subtle);
}

.preview-question-card__head > div {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.preview-question-number {
  color: var(--text-tertiary);
  font-size: 9px;
}

.preview-question-card__body {
  padding: 19px;
}

.preview-question-card__body h2 {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 620;
  line-height: 1.45;
  letter-spacing: -0.02em;
}

.preview-classification {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 7px;
  color: var(--text-tertiary);
  font-size: 9px;
}

.preview-classification span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.preview-rendered {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border-default);
}

.preview-rendered :deep(.stem) {
  font-size: 14px;
  line-height: 1.75;
}

.preview-rendered :deep(.choice-list) {
  margin-top: 17px;
}

.preview-block {
  margin-top: 17px;
  padding-top: 14px;
  border-top: 1px solid var(--border-default);
}

.preview-block__label {
  margin-bottom: 7px;
  color: var(--text-tertiary);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.preview-block :deep(.prose) {
  font-size: 12px;
  line-height: 1.7;
}

.preview-answer-text {
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.7;
}

.preview-foot-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 15px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.preview-foot-actions p {
  color: var(--text-tertiary);
  font-size: 11.5px;
}

.preview-foot-actions > div {
  display: flex;
  gap: 7px;
}

/* Success step */
.import-success {
  display: flex;
  justify-content: center;
  padding: 22px 0 50px;
}

.success-card {
  width: min(620px, 100%);
  padding: 34px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  text-align: center;
}

.success-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border: 1px solid var(--success-border);
  border-radius: var(--radius-lg);
  background: var(--success-bg);
  color: var(--success);
}

.success-card > .admin-eyebrow {
  margin-top: 16px;
  color: var(--success);
}

.success-card h2 {
  margin-top: 5px;
  font-size: 21px;
  font-weight: 630;
  letter-spacing: -0.025em;
}

.success-card__description {
  max-width: 450px;
  margin: 8px auto 0;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.7;
}

.imported-titles {
  margin: 20px 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  text-align: left;
  overflow: hidden;
}

.imported-titles > div {
  display: flex;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-secondary);
  font-size: 10px;
}

.imported-titles > div:last-child {
  border-bottom: 0;
}

.imported-titles span:first-child {
  color: var(--text-tertiary);
  font-size: 8.5px;
}

.success-card__actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px;
}

@media (max-width: 1000px) {
  .import-upload-layout {
    grid-template-columns: 1fr;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }

  .preview-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    max-height: 220px;
  }

  .preview-list-item {
    border-right: 1px solid var(--border-default);
  }
}

@media (max-width: 700px) {
  .admin-page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .admin-page-header__actions {
    width: 100%;
  }

  .admin-page-header__actions .btn {
    flex: 1;
  }

  .import-step__label {
    display: none;
  }

  .import-step__line {
    margin: 0 8px;
  }

  .dropzone {
    padding: 36px 18px;
  }

  .preview-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .preview-summary__actions {
    width: 100%;
    justify-content: space-between;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }

  .preview-list {
    grid-template-columns: 1fr;
  }

  .preview-list-item {
    border-right: 0;
  }

  .preview-foot-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .preview-foot-actions > div {
    width: 100%;
  }

  .preview-foot-actions > div .btn {
    flex: 1;
  }

  .imported-titles {
    text-align: left;
  }

  .success-card {
    padding: 24px 18px;
  }

  .success-card__actions .btn {
    flex: 1;
    min-width: 130px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
