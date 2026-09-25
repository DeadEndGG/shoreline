import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input } from '@angular/core';
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Ban, Building2, Calendar, CalendarPlus, Camera, Car, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleDot, CirclePause, CircleX, Clock, Copy,
  CopyCheck, DoorOpen, Dumbbell, Ellipsis, ExternalLink, Eye, EyeOff, FastForward, Fence, History, House, Info,
  KeyRound, LayoutDashboard, LayoutGrid, List, LoaderCircle, Lock, LogIn, LogOut, Mail, Mailbox, MapPin,
  Menu, MessageSquare, Package, Phone, Play, Plus, QrCode, RefreshCw, RotateCcw, Search, Send, Server, ShieldCheck,
  SlidersHorizontal, Smartphone, Sofa, Split, Sun, TriangleAlert, Umbrella, User, Users, Waves, Wifi, WifiOff,
  Wrench, X, type IconNode,
} from 'lucide';

const icons = {
  activity: Activity, 'arrow-right': ArrowRight, 'arrow-up-right': ArrowUpRight, 'badge-check': BadgeCheck, ban: Ban,
  building: Building2, calendar: Calendar, 'calendar-plus': CalendarPlus, camera: Camera, car: Car, check: Check,
  'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'circle-alert': CircleAlert,
  'circle-check': CircleCheck, 'circle-dot': CircleDot, 'circle-pause': CirclePause, 'circle-x': CircleX, clock: Clock,
  copy: Copy, 'copy-check': CopyCheck, door: DoorOpen, dumbbell: Dumbbell, ellipsis: Ellipsis, 'external-link': ExternalLink,
  eye: Eye, 'eye-off': EyeOff, 'fast-forward': FastForward, fence: Fence, history: History, house: House, info: Info,
  key: KeyRound, dashboard: LayoutDashboard, grid: LayoutGrid, list: List, loader: LoaderCircle, lock: Lock,
  'log-in': LogIn, 'log-out': LogOut, mail: Mail, mailbox: Mailbox, 'map-pin': MapPin, menu: Menu, message: MessageSquare,
  package: Package, phone: Phone, play: Play, plus: Plus, qr: QrCode, refresh: RefreshCw, reset: RotateCcw,
  search: Search, send: Send, server: Server, shield: ShieldCheck, sliders: SlidersHorizontal, smartphone: Smartphone,
  sofa: Sofa, split: Split, sun: Sun, warning: TriangleAlert, umbrella: Umbrella, user: User, users: Users,
  waves: Waves, wifi: Wifi, 'wifi-off': WifiOff, wrench: Wrench, x: X,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof icons;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Thin-stroke icon set (Lucide, ISC) rendered as inline SVG — bundled, no network requests. */
@Component({
  selector: 'app-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  styles: `:host { display: inline-flex; flex: none; line-height: 0; } :host ::ng-deep svg { width: 100%; height: 100%; }`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(16);
  readonly stroke = input(1.75);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const svg = document.createElementNS(SVG_NS, 'svg');
      const attrs: Record<string, string> = {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': String(this.stroke()),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', focusable: 'false',
      };
      for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
      for (const [tag, nodeAttrs] of icons[this.name()]) {
        const child = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(nodeAttrs)) child.setAttribute(k, String(v));
        svg.appendChild(child);
      }
      this.host.nativeElement.replaceChildren(svg);
    });
  }
}
