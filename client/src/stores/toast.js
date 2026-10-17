import { reactive } from 'vue';

let seed = 0;

export const toastState = reactive({
  items: [],
});

function dismiss(id) {
  const index = toastState.items.findIndex((item) => item.id === id);
  if (index !== -1) toastState.items.splice(index, 1);
}

function push(message, tone = 'neutral', timeout = 3800) {
  const id = ++seed;
  toastState.items.push({
    id,
    message,
    tone,
    createdAt: Date.now(),
  });
  if (timeout > 0) {
    window.setTimeout(() => dismiss(id), timeout);
  }
  return id;
}

export const toast = {
  success(message, timeout) {
    return push(message, 'success', timeout);
  },
  error(message, timeout) {
    return push(message, 'danger', timeout ?? 5000);
  },
  info(message, timeout) {
    return push(message, 'neutral', timeout);
  },
  warning(message, timeout) {
    return push(message, 'warning', timeout);
  },
  dismiss,
};

export function clearToasts() {
  toastState.items.splice(0, toastState.items.length);
}
