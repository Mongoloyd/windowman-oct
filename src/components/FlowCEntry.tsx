import { motion } from 'framer-motion';

interface FlowCEntryProps { quoteStage: 'verbal' | 'appointment'; onSwitchToA: () => void; }

const track = (data: Record<string, unknown>) => { console.log({ ...data, timestamp: new Date().toISOString() }); };

const outcomes = [
  { icon: '✓', iconColor: '#2563EB', title: 'Know whether your number is fair', sub: 'Before it becomes the floor in a contract' },
  { icon: '📋', iconColor: '#F97316', title: 'Get the 5 questions to ask before anything is signed', sub: 'The questions that change what ends up in writing' },
  { icon: '🔔', iconColor: '#2563EB', title: 'Set a reminder for when the contract arrives', sub: "So you review it the moment it's in your hands" },
];

const FlowCEntry = ({ quoteStage, onSwitchToA }: FlowCEntryProps) => {
  const isAppointment = quoteStage === 'appointment';
  return (
    <motion.section id="flow-c-entry" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="bg-background py-20 md:py-28 px-4 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="inline-flex items-center gap-2 mb-5 card-raised px-3.5 py-1.5 border-destructive bg-destructive/5">
          <span className="text-destructive text-sm">⚡</span>
          <span className="wm-eyebrow text-destructive">{isAppointment ? 'CONTRACTOR VISIT APPROACHING — ACT NOW' : "YOU HAVE A NUMBER — LET'S USE IT"}</span>
        </div>
        <h2 className="font-display text-foreground font-extrabold uppercase leading-[1.15] tracking-[0.02em]" style={{ fontSize: 'clamp(42px, 5.5vw, 54px)' }}>{isAppointment ? 'You have a visit coming up.' : 'You have a number.'}</h2>
        <h2 className="font-display text-destructive font-extrabold uppercase leading-[1.15] tracking-[0.02em]" style={{ fontSize: 'clamp(42px, 5.5vw, 54px)' }}>It's not in writing yet. That means you still have leverage.</h2>
        <p className="font-body text-foreground leading-[1.75] mt-4" style={{ fontSize: 17, maxWidth: 580 }}>The moment a contractor puts it on paper, the anchor is set. Right now, you can still change the number before the contract arrives.</p>
        <div className="card-raised mt-4 mb-8 p-4" style={{ borderLeft: '3px solid hsl(var(--destructive))', maxWidth: 580 }}>
          <p className="font-body text-[15px] font-semibold text-destructive">Your Leverage isn't just gone when you sign. It's actively shrinking right now.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-5 max-w-[680px] mb-8">
          {outcomes.map((o, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex items-center justify-center shrink-0 w-9 h-9 card-raised"><span style={{ color: o.iconColor, fontSize: 14 }}>{o.icon}</span></div>
              <div>
                <p className="font-body text-sm font-semibold text-foreground">{o.title}</p>
                <p className="font-body text-[13px] text-muted-foreground mt-0.5">{o.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { track({ event: 'wm_flow_c_entry_cta_clicked', quoteStage }); document.getElementById('market-baseline')?.scrollIntoView({ behavior: 'smooth' }); }}
          className="btn-depth-primary" style={{ padding: '16px 32px' }}>
          Lock In My Leverage →
        </button>
        <p className="font-body text-[13px] text-muted-foreground mt-8">I do have a written quote —{' '}<span onClick={onSwitchToA} className="text-primary underline cursor-pointer">scan it instead →</span></p>
      </div>
    </motion.section>
  );
};

export default FlowCEntry;
