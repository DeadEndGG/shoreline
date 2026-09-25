import { Pipe, PipeTransform } from '@angular/core';
import { formatPropertyTime, relativeTo, TimeFormat } from './property-time';

@Pipe({ name: 'ptime' })
export class PropertyTimePipe implements PipeTransform {
  transform(value: string | null | undefined, format: TimeFormat = 'dateTime'): string {
    return formatPropertyTime(value, format);
  }
}

@Pipe({ name: 'relative' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined, now: string | null | undefined): string {
    return relativeTo(value, now);
  }
}
