import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Database, Terminal, Clock, Shield } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogViewModalProps {
  booster: any;
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="space-y-3 mb-8">
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" />
      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
        {title}
      </h3>
    </div>
    <div className="flex flex-wrap gap-2.5">
      {children}
    </div>
  </div>
);

const TagValue = ({ value }: { value: string }) => {
  if (!value || value === '—') return null;
  const parts = value.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
  
  return (
    <>
      {parts.map((p, i) => (
        <div 
          key={i}
          className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm font-bold text-white/90 shadow-inner backdrop-blur-sm"
        >
          {p}
        </div>
      ))}
    </>
  );
};

const BlockValue = ({ value }: { value: string }) => {
  if (!value || value === '—') return null;
  return (
    <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-sm leading-relaxed text-white/80 font-medium">
      {value}
    </div>
  );
};

export const LogViewModal = ({ booster, onClose }: LogViewModalProps) => {
  if (!booster) return null;

  const email = booster.fields['Email'] || booster.fields['email'] || booster.email || 'NO_EMAIL_DETECTED';
  const syncDate = new Date(booster.statusUpdatedAt || booster.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\./g, '.'); // Already uses dots

  // Group fields into common categories for a clean layout
  const fields = booster.fields || {};
  
  const getField = (keywords: string[]) => {
    const key = Object.keys(fields).find(k => 
      keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))
    );
    return key ? { label: key, value: String(fields[key]) } : null;
  };

  const experience = getField(['experience', 'relevant', 'previous']);
  const region = getField(['region', 'provide', 'services']);
  const duration = getField(['daily', 'spend', 'time', 'hours']);
  const services = getField(['services', 'types', 'help']);
  const group = getField(['solo', 'group', 'applying']);
  const additional = getField(['anything else', 'share', 'more']);
  const vpn = getField(['vpn']);
  const platforms = getField(['platforms', 'device', 'console']);
  const telegram = getField(['telegram', 'tg']);
  const discord = getField(['discord', 'ds']);
  const boostType = getField(['boost you can', 'selfplay', 'piloted']);
  const links = getField(['link', 'profile', 'url']);

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-[#0A0A0B] border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[90vh]"
      >
        {/* Header Section */}
        <div className="px-8 pt-8 pb-6 border-b border-white/5 flex items-start justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
               <Database className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase tracking-tight text-white/95 truncate max-w-[350px]">
                {email}
              </h2>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" />
                  <span>ID_{booster.id.slice(0, 12)}</span>
                </div>
                <span className="opacity-20 text-white">|</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  <span>SYNC_{syncDate.replace(/\d{4}$/, '2026')}</span>
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2.5 text-white/20 hover:text-white transition-all hover:bg-white/5 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto px-10 py-8 scrollbar-none space-y-2">
          {/* Games */}
          <Section title="SELECT GAMES WHERE YOU ARE ABLE TO PROVIDE SERVICES">
             <TagValue value={booster.games || fields['Games'] || fields['Select Game']} />
          </Section>

          {/* Duration */}
          {duration && (
            <Section title={duration.label}>
              <TagValue value={duration.value} />
            </Section>
          )}

          {/* Transition Row for Experience & Region */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {experience && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                    {experience.label}
                  </h3>
                </div>
                <BlockValue value={experience.value} />
              </div>
            )}
            {region && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                    {region.label}
                  </h3>
                </div>
                <TagValue value={region.value} />
              </div>
            )}
          </div>

          {/* DOTA 2 Services or similar */}
          {services && (
            <Section title={services.label}>
               <TagValue value={services.value} />
            </Section>
          )}

          {/* Solo or group */}
          {group && (
            <Section title={group.label}>
               <TagValue value={group.value} />
            </Section>
          )}

          {/* Additional info */}
          {additional && (
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                  {additional.label}
                </h3>
              </div>
              <div className="text-sm font-medium leading-relaxed text-white/90">
                {additional.value}
              </div>
            </div>
          )}

          {/* VPN & Platform Row */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {vpn && (
              <Section title={vpn.label}>
                <TagValue value={vpn.value} />
              </Section>
            )}
            {platforms && (
              <Section title={platforms.label}>
                <TagValue value={platforms.value} />
              </Section>
            )}
          </div>

          {/* Telegram & Discord Row */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {telegram && (
              <Section title="TELEGRAM">
                <TagValue value={telegram.value} />
              </Section>
            )}
            {discord && (
              <Section title="DISCORD">
                <TagValue value={discord.value} />
              </Section>
            )}
          </div>

          {/* Boost Type */}
          {boostType && (
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                  {boostType.label}
                </h3>
              </div>
              <div className="text-sm font-medium leading-relaxed text-white/90">
                {boostType.value}
              </div>
            </div>
          )}

          {/* Links */}
          {links && (
            <Section title={links.label}>
              <div className="w-full h-12 border border-dashed border-white/5 rounded-xl" />
            </Section>
          )}

          {/* Fallback for other fields */}
          <div className="pt-8 border-t border-white/5 space-y-6">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#D4AF37]/50">Unprocessed Data Blocks</p>
            {Object.entries(fields).map(([label, val], idx) => {
              const value = String(val);
              const processed = [experience?.label, region?.label, duration?.label, services?.label, group?.label, additional?.label, vpn?.label, platforms?.label, boostType?.label, links?.label, 'Games', 'Email', 'Telegram', 'Discord', 'Full name'].some(l => l && label.toLowerCase().includes(l.toLowerCase()));
              
              if (processed || !value || value === '—') return null;
              
              return (
                <div key={idx} className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/20">{label}</h3>
                  <div className="text-xs text-white/60">{value}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Section */}
        <div className="px-8 py-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between gap-6">
          <button 
            className="flex-1 px-8 py-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 hover:bg-blue-500/20 transition-all shadow-lg active:scale-95"
          >
            {booster.status}
          </button>
          
          <button 
            onClick={onClose}
            className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95 flex items-center gap-3"
          >
            <Shield className="w-4 h-4" />
            CLOSE_TERMINAL
          </button>
        </div>
      </motion.div>
    </div>
  );
};
