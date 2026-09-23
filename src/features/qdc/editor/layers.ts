export type LayerId = 'components' | 'wires';
export type LayerFocus = 'all' | LayerId;
export type LayerSettings = { visible: boolean; locked: boolean };
export type EditorLayers = { focus: LayerFocus; components: LayerSettings; wires: LayerSettings };

export const DEFAULT_EDITOR_LAYERS: EditorLayers = {
  focus: 'all',
  components: { visible: true, locked: false },
  wires: { visible: true, locked: false },
};

export function canEditLayer(layers: EditorLayers, layer: LayerId): boolean {
  return layers[layer].visible && !layers[layer].locked && (layers.focus === 'all' || layers.focus === layer);
}
