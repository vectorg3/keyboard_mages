import { Injectable } from '@angular/core';

/** Один переиспользуемый Audio-элемент на все клики в приложении — см. App.onStageClick()
 *  (делегирование клика с <main class="stage">, а не обработчик на каждой кнопке). */
@Injectable({ providedIn: 'root' })
export class ClickSoundService {
  private readonly audio = new Audio('/sounds/click.wav');

  constructor() {
    this.audio.volume = 0.2;
  }

  play(): void {
    this.audio.currentTime = 0;
    this.audio.play().catch(() => {});
  }
}
