import { AnimatedSprite, Rectangle, Texture } from 'pixi.js';
import { SpriteGrid } from './sprite-sheet-data';

/** Slices a sprite grid into ordered frame textures — left-to-right, then top-to-bottom, the
 *  same order the old CSS background-position keyframes stepped through. */
function sliceFrames(baseTexture: Texture, grid: SpriteGrid): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < grid.frameCount; i++) {
    const column = i % grid.columns;
    const row = Math.floor(i / grid.columns);
    frames.push(
      new Texture({
        source: baseTexture.source,
        frame: new Rectangle(
          column * grid.frameWidth,
          row * grid.frameHeight,
          grid.frameWidth,
          grid.frameHeight,
        ),
      }),
    );
  }
  return frames;
}

/** Builds a ready-to-play AnimatedSprite from a loaded sheet texture + its grid geometry, paced
 *  to run the whole sheet in exactly grid.durationMs — the canvas equivalent of the old CSS
 *  `animation-duration` + `steps(1)`. `loop: false` also stops on the last frame instead of
 *  looping back, matching the old `animation-fill-mode: forwards` used for the death sprite. */
export function createAnimatedSprite(
  baseTexture: Texture,
  grid: SpriteGrid,
  { loop, onComplete }: { loop: boolean; onComplete?: () => void },
): AnimatedSprite {
  const frames = sliceFrames(baseTexture, grid);
  const sprite = new AnimatedSprite(frames);
  sprite.loop = loop;
  // animationSpeed is "sheet frames per ticker tick"; the ticker runs at ~60fps, so convert the
  // wall-clock duration into that unit to reproduce the CSS timing exactly.
  const totalTicks = (grid.durationMs / 1000) * 60;
  sprite.animationSpeed = frames.length / totalTicks;
  sprite.anchor.set(0.5);
  if (onComplete) sprite.onComplete = onComplete;
  sprite.gotoAndPlay(0);
  return sprite;
}
