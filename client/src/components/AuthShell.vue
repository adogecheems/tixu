<template>
  <div class="container auth-page">
    <div class="auth-shell">
      <aside class="auth-aside">
        <div>
          <p class="eyebrow auth-eyebrow"><span class="eyebrow__dot" />{{ asideEyebrow }}</p>
          <h1 class="auth-aside__title">
            让每一次练习，<br />
            都有回响。
          </h1>
          <p class="auth-aside__description">
            一个简洁、专注的在线刷题空间。记录你的作答，保留每一次思考的痕迹。
          </p>
        </div>

        <ul class="auth-features">
          <li v-for="feature in features" :key="feature.title">
            <span class="auth-feature__icon"><Check :size="13" /></span>
            <div>
              <strong>{{ feature.title }}</strong>
              <p>{{ feature.description }}</p>
            </div>
          </li>
        </ul>

        <div class="auth-aside__foot">
          <span class="auth-aside__line" />
          <p>题序 TIXU · 认真对待每一道题</p>
        </div>
      </aside>

      <section class="auth-panel">
        <div class="auth-panel__head">
          <p class="auth-panel__eyebrow">{{ panelEyebrow }}</p>
          <h2>{{ formTitle }}</h2>
          <p>{{ formDescription }}</p>
        </div>
        <slot />
      </section>
    </div>
  </div>
</template>

<script>
import { Check } from 'lucide-vue-next';

export default {
  name: 'AuthShell',
  components: { Check },
  props: {
    asideEyebrow: { type: String, default: 'Welcome' },
    panelEyebrow: { type: String, default: 'Account' },
    formTitle: { type: String, required: true },
    formDescription: { type: String, required: true },
  },
  data() {
    return {
      features: [
        { title: '即时反馈', description: '提交后立即查看判题结果与完整解析。' },
        { title: '错题沉淀', description: '自动整理当前需要复习的题目。' },
        { title: '跨设备同步', description: '登录后学习记录随账户保存。' },
      ],
    };
  },
};
</script>

<style scoped>
.auth-page {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding-top: clamp(34px, 5vh, 52px);
  padding-bottom: clamp(40px, 6vh, 72px);
}

.auth-shell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  max-width: 1000px;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  background: var(--bg-surface);
  box-shadow: var(--shadow-xs);
}

.auth-aside {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 590px;
  padding: 42px 40px 32px;
  border-right: 1px solid var(--border-default);
  background: var(--bg-subtle);
}

.auth-eyebrow {
  color: var(--text-tertiary);
}

.auth-aside__title {
  margin-top: 22px;
  font-size: clamp(30px, 3.3vw, 40px);
  font-weight: 620;
  line-height: 1.3;
  letter-spacing: -0.045em;
}

.auth-aside__description {
  max-width: 340px;
  margin-top: 17px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.8;
}

.auth-features {
  display: flex;
  flex-direction: column;
  gap: 17px;
  margin-top: 40px;
  padding-top: 26px;
  border-top: 1px solid var(--border-default);
  list-style: none;
}

.auth-features li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.auth-feature__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  flex-shrink: 0;
  margin-top: 1px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  background: var(--bg-surface);
}

.auth-features strong {
  display: block;
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 560;
}

.auth-features p {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.55;
}

.auth-aside__foot {
  padding-top: 28px;
}

.auth-aside__line {
  display: block;
  width: 26px;
  height: 1px;
  margin-bottom: 14px;
  background: var(--border-strong);
}

.auth-aside__foot p {
  color: var(--text-tertiary);
  font-size: 10px;
  letter-spacing: 0.03em;
}

.auth-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 52px 56px;
}

.auth-panel__head {
  margin-bottom: 26px;
}

.auth-panel__eyebrow {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.auth-panel__head h2 {
  margin-top: 9px;
  font-size: 25px;
  font-weight: 630;
  letter-spacing: -0.03em;
}

.auth-panel__head > p:last-child {
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .auth-page {
    padding-top: 28px;
    padding-bottom: 48px;
  }

  .auth-shell {
    grid-template-columns: 1fr;
    max-width: 560px;
  }

  .auth-aside {
    min-height: 0;
    padding: 28px 28px 24px;
    border-right: 0;
    border-bottom: 1px solid var(--border-default);
  }

  .auth-aside__title {
    margin-top: 12px;
    font-size: 29px;
  }

  .auth-aside__description {
    margin-top: 10px;
    font-size: 12px;
  }

  .auth-features {
    display: none;
  }

  .auth-aside__foot {
    display: none;
  }

  .auth-panel {
    padding: 32px 28px 34px;
  }
}

@media (max-width: 480px) {
  .auth-aside {
    padding: 22px 20px 20px;
  }

  .auth-aside__title {
    font-size: 25px;
  }

  .auth-panel {
    padding: 26px 20px 28px;
  }

  .auth-panel__head h2 {
    font-size: 22px;
  }
}
</style>
