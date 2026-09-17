import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── 首頁 Landing Page（公開可訪問） ────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    pathMatch: 'full',
  },

  // ── Epic 0: 身份驗證 ────────────────────────────────────────────────────────
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
  { path: 'auth/callback/:provider', loadComponent: () => import('./features/auth/oauth-callback/oauth-callback.component').then(m => m.OAuthCallbackComponent) },

  // ── Epic 7: 版權與免責聲明（公開可訪問） ────────────────────────────────────
  { path: 'legal', loadComponent: () => import('./features/legal/legal-page/legal-page.component').then(m => m.LegalPageComponent) },

  // ── Epic 1: 角色管理（需登入） ────────────────────────────────────────────────
  {
    path: 'characters',
    loadComponent: () => import('./features/characters/character-list/character-list.component').then(m => m.CharacterListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'characters/new',
    loadComponent: () => import('./features/characters/character-form/character-form.component').then(m => m.CharacterFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'characters/:id/edit',
    loadComponent: () => import('./features/characters/character-form/character-form.component').then(m => m.CharacterFormComponent),
    canActivate: [authGuard],
  },

  // ── 角色 Shell（含 Tab 導覽，需登入） ────────────────────────────────────────
  {
    path: 'characters/:id',
    loadComponent: () => import('./features/characters/character-shell/character-shell.component').then(m => m.CharacterShellComponent),
    canActivate: [authGuard],
    children: [
      // Epic 2: 冒險紀錄表
      { path: 'adventures', loadComponent: () => import('./features/adventures/adventure-list/adventure-list.component').then(m => m.AdventureListComponent) },
      { path: 'adventures/new', loadComponent: () => import('./features/adventures/adventure-form/adventure-form.component').then(m => m.AdventureFormComponent) },
      { path: 'adventures/:entryId', loadComponent: () => import('./features/adventures/adventure-detail/adventure-detail.component').then(m => m.AdventureDetailComponent) },
      { path: 'adventures/:entryId/edit', loadComponent: () => import('./features/adventures/adventure-form/adventure-form.component').then(m => m.AdventureFormComponent) },

      // Epic 3: 倉庫
      { path: 'inventory', loadComponent: () => import('./features/inventory/inventory-list/inventory-list.component').then(m => m.InventoryListComponent) },
      { path: 'inventory/new', loadComponent: () => import('./features/inventory/inventory-form/inventory-form.component').then(m => m.InventoryFormComponent) },
      { path: 'inventory/:itemId/edit', loadComponent: () => import('./features/inventory/inventory-form/inventory-form.component').then(m => m.InventoryFormComponent) },

      // 預設子路由
      { path: '', redirectTo: 'adventures', pathMatch: 'full' },
    ],
  },

  // Fallback
  { path: '**', redirectTo: 'characters' },
];
