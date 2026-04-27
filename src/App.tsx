import { useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { LayerPanel } from './components/LayerPanel';
import { Preview } from './components/Preview';
import { View3D } from './components/View3D';
import { PropertiesPanel } from './components/PropertiesPanel';
import { usePatternStore } from './store/patternStore';
import './App.css';

function App() {
  const removeLayer = usePatternStore((s) => s.removeLayer);
  const duplicateLayer = usePatternStore((s) => s.duplicateLayer);
  const selectedLayerId = usePatternStore((s) => s.selectedLayerId);
  const updateLayer = usePatternStore((s) => s.updateLayer);
  const layers = usePatternStore((s) => s.layers);
  const viewMode = usePatternStore((s) => s.viewMode);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!selectedLayerId) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeLayer(selectedLayerId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        duplicateLayer(selectedLayerId);
      }
      // [ / ] keys for fine rotation control (0.01° per press)
      const layer = layers.find((l) => l.id === selectedLayerId);
      if (layer && !e.metaKey && !e.ctrlKey) {
        if (e.key === '[') {
          updateLayer(selectedLayerId, { rotation: +(layer.rotation - 0.01).toFixed(2) });
        }
        if (e.key === ']') {
          updateLayer(selectedLayerId, { rotation: +(layer.rotation + 0.01).toFixed(2) });
        }
      }
    },
    [selectedLayerId, removeLayer, duplicateLayer, updateLayer, layers]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app">
      <TopBar />
      <div className="app__workspace">
        {viewMode === '3d' ? <View3D /> : <Preview />}
        <LayerPanel />
        <PropertiesPanel />
      </div>
    </div>
  );
}

export default App;
