import type { ReactNode } from 'react';

import { samplePixels } from '../../engine/sample-pixels';
import type { SkImage } from '../../engine/skia';
import { showError } from '../../ui/dialogs';
import { reportError } from '../analytics/analytics';
import { BeautyControls, FaceShapeControls } from '../camera/beauty-sheet';
import { MakeupControls } from '../makeup/makeup-controls';
import type { Size } from '../photo/geometry';
import { autoAdjusted } from './auto-adjust';
import { FramePicker } from './frame-picker';
import { AdjustPanel } from './panels/adjust-panel';
import { BackgroundPanel } from './panels/background-panel';
import { CropPanel } from './panels/crop-panel';
import { FilmPanel } from './panels/film-panel';
import { HslPanel } from './panels/hsl-panel';
import { LocalPanel } from './panels/local-panel';
import type { PanelProps } from './panels/panel-props';
import { RetouchPanel } from './panels/retouch-panel';
import { SceneryPanel } from './panels/scenery-panel';
import { TonePanel } from './panels/tone-panel';
import type { useLocalTool } from './tools/use-local-tool';
import type { useRetouchTool } from './tools/use-retouch-tool';

/** The editor's tabs, in the order they are offered (S-21). */
export const EDIT_TABS = [
  'film',
  'beauty',
  'makeup',
  'retouch',
  'background',
  'adjust',
  'scenery',
  'tone',
  'hsl',
  'local',
  'crop',
  'frame',
] as const;
export type EditTab = (typeof EDIT_TABS)[number];

export interface EditTabContext extends PanelProps {
  readonly original: { readonly image: SkImage; readonly size: Size };
  readonly takenAt: number | null;
  readonly local: ReturnType<typeof useLocalTool>;
  readonly retouch: ReturnType<typeof useRetouchTool>;
}

/** The controls of one tab; every change goes through `update`, so it can be undone. */
export function EditTabPanel({
  tab,
  context,
}: {
  readonly tab: EditTab;
  readonly context: EditTabContext;
}) {
  const { recipe, update, local, retouch } = context;
  const props: PanelProps = { recipe, update };
  const panels: Record<EditTab, () => ReactNode> = {
    film: () => <FilmPanel {...props} takenAt={context.takenAt} />,
    beauty: () => (
      <>
        <BeautyControls
          beauty={recipe.beauty}
          onChange={(beauty) => {
            update({ beauty }, 'beauty');
          }}
        />
        <FaceShapeControls
          faceShape={recipe.faceShape}
          onChange={(faceShape) => {
            update({ faceShape }, 'faceShape');
          }}
        />
      </>
    ),
    makeup: () => (
      <MakeupControls
        makeup={recipe.makeup}
        onChange={(makeup) => {
          update({ makeup }, 'makeup');
        }}
      />
    ),
    retouch: () => (
      <RetouchPanel
        {...props}
        tool={retouch.mode}
        onTool={retouch.onMode}
        healSize={retouch.healSize}
        onHealSize={retouch.onHealSize}
      />
    ),
    background: () => <BackgroundPanel {...props} />,
    adjust: () => (
      <AdjustPanel
        {...props}
        onAuto={() => {
          try {
            update(autoAdjusted(recipe, samplePixels(context.original.image)));
          } catch (error) {
            reportError(error, 'edit.auto');
            showError();
          }
        }}
      />
    ),
    scenery: () => <SceneryPanel {...props} />,
    tone: () => <TonePanel {...props} />,
    hsl: () => <HslPanel {...props} />,
    local: () => (
      <LocalPanel
        {...props}
        selected={local.selected}
        onSelect={local.onSelect}
        shape={local.shape}
        onShape={local.onShape}
      />
    ),
    crop: () => <CropPanel {...props} originalSize={context.original.size} />,
    frame: () => (
      <FramePicker
        frame={recipe.frame}
        onChange={(frame) => {
          update({ frame });
        }}
      />
    ),
  };
  return panels[tab]();
}
