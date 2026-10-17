<template>
  <div ref="root" class="theme-switcher">
    <button
      class="theme-trigger"
      type="button"
      :aria-label="`主题：${currentLabel}`"
      :aria-expanded="open"
      aria-haspopup="menu"
      :title="`主题：${currentLabel}`"
      @click.stop="toggle"
    >
      <component :is="currentIcon" :size="18" :stroke-width="1.8" />
    </button>
    <Transition name="pop">
      <div v-if="open" class="popover theme-menu" role="menu" aria-label="选择主题">
        <p class="theme-menu__title">界面主题</p>
        <button
          v-for="item in options"
          :key="item.value"
          class="menu-item"
          :class="{ 'is-active': themeState.preference === item.value }"
          type="button"
          role="menuitemradio"
          :aria-checked="themeState.preference === item.value"
          @click="select(item.value)"
        >
          <component :is="item.icon" :size="15" />
          <span>{{ item.label }}</span>
          <Check v-if="themeState.preference === item.value" :size="14" class="theme-menu__check" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script>
import { Check, Monitor, Moon, Sun } from 'lucide-vue-next';
import { setThemePreference, themeState } from '@/stores/theme.js';

export default {
  name: 'ThemeSwitcher',
  components: { Check, Monitor, Moon, Sun },
  data() {
    return {
      open: false,
      themeState,
      options: [
        { value: 'system', label: '跟随系统', icon: Monitor },
        { value: 'light', label: '浅色模式', icon: Sun },
        { value: 'dark', label: '深色模式', icon: Moon },
      ],
    };
  },
  computed: {
    currentIcon() {
      if (themeState.preference === 'light') return Sun;
      if (themeState.preference === 'dark') return Moon;
      return Monitor;
    },
    currentLabel() {
      return this.options.find((item) => item.value === themeState.preference)?.label || '跟随系统';
    },
  },
  watch: {
    open(value) {
      if (value) this.$nextTick(() => document.addEventListener('pointerdown', this.onOutside));
      else document.removeEventListener('pointerdown', this.onOutside);
    },
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.onOutside);
  },
  methods: {
    toggle() {
      this.open = !this.open;
    },
    select(value) {
      setThemePreference(value);
      this.open = false;
    },
    onOutside(event) {
      if (!this.$refs.root?.contains(event.target)) this.open = false;
    },
  },
};
</script>

<style scoped>
.theme-switcher {
  position: relative;
}

.theme-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.theme-trigger:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.theme-menu {
  top: calc(100% + 8px);
  right: 0;
  min-width: 172px;
}

.theme-menu__title {
  padding: 6px 10px 7px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 560;
  letter-spacing: 0.05em;
}

.theme-menu__check {
  margin-left: auto;
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
