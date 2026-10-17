import { createRouter, createWebHistory } from 'vue-router';
import { authState, isAdmin } from '@/stores/auth.js';
import { toast } from '@/stores/toast.js';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '开始' },
  },
  {
    path: '/questions',
    name: 'questions',
    component: () => import('@/views/QuestionsView.vue'),
    meta: { title: '题库' },
  },
  {
    path: '/questions/:id',
    name: 'question',
    component: () => import('@/views/QuestionDetailView.vue'),
    meta: { title: '单题练习' },
  },
  {
    path: '/wrong',
    name: 'wrong',
    component: () => import('@/views/CollectionView.vue'),
    props: { mode: 'wrong' },
    meta: { title: '错题本' },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('@/views/CollectionView.vue'),
    props: { mode: 'favorites' },
    meta: { title: '收藏夹' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: '作答历史' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { title: '学习中心', requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { title: '注册', guestOnly: true },
  },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { layout: 'admin', requiresAdmin: true, title: '管理后台' },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/AdminDashboardView.vue'),
        meta: { title: '管理概览' },
      },
      {
        path: 'questions',
        name: 'admin-questions',
        component: () => import('@/views/admin/AdminQuestionsView.vue'),
        meta: { title: '题目管理' },
      },
      {
        path: 'questions/new',
        name: 'admin-question-new',
        component: () => import('@/views/admin/AdminQuestionEditorView.vue'),
        meta: { title: '新建题目' },
      },
      {
        path: 'questions/:id/edit',
        name: 'admin-question-edit',
        component: () => import('@/views/admin/AdminQuestionEditorView.vue'),
        meta: { title: '编辑题目' },
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/AdminCategoriesView.vue'),
        meta: { title: '分类管理' },
      },
      {
        path: 'tags',
        name: 'admin-tags',
        component: () => import('@/views/admin/AdminTagsView.vue'),
        meta: { title: '标签管理' },
      },
      {
        path: 'import',
        name: 'admin-import',
        component: () => import('@/views/admin/AdminImportView.vue'),
        meta: { title: '批量导入' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.name === 'question' && from.name === 'question') return { top: 0 };
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  if (to.name === 'home' && authState.user) {
    return { name: 'questions' };
  }
  if (to.meta.requiresAuth && !authState.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin) {
    if (!authState.user) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (!isAdmin()) {
      toast.error('当前账户没有访问管理后台的权限。');
      return { name: 'questions' };
    }
  }
  if (to.meta.guestOnly && authState.user) {
    return { name: 'profile' };
  }
  return true;
});

router.afterEach((to) => {
  const title = to.meta.title;
  document.title = title ? `${title} · 题序` : '题序 · 在线刷题平台';
});

export default router;
