import { create } from 'zustand';

export type DiffViewMode = 'split' | 'unified';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface DiffViewerState {
  viewMode: DiffViewMode;
  activeFilePath: string | null;
  severityFilters: Record<SeverityLevel, boolean>;
  hideResolved: boolean;
  focusedLine: number | null;
  selectedFindingId: string | null;

  // Actions
  setViewMode: (mode: DiffViewMode) => void;
  setActiveFilePath: (path: string | null) => void;
  toggleSeverityFilter: (severity: SeverityLevel) => void;
  setHideResolved: (hide: boolean) => void;
  setFocusedLine: (line: number | null) => void;
  setSelectedFindingId: (id: string | null) => void;
}

export const useDiffStore = create<DiffViewerState>((set) => ({
  viewMode: 'split',
  activeFilePath: null,
  severityFilters: {
    critical: true,
    high: true,
    medium: true,
    low: true,
  },
  hideResolved: false,
  focusedLine: null,
  selectedFindingId: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveFilePath: (path) => set({ activeFilePath: path }),
  toggleSeverityFilter: (severity) =>
    set((state) => ({
      severityFilters: {
        ...state.severityFilters,
        [severity]: !state.severityFilters[severity],
      },
    })),
  setHideResolved: (hide) => set({ hideResolved: hide }),
  setFocusedLine: (line) => set({ focusedLine: line }),
  setSelectedFindingId: (id) => set({ selectedFindingId: id }),
}));
