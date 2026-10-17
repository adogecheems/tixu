import { reactive } from 'vue';

export const studyState = reactive({
  version: 0,
});

export function notifyStudyChange() {
  studyState.version += 1;
}
