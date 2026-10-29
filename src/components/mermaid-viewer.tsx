'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GitMerge, Code2, Copy, Check, ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';

interface MermaidViewerProps {
  chart: string;
  defaultExpanded?: boolean;
}

export function MermaidViewer({ chart, defaultExpanded = false }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [viewMode, setViewMode] = useState<'diagram' | 'code'>('diagram');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    setIsRendering(true);
    setError(null);

    // Clean input chart string
    const cleanChart = chart.trim().replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '').trim();

    const renderChart = async () => {
      try {
        // Dynamically load mermaid from CDN
        // @ts-ignore
        const mermaidModule = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
        const mermaid = mermaidModule.default || mermaidModule;

        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          themeVariables: {
            darkMode: true,
            background: '#070b13',
            primaryColor: '#1e293b',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#3b82f6',
            lineColor: '#60a5fa',
            secondaryColor: '#172554',
            tertiaryColor: '#0f172a',
            noteBkgColor: '#1e293b',
            noteTextColor: '#93c5fd',
            noteBorderColor: '#3b82f6',
            actorBkg: '#0d1322',
            actorBorder: '#3b82f6',
            actorTextColor: '#f8fafc',
            actorLineColor: '#38bdf8',
            signalColor: '#60a5fa',
            signalTextColor: '#e2e8f0',
          },
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        });

        const uniqueId = `cgai-mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(uniqueId, cleanChart);

        if (!isCancelled) {
          setSvgHtml(svg);
          setIsRendering(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to render Mermaid diagram';
          console.warn('Mermaid rendering notice:', msg);
          setError(msg);
          setIsRendering(false);
        }
      }
    };

    renderChart();

    return () => {
      isCancelled = true;
    };
  }, [chart]);

  const handleCopy = async () => {
    try {
      const cleanChart = chart.trim().replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '').trim();
      await navigator.clipboard.writeText(cleanChart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const cleanChart = chart.trim().replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '').trim();

  return (
    <div className="rounded-xl border border-[#1b2436] bg-[#0c1220] overflow-hidden mb-2 shadow-sm font-sans transition-all">
      {/* Header Bar */}
      <div className="px-3.5 py-2 bg-[#090e1a] border-b border-[#1b2436] flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:border-blue-500/40 transition-colors">
            <GitMerge className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
              Architecture & Interaction Flow
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
              <Sparkles className="w-2.5 h-2.5 text-blue-400" />
              Gemini 3.8 Flash
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          {isExpanded && (
            <div className="flex items-center bg-[#070b13] border border-[#1b2436] rounded-md p-0.5">
              <button
                onClick={() => setViewMode('diagram')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  viewMode === 'diagram'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Diagram
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  viewMode === 'code'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3 h-3" />
                Code
              </button>
            </div>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy Mermaid Syntax"
            className="p-1 rounded-md border border-[#1b2436] bg-[#070b13] text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md border border-[#1b2436] bg-[#070b13] text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Diagram Panel */}
      {isExpanded && (
        <div className="p-4 bg-[#070b13]">
          {viewMode === 'diagram' ? (
            <div className="flex flex-col items-center justify-center min-h-[140px] overflow-x-auto py-2">
              {isRendering ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Rendering architectural diagram...</span>
                </div>
              ) : error || !svgHtml ? (
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2 text-xs text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Visual diagram fallback:</span>
                  </div>
                  <pre className="p-3 bg-[#0d1322] border border-[#1b2436] rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
                    {cleanChart}
                  </pre>
                </div>
              ) : (
                <div
                  ref={containerRef}
                  className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              )}
            </div>
          ) : (
            <pre className="p-3 bg-[#05080e] border border-[#1b2436] rounded-lg text-xs font-mono text-blue-300 overflow-x-auto leading-relaxed select-all">
              {cleanChart}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
