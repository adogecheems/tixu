<template>
  <RouterLink :to="to" class="brand" :class="{ 'brand--inverse': inverse, 'brand--compact': compact }">
    <span class="brand__mark">序</span>
    <span v-if="!compact" class="brand__text">
      <span class="brand__name">{{ name }}</span>
      <span class="brand__sub">TIXU</span>
    </span>
  </RouterLink>
</template>

<script>
export default {
  name: 'AppLogo',
  props: {
    to: { type: [String, Object], default: '/' },
    compact: { type: Boolean, default: false },
    inverse: { type: Boolean, default: false },
    name: { type: String, default: '题序' },
  },
};
</script>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.brand__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #20201f;
  color: #fafaf9;
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .brand__mark {
  background: #f2f2f0;
  color: #171716;
}

.brand__text {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.brand__name {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.brand__sub {
  color: var(--text-tertiary);
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.16em;
}

.brand--inverse .brand__mark {
  background: #fafaf9;
  color: #1b1b1a;
}

.brand--inverse .brand__name {
  color: #fafaf9;
}

.brand--inverse .brand__sub {
  color: rgba(250, 250, 249, 0.42);
}

.brand--compact .brand__mark {
  width: 30px;
  height: 30px;
}
</style>
