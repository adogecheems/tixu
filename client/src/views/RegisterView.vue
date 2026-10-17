<template>
  <AuthShell
    aside-eyebrow="Join Tixu"
    panel-eyebrow="Create account"
    form-title="创建账户"
    form-description="注册后自动登录。你的学习记录会安全地保存到账户中。"
  >
    <div v-if="errorMessage" class="alert alert--danger auth-alert" role="alert">
      <AlertCircle :size="15" class="alert__icon" />
      <span>{{ errorMessage }}</span>
    </div>

    <form class="auth-form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">
          用户名
          <span class="field__label-hint">3–24 个字符</span>
        </span>
        <div class="auth-input-wrap">
          <UserRound :size="15" class="auth-input-icon" />
          <input
            v-model="form.username"
            class="input auth-input"
            type="text"
            autocomplete="username"
            placeholder="中文、字母、数字、下划线或短横线"
            maxlength="24"
            autofocus
          />
        </div>
      </label>

      <label class="field">
        <span class="field__label">
          密码
          <span class="field__label-hint">至少 8 个字符</span>
        </span>
        <div class="auth-input-wrap">
          <LockKeyhole :size="15" class="auth-input-icon" />
          <input
            v-model="form.password"
            class="input auth-input auth-input--password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="设置登录密码"
            maxlength="128"
          />
          <button
            class="password-toggle"
            type="button"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="15" />
            <Eye v-else :size="15" />
          </button>
        </div>
      </label>

      <label class="field">
        <span class="field__label">确认密码</span>
        <div class="auth-input-wrap">
          <LockKeyhole :size="15" class="auth-input-icon" />
          <input
            v-model="form.confirmPassword"
            class="input auth-input"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="再次输入密码"
            maxlength="128"
          />
        </div>
      </label>

      <button class="btn btn--primary btn--lg btn--block auth-submit" type="submit" :disabled="submitting">
        <LoaderCircle v-if="submitting" :size="16" class="btn__spinner" />
        {{ submitting ? '正在创建账户…' : '创建账户并登录' }}
      </button>
    </form>

    <div class="auth-switch">
      已经有账户？
      <RouterLink :to="loginLink">直接登录</RouterLink>
    </div>

    <RouterLink class="auth-back" to="/questions">
      <ArrowLeft :size="13" />
      先以游客身份看看
    </RouterLink>
  </AuthShell>
</template>

<script>
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from 'lucide-vue-next';
import AuthShell from '@/components/AuthShell.vue';
import { register } from '@/stores/auth.js';
import { getErrorMessage } from '@/lib/api.js';
import { toast } from '@/stores/toast.js';

function safeRedirect(value) {
  const redirect = String(value || '');
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return '/questions';
  if (redirect === '/' || redirect.startsWith('/login') || redirect.startsWith('/register')) {
    return '/questions';
  }
  return redirect;
}

export default {
  name: 'RegisterView',
  components: {
    AlertCircle,
    ArrowLeft,
    AuthShell,
    Eye,
    EyeOff,
    LoaderCircle,
    LockKeyhole,
    UserRound,
  },
  data() {
    return {
      form: { username: '', password: '', confirmPassword: '' },
      showPassword: false,
      submitting: false,
      errorMessage: '',
    };
  },
  computed: {
    redirect() {
      return safeRedirect(this.$route.query.redirect);
    },
    loginLink() {
      return {
        name: 'login',
        query: this.$route.query.redirect ? { redirect: this.$route.query.redirect } : {},
      };
    },
  },
  methods: {
    async submit() {
      this.errorMessage = '';
      const username = this.form.username.trim();
      if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)) {
        this.errorMessage = '用户名需为 3–24 个字符，可使用中文、字母、数字、下划线或短横线。';
        return;
      }
      if (this.form.password.length < 8) {
        this.errorMessage = '密码长度至少为 8 个字符。';
        return;
      }
      if (this.form.password !== this.form.confirmPassword) {
        this.errorMessage = '两次输入的密码不一致。';
        return;
      }
      this.submitting = true;
      try {
        await register(username, this.form.password);
        toast.success('账户已创建，已自动登录。');
        await this.$router.replace(this.redirect);
      } catch (error) {
        this.errorMessage = getErrorMessage(error, '注册失败，请稍后重试。');
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.auth-alert {
  margin-bottom: 16px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-input-wrap {
  position: relative;
}

.auth-input {
  height: 43px;
  padding-left: 36px;
  padding-right: 38px;
  background: var(--bg-surface);
}

.auth-input-icon {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  transform: translateY(-50%);
  border-radius: 6px;
  color: var(--text-tertiary);
}

.password-toggle:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.auth-submit {
  margin-top: 4px;
}

.auth-switch {
  margin-top: 18px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.auth-switch a {
  color: var(--text-primary);
  font-weight: 560;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.auth-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 16px;
  color: var(--text-tertiary);
  font-size: 11px;
}

.auth-back:hover {
  color: var(--text-primary);
}
</style>
