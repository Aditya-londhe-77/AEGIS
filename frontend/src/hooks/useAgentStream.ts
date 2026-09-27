import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';

// ── Event types ──────────────────────────────────────────────────────────────

export type AgentEventType =
  | 'system'
  | 'agent'
  | 'claim'
  | 'challenge'
  | 'graph'
  // Rich debate sub-types (set by the backend `event` field)
  | 'agent_started'
  | 'agent_claim'
  | 'debate_challenge'
  | 'debate_response'
  | 'debate_revision'
  | 'synthesis_complete';

export interface AgentEvent {
  id: number;
  type: AgentEventType;
  /** Visual bucket for colour-coding (always one of the base 5) */
  displayType: 'system' | 'agent' | 'claim' | 'challenge' | 'graph';
  text: string;
  time: string;
  // Optional rich fields
  agentId?: string;
  agentName?: string;
  model?: string;
  statement?: string;
  confidence?: number;
  sources?: string[];
  challengeText?: string;
  targetAgent?: string;
  targetAgentName?: string;
}

// Map backend event sub-type → display bucket
const DISPLAY_TYPE_MAP: Record<string, AgentEvent['displayType']> = {
  agent_started:    'agent',
  agent_claim:      'claim',
  agent_revising:   'agent',
  debate_challenge: 'challenge',
  debate_response:  'challenge',
  debate_revision:  'agent',
  synthesis_complete: 'system',
  agent:            'agent',
  claim:            'claim',
  challenge:        'challenge',
  graph:            'graph',
  system:           'system',
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentStream(queryId: string | undefined) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [progress, setProgress] = useState(5);
  const [isComplete, setIsComplete] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<any>(null);
  const fallbackTimerRef = useRef<any>(null);
  const wsConnectedRef = useRef(false);

  const addEvent = (rawType: string, text: string, extras?: Partial<AgentEvent>) => {
    const displayType = DISPLAY_TYPE_MAP[rawType] || 'system';
    setEvents(prev => {
      // Deduplicate consecutive identical messages
      if (prev.length > 0 && prev[prev.length - 1].text === text) return prev;
      return [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: rawType as AgentEventType,
          displayType,
          text,
          time: new Date().toLocaleTimeString([], {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
          }),
          ...extras,
        },
      ];
    });
  };

  useEffect(() => {
    if (!queryId) return;

    let pollAttempts = 0;

    addEvent('system', 'Connecting to AEGIS Live Telemetry Uplink...');

    // ── 1. WebSocket ────────────────────────────────────────────────────────
    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
    try {
      const ws = new WebSocket(`${WS_URL}/${queryId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        wsConnectedRef.current = true;
        addEvent('system', '🔗 Connected to AEGIS Live Telemetry Uplink.');
        // Clear the fallback timer — we have a real stream now
        if (fallbackTimerRef.current) {
          clearInterval(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const rawType = data.event || data.type || 'system';
          const text = data.message || '';

          if (text) {
            addEvent(rawType, text, {
              agentId:        data.agent_id,
              agentName:      data.agent_name,
              model:          data.model,
              statement:      data.statement,
              confidence:     data.confidence,
              sources:        data.sources,
              challengeText:  data.challenge_text,
              targetAgent:    data.target_agent,
              targetAgentName:data.target_agent_name,
            });
          }

          if (data.progress) {
            setProgress(prev => Math.max(prev, data.progress));
          }

          if (data.status === 'completed' || data.progress >= 100 || data.event === 'completed') {
            setIsComplete(true);
            setProgress(100);
            // Stop polling — WS delivered completion
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch {
          addEvent('system', event.data);
        }
      };

      ws.onerror = () => {
        if (!wsConnectedRef.current) {
          addEvent('system', '📡 WebSocket unavailable — switching to polling mode.');
        }
      };

      ws.onclose = () => {
        wsConnectedRef.current = false;
      };
    } catch {
      addEvent('system', '📡 Streaming via high-speed polling channel.');
    }

    // ── 2. Fallback progress ticker (ONLY fires if WS hasn't connected yet) ─
    //    Shows generic messages — does NOT inject fake specific claim text.
    const FALLBACK_MILESTONES = [
      { p: 20, type: 'agent',     msg: "▶ Recon & Geopolitical Operatives gathering OSINT and regulatory intelligence..." },
      { p: 40, type: 'agent',     msg: "▶ Financial Operative fetching live market data and analysing commodity exposure..." },
      { p: 65, type: 'challenge', msg: "⚔️  Devil's Advocate initiating adversarial challenge pass on initial claims..." },
      { p: 85, type: 'agent',     msg: "🧠 Synthesis Engine compiling multi-horizon strategic dossier..." },
      { p: 95, type: 'graph',     msg: "📊 Confidence Engine quantifying GraphRAG and Bayesian verification scores..." },
    ];
    let milestoneIdx = 0;
    fallbackTimerRef.current = setInterval(() => {
      // Only emit fallback messages if WS hasn't taken over
      if (!wsConnectedRef.current && milestoneIdx < FALLBACK_MILESTONES.length) {
        const stage = FALLBACK_MILESTONES[milestoneIdx];
        setProgress(prev => Math.max(prev, stage.p));
        addEvent(stage.type, stage.msg);
        milestoneIdx++;
      }
    }, 3500);

    // ── 3. REST polling fallback ────────────────────────────────────────────
    pollingRef.current = setInterval(async () => {
      pollAttempts++;
      try {
        const res = await api.fetchQueryResult(queryId);
        if (res && res.status === 'completed') {
          clearInterval(pollingRef.current);
          if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
          setProgress(100);
          addEvent('system', '✅ Strategic dossier compiled. Final briefing ready.');
          setIsComplete(true);
        }
      } catch {
        // Still processing or 404 not yet available — keep polling
      }

      // Hard cap: auto-complete after ~30s to avoid infinite spinner
      if (pollAttempts > 20) {
        clearInterval(pollingRef.current);
        if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
        setProgress(100);
        addEvent('system', '⏱️  Analysis timeout reached. Loading available dossier.');
        setIsComplete(true);
      }
    }, 1500);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, [queryId]);

  return { events, progress, isComplete };
}
