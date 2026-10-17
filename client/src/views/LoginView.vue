<template>
  <AuthShell
    aside-eyebrow="Welcome back"
    panel-eyebrow="Sign in"
    form-title="登录账户"
    form-description="登录后，你的作答历史、错题与收藏会随账户同步。"
  >
    <div v-if="expired" class="alert alert--warning auth-alert">
      <Clock3 :size="15" class="alert__icon" />
      <span>登录状态已失效，请重新登录以继续。</span>
    </div>

    <div v-if="errorMessage" class="alert alert--danger auth-alert" role="alert">
      <AlertCircle :size="15" class="alert__icon" />
      <span>{{ errorMessage }}</span>
    </div>

    <form class="auth-form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">用户名</span>
        <div class="auth-input-wrap">
          <UserRound :size="15" class="auth-input-icon" />
          <input
            v-model="form.username"
            class="input auth-input"
            type="text"
            autocomplete="username"
            placeholder="输入用户名"
            maxlength="24"
            autofocus
          />
        </div>
      </label>

      <label class="field">
        <span class="field__label">密码</span>
        <div class="auth-input-wrap">
          <LockKeyhole :size="15" class="auth-input-icon" />
          <input
            v-model="form.password"
            class="input auth-input auth-input--password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="输入密码"
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

      <button class="btn btn--primary btn--lg btn--block auth-submit" type="submit" :disabled="submitting">
        <LoaderCircle v-if="submitting" :size="16" class="btn__spinner" />
        {{ submitting ? '正在登录…' : '登录' }}
      </button>
    </form>

    <div class="auth-switch">
      还没有账户？
      <RouterLink :to="registerLink">免费注册</RouterLink>
    </div>

    <div class="auth-divider">
      <span>或者</span>
    </div>

    <RouterLink class="btn btn--secondary btn--block" to="/questions">
      以游客身份继续刷题
      <ArrowRight :size="14" />
    </RouterLink>
    <p class="auth-guest-note">游客作答记录保存在当前浏览器，登录后可选择合并。</p>
  </AuthShell>
</template>

<script>
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from 'lucide-vue-next';
import AuthShell from '@/components/AuthShell.vue';
import { login } from '@/stores/auth.js';
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
  name: 'LoginView',
  components: {
    AlertCircle,
    ArrowRight,
    AuthShell,
    Clock3,
    Eye,
    EyeOff,
    LoaderCircle,
    LockKeyhole,
    UserRound,
  },
  data() {
    return {
      form: { username: '', password: '' },
      showPassword: false,
      submitting: false,
      errorMessage: '',
      expired: this.$route.query.expired === '1',
    };
  },
  computed: {
    redirect() {
      return safeRedirect(this.$route.query.redirect);
    },
    registerLink() {
      return {
        name: 'register',
        query: this.$route.query.redirect ? { redirect: this.$route.query.redirect } : {},
      };
    },
  },
  methods: {
    async submit() {
      this.errorMessage = '';
      if (!this.form.username.trim() || !this.form.password) {
        this.errorMessage = '请输入用户名和密码。';
        return;
      }
      this.submitting = true;
      try {
        await login(this.form.username.trim(), this.form.password);
        toast.success('欢迎回来。');
        await this.$router.replace(this.redirect);
      } catch (error) {
        this.errorMessage = getErrorMessage(error, '登录失败，请稍后重试。');
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
  gap: 16px;
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
  margin-top: 22px;
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

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  color: var(--text-tertiary);
  font-size: 10px;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-default);
}

.auth-guest-note {
  margin-top: 9px;
  color: var(--text-tertiary);
  font-size: 10.5px;
  line-height: 1.6;
  text-align: center;
}
</style>
