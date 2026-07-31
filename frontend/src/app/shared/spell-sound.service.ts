import { Injectable } from '@angular/core';

/** Проигрывает звук каста заклинания (SPELL_SOUND) — по одному переиспользуемому Audio-элементу
 *  на путь, чтобы повторный каст того же заклинания перезапускал звук, а не глотался браузером. */
@Injectable({ providedIn: 'root' })
export class SpellSoundService {
  private readonly audioByPath = new Map<string, HTMLAudioElement>();

  play(path: string): void {
    let audio = this.audioByPath.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.volume = 0.1;
      this.audioByPath.set(path, audio);
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}
