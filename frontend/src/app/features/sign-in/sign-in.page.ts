import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DEMO_CREDENTIALS, DemoSession } from '../../core/auth/demo-session';
import { OWNERSHIP } from '../../core/ownership';
import { BrandMark } from '../../shared/ui/brand-mark';
import { Icon } from '../../shared/ui/icon';

/** Cosmetic sign-in for presentations. Any password works; nothing is verified or sent. */
@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule, BrandMark, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-in.page.html',
  styleUrl: './sign-in.page.scss',
})
export class SignInPage {
  readonly redirect = input<string | undefined>(undefined);

  private readonly session = inject(DemoSession);
  private readonly router = inject(Router);

  protected readonly form = new FormGroup({
    email: new FormControl(DEMO_CREDENTIALS.email, { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl(DEMO_CREDENTIALS.password, { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly credentials = DEMO_CREDENTIALS;
  protected readonly ownership = OWNERSHIP;

  protected async submit() {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    // A short, deliberate pause so the transition feels like a real sign-in.
    await new Promise((resolve) => setTimeout(resolve, 650));
    this.session.signIn(this.form.controls.email.value.trim());
    const target = this.redirect();
    await this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('/sign-in') ? target : '/overview');
  }

  protected error(field: 'email' | 'password'): string | null {
    const control = this.form.controls[field];
    if (!(control.touched || this.submitted()) || control.valid) return null;
    return field === 'email' ? 'Enter a valid email address.' : 'Enter your password.';
  }
}
