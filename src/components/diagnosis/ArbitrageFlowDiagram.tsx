import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, type LucideIcon } from 'lucide-react';

type NodeType = 'orange' | 'blue';

interface SkeuoNodeProps {
  text: string;
  type: NodeType;
  delay?: number;
  icon?: LucideIcon;
  className?: string;
}

const SkeuoNode = forwardRef<HTMLDivElement, SkeuoNodeProps>(
  ({ text, type, delay = 0, icon: Icon, className = '' }, ref) => {
    const isOrange = type === 'orange';

    const sideBg = isOrange ? 'bg-orange-200' : 'bg-blue-200';
    const faceBg = isOrange
      ? 'bg-gradient-to-b from-orange-50 to-orange-100'
      : 'bg-gradient-to-b from-white to-blue-50/50';
    const shadowColor = isOrange ? 'rgba(249, 115, 22, 0.3)' : 'rgba(59, 130, 246, 0.3)';
    const glowColor = isOrange ? 'rgba(255, 237, 213, 0.8)' : 'rgba(219, 234, 254, 0.8)';

    return (
      <motion.div
        ref={ref}
        className={`relative flex items-center justify-center cursor-pointer group ${className}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
      >
        <div
          className={`absolute inset-0 rounded-2xl ${sideBg} w-full h-full`}
          style={{
            transform: 'translateY(6px)',
            boxShadow: `0 20px 40px ${shadowColor}, 0 0 40px ${glowColor}`,
          }}
        />
        <div
          className={`relative flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border border-white ${faceBg} text-slate-800 font-semibold text-[15px] tracking-tight w-full h-full`}
          style={{
            transform: 'translateY(-2px)',
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,1), inset 0 -2px 4px rgba(0,0,0,0.02)',
          }}
        >
          {Icon && (
            <div className="bg-blue-100 p-1.5 rounded-lg border border-blue-200/50 shadow-sm shrink-0">
              <Icon className="text-blue-600" size={20} strokeWidth={2.5} />
            </div>
          )}
          <span className="text-center">{text}</span>
        </div>
      </motion.div>
    );
  }
);
SkeuoNode.displayName = 'SkeuoNode';

interface NodePos {
  x: number;
  topY: number;
  bottomY: number;
}

export function ArbitrageFlowDiagram() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gradeRef = useRef<HTMLDivElement | null>(null);
  const strongRef = useRef<HTMLDivElement | null>(null);
  const weakRef = useRef<HTMLDivElement | null>(null);
  const vetted1Ref = useRef<HTMLDivElement | null>(null);
  const vetted2Ref = useRef<HTMLDivElement | null>(null);
  const vetted3Ref = useRef<HTMLDivElement | null>(null);

  const [paths, setPaths] = useState({
    strong: '',
    weak: '',
    vetted1: '',
    vetted2: '',
    vetted3: '',
  });

  useEffect(() => {
    const updatePaths = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      const getPos = (ref: React.RefObject<HTMLDivElement>): NodePos | null => {
        if (!ref.current) return null;
        const rect = ref.current.getBoundingClientRect();
        return {
          x: rect.left - containerRect.left + rect.width / 2,
          topY: rect.top - containerRect.top,
          bottomY: rect.bottom - containerRect.top,
        };
      };

      const g = getPos(gradeRef);
      const s = getPos(strongRef);
      const w = getPos(weakRef);
      const v1 = getPos(vetted1Ref);
      const v2 = getPos(vetted2Ref);
      const v3 = getPos(vetted3Ref);

      const drawOrthogonal = (start: NodePos | null, end: NodePos | null, radius = 24): string => {
        if (!start || !end) return '';
        const startX = start.x;
        const startY = start.bottomY;
        const endX = end.x;
        const endY = end.topY;
        const midY = startY + (endY - startY) / 2;
        const diffX = Math.abs(endX - startX);

        if (diffX < 2) {
          return `M ${startX} ${startY} L ${endX} ${endY}`;
        }

        const dirX = endX > startX ? 1 : -1;
        const r = Math.min(radius, diffX / 2, Math.abs(midY - startY));

        return `M ${startX} ${startY} 
                L ${startX} ${midY - r} 
                Q ${startX} ${midY} ${startX + r * dirX} ${midY} 
                L ${endX - r * dirX} ${midY} 
                Q ${endX} ${midY} ${endX} ${midY + r} 
                L ${endX} ${endY}`;
      };

      setPaths({
        strong: drawOrthogonal(g, s),
        weak: drawOrthogonal(g, w),
        vetted1: drawOrthogonal(w, v1),
        vetted2: drawOrthogonal(w, v2),
        vetted3: drawOrthogonal(w, v3),
      });
    };

    const observer = new ResizeObserver(() => updatePaths());
    if (containerRef.current) observer.observe(containerRef.current);

    const t = setTimeout(updatePaths, 50);
    return () => {
      observer.disconnect();
      clearTimeout(t);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full py-10 md:py-14 px-2 md:px-6 flex flex-col items-center gap-16 md:gap-24"
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <linearGradient id="afd-blueLine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="afd-orangeLine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        {Object.entries(paths).map(
          ([key, d]) =>
            d && (
              <motion.path
                key={key}
                d={d}
                fill="none"
                stroke={key === 'strong' ? 'url(#afd-blueLine)' : 'url(#afd-orangeLine)'}
                strokeWidth="4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
              />
            )
        )}
      </svg>

      {/* Level 1 */}
      <div className="relative z-10 w-full flex justify-center">
        <SkeuoNode ref={gradeRef} text="The Gradecard" type="blue" delay={0.1} className="w-64" />
      </div>

      {/* Level 2 */}
      <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-center gap-16 md:gap-8 max-w-4xl">
        <div className="flex justify-center w-full md:w-1/2">
          <SkeuoNode
            ref={strongRef}
            text="Strong Pillars"
            type="blue"
            icon={Shield}
            delay={0.2}
            className="w-64"
          />
        </div>
        <div className="flex justify-center w-full md:w-1/2">
          <SkeuoNode ref={weakRef} text="Weak Pillars" type="orange" delay={0.3} className="w-64" />
        </div>
      </div>

      {/* Level 3 */}
      <div className="relative z-10 w-full flex flex-col items-center gap-8 max-w-5xl">
        <div className="w-full flex flex-col md:flex-row justify-between items-stretch gap-8 md:gap-6">
          <SkeuoNode
            ref={vetted1Ref}
            text="Vetted Contractor"
            type="blue"
            icon={Shield}
            delay={0.4}
            className="flex-1 w-full min-h-[64px]"
          />
          <SkeuoNode
            ref={vetted2Ref}
            text="Vetted Contractor"
            type="blue"
            icon={Shield}
            delay={0.5}
            className="flex-1 w-full min-h-[64px]"
          />
          <SkeuoNode
            ref={vetted3Ref}
            text="Vetted Contractor"
            type="blue"
            icon={Shield}
            delay={0.6}
            className="flex-1 w-full min-h-[64px]"
          />
        </div>
        <motion.div
          className="text-[15px] leading-relaxed text-foreground/75 w-full text-center mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <strong className="text-foreground">The Correction:</strong> They Actively Bid To Correct The Specific Failures In Your Original Quote.
        </motion.div>
      </div>
    </div>
  );
}
