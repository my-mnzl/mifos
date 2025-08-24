/** Angular Imports */
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// Not Found Component
import { NotFoundComponent } from './not-found/not-found.component';

// OAuth Callback Component
import { OAuthCallbackComponent } from './core/authentication/oauth-callback.component';

/**
 * Fallback to this route when no prior route is matched.
 */
const routes: Routes = [
  {
    path: 'auth/callback',
    component: OAuthCallbackComponent
  },
  {
    path: '**',
    component: NotFoundComponent
  }
];

/**
 * App Routing Module.
 *
 * Configures the fallback route.
 */
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: []
})
export class AppRoutingModule {}
