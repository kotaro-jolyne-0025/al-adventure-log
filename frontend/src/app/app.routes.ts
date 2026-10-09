import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── 首頁 Landing Page（公開可訪問） ────────────────────────────────────────
  {
    path: '', title: '冒險紀錄表 | 冒險紀錄表 Web版',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    pathMatch: 'full',
  },

  // ── Epic 0: 身份驗證 ────────────────────────────────────────────────────────
  { path: 'login', title: '登入 | 冒險紀錄表 Web版', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', title: '註冊 | 冒險紀錄表 Web版', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'forgot-password', title: '忘記密碼 | 冒險紀錄表 Web版', loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'reset-password', title: '重設密碼 | 冒險紀錄表 Web版', loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
  { path: 'auth/callback/:provider', title: '第三方登入 | 冒險紀錄表 Web版', loadComponent: () => import('./features/auth/oauth-callback/oauth-callback.component').then(m => m.OAuthCallbackComponent) },

  // ── Epic 7: 版權與免責聲明（公開可訪問） ────────────────────────────────────
  { path: 'legal', title: '版權與免責聲明 | 冒險紀錄表 Web版', loadComponent: () => import('./features/legal/legal-page/legal-page.component').then(m => m.LegalPageComponent) },

  // ── Epic 1: 角色管理（需登入） ────────────────────────────────────────────────
  {
    path: 'characters', title: '我的角色 | 冒險紀錄表 Web版',
    loadComponent: () => import('./features/characters/character-list/character-list.component').then(m => m.CharacterListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'characters/new', title: '新增角色 | 冒險紀錄表 Web版',
    loadComponent: () => import('./features/characters/character-form/character-form.component').then(m => m.CharacterFormComponent),
    canActivate: [authGuard],
  },
  // ── 角色 Shell（含 Tab 導覽，需登入） ────────────────────────────────────────
  {
    path: 'characters/:id', title: '角色 | 冒險紀錄表 Web版',
    loadComponent: () => import('./features/characters/character-shell/character-shell.component').then(m => m.CharacterShellComponent),
    canActivate: [authGuard],
    children: [
      // Epic 2: 冒險紀錄表
      { path: 'adventures', title: '冒險紀錄表 | 冒險紀錄表 Web版', loadComponent: () => import('./features/adventures/adventure-list/adventure-list.component').then(m => m.AdventureListComponent) },
      { path: 'adventures/new', title: '新增冒險紀錄 | 冒險紀錄表 Web版', loadComponent: () => import('./features/adventures/adventure-form/adventure-form.component').then(m => m.AdventureFormComponent) },
      { path: 'adventures/:entryId', title: '冒險紀錄詳情 | 冒險紀錄表 Web版', loadComponent: () => import('./features/adventures/adventure-detail/adventure-detail.component').then(m => m.AdventureDetailComponent) },
      { path: 'adventures/:entryId/edit', title: '編輯冒險紀錄 | 冒險紀錄表 Web版', loadComponent: () => import('./features/adventures/adventure-form/adventure-form.component').then(m => m.AdventureFormComponent) },
      { path: 'edit', title: '編輯角色 | 冒險紀錄表 Web版', loadComponent: () => import('./features/characters/character-form/character-form.component').then(m => m.CharacterFormComponent) },

      // Epic 3: 倉庫
      { path: 'inventory', title: '倉庫 | 冒險紀錄表 Web版', loadComponent: () => import('./features/inventory/inventory-list/inventory-list.component').then(m => m.InventoryListComponent) },
      { path: 'inventory/new', title: '新增物品 | 冒險紀錄表 Web版', loadComponent: () => import('./features/inventory/inventory-form/inventory-form.component').then(m => m.InventoryFormComponent) },
      { path: 'inventory/:itemId/edit', title: '編輯物品 | 冒險紀錄表 Web版', loadComponent: () => import('./features/inventory/inventory-form/inventory-form.component').then(m => m.InventoryFormComponent) },

      // 預設子路由
      { path: '', redirectTo: 'adventures', pathMatch: 'full' },
    ],
  },

  // Fallback
  { path: '**', redirectTo: 'characters' },
];
