import React, { useRef, useEffect, useState, useCallback } from 'react';

interface NeuralPanelProps {
  isThinking: boolean;
  emotions: Record<string, number>;
  thoughts: string[];
  perceptions: string[];
  isActive: boolean;
}

const OUTPUT_LABELS = ['FEAR', 'CURIOSITY', 'TRUST', 'CONFUSION', 'HUMOR', 'WARINESS', 'WONDER'] as const;
const DEFAULT_INPUT_LABELS = ['ENVIRONMENT', 'ENTITIES', 'STRUCTURES', 'SIGNALS'];
const LAYER_SIZES = [4, 5, 4, 7];

const POSITIVE_EMOTIONS = new Set(['CURIOSITY', 'TRUST', 'WONDER', 'HUMOR']);

function getEmotionColor(label: string, value: number): string {
  const isPositive = POSITIVE_EMOTIONS.has(label);
  if (isPositive) {
    return `rgba(0, 255, 255, ${value})`;
  }
  return `rgba(255, 0, 255, ${value})`;
}

const NeuralPanel: React.FC<NeuralPanelProps> = ({
  isThinking,
  emotions,
  thoughts,
  perceptions,
  isActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const pulseRef = useRef(0);
  const idlePhaseRef = useRef(0);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);
  const [visibleThoughts, setVisibleThoughts] = useState<string[]>([]);

  // Update visible thoughts when new ones arrive
  useEffect(() => {
    const last10 = thoughts.slice(-10);
    setVisibleThoughts(last10);
  }, [thoughts]);

  // Scroll to bottom when thoughts change
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleThoughts]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, w, h);

    if (!isActive) {
      ctx.fillStyle = '#2a2a3a';
      ctx.font = '12px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NO SUBJECT DETECTED', w / 2, h / 2);
      return;
    }

    // Title
    ctx.fillStyle = '#4a4a6a';
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('NEURAL ACTIVITY \u2014 SUBJECT UNKNOWN', w / 2, 8);

    // Update animation
    if (isThinking) {
      pulseRef.current = (pulseRef.current + 0.012) % 1;
    }
    idlePhaseRef.current += 0.005;

    const pulse = pulseRef.current;
    const idlePhase = idlePhaseRef.current;

    // Compute node positions for each layer
    const padding = { left: 70, right: 70, top: 35, bottom: 15 };
    const layerCount = LAYER_SIZES.length;
    const layerSpacing = (w - padding.left - padding.right) / (layerCount - 1);

    const inputLabels =
      perceptions.length >= 4
        ? perceptions.slice(0, 4)
        : [...perceptions, ...DEFAULT_INPUT_LABELS.slice(perceptions.length)].slice(0, 4);

    // positions[layerIdx][nodeIdx] = {x, y}
    const positions: { x: number; y: number }[][] = [];
    for (let li = 0; li < layerCount; li++) {
      const x = padding.left + li * layerSpacing;
      const count = LAYER_SIZES[li];
      const areaH = h - padding.top - padding.bottom;
      const spacing = areaH / (count + 1);
      const nodes: { x: number; y: number }[] = [];
      for (let ni = 0; ni < count; ni++) {
        const y = padding.top + spacing * (ni + 1);
        nodes.push({ x, y });
      }
      positions.push(nodes);
    }

    // Compute node values
    const nodeValues: number[][] = [];

    // Input layer values: light up if perception label is present in perceptions prop
    const inputValues = inputLabels.map((label) => {
      const present = perceptions.some(
        (p) => p.toUpperCase() === label.toUpperCase()
      );
      return present ? 0.9 : 0.15;
    });
    nodeValues.push(inputValues);

    // Hidden layers: derive from average of inputs + some variation
    const avgInput = inputValues.reduce((a, b) => a + b, 0) / inputValues.length;
    for (let li = 1; li <= 2; li++) {
      const vals: number[] = [];
      for (let ni = 0; ni < LAYER_SIZES[li]; ni++) {
        const base = isThinking
          ? avgInput * (0.5 + 0.5 * Math.sin(idlePhase * 2 + ni * 1.3 + li))
          : 0.08 + 0.06 * Math.sin(idlePhase + ni * 0.7 + li);
        vals.push(Math.min(1, Math.max(0, base)));
      }
      nodeValues.push(vals);
    }

    // Output layer values: from emotions
    const outputValues = OUTPUT_LABELS.map((label) => {
      const key = label.toLowerCase();
      return emotions[key] ?? 0;
    });
    nodeValues.push(outputValues);

    // Draw connections between adjacent layers
    for (let li = 0; li < layerCount - 1; li++) {
      const from = positions[li];
      const to = positions[li + 1];
      for (let fi = 0; fi < from.length; fi++) {
        for (let ti = 0; ti < to.length; ti++) {
          const fromNode = from[fi];
          const toNode = to[ti];

          // Base connection
          ctx.strokeStyle = '#151520';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.stroke();

          // Animated pulse when thinking
          if (isThinking) {
            const offset = (fi * 0.07 + ti * 0.05 + li * 0.2) % 1;
            const p = (pulse + offset) % 1;
            const px = fromNode.x + (toNode.x - fromNode.x) * p;
            const py = fromNode.y + (toNode.y - fromNode.y) * p;
            const strength = nodeValues[li][fi] * nodeValues[li + 1][ti];
            const alpha = Math.max(0.05, strength * 0.6);

            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
            ctx.fill();

            // Brighter connection line when active
            if (strength > 0.3) {
              ctx.strokeStyle = `rgba(0, 200, 255, ${strength * 0.15})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(fromNode.x, fromNode.y);
              ctx.lineTo(toNode.x, toNode.y);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Draw nodes
    for (let li = 0; li < layerCount; li++) {
      for (let ni = 0; ni < LAYER_SIZES[li]; ni++) {
        const { x, y } = positions[li][ni];
        const value = nodeValues[li][ni];
        const radius = li === 0 || li === 3 ? 7 : 6;

        // Node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        if (value < 0.1) {
          ctx.fillStyle = '#2a2a3a';
        } else if (li === 3) {
          // Output layer: color by emotion
          ctx.fillStyle = getEmotionColor(OUTPUT_LABELS[ni], value);
        } else {
          ctx.fillStyle = `rgba(0, 220, 255, ${value * 0.8})`;
        }
        ctx.fill();

        // Glow for active nodes
        if (value > 0.3) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
          if (li === 3) {
            const glowColor = POSITIVE_EMOTIONS.has(OUTPUT_LABELS[ni])
              ? `rgba(0, 255, 255, ${value * 0.2})`
              : `rgba(255, 0, 255, ${value * 0.2})`;
            ctx.fillStyle = glowColor;
          } else {
            ctx.fillStyle = `rgba(0, 200, 255, ${value * 0.15})`;
          }
          ctx.fill();
        }

        // Labels for input and output layers
        ctx.font = '7px "Space Mono", monospace';
        ctx.fillStyle = `rgba(120, 120, 160, ${Math.max(0.4, value)})`;
        if (li === 0) {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(inputLabels[ni], x - 14, y);
        } else if (li === 3) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(OUTPUT_LABELS[ni], x + 14, y);
        }
      }
    }
  }, [isThinking, emotions, perceptions, isActive]);

  // Animation loop
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 200;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#08080f',
        fontFamily: '"Space Mono", monospace',
        height: '100%',
        opacity: isActive ? 1 : 0.35,
      }}
    >
      {/* Canvas neural network */}
      <div style={{ width: '100%', flexShrink: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '200px' }}
        />
      </div>

      {/* Thought stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          borderTop: '1px solid #151520',
          minHeight: 0,
        }}
      >
        {isActive && visibleThoughts.length > 0 ? (
          visibleThoughts.map((thought, i) => (
            <div
              key={`${thought}-${i}`}
              style={{
                color: 'rgba(0, 200, 220, 0.55)',
                fontStyle: 'italic',
                fontSize: '10px',
                fontFamily: '"Space Mono", monospace',
                marginBottom: '4px',
                animation: 'neuralFadeIn 0.6s ease-in',
              }}
            >
              ...{thought}...
            </div>
          ))
        ) : (
          <div
            style={{
              color: '#2a2a3a',
              fontSize: '10px',
              fontFamily: '"Space Mono", monospace',
              fontStyle: 'italic',
              textAlign: 'center',
              marginTop: '12px',
            }}
          >
            awaiting neural input...
          </div>
        )}
        <div ref={thoughtsEndRef} />
      </div>

      {/* Inline keyframes for fade-in */}
      <style>{`
        @keyframes neuralFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default NeuralPanel;
