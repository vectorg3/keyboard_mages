import { Injectable } from '@angular/core';

/** Зацикленный звук, пока открыто окно ввода триггера (см. socket.activeCast()) — один
 *  переиспользуемый Audio-элемент на школу, start()/stop() вместо одноразового play(). */
@Injectable({ providedIn: 'root' })
export class CastingSoundService {
  private readonly audioByPath = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;

  start(path: string): void {
    if (this.current && !this.current.paused && this.audioByPath.get(path) === this.current) return;
    this.stop();

    let audio = this.audioByPath.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.loop = true;
      audio.volume = 0.15;
      this.audioByPath.set(path, audio);
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
    this.current = audio;
  }

  stop(): void {
    if (!this.current) return;
    this.current.pause();
    this.current.currentTime = 0;
    this.current = null;
  }
}
