import { Routes } from '@angular/router';
import { CharacterListComponent } from './features/characters/character-list/character-list.component';
import { CharacterFormComponent } from './features/characters/character-form/character-form.component';
import { CharacterShellComponent } from './features/characters/character-shell/character-shell.component';
import { AdventureListComponent } from './features/adventures/adventure-list/adventure-list.component';
import { AdventureDetailComponent } from './features/adventures/adventure-detail/adventure-detail.component';
import { AdventureFormComponent } from './features/adventures/adventure-form/adventure-form.component';
import { InventoryListComponent } from './features/inventory/inventory-list/inventory-list.component';
import { InventoryFormComponent } from './features/inventory/inventory-form/inventory-form.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { OAuthCallbackComponent } from './features/auth/oauth-callback/oauth-callback.component';
import { HomeComponent } from './features/home/home.component';
import { LegalPageComponent } from './features/legal/legal-page/legal-page.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── 首頁 Landing Page（公開可訪問） ────────────────────────────────────────
  { path: '', component: HomeComponent, pathMatch: 'full' },

  // ── Epic 0: 身份驗證 ────────────────────────────────────────────────────────
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'auth/callback/:provider', component: OAuthCallbackComponent },

  // ── Epic 7: 版權與免責聲明（公開可訪問） ────────────────────────────────────
  { path: 'legal', component: LegalPageComponent },

  // ── Epic 1: 角色管理（需登入） ────────────────────────────────────────────────
  { path: 'characters', component: CharacterListComponent, canActivate: [authGuard] },
  { path: 'characters/new', component: CharacterFormComponent, canActivate: [authGuard] },
  { path: 'characters/:id/edit', component: CharacterFormComponent, canActivate: [authGuard] },

  // ── 角色 Shell（含 Tab 導覽，需登入） ────────────────────────────────────────
  {
    path: 'characters/:id',
    component: CharacterShellComponent,
    canActivate: [authGuard],
    children: [
      // Epic 2: 冒險日誌
      { path: 'adventures', component: AdventureListComponent },
      { path: 'adventures/new', component: AdventureFormComponent },
      { path: 'adventures/:entryId', component: AdventureDetailComponent },
      { path: 'adventures/:entryId/edit', component: AdventureFormComponent },

      // Epic 3: 倉庫
      { path: 'inventory', component: InventoryListComponent },
      { path: 'inventory/new', component: InventoryFormComponent },
      { path: 'inventory/:itemId/edit', component: InventoryFormComponent },

      // 預設子路由
      { path: '', redirectTo: 'adventures', pathMatch: 'full' },
    ],
  },

  // Fallback
  { path: '**', redirectTo: 'characters' },
];

