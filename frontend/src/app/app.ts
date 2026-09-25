import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastOutlet } from './shared/ui/toast-outlet';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-toast-outlet />`,
})
export class App {}
