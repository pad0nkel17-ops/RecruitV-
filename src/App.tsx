import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  Clock, 
  MessageSquare, 
  Globe, 
  Gamepad2, 
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Settings,
  Layout,
  ListPlus,
  CheckCircle2,
  PanelRightClose,
  Calendar,
  FilterX,
  Menu,
  X,
  Copy,
  Check,
  Shield,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Zap,
  PlusCircle,
  Maximize2,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { firebaseService, type BoosterData, type Settings as AppSettings, type Form as AppForm } from './services/firebaseService';
import { LogViewModal } from './components/LogViewModal';
import { splitTags } from './lib/tagUtils';

let config: any = { projectId: 'Firebase' };
try {
  // @ts-ignore
  const localConfig = await import(/* @vite-ignore */ '../firebase-applet-config.json');
  config = localConfig.default || localConfig;
} catch (e) {
  // Use env var or default
  config = { projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Firebase' };
}
const firebaseConfig = config;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Booster {
  id: string;
  telegram: string;
  discord: string;
  games: string;
  workingHours: string;
  region: string;
  status: 'WAITING FOR RECRUITMENT' | 'RECRUITMENT IN PROCESS' | 'CRM ACCOUNT GIVEN' | 'RECRUITED' | 'LOST' | 'RESERVE' | 'REJECTED' | 'DUPLICATION';
  statusUpdatedAt: string;
  statusSortTime: number;
  createdAt: string;
  createdSortTime: number;
  statusHistory?: { status: string; timestamp: string; crmAccount?: string }[];
  lastStatusCheckedAt?: string;
  crmAccount?: string;
  contactStartedOn: 'TELEGRAM' | 'DISCORD' | 'EMAIL' | null;
  email?: string;
  notes: string;
  formId: string;
  fields: Record<string, string>;
  formTitle?: string;
  fastSearchContent?: string;
  deepSearchContent?: string;
}

const CellContent = ({ val, col }: { val: any, col: string }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!val || val === '—') return <span className="text-white/40 italic">—</span>;
  
  // Split into parts for potential multi-block rendering
  const parts = splitTags(val);
  
  const shouldTruncate = parts.length > 10;
  const displayParts = (shouldTruncate && !expanded) ? parts.slice(0, 10) : parts;
  
  return (
    <div className="flex flex-wrap gap-1.5 max-w-[250px] py-1">
      {displayParts.map((p: string, i: number) => (
        <span 
          key={i} 
          className={cn(
            "px-2.5 py-1 rounded bg-white/[0.06] border border-white/20 text-[11px] font-medium tracking-tight text-white hover:text-white transition-colors break-all shadow-sm cursor-default block w-fit",
            col === 'Games' && getBadgeStyles(p)
          )}
        >
          {p}
        </span>
      ))}
      {shouldTruncate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="px-2 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[9px] font-black uppercase tracking-[0.1em] text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all shadow-sm animate-in fade-in zoom-in duration-300"
        >
          {expanded ? 'Show Less' : `+${parts.length - 10} more`}
        </button>
      )}
    </div>
  );
};

const computeFastSearchContent = (b: any): string => {
  const parts = [
    String(b.id || ''),
    String(b.telegram || ''),
    String(b.discord || ''),
    String(b.email || ''),
    String(b.crmAccount || ''),
  ];
  return parts.join(' ').toLowerCase();
};

const computeDeepSearchContent = (b: any): string => {
  const parts = [
    String(b.games || ''),
    String(b.notes || ''),
    String(b.region || ''),
    String(b.createdAt || ''),
    String(b.workingHours || ''),
    ...Object.values(b.fields || {})
  ];
  return parts.join(' ').toLowerCase();
};

const enhanceBooster = (b: any): Booster => {
  const statusUpdatedAt = b.statusUpdatedAt || b.updatedAt || b.createdAt;
  const statusSortTime = new Date(statusUpdatedAt).getTime() || 0;
  const createdSortTime = new Date(b.createdAt).getTime() || 0;

  return {
    ...b,
    statusUpdatedAt,
    statusSortTime,
    createdSortTime,
    fastSearchContent: computeFastSearchContent(b),
    deepSearchContent: computeDeepSearchContent(b)
  };
};

const SearchInput = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  return (
    <div className="relative group flex-shrink-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
      <input 
        type="text" 
        placeholder="Search..." 
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="bg-transparent border-b border-[#2D2D30] focus:border-[#D4AF37] pl-9 pr-4 py-1.5 sm:py-2 text-xs text-white focus:outline-none transition-all w-32 sm:w-48 placeholder:text-white/30"
      />
    </div>
  );
};

const getNotificationLevel = (booster: Booster) => {
  // Notifications not needed on recruited / lost / reserve or rejected 
  if (['RECRUITED', 'LOST', 'RESERVE', 'REJECTED'].includes(booster.status)) {
    return null;
  }

  const now = new Date().getTime();
  const created = new Date(booster.createdAt).getTime();
  const updated = booster.statusUpdatedAt ? new Date(booster.statusUpdatedAt).getTime() : created;
  
  if (booster.status === 'WAITING FOR RECRUITMENT') {
    const hoursWaiting = (now - updated) / (1000 * 60 * 60);
    if (hoursWaiting > 96) return 'URGENT';
    if (hoursWaiting > 48) return 'STALE';
    return 'NEW'; // All WAITING entries are NEW until they qualify for STALE/URGENT or move
  }
  
  if (booster.status === 'RECRUITMENT IN PROCESS') {
    const hoursProcessing = (now - updated) / (1000 * 60 * 60);
    if (hoursProcessing > 96) return 'URGENT';
    if (hoursProcessing > 48) return 'STALE';
  }

  return null;
};

const getStalledDays = (booster: Booster) => {
   const now = new Date().getTime();
   const created = new Date(booster.createdAt).getTime();
   const updated = booster.statusUpdatedAt ? new Date(booster.statusUpdatedAt).getTime() : created;
   const diff = now - updated;
   return Math.floor(diff / (1000 * 60 * 60 * 24));
};

interface Jotform {
  id: string;
  title: string;
  count: number;
  type?: 'LOCAL' | 'JOTFORM';
  schema?: string[];
}

const STATUS_CONFIG = {
  'WAITING FOR RECRUITMENT': { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_4px_12px_rgba(59,130,246,0.1)]', icon: Clock, funnelLabel: 'Waiting for recruitment' },
  'RECRUITMENT IN PROCESS': { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-[0_4px_12px_rgba(234,179,8,0.1)]', icon: RefreshCw, funnelLabel: 'Recruitment in process' },
  'CRM ACCOUNT GIVEN': { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_4px_12px_rgba(16,185,129,0.1)]', icon: CheckCircle2, funnelLabel: 'CRM account given' },
  'RECRUITED': { color: 'bg-green-500/10 text-green-500 border-green-500/20 shadow-[0_4px_12px_rgba(34,197,94,0.1)]', icon: UserCheck, funnelLabel: 'Recruited' },
  'LOST': { color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_4px_12px_rgba(244,63,94,0.1)]', icon: UserMinus, funnelLabel: 'Lost' },
  'RESERVE': { color: 'bg-pink-500/10 text-pink-400 border-pink-500/20 shadow-[0_4px_12px_rgba(236,72,153,0.1)]', icon: Users, funnelLabel: 'Reserve' },
  'REJECTED': { color: 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_4px_12px_rgba(239,68,68,0.1)]', icon: AlertCircle, funnelLabel: 'Rejected' },
  'DUPLICATION': { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_4px_12px_rgba(168,85,247,0.1)]', icon: Copy, funnelLabel: 'Duplication' },
};

const DB_COLORS = [
  'text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-rose-400', 
  'text-indigo-400', 'text-pink-400', 'text-cyan-400', 'text-orange-400'
];

const getDbColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DB_COLORS[Math.abs(hash) % DB_COLORS.length];
};

const getBadgeStyles = (val: string) => {
  const v = val.toLowerCase();
  if (v.includes('selfplay')) return "bg-[#FDF2F8] text-[#BE185D] border-[#FBCFE8]";
  if (v.includes('piloted')) return "bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]";
  if (v.includes('us')) return "bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5]";
  if (v.includes('eu')) return "bg-[#F5F3FF] text-[#6D28D9] border-[#EDE9FE]";
  return "bg-white/5 text-white/90 border-white/10";
};

const StatusPickerPortal = ({ boosterId, anchorRect, onSelect, onClose }: { 
  boosterId: string, 
  anchorRect: DOMRect, 
  onSelect: (status: string) => void, 
  onClose: () => void 
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Calculate positioning
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  // Prefer below unless there's significantly more space above or below is too small
  const showUp = spaceBelow < 300 && spaceAbove > spaceBelow;
  
  const maxHeight = showUp ? Math.min(spaceAbove - 20, 500) : Math.min(spaceBelow - 20, 500);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    // Add listener after a brief delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return createPortal(
    <div 
      ref={dropdownRef}
      className="fixed z-[10000] bg-[#141416]/95 backdrop-blur-xl border border-[#D4AF37]/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/10"
      style={{
        width: '260px',
        left: `${Math.max(10, Math.min(anchorRect.left, window.innerWidth - 270))}px`,
        top: showUp ? 'auto' : `${anchorRect.bottom + 12}px`,
        bottom: showUp ? `${window.innerHeight - anchorRect.top + 12}px` : 'auto',
        maxHeight: `${maxHeight}px`,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="px-4 py-3 border-b border-white/10 bg-white/[0.03] flex items-center justify-between shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">Select Progress Status</p>
        <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
      </div>
      <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 flex-1">
        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => (
          <button
            key={status}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(status);
            }}
            className="w-full text-left px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-[#D4AF37]/10 transition-all border-b border-white/5 last:border-0 flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
               <div className={cn(
                "w-2.5 h-2.5 rounded-full border-2",
                STATUS_CONFIG[status].color.split(' ')[1].replace('text-', 'border-').split('/')[0]
              )} />
              <span>{STATUS_CONFIG[status].funnelLabel}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};

const StatusProgress = ({ booster, onMarkChecked }: { booster: Booster, onMarkChecked: (id: string) => void }) => {
  const [justCopied, setJustCopied] = useState(false);
  if (!booster.statusHistory || booster.statusHistory.length === 0) return null;
  
  if (booster.status !== 'RECRUITMENT IN PROCESS' && booster.status !== 'CRM ACCOUNT GIVEN') {
    return (
      <span className="text-[10px] text-white/40 font-mono tracking-tighter">
        {new Date(booster.statusHistory[booster.statusHistory.length - 1].timestamp).toLocaleDateString()}
      </span>
    );
  }

  const lastEntry = booster.statusHistory[booster.statusHistory.length - 1];
  const lastTimestamp = new Date(lastEntry.timestamp).getTime();
  const now = new Date().getTime();
  const diffInMs = now - lastTimestamp;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  let colorClass = "text-emerald-400";
  let showWarning = false;
  let label = "";

  if (diffInHours < 24) {
    colorClass = "text-emerald-400";
    label = `${diffInHours}h passed`;
  } else if (diffInDays <= 3) {
    colorClass = "text-yellow-400";
    label = `${diffInDays} days passed`;
    showWarning = true;
  } else {
    colorClass = "text-rose-500";
    label = `${diffInDays} days passed`;
    showWarning = true;
  }

  // Check for second warning
  let secondWarning = false;
  let canCheck = true;

  if (booster.lastStatusCheckedAt) {
    const checkedAt = new Date(booster.lastStatusCheckedAt).getTime();
    const checkedDiffInMs = now - checkedAt;
    const checkedDiffInHours = Math.floor(checkedDiffInMs / (1000 * 60 * 60));
    
    if (checkedDiffInHours >= 24) {
      secondWarning = true;
      // User said: "If 1 day passed after we market what status checked, and its not been moved, reset status of button"
      canCheck = true; 
    } else {
      canCheck = false;
    }
  }

  const getIdentity = () => {
    if (booster.contactStartedOn === 'TELEGRAM' && booster.telegram) return `TG: ${booster.telegram}`;
    if (booster.contactStartedOn === 'DISCORD' && booster.discord) return `DS: ${booster.discord}`;
    
    // Fallbacks
    if (booster.telegram) return `TG: ${booster.telegram}`;
    if (booster.discord) return `DS: ${booster.discord}`;
    const fullName = (booster.fields as any)?.['Full name'];
    if (fullName) return `Name: ${fullName}`;
    const dsUser = (booster.fields as any)?.['Discord Username'];
    if (dsUser) return `DS: ${dsUser}`;
    return 'Identity: Unknown';
  };

  const identity = getIdentity();

  const copyIdentityHandle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rawHandle = booster.contactStartedOn === 'TELEGRAM' ? booster.telegram : 
                      booster.contactStartedOn === 'DISCORD' ? booster.discord : 
                      (booster.telegram || booster.discord);
    
    if (rawHandle) {
      const handle = rawHandle.replace(/^@/, '');
      
      const doCopy = (text: string) => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
          }).catch(() => {
            // fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
          });
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        }
      };

      doCopy(handle);
    }
  };

  const handleCopyAndMark = (e: React.MouseEvent) => {
    copyIdentityHandle(e);
    onMarkChecked(booster.id);
  };

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-mono tracking-tighter font-bold", colorClass)}>
          {label}
        </span>
        {showWarning && canCheck && (
          <button
            onClick={handleCopyAndMark}
            className="px-2 py-0.5 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/30 rounded text-[9px] font-black uppercase tracking-widest text-[#D4AF37] transition-all whitespace-nowrap flex items-center gap-1 shadow-[0_0_15px_rgba(212,175,55,0.1)] active:scale-95"
          >
            <Copy className="w-2.5 h-2.5" />
            Confirm Status Checked
          </button>
        )}
      </div>
      
      {booster.lastStatusCheckedAt && !secondWarning && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full w-fit shadow-[0_0_10px_rgba(16,185,129,0.1)]">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.05em] text-emerald-400">
            Contacted again: {new Date(booster.lastStatusCheckedAt).toLocaleDateString()}
          </span>
        </div>
      )}

      {showWarning && (
        <div className="flex flex-col gap-0.5 bg-white/[0.03] p-1.5 rounded-lg border border-white/5 max-w-[180px] shadow-xl">
          <div className="flex items-center gap-1.5 px-0.5">
            <AlertCircle className={cn("w-3 h-3", secondWarning ? "text-rose-500 animate-pulse" : "text-yellow-400")} />
            <span className={cn("text-[8px] font-black uppercase tracking-widest", secondWarning ? "text-rose-400" : "text-white/60")}>
              {secondWarning ? "Second warning" : "Check status"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 pl-0.5">
            <button 
              onClick={copyIdentityHandle}
              className="text-[10px] text-white/60 truncate italic flex-1 hover:text-white transition-colors text-left"
            >
              {identity}
            </button>
            <button 
              onClick={copyIdentityHandle}
              className="p-1 hover:bg-white/10 rounded transition-colors group/copy relative"
              title="Copy contact"
            >
              {justCopied ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 text-white/20 group-hover/copy:text-[#D4AF37]" />
              )}
              {justCopied && (
                <motion.span 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: -20 }}
                  className="absolute left-1/2 -translate-x-1/2 text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded border border-emerald-400/20 whitespace-nowrap"
                >
                  COPIED!
                </motion.span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface DbSummary {
  urgent: number;
  stale: number;
  new: number;
  total: number;
}

export default function App() {
  const [boosters, setBoosters] = useState<Booster[]>([]);
  const [viewingBooster, setViewingBooster] = useState<Booster | null>(null);
  const [statusPickerAnchor, setStatusPickerAnchor] = useState<{ id: string, rect: DOMRect } | null>(null);
  const [forms, setForms] = useState<Jotform[]>([]);
  const [hiddenForms, setHiddenForms] = useState<Jotform[]>([]);
  const [selectedForm, setSelectedForm] = useState<string>(() => localStorage.getItem('selected_database') || '');
  const [dashboardMode, setDashboardMode] = useState(() => !localStorage.getItem('selected_database'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingFormTitle, setEditingFormTitle] = useState('');
  const [dbSummaries, setDbSummaries] = useState<Record<string, DbSummary>>({});
  const [search, setSearch] = useState('');
  const [deepSearch, setDeepSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const deferredDeepSearch = useDeferredValue(deepSearch);
  const [gameFilter, setGameFilter] = useState('');
  const [firebaseStatus, setFirebaseStatus] = useState<'CONNECTING' | 'ONLINE' | 'OFFLINE'>('CONNECTING');
  const [activeTab, setActiveTab] = useState<string>('WAITING FOR RECRUITMENT');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [newFormId, setNewFormId] = useState('');
  const [localFormTitle, setLocalFormTitle] = useState('');
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [fieldSettings, setFieldSettings] = useState<Record<string, Record<string, string[]>>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configTab, setConfigTab] = useState<'FIELDS' | 'BUILDER' | 'CONNECTION' | 'TOOLS'>('FIELDS');
  const [isSyncingHistorical, setIsSyncingHistorical] = useState(false);
  const [syncHistoryRange, setSyncHistoryRange] = useState({ start: '', end: '' });
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [configStatus, setConfigStatus] = useState<string>('ALL');
  const [columnRenames, setColumnRenames] = useState<Record<string, string>>({});
  const [jotformKey, setJotformKey] = useState('');
  const [initLoaded, setInitLoaded] = useState(false);
  const [availableGames, setAvailableGames] = useState<string[]>([]);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('pageSize');
    return saved ? parseInt(saved, 10) : 50; 
  });
  const [selectedBoosterIds, setSelectedBoosterIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('pageSize', pageSize.toString());
    setCurrentPage(1);
  }, [pageSize, activeTab, search, gameFilter, selectedForm]);

  const [scrollPercent, setScrollPercent] = useState(0);

  const [notification, setNotification] = useState<{ message: string, type: 'SUCCESS' | 'ERROR' } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setStatusPickerAnchor(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const max = container.scrollWidth - container.clientWidth;
      if (max <= 0) {
        setScrollPercent(0);
        return;
      }
      setScrollPercent((container.scrollLeft / max) * 100);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [selectedForm, boosters]);

  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const scrollAmount = 300;
      tableContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollToSection = (target: 'top' | 'bottom') => {
    window.scrollTo({
      top: target === 'top' ? 0 : document.body.scrollHeight,
      behavior: 'smooth'
    });
  };
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (settingsOpen) {
      setConfigStatus(activeTab);
    }
  }, [settingsOpen, activeTab]);
  const getGMT3DateString = (date?: Date) => {
    const d = date || new Date();
    // Using Europe/Istanbul as it is UTC+3 and does not observe DST changes
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  const poolStats = useMemo(() => {
    let urgent = 0;
    let stale = 0;
    let fresh = 0;
    boosters.forEach(b => {
      const level = getNotificationLevel(b);
      if (level === 'URGENT') urgent++;
      else if (level === 'STALE') stale++;
      else if (level === 'NEW') fresh++;
    });
    return { urgent, stale, fresh };
  }, [boosters]);

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const currentDay = getGMT3DateString();
    const savedStart = localStorage.getItem('booster_filter_start_date');
    
    if (savedStart) {
      return { start: savedStart, end: currentDay };
    }

    const now = new Date();
    // Start of last month as a sensible default if none saved
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    return {
      start: startOfPrevMonth.toISOString().split('T')[0],
      end: currentDay
    };
  });

  useEffect(() => {
    fetchForms();
  }, []);

  // Background fetch summaries for all forms
  useEffect(() => {
    if (forms.length > 0) {
      const loadSummaries = async () => {
        const summaries: Record<string, DbSummary> = {};
        await Promise.all(forms.map(async (form) => {
           try {
             const cachedVal = localStorage.getItem(`cache_boosters_${form.id}`);
             let data: Booster[] = [];
             if (cachedVal) {
               data = JSON.parse(cachedVal);
             } else {
               const fbData = await firebaseService.getBoosterData(form.id);
               data = fbData.map(d => ({
                 id: d.id,
                 createdAt: d.updatedAt,
                 status: d.status as any,
                 statusUpdatedAt: d.updatedAt,
                 fields: d.fields || {}
               } as Booster));
             }
             
             summaries[form.id] = {
               urgent: data.filter(b => getNotificationLevel(b) === 'URGENT').length,
               stale: data.filter(b => getNotificationLevel(b) === 'STALE').length,
               new: data.filter(b => getNotificationLevel(b) === 'NEW').length,
               total: data.length
             };
           } catch (e) {
             console.error(`Failed to load summary for ${form.id}`);
           }
        }));
        setDbSummaries(prev => ({ ...prev, ...summaries }));
      };
      loadSummaries();
    }
  }, [forms]);

  const fetchForms = async () => {
    try {
      setFirebaseStatus('CONNECTING');
      // 1. Get Settings from Firebase
      const fbSettings = await firebaseService.getSettings();
      setFirebaseStatus('ONLINE');
      const renames = fbSettings?.formRenames || {};
      const order = fbSettings?.formOrder || [];
      const ignored = fbSettings?.ignoredForms || [];
      const manual = fbSettings?.manualForms || [];
      const blacklist = fbSettings?.blacklistForms || [];
      const fSettings = fbSettings?.fieldSettings || {};
      const colRenames = fbSettings?.columnRenames || {};
      const jfKey = fbSettings?.jotformApiKey || '';
      const cachedGames = fbSettings?.availableGames || [];

      setFieldSettings(fSettings);
      setColumnRenames(colRenames);
      setJotformKey(jfKey);
      setAvailableGames(cachedGames);

      // 2. Get local forms from Firebase
      const fbLocalForms = await firebaseService.getForms();
      const localActive = fbLocalForms.filter(f => !ignored.includes(String(f.id)));
      const localHidden = fbLocalForms.filter(f => ignored.includes(String(f.id)));

      // 3. Get Jotform forms from Server Proxy
      let jotformActive: any[] = [];
      let jotformHidden: any[] = [];
      let jotformError = '';
      
      try {
        const headers: any = {};
        if (jfKey) headers['x-jotform-api-key'] = jfKey;

        const jfResp = await axios.get('/api/jotform-forms', { headers });
        const allJf = jfResp.data.content || jfResp.data || [];
        
        const filtered = Array.isArray(allJf) ? allJf.filter((f: any) => {
          const id = String(f.id);
          if (blacklist.includes(id)) return false;
          // Matching 'BECOME A' or manual import
          return (f.title || '').toUpperCase().includes('BECOME A') || manual.includes(id);
        }) : [];
        
        jotformActive = filtered.filter((f: any) => !ignored.includes(String(f.id)));
        jotformHidden = filtered.filter((f: any) => ignored.includes(String(f.id)));
        
        if (Array.isArray(allJf) && allJf.length > 0 && jotformActive.length === 0 && localActive.length === 0) {
           jotformError = 'Found forms in Jotform, but none match "BECOME A". Try manual import in Settings.';
        }
      } catch (e: any) {
        if (e.response?.status === 401) {
          jotformError = 'Jotform API Key is missing. Add JOTFORM_API_KEY to your Vercel Environment Variables.';
        } else {
          console.error('Failed to proxy Jotform forms');
        }
      }

      const combined = [...localActive, ...jotformActive].map(f => ({
        ...f,
        title: renames[f.id] || f.title
      }));
      
      combined.sort((a, b) => {
        const idxA = order.indexOf(String(a.id));
        const idxB = order.indexOf(String(b.id));
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

      setForms(combined);
      setHiddenForms([...localHidden, ...jotformHidden].map(f => ({ ...f, title: renames[f.id] || f.title })));

      // Auto-select
      if (!selectedForm && combined.length > 0) {
        const main = combined.find(f => f.title.toLowerCase().includes('become a booster'));
        const defaultId = main ? main.id : combined[0].id;
        setSelectedForm(defaultId);
        localStorage.setItem('selected_database', defaultId);
        setDashboardMode(false);
      } else if (combined.length === 0) {
        setError(jotformError || 'No forms found. Connect a Jotform account or create a local database.');
        setLoading(false);
      }
      setInitLoaded(true);
    } catch (err: any) {
      console.error('Failed to fetch forms', err);
      setError('System could not initialize forms. Please verify your environment variables.');
      setLoading(false);
      setInitLoaded(true);
    }
  };

  const renameForm = async (formId: string, customName: string) => {
    try {
      const settings = await firebaseService.getSettings() || {
        formOrder: [], columnRenames: {}, formRenames: {}, ignoredForms: [], manualForms: [], blacklistForms: [], fieldSettings: {}
      };
      const newRenames = { ...(settings.formRenames || {}), [formId]: customName };
      await firebaseService.updateSettings({ formRenames: newRenames });
      
      // Also update local form title if it's local
      if (formId.startsWith('local_')) {
        const localForms = await firebaseService.getForms();
        const found = localForms.find(f => f.id === formId);
        if (found) {
          await firebaseService.saveForm({ ...found, title: customName });
        }
      }

      setForms(prev => prev.map(f => f.id === formId ? { ...f, title: customName || f.title } : f));
      setEditingFormId(null);
    } catch (error) {
      console.error('Failed to rename form:', error);
    }
  };

  const reorderForms = async (formId: string, direction: 'UP' | 'DOWN') => {
    const currentIndex = forms.findIndex(f => f.id === formId);
    if (currentIndex === -1) return;

    const newForms = [...forms];
    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= forms.length) return;

    const [removed] = newForms.splice(currentIndex, 1);
    newForms.splice(targetIndex, 0, removed);
    
    const newOrder = newForms.map(f => f.id);
    setForms(newForms);
    
    try {
      await firebaseService.updateSettings({ formOrder: newOrder });
    } catch (err) {
      console.error('Failed to save order');
    }
  };

  const toggleFieldVisibility = async (formId: string, status: string, field: string) => {
    const formSettings = fieldSettings[formId] || {};
    const currentHidden = formSettings[status] || [];
    const isHidden = currentHidden.includes(field);
    const newHidden = isHidden 
      ? currentHidden.filter(f => f !== field)
      : [...currentHidden, field];
    
    const newSettingsForForm = { 
      ...(fieldSettings[formId] || {}),
      [status]: newHidden 
    };

    const updatedGlobalSettings = {
      ...fieldSettings,
      [formId]: newSettingsForForm
    };

    setFieldSettings(updatedGlobalSettings);
    
    try {
      await firebaseService.updateSettings({ fieldSettings: updatedGlobalSettings });
    } catch (err) {
      console.error('Failed to update field settings');
    }
  };

  const updateLocalSchema = async (formId: string, schema: string[]) => {
    try {
      const localForms = await firebaseService.getForms();
      const form = localForms.find(f => f.id === formId);
      if (form) {
        await firebaseService.saveForm({ ...form, schema });
        setForms(prev => prev.map(f => f.id === formId ? { ...f, schema } : f));
      }
    } catch (err) {
      console.error('Failed to update schema');
    }
  };

  const saveJotformKey = async () => {
    try {
      setIsTestingKey(true);
      // Validate key first by trying to fetch forms
      const headers = { 'x-jotform-api-key': jotformKey };
      const resp = await axios.get('/api/jotform-forms', { headers });
      
      if (resp.data.content || resp.data) {
        await firebaseService.updateSettings({ jotformApiKey: jotformKey });
        alert('Jotform API Key verified and saved successfully.');
        fetchForms(); // Refresh everything
      } else {
        throw new Error('Invalid response from Jotform');
      }
    } catch (err: any) {
      alert(`Failed to verify Jotform Key: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsTestingKey(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renameColumn = async (originalName: string, customName: string) => {
    try {
      const settings = await firebaseService.getSettings();
      const ren = { ...(settings?.columnRenames || {}), [originalName]: customName };
      if (!customName) delete ren[originalName];
      await firebaseService.updateSettings({ columnRenames: ren });
      setColumnRenames(ren);
      setEditingHeader(null);
    } catch (err) {
      console.error('Failed to rename column');
    }
  };

  const updateBoosterField = async (id: string, field: string, value: string) => {
    const sId = String(id);
    try {
      const targetBooster = boosters.find(b => String(b.id) === sId);
      const boosterFormId = targetBooster?.formId || selectedForm;

      const existing = await firebaseService.getSingleBoosterData(sId);
      const now = new Date().toISOString();
      
      const trimmedValue = field === 'crmAccount' ? value.trim() : value;
      const updatedOverrides = { ...(existing?.fieldOverrides || {}), [field]: trimmedValue };
      const isCoreField = ['telegram', 'discord', 'email', 'games', 'workingHours', 'region', 'crmAccount'].includes(field);
      
      // Special handling if someone is editing status field directly (if exposed)
      if (field.toLowerCase() === 'status') {
         await firebaseService.updateBoosterStatus(sId, boosterFormId, trimmedValue);
      } else {
        const newEntry: BoosterData = existing ? {
          ...existing,
          fieldOverrides: updatedOverrides,
          updatedAt: now,
          ...(isCoreField ? { [field]: trimmedValue } : {})
        } : {
          id: sId,
          formId: boosterFormId,
          status: 'WAITING FOR RECRUITMENT',
          notes: '',
          contactStartedOn: null,
          fieldOverrides: updatedOverrides,
          updatedAt: now,
          ...(isCoreField ? { [field]: trimmedValue } : {})
        };

        await firebaseService.saveBoosterData(newEntry);
      }

      setBoosters(prev => prev.map(b => {
        if (String(b.id) !== sId) return b;
        let updated: any;
        if (field.toLowerCase() === 'status') {
          updated = { ...b, status: trimmedValue as any };
        } else if (['telegram', 'discord', 'games', 'workingHours', 'region', 'crmAccount'].includes(field)) {
          updated = { ...b, [field]: trimmedValue };
        } else {
          updated = { ...b, fields: { ...b.fields, [field]: trimmedValue } };
        }
        return enhanceBooster(updated);
      }));
      setEditingCell(null);
    } catch (err) {
      console.error('Failed to update field', err);
    }
  };

  const getColumnName = (original: string) => columnRenames[original] || original;

  const dynamicColumns = useMemo(() => {
    const counts: Record<string, number> = {};
    const excluded = ['id', 'token', 'other', 'notes', 'formId', 'telegram', 'discord', 'contact', 'games', 'game'];
    const formSettings = fieldSettings[selectedForm] || {};
    const hidden = formSettings[activeTab] || [];
    
    // Determine all potential fields
    const coreFields = ['Primary Contact', 'Application Date', 'Region', 'Working Hours', 'Games', 'Status'];
    
    boosters.forEach(b => {
      coreFields.forEach(cf => {
        if (!hidden.includes(cf)) {
           counts[cf] = (counts[cf] || 0) + (boosters.length * 10); // Boost weight for core fields
        }
      });
      Object.keys(b.fields).forEach(key => {
        const isExcluded = excluded.some(ex => key.toLowerCase().includes(ex));
        const isHidden = hidden.includes(key);
        if (!isExcluded && !isHidden) {
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });

    const cols = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // Core fields and then most filled
      .map(entry => entry[0]);

    if (activeTab === 'WAITING FOR RECRUITMENT') {
      const groupCol = cols.find(c => c.toLowerCase().includes('group of players') || c.toLowerCase().includes('applying for yourself'));
      const primaryCol = cols.find(c => c === 'Primary Contact');
      if (groupCol && primaryCol) {
        const groupIdx = cols.indexOf(groupCol);
        const primaryIdx = cols.indexOf(primaryCol);
        // Swap them if they are both found
        const temp = cols[groupIdx];
        cols[groupIdx] = cols[primaryIdx];
        cols[primaryIdx] = temp;
      }
    }

    return cols;
  }, [boosters, fieldSettings, selectedForm, activeTab]);

  const currentForm = useMemo(() => forms.find(f => f.id === selectedForm), [forms, selectedForm]);
  const allDetectedFields = useMemo(() => {
    const fields = new Set<string>();
    ['Primary Contact', 'Application Date', 'Region', 'Working Hours', 'Games', 'Status'].forEach(f => fields.add(f));
    boosters.forEach(b => Object.keys(b.fields).forEach(f => fields.add(f)));
    const excluded = ['id', 'token', 'other', 'notes', 'formId'];
    return Array.from(fields).filter(f => !excluded.some(ex => f.toLowerCase().includes(ex)));
  }, [boosters]);

  const fetchAvailableGames = async (formId: string) => {
    if (!formId || formId.startsWith('local_')) return;
    try {
      const headers: any = {};
      const fbSettings = await firebaseService.getSettings();
      const currentKey = fbSettings?.jotformApiKey || jotformKey;
      if (currentKey) headers['x-jotform-api-key'] = currentKey;
      
      const resp = await axios.get('/api/jotform-questions', { params: { formId }, headers });
      const questions = resp.data.content || {};
      
      const gameQuestion = Object.values(questions).find((q: any) => 
        ((q.text || '').toLowerCase().includes('game') || (q.text || '').toLowerCase().includes('skill') || (q.text || '').toLowerCase().includes('portfolio')) && 
        ((q.options || q.items) || (q.text || '').toLowerCase().includes('select') || q.type === 'control_checkbox' || q.type === 'control_dropdown')
      );
      
      let options: string[] = [];

      if (gameQuestion) {
        let optionsStr = (gameQuestion as any).options || (gameQuestion as any).items || '';
        if (optionsStr) {
          options = optionsStr.split('|').map((o: string) => o.trim()).filter(Boolean);
        }
      }
      
      // Fallback: search for any checkboxes/dropdowns if still empty
      if (options.length === 0) {
        const anyOptionQuestion = Object.values(questions).find((q: any) => 
          (q.type === 'control_checkbox' || q.type === 'control_dropdown') && 
          (q.options || '').split('|').length > 3
        );
        
        if (anyOptionQuestion) {
          options = (anyOptionQuestion as any).options.split('|').map((o: string) => o.trim()).filter(Boolean);
        }
      }

      // Hardcoded fallbacks if Jotform returns nothing but we want to provide something
      const hardcodedFallbacks = ['World of Warcraft', 'Destiny 2', 'Diablo 4', 'League of Legends', 'Valorant', 'Counter-Strike 2', 'Escape from Tarkov', 'Path of Exile'];
      
      const finalGames = options.length > 0 ? options : (availableGames.length > 0 ? availableGames : hardcodedFallbacks);
      
      setAvailableGames(finalGames);
      
      // Save globally if we found something new or it was empty
      if (options.length > 0) {
        await firebaseService.updateSettings({ availableGames: options });
      }
    } catch (e) {
      console.error('Failed to fetch jotform questions', e);
    }
  };

  const fetchData = async (formIdTarget?: string) => {
    const idToFetch = formIdTarget || selectedForm;
    if (!idToFetch) return;
    
    fetchAvailableGames(idToFetch);
    
    try {
      setRefreshing(true);
      
      let jotformSubs: any[] = [];
      let fbData: BoosterData[] = [];

      // 1. Fetch Jotform submissions via proxy if it's not a local form
      if (!idToFetch.startsWith('local_')) {
        try {
          const headers: any = {};
          if (jotformKey) headers['x-jotform-api-key'] = jotformKey;

          const jfResp = await axios.get('/api/jotform-submissions', { 
            params: { formId: idToFetch },
            headers
          });
          jotformSubs = (jfResp.data.content || []).filter((sub: any) => {
            const subDate = new Date(sub.created_at);
            return subDate.getFullYear() >= 2026;
          });
        } catch (e) {
          console.error('Failed to fetch Jotform submissions');
        }
      }

      // 2. Fetch Firebase booster_data
      fbData = await firebaseService.getBoosterData(idToFetch);

      // 3. Merge
      let merged: Booster[] = [];

      if (idToFetch.startsWith('local_')) {
        // Local form data is entirely in Firebase
        merged = fbData.map(d => {
          const fields = { ...(d.fields || {}), ...(d.fieldOverrides || {}) };
          const getFVal = (keys: string[]) => {
            const foundKey = Object.keys(fields).find(k => 
              keys.some(ki => k.toLowerCase().includes(ki.toLowerCase()))
            );
            return foundKey ? fields[foundKey] : '';
          };

          return enhanceBooster({
            id: String(d.id),
            createdAt: (d as any).createdAt || d.updatedAt,
            telegram: d.telegram || getFVal(['telegram', 'tg', 'contact']),
            discord: d.discord || getFVal(['discord', 'ds']),
            email: d.email || getFVal(['email', 'mail']),
            games: d.games || getFVal(['games', 'game']),
            workingHours: d.workingHours || getFVal(['hours', 'time']),
            region: d.region || getFVal(['region', 'country']),
            status: d.status as any,
            statusUpdatedAt: d.statusUpdatedAt || d.updatedAt,
            statusHistory: d.statusHistory || [],
            crmAccount: d.crmAccount || d.fieldOverrides?.['crmAccount'] || '',
            contactStartedOn: d.contactStartedOn as any,
            notes: d.notes,
            formId: d.formId,
            fields: fields,
          });
        });
      } else {
        // Merge Jotform with Firebase
        merged = jotformSubs.map((sub: any) => {
          const sId = String(sub.id);
          const persist = fbData.find(d => String(d.id) === sId);
          const answers = sub.answers || {};
          
          const formatAnswer = (ans: any) => {
            if (typeof ans === 'object' && ans !== null) {
              const parts: string[] = [];
              Object.entries(ans).forEach(([key, val]) => {
                if (key !== 'other' && typeof val === 'string') {
                  parts.push(val);
                }
              });
              if (ans.other && typeof ans.other === 'string') {
                parts.push(ans.other);
              }
              if (parts.length === 0) {
                return Object.values(ans).filter(v => typeof v === 'string').join(', ');
              }
              return parts.join(', ');
            }
            return String(ans || '');
          };

          const getVal = (label: string) => {
              // 1. Check if we have an exactly matching override
              if (persist?.fieldOverrides?.[label] !== undefined) {
                return persist.fieldOverrides[label];
              }

              // 2. See if there is any override key matching case-insensitively
              if (persist?.fieldOverrides) {
                const foundKey = Object.keys(persist.fieldOverrides).find(
                  k => k.toLowerCase() === label.toLowerCase()
                );
                if (foundKey !== undefined && persist.fieldOverrides[foundKey] !== undefined) {
                  return persist.fieldOverrides[foundKey];
                }
              }

              // 3. See if we have a core field direct root match or case-insensitive keyword override
              if (persist) {
                const labelLower = label.toLowerCase();
                if (labelLower.includes('discord') && persist.discord !== undefined && persist.discord !== '') {
                  return persist.discord;
                }
                if ((labelLower.includes('telegram') || labelLower.includes('contact')) && persist.telegram !== undefined && persist.telegram !== '') {
                  return persist.telegram;
                }
                if ((labelLower.includes('email') || labelLower.includes('mail')) && persist.email !== undefined && persist.email !== '') {
                  return persist.email;
                }
                if ((labelLower.includes('game') || labelLower.includes('skills') || labelLower.includes('portfolio')) && persist.games !== undefined && persist.games !== '') {
                  return persist.games;
                }
                if ((labelLower.includes('hour') || labelLower.includes('time') || labelLower.includes('how long')) && persist.workingHours !== undefined && persist.workingHours !== '') {
                  return persist.workingHours;
                }
                if (labelLower.includes('region') && persist.region !== undefined && persist.region !== '') {
                  return persist.region;
                }
              }

              // 4. Fallback to Jotform's original value
              const entry: any = Object.values(answers).find((a: any) => a.text?.toLowerCase().includes(label.toLowerCase()));
              return entry ? formatAnswer(entry.answer) : '';
          };

          const dynamicFields: Record<string, string> = {};
          Object.values(answers).forEach((a: any) => {
            if (a.text && a.answer !== undefined) {
               dynamicFields[a.text] = getVal(a.text);
            }
          });

          return enhanceBooster({
            id: sId,
            createdAt: sub.created_at,
            telegram: getVal('Telegram') || getVal('Contact'),
            discord: getVal('Discord'),
            email: getVal('email') || getVal('mail'),
            games: getVal('game') || getVal('What games'),
            workingHours: getVal('How long') || getVal('Working hours'),
            region: getVal('region'),
            status: (persist?.status || 'WAITING FOR RECRUITMENT') as any,
            statusUpdatedAt: persist?.statusUpdatedAt || persist?.updatedAt || sub.created_at,
            statusHistory: persist?.statusHistory || [],
            crmAccount: persist?.crmAccount || persist?.fieldOverrides?.['crmAccount'] || '',
            contactStartedOn: (persist?.contactStartedOn || null) as any,
            notes: persist?.notes || '',
            formId: idToFetch,
            fields: dynamicFields,
          });
        });
      }

      merged.sort((a, b) => b.statusSortTime - a.statusSortTime);
      setBoosters(merged);
      setError(null);
      
      // Local storage cache
      localStorage.setItem(`cache_boosters_${idToFetch}`, JSON.stringify(merged));
      localStorage.setItem(`cache_time_${idToFetch}`, new Date().toISOString());

      // Check for duplicates in background if new entries arrived
      if (jotformSubs.length > 0) {
        setTimeout(() => scanGlobalDuplicates(true), 2000);
      }

      // Update summary counts
      const summaries = { ...dbSummaries };
      summaries[idToFetch] = {
        urgent: merged.filter(b => getNotificationLevel(b) === 'URGENT').length,
        stale: merged.filter(b => getNotificationLevel(b) === 'STALE').length,
        new: merged.filter(b => getNotificationLevel(b) === 'NEW').length,
        total: merged.length
      };
      setDbSummaries(summaries);

    } catch (err: any) {
      setError(err.message || 'Failed to connect to API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createLocalForm = async () => {
    if (!localFormTitle) return;
    try {
      const newForm: AppForm = {
        id: `local_${Date.now()}`,
        title: localFormTitle,
        type: 'LOCAL',
        schema: ['Name/Contact', 'Telegram', 'Discord', 'Region', 'Games'],
        createdAt: new Date().toISOString()
      };
      await firebaseService.saveForm(newForm);
      setLocalFormTitle('');
      fetchForms();
      setSelectedForm(newForm.id);
    } catch (err) {
      console.error('Failed to create form');
    }
  };

  const addLocalRow = async () => {
    if (!selectedForm || Object.keys(newRowData).length === 0) return;
    try {
      const id = `row_${Date.now()}`;
      const now = new Date().toISOString();
      const newData: BoosterData = {
        id,
        formId: selectedForm,
        status: 'WAITING FOR RECRUITMENT',
        notes: '',
        contactStartedOn: null,
        updatedAt: now,
        fields: newRowData
      };
      await firebaseService.saveBoosterData(newData);
      setNewRowData({});
      fetchData();
    } catch (err) {
      console.error('Failed to add row');
    }
  };

  const addManualForm = async () => {
    if (!newFormId) return;
    try {
      const set = await firebaseService.getSettings();
      const manual = [...(set?.manualForms || [])];
      if (!manual.includes(newFormId)) {
        manual.push(newFormId);
        const blacklist = (set?.blacklistForms || []).filter(id => id !== newFormId);
        await firebaseService.updateSettings({ manualForms: manual, blacklistForms: blacklist });
      }
      setNewFormId('');
      fetchForms();
    } catch (err) {
      console.error('Failed to add form');
    }
  };

  const permanentDeleteForm = async (formId: string) => {
    if (!confirm('Permanently remove this form from the workspace?')) return;
    try {
      const set = await firebaseService.getSettings();
      const blacklist = [...(set?.blacklistForms || [])];
      if (!blacklist.includes(formId)) blacklist.push(formId);
      const manual = (set?.manualForms || []).filter(id => id !== formId);
      const ignored = (set?.ignoredForms || []).filter(id => id !== formId);
      
      await firebaseService.updateSettings({ blacklistForms: blacklist, manualForms: manual, ignoredForms: ignored });
      
      // If it's local, delete from forms collection too
      if (formId.startsWith('local_')) {
        await firebaseService.deleteForm(formId);
      }

      fetchForms();
      if (selectedForm === formId) {
        const next = forms.find(f => f.id !== formId);
        setSelectedForm(next ? next.id : '');
      }
    } catch (err) {
      console.error('Failed to delete form');
    }
  };

  const hideDatabase = async (formId: string) => {
    if (!confirm('Hide this database from the workspace? You can restore it from Archived list.')) return;
    try {
      // Optimistic update
      const formToHide = forms.find(f => f.id === formId);
      if (formToHide) {
        setForms(prev => prev.filter(f => f.id !== formId));
        setHiddenForms(prev => [...prev, formToHide]);
      }

      const settings = await firebaseService.getSettings();
      const ignored = [...(settings?.ignoredForms || [])];
      if (!ignored.includes(formId)) ignored.push(formId);
      await firebaseService.updateSettings({ ignoredForms: ignored });
      
      if (selectedForm === formId) {
        const next = forms.find(f => f.id !== formId);
        const nextId = next ? next.id : '';
        setSelectedForm(nextId);
        if (nextId) localStorage.setItem('selected_database', nextId);
        else localStorage.removeItem('selected_database');
      }
      setNotification({ message: 'Database moved to Archive', type: 'SUCCESS' });
      // Re-fetch to ensure sync
      fetchForms();
    } catch (err) {
      console.error('Failed to hide form');
      fetchForms(); // Revert on error
    }
  };

  const restoreForm = async (formId: string) => {
    try {
      // Optimistic update
      const formToRestore = hiddenForms.find(f => f.id === formId);
      if (formToRestore) {
        setHiddenForms(prev => prev.filter(f => f.id !== formId));
        setForms(prev => [...prev, formToRestore]);
      }

      const settings = await firebaseService.getSettings();
      const ignored = (settings?.ignoredForms || []).filter(id => id !== formId);
      await firebaseService.updateSettings({ ignoredForms: ignored });
      setNotification({ message: 'Database restored', type: 'SUCCESS' });
      fetchForms();
    } catch (err) {
      console.error('Failed to restore form');
      fetchForms(); // Revert on error
    }
  };

  useEffect(() => {
    if (selectedForm) {
      localStorage.setItem('selected_database', selectedForm);
      const cached = localStorage.getItem(`cache_boosters_${selectedForm}`);
      if (cached) {
        setBoosters(JSON.parse(cached));
        setLoading(false);
      }
      if (initLoaded) {
        fetchData(selectedForm);
      }
    }
  }, [selectedForm, initLoaded]);

  const [crmPrompt, setCrmPrompt] = useState<{ ids: string[]; status: Booster['status'] } | null>(null);
  const [tempCrmName, setTempCrmName] = useState('');

  const updateStatus = async (id: string, status: Booster['status'], crmAccount?: string) => {
    const sId = String(id);
    const foundBooster = boosters.find(b => String(b.id) === sId);
    const existingCrm = foundBooster?.crmAccount?.trim() || '';

    if (status === 'CRM ACCOUNT GIVEN') {
      if (!crmAccount) {
        if (existingCrm) {
          crmAccount = existingCrm;
        } else {
          setCrmPrompt({ ids: [sId], status });
          setTempCrmName('');
          return;
        }
      }
    }
    try {
      await firebaseService.updateBoosterStatus(sId, selectedForm, status, undefined, crmAccount);
      
      setNotification({ message: `Booster moved to ${STATUS_CONFIG[status].funnelLabel}`, type: 'SUCCESS' });

      setBoosters(prev => prev.map(b => {
        if (String(b.id) !== sId) return b;
        
        const historyEntry: any = { status, timestamp: new Date().toISOString() };
        const bCrm = crmAccount !== undefined ? crmAccount : (b.crmAccount || '');
        const trimmedCrm = bCrm.trim();
        if (trimmedCrm) historyEntry.crmAccount = trimmedCrm;

        return enhanceBooster({ 
          ...b, 
          status, 
          crmAccount: trimmedCrm || b.crmAccount,
          statusUpdatedAt: new Date().toISOString(),
          statusHistory: [...(b.statusHistory || []), historyEntry],
          lastStatusCheckedAt: undefined
        });
      }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const onMarkChecked = async (id: string) => {
    try {
      await firebaseService.markStatusChecked(id);
      const now = new Date().toISOString();
      setBoosters(prev => prev.map(b => {
        if (String(b.id) !== String(id)) return b;
        return enhanceBooster({ 
          ...b, 
          lastStatusCheckedAt: now,
          statusHistory: [...(b.statusHistory || []), { status: 'CHECKED', timestamp: now }]
        });
      }));
      setNotification({ message: 'Status check confirmed', type: 'SUCCESS' });
    } catch (err) {
      console.error('Failed to mark status checked:', err);
    }
  };

  const bulkUpdateStatus = async (status: Booster['status'], crmAccount?: string) => {
    if (selectedBoosterIds.size === 0 || !selectedForm) return;

    const sIds = Array.from(selectedBoosterIds)
      .map(id => String(id))
      .filter(id => id && id !== 'undefined' && id !== 'null');
      
    if (sIds.length === 0) {
      console.warn('No valid IDs selected for bulk update');
      return;
    }

    if (status === 'CRM ACCOUNT GIVEN' && !crmAccount) {
      const boostersMap = new Map<string, Booster>(boosters.map(b => [String(b.id), b]));
      const sIdsWithoutCrm = sIds.filter(id => {
        const b = boostersMap.get(id);
        return !(b?.crmAccount?.trim());
      });

      if (sIdsWithoutCrm.length > 0) {
        setCrmPrompt({ ids: sIds, status });
        setTempCrmName('');
        return;
      }
    }

    try {
      setRefreshing(true);

      await Promise.all(
        sIds.map(id => firebaseService.updateBoosterStatus(id, selectedForm, status, undefined, crmAccount))
      );
      
      setNotification({ message: `${sIds.length} Boosters moved to ${STATUS_CONFIG[status].funnelLabel}`, type: 'SUCCESS' });

      setBoosters(prev => prev.map(b => {
        if (!sIds.includes(String(b.id))) return b;

        const historyEntry: any = { status, timestamp: new Date().toISOString() };
        const bCrm = crmAccount !== undefined ? crmAccount : (b.crmAccount || '');
        const trimmedCrm = bCrm.trim();
        if (trimmedCrm) historyEntry.crmAccount = trimmedCrm;

        return enhanceBooster({
          ...b,
          status,
          crmAccount: trimmedCrm || b.crmAccount,
          statusUpdatedAt: new Date().toISOString(),
          statusHistory: [...(b.statusHistory || []), historyEntry],
          lastStatusCheckedAt: undefined
        });
      }));
      setSelectedBoosterIds(new Set());
    } catch (err) {
      console.error('Failed to bulk update status:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleBoosterSelection = (id: string) => {
    setSelectedBoosterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedBoosterIds.size === filteredBoosters.length) {
      setSelectedBoosterIds(new Set());
    } else {
      setSelectedBoosterIds(new Set(filteredBoosters.map(b => b.id)));
    }
  };

  const updateContactStart = async (id: string, contactType: 'TELEGRAM' | 'DISCORD' | 'EMAIL' | null) => {
    try {
      await firebaseService.updateContactStart(id, selectedForm, contactType || '');
      setBoosters(prev => prev.map(b => b.id === id ? { ...b, contactStartedOn: contactType } : b));
    } catch (err) {
      console.error('Failed to update contact info');
    }
  };

  const scanGlobalDuplicates = async (silent = false) => {
    try {
      if (!silent) {
        setRefreshing(true);
        setNotification({ message: 'Analyzing recruitment pool for duplications...', type: 'INFO' });
      }
      
      const allData = await firebaseService.getAllBoosterData();
      
      const tgMap = new Map<string, {id: string, date: number}[]>();
      const dsMap = new Map<string, {id: string, date: number}[]>();
      
      allData.forEach(d => {
        const tg = (d.telegram || d.fields?.Telegram || d.fields?.['Telegram Username'] || '').toString().toLowerCase().trim();
        const ds = (d.discord || d.fields?.Discord || d.fields?.['Discord ID'] || '').toString().toLowerCase().trim();
        const date = new Date(d.updatedAt || 0).getTime();
        
        if (tg && tg !== '—' && tg.length > 2) {
          tgMap.set(tg, [...(tgMap.get(tg) || []), {id: d.id, date}]);
        }
        if (ds && ds !== '—' && ds.length > 2) {
          dsMap.set(ds, [...(dsMap.get(ds) || []), {id: d.id, date}]);
        }
      });
      
      const duplicates = new Set<string>();
      
      const findDuplicates = (map: Map<string, {id: string, date: number}[]>) => {
        map.forEach((records) => {
          if (records.length > 1) {
            records.sort((a, b) => a.date - b.date);
            records.slice(1).forEach(r => duplicates.add(r.id));
          }
        });
      };
      
      findDuplicates(tgMap);
      findDuplicates(dsMap);
      
      let updateCount = 0;
      for (const id of Array.from(duplicates)) {
        const item = allData.find(d => d.id === id);
        if (item && item.status !== 'DUPLICATION' && !['RECRUITED', 'LOST', 'REJECTED'].includes(item.status)) {
          await firebaseService.updateBoosterStatus(id, item.formId, 'DUPLICATION');
          updateCount++;
        }
      }
      
      if (!silent) {
        setNotification({ 
          message: updateCount > 0 
            ? `Cleaning complete. Marked ${updateCount} new duplications.` 
            : `System healthy. No new duplicates found.`, 
          type: 'SUCCESS' 
        });
        fetchData();
      }
    } catch (err) {
      console.error('Duplicate scan failed:', err);
      if (!silent) setNotification({ message: 'Duplicate scan failed.', type: 'ERROR' });
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  const copyMasterInfo = (booster: Booster) => {
    const getF = (keys: string[]) => {
      const fieldKey = Object.keys(booster.fields || {}).find(k => 
        keys.some(ki => k.toLowerCase().includes(ki.toLowerCase()))
      );
      return fieldKey ? booster.fields[fieldKey] : '';
    };

    const specialty = getF(['specialty', 'specialization', 'skills', 'role']);
    const platform = getF(['platform', 'device', 'console']);
    const stream = getF(['stream', 'twitch', 'youtube']);
    const pvp = getF(['pvp', 'arena', 'rating']);

    const text = `CRM: ${booster.crmAccount || ''}
    
Telegram: ${booster.telegram || ''}
Discord: ${booster.discord || ''}

Region: 
Games: ${booster.games || ''}
Specialty : ${specialty}
Working hours: 
Platform: ${platform}
Stream: 
PvP: ${pvp || '-'}
Additional notes: ${booster.notes || 'Verified / | AD'}

Telegram marking : ${booster.crmAccount || ''}
Added to MasterFile`;

    copyToClipboard(text, `master-${booster.id}`);
  };

  const renderRowCells = (booster: Booster, level: string | null, statusConfig: any) => {
    return (
      <>
        <td className="px-3 py-2 border-b border-white/5">
          <div className="flex flex-col gap-1.5 min-w-[170px]">
            {(() => {
              const rawName = booster.fields?.['Name/Contact'] || '';
              const tg = booster.telegram || '';
              const ds = booster.discord || '';
              const em = booster.email || '';
              const showBigName = rawName && 
                                  rawName.toLowerCase() !== tg.toLowerCase() && 
                                  rawName.toLowerCase() !== ds.toLowerCase() &&
                                  rawName.toLowerCase() !== em.toLowerCase();

              return (
                <>
                  <div className="mb-1 flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingBooster(booster); }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#007AFF] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#0063CC] transition-all shadow-lg active:scale-95 shrink-0 group/view-btn border border-white/5"
                    >
                      <Maximize2 className="w-2.5 h-2.5 group-hover:scale-110 transition-transform" />
                      View
                    </button>
                    {showBigName && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ id: booster.id, field: 'Name/Contact', value: rawName });
                        }}
                        className="p-1 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all active:scale-95"
                        title="Edit Real Name"
                      >
                         <Edit2 className="w-2 h-2" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-white/40 font-mono tracking-tighter uppercase whitespace-nowrap">#{booster.id.slice(0, 6)}</span>
                      <span className="text-white/20 font-light select-none">:</span>
                      {level ? (
                        <div className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                          level === 'URGENT' ? 'bg-rose-500 text-white' : level === 'STALE' ? 'bg-amber-500 text-black' : 'bg-blue-400 text-white'
                        )}>
                          {level}
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/20 uppercase font-black tracking-widest">Normal</span>
                      )}
                      {booster.status === 'DUPLICATION' && (
                        <div className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                          <Copy className="w-2.5 h-2.5" />
                          Duplicate
                        </div>
                      )}
                    </div>
                    
                    <span className="text-white/20 font-light select-none">:</span>
                    
                    <div className="flex flex-wrap gap-2">
                      {tg && (
                        <div className="flex flex-col items-center gap-1">
                          <div 
                            className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded-lg border group/link cursor-pointer transition-all shadow-md relative overflow-hidden",
                              booster.contactStartedOn === 'TELEGRAM' 
                                ? "bg-blue-500/20 border-blue-500/60 ring-1 ring-blue-500/30" 
                                : "bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/20 hover:border-blue-500/60"
                            )}
                            onClick={() => copyToClipboard(tg, `tg-${booster.id}`)}
                          >
                            <MessageSquare className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[14px] font-bold text-blue-50/90 font-mono tracking-tight">{tg}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({ id: booster.id, field: 'telegram', value: tg });
                              }}
                              className="ml-1 p-0.5 opacity-0 group-hover/link:opacity-100 hover:text-white transition-opacity"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateContactStart(booster.id, booster.contactStartedOn === 'TELEGRAM' ? null : 'TELEGRAM');
                            }}
                            className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full border transition-all",
                              booster.contactStartedOn === 'TELEGRAM'
                                ? "bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                : "bg-white/5 border-white/10 text-white/20 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10"
                            )}
                            title="Mark as Contacted via Telegram"
                          >
                            <Check className={cn("w-3.5 h-3.5", booster.contactStartedOn === 'TELEGRAM' ? "stroke-[4]" : "stroke-[2]")} />
                          </button>
                        </div>
                      )}
                      {ds && (
                        <div className="flex flex-col items-center gap-1">
                          <div 
                            className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded-lg border group/link cursor-pointer transition-all shadow-md relative overflow-hidden",
                              booster.contactStartedOn === 'DISCORD'
                                ? "bg-indigo-500/20 border-indigo-500/60 ring-1 ring-indigo-500/30"
                                : "bg-indigo-500/10 border-indigo-500/40 hover:bg-indigo-500/20 hover:border-indigo-500/60"
                            )}
                            onClick={() => copyToClipboard(ds, `ds-${booster.id}`)}
                          >
                            <Users className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[14px] font-bold text-indigo-50/90 font-mono tracking-tight">{ds}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({ id: booster.id, field: 'discord', value: ds });
                              }}
                              className="ml-1 p-0.5 opacity-0 group-hover/link:opacity-100 hover:text-white transition-opacity"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateContactStart(booster.id, booster.contactStartedOn === 'DISCORD' ? null : 'DISCORD');
                            }}
                            className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full border transition-all",
                              booster.contactStartedOn === 'DISCORD'
                                ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                : "bg-white/5 border-white/10 text-white/20 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10"
                            )}
                            title="Mark as Contacted via Discord"
                          >
                            <Check className={cn("w-3.5 h-3.5", booster.contactStartedOn === 'DISCORD' ? "stroke-[4]" : "stroke-[2]")} />
                          </button>
                        </div>
                      )}
                      
                      {em && (
                        <div className="flex flex-col items-center gap-1 group/em-block">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateContactStart(booster.id, booster.contactStartedOn === 'EMAIL' ? null : 'EMAIL');
                            }}
                            className={cn(
                              "flex flex-col items-center gap-1 transition-all",
                              booster.contactStartedOn === 'EMAIL' ? "scale-105" : "hover:scale-105"
                            )}
                            title={booster.contactStartedOn === 'EMAIL' ? "Unmark Email Sent" : "Mark as Email Sent"}
                          >
                             <div className={cn(
                               "w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-md relative group/mail-icon",
                               booster.contactStartedOn === 'EMAIL'
                                 ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                 : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                             )}>
                               <Mail className={cn("w-4 h-4", booster.contactStartedOn === 'EMAIL' ? "stroke-[3]" : "stroke-[2]")} />
                               {booster.contactStartedOn === 'EMAIL' && (
                                 <div className="absolute -top-1 -right-1 bg-white text-emerald-600 rounded-full p-0.5 shadow-sm border border-emerald-200">
                                   <Check className="w-2.5 h-2.5 stroke-[5]" />
                                 </div>
                               )}
                             </div>
                             <span className={cn(
                               "text-[9px] font-black uppercase tracking-tighter transition-colors",
                               booster.contactStartedOn === 'EMAIL' ? "text-emerald-400" : "text-white/20 group-hover/em-block:text-emerald-400/50"
                             )}>
                               {booster.contactStartedOn === 'EMAIL' ? 'Sent' : 'Mail'}
                             </span>
                          </button>
                        </div>
                      )}

                      {!tg && !ds && !em && !rawName && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[12px] text-white/30 italic">No Identity</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({ id: booster.id, field: 'telegram', value: '' });
                            }}
                            className="text-[9px] uppercase font-black text-[#D4AF37]/60 hover:text-[#D4AF37]"
                          >
                            Add Contact
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {showBigName && (
                    <div className="pl-5 border-l border-white/10 ml-1.5 -mt-1 group-hover:border-[#D4AF37]/30 transition-colors">
                      <span className="text-sm font-bold text-white/90 group-hover:text-[#D4AF37] transition-colors truncate block">
                        {rawName}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </td>
        <td 
          className="px-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors group/games"
          onClick={() => setEditingCell({ id: booster.id, field: 'games', value: booster.games || '' })}
        >
          <div className="flex items-center justify-between gap-1">
            <CellContent val={booster.games} col="Games" />
            <Edit2 className="w-3 h-3 text-white/0 group-hover/games:text-[#D4AF37] transition-all" />
          </div>
        </td>
        {activeTab === 'RECRUITED' && (
          <td className="px-3 py-2 border-b border-white/5">
            <button
              onClick={() => copyMasterInfo(booster)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm border",
                copiedId === `master-${booster.id}`
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20"
              )}
            >
              {copiedId === `master-${booster.id}` ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy for Master
                </>
              )}
            </button>
          </td>
        )}
        <td 
          className="px-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors group/status"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setStatusPickerAnchor({ id: booster.id, rect });
          }}
        >
          <div className="flex flex-col gap-1.5 relative">
            <div className="flex items-center justify-between gap-2">
              <div className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border w-fit shadow-sm transition-all",
                statusConfig?.color
              )}>
                {statusConfig?.funnelLabel || booster.status}
              </div>
              <Edit2 className="w-3 h-3 text-white/0 group-hover/status:text-[#D4AF37] transition-all" />
            </div>
            
            <StatusProgress booster={booster} onMarkChecked={onMarkChecked} />
          </div>
        </td>
        <td className="px-3 py-2 border-b border-white/5">
          <div 
            onClick={() => setEditingCell({ id: booster.id, field: 'crmAccount', value: booster.crmAccount || '' })}
            className={cn(
              "group/crm px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between min-w-[140px]",
              booster.crmAccount 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 font-black shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                : "bg-white/5 border-white/10 text-white/20 hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/5"
            )}
          >
            <span className={cn(
              "text-[12px] uppercase font-bold tracking-wider truncate",
              !booster.crmAccount && "italic font-normal text-[10px]"
            )}>
              {booster.crmAccount || 'Not Assigned'}
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              {booster.crmAccount && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(booster.crmAccount!, `crm-${booster.id}`);
                  }}
                  className="p-1 px-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                  title="Copy CRM Account"
                >
                  <Copy className="w-3 h-3 text-emerald-400" />
                </button>
              )}
              <Edit2 className="w-3 h-3 opacity-40 group-hover/crm:opacity-100 transition-opacity" />
            </div>
          </div>
        </td>
        <td 
          className="px-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors group/region"
          onClick={() => setEditingCell({ id: booster.id, field: 'region', value: booster.region || '' })}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <Globe className="w-2 h-2 text-[#D4AF37]/70" />
                <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest">{booster.region || '—'}</span>
              </div>
              <Edit2 className="w-2.5 h-2.5 text-white/0 group-hover/region:text-[#D4AF37] transition-all" />
            </div>
            <span className="text-[9px] text-white/40 font-mono ml-3.5">{new Date(booster.createdAt).toLocaleDateString()}</span>
          </div>
        </td>
        {dynamicColumns.map(col => {
          const val = col === 'Status' ? booster.status : 
                      col === 'Application Date' ? new Date(booster.createdAt).toLocaleDateString() :
                      (booster as any)[col.toLowerCase()] || (booster.fields as any)[col];
          
          return (
            <td 
              key={col} 
              className="px-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors group/dynamic"
              onClick={() => setEditingCell({ id: booster.id, field: col, value: val || '' })}
            >
              <div className="flex items-center justify-between gap-2">
                <CellContent val={val} col={col} />
                <Edit2 className="w-3 h-3 text-white/0 group-hover/dynamic:text-[#D4AF37] transition-all shrink-0" />
              </div>
            </td>
          );
        })}
        <td className="px-3 py-2 border-b border-white/5 text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="relative group/status-pick inline-block">
              <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/30 transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.15)] hover:scale-105 active:scale-95">
                <Zap className="w-4 h-4" />
              </button>
              <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#141416] border border-[#2D2D30] rounded-xl shadow-2xl opacity-0 translate-y-2 invisible group-hover/status-pick:opacity-100 group-hover/status-pick:visible group-hover/status-pick:translate-y-0 transition-all z-50 py-1 overflow-hidden">
                {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(booster.id, status as any)}
                    className="w-full text-left px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    {STATUS_CONFIG[status].funnelLabel}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => setEditingCell({ id: booster.id, field: 'notes', value: booster.notes || '' })}
              className={cn(
                "p-2.5 rounded-xl transition-all border shrink-0",
                booster.notes
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                  : "bg-white/5 border-white/10 text-white/20 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/30"
              )}
              title="Edit Notes"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </>
    );
  };


  const filteredBoosters = useMemo(() => {
    if (!deferredSearch && !deferredDeepSearch && !gameFilter && activeTab === 'ALL' && !dateRange.start && !dateRange.end) {
      return [...boosters].sort((a, b) => b.statusSortTime - a.statusSortTime);
    }

    const searchTerms = deferredSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const deepTerms = deferredDeepSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    // Pre-calculate date filter boundaries if needed
    let startBoundary = 0;
    let endBoundary = Infinity;
    if (dateRange.start) {
      startBoundary = new Date(`${dateRange.start}T00:00:00+03:00`).getTime();
    }
    if (dateRange.end) {
      endBoundary = new Date(`${dateRange.end}T23:59:59+03:00`).getTime();
    }

    return boosters.filter(b => {
      // 1. Cheap checks first: Tab and Game Filter
      if (activeTab !== 'ALL' && b.status !== activeTab) return false;
      
      const matchesGameFilter = !gameFilter || b.games?.toLowerCase().includes(gameFilter.toLowerCase());
      if (!matchesGameFilter) return false;

      // 2. Date checks - use pre-calculated timestamps
      if (startBoundary > 0 || endBoundary < Infinity) {
        if (b.createdSortTime < startBoundary || b.createdSortTime > endBoundary) return false;
      }

      // 3. Fast Search (Identity, IDs, Contacts)
      if (searchTerms.length > 0) {
        const matches = searchTerms.every(term => {
          if (term.includes(':')) {
            const parts = term.split(':');
            const key = parts[0];
            const val = parts.slice(1).join(':');
            if (key === 'status') return b.status.toLowerCase().includes(val);
            if (key === 'crm') return (b.crmAccount || '').toLowerCase().includes(val);
            if (key === 'id') return b.id.toLowerCase().includes(val);
            return b.fastSearchContent?.includes(term);
          }
          return b.fastSearchContent?.includes(term);
        });
        if (!matches) return false;
      }

      // 4. Deep Search (Games, Region, Working Hours, Custom Fields)
      if (deepTerms.length > 0) {
        const matches = deepTerms.every(term => {
          return b.deepSearchContent?.includes(term) || b.fastSearchContent?.includes(term);
        });
        if (!matches) return false;
      }
      
      return true;
    }).sort((a, b) => b.statusSortTime - a.statusSortTime);
  }, [boosters, deferredSearch, deferredDeepSearch, gameFilter, activeTab, dateRange]);

  const allGames = useMemo(() => {
    const games = new Set<string>();
    boosters.forEach(b => {
      if (b.games) {
        splitTags(b.games).forEach(g => {
          games.add(g);
        });
      }
    });
    return Array.from(games).sort();
  }, [boosters]);

  const sidebarGroups = [
    {
      label: 'Recruitment Status',
      items: [
        { label: 'All Applications', value: 'ALL', icon: Shield },
        ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
          label: cfg.funnelLabel,
          value: key,
          icon: cfg.icon
        }))
      ]
    }
  ];

  if (loading && !refreshing && !boosters.length) {
    return (
      <div className="h-screen bg-[#0A0A0B] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-[#D4AF37]" />
          <div className="space-y-2">
            <p className="text-white font-serif italic text-xl tracking-widest">Recruitment Based Initializing...</p>
            <p className="text-white/40 text-xs uppercase tracking-tighter">Connecting to Enterprise Data Pipelines</p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 10 }}
            className="pt-8 border-t border-white/5 space-y-4"
          >
            <p className="text-[12px] text-white/50 uppercase tracking-[0.2em] font-bold">Taking too long?</p>
             <p className="text-[11px] text-white/40 italic font-serif">
               If it's been more than 15 seconds, check your environment variables or Firebase configuration.
             </p>
             <button 
               onClick={() => window.location.reload()}
               className="text-[10px] text-[#D4AF37] hover:underline uppercase tracking-widest font-bold"
             >
               Force Reload
             </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#0A0A0B] selection-accent relative">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 30, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className={cn(
              "fixed top-0 left-1/2 z-[300] px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3",
              notification.type === 'SUCCESS' 
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" 
                : "bg-rose-500/20 border-rose-500/40 text-rose-400"
            )}
          >
            {notification.type === 'SUCCESS' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-xs font-black uppercase tracking-[0.2em]">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Aesthetic */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <div className="absolute inset-0 bg-gradient-to-br from-[#141416] via-[#0A0A0B] to-[#141416]" />
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#D4AF37]/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#3B82F6]/5 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 flex w-full h-full">
        {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <nav className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[#141416] border-r border-[#2D2D30] flex flex-col p-4 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 overflow-y-auto overflow-x-hidden shadow-[10px_0_30px_rgba(0,0,0,0.3)]",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="font-serif italic text-xl mb-6 text-[#D4AF37] tracking-wider flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
            onClick={() => { setDashboardMode(true); setSelectedForm(''); }}
          >
            <svg 
              className="w-6 h-6 shrink-0 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#10B981" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M4 8l8-5 8 5" />
              <path d="M4 14l8-5 8 5" />
              <path d="M4 19h16" />
            </svg>
            Recruitment Based
          </div>
          <div className="flex items-center gap-3">
             <RefreshCw 
               className={cn("w-3.5 h-3.5 cursor-pointer opacity-50 hover:opacity-100 transition-all", refreshing && "animate-spin")} 
               onClick={() => { fetchForms(); fetchData(); }}
             />
             <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
               <X className="w-5 h-5 text-[#94949E]" />
             </button>
          </div>
        </div>

        <button
          onClick={() => { 
            setDashboardMode(true); 
            setSelectedForm(''); 
            localStorage.removeItem('selected_database');
          }}
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-2xl mb-6 transition-all group shadow-lg",
            dashboardMode ? "bg-white/[0.05] ring-2 ring-[#D4AF37]/30" : "hover:bg-white/[0.02]"
          )}
        >
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20 group-hover:bg-[#D4AF37]/20 transition-all">
                <Globe className="w-5 h-5 text-[#D4AF37]" />
             </div>
             <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-white tracking-widest uppercase">Global Dashboard</span>
                <span className="text-[9px] text-white/40 uppercase tracking-tighter">System Overview</span>
             </div>
          </div>
          {dashboardMode && (
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]" />
          )}
        </button>

        {/* Form Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
             <span className="text-[11px] uppercase tracking-widest text-white">
              Databases
            </span>
            {hiddenForms.length > 0 && (
              <button 
                onClick={() => setShowHidden(!showHidden)}
                className="text-[10px] text-[#D4AF37] hover:underline"
              >
                {showHidden ? 'Hide Hidden' : `Archived (${hiddenForms.length})`}
              </button>
            )}
          </div>
          
          <div className="space-y-1">
            {forms.map((form) => {
              const isSelected = selectedForm === form.id && !dashboardMode;
              const summary = dbSummaries[form.id];
              const colorClass = getDbColor(form.id);

              return (
                <div 
                  key={form.id} 
                  className={cn(
                    "group flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl transition-all cursor-pointer shadow-lg",
                    isSelected ? "bg-[#141416] ring-2 ring-[#D4AF37]/50 shadow-[0_10px_30px_rgba(0,0,0,0.4)]" : "hover:bg-white/[0.03] active:scale-98"
                  )}
                  onClick={() => { 
                    setSelectedForm(form.id); 
                    setDashboardMode(false); 
                    setSelectedBoosterIds(new Set()); 
                    localStorage.setItem('selected_database', form.id);
                  }}
                >
                  <div className="flex items-center justify-between gap-3 overflow-hidden">
                    {editingFormId === form.id ? (
                      <input
                        autoFocus
                        className="bg-[#0A0A0B] border border-[#D4AF37] text-[11px] px-3 py-1.5 outline-none w-full text-white rounded-lg shadow-inner"
                        value={editingFormTitle}
                        onChange={(e) => setEditingFormTitle(e.target.value)}
                        onBlur={() => renameForm(form.id, editingFormTitle)}
                        onKeyDown={(e) => e.key === 'Enter' && renameForm(form.id, editingFormTitle)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSelected ? colorClass.replace('text-', 'bg-') : "bg-white/20")} />
                        <span className={cn(
                          "truncate text-[12px] font-bold uppercase tracking-widest",
                          isSelected ? colorClass : "text-white/80 group-hover:text-white"
                        )} title={form.title}>
                          {form.title}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {summary && (
                        <div className="flex items-center gap-1">
                          {summary.urgent > 0 && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_#F43F5E]" />}
                          {summary.stale > 0 && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_#F59E0B]" />}
                          {summary.new > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3B82F6]" />}
                        </div>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFormId(form.id);
                          setEditingFormTitle(form.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-[#D4AF37] transition-opacity p-0.5"
                        title="Rename Database"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          hideDatabase(form.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity p-0.5"
                        title="Hide Database"
                      >
                        <EyeOff className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  
                  {summary && (
                    <div className="flex items-center gap-2 mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                       <div className="flex items-center gap-1 text-[10px] font-bold tracking-tighter">
                          <span className="text-rose-500">{summary.urgent}U</span>
                          <span className="text-white/40">|</span>
                          <span className="text-amber-500">{summary.stale}S</span>
                          <span className="text-white/40">|</span>
                          <span className="text-blue-500">{summary.new}N</span>
                       </div>
                       <span className="text-[9px] text-white/40 uppercase tracking-widest ml-auto">Total: {summary.total}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {showHidden && (
              <div className="mt-2 space-y-1 bg-white/[0.02] rounded-xl p-2 border border-dashed border-white/10">
                <span className="text-[9px] text-white/30 uppercase font-black tracking-widest px-2 mb-1 block">Archived Databases</span>
                {hiddenForms.map(form => (
                  <div key={form.id} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg group">
                    <span className="text-[10px] text-white/50 truncate flex-1">{form.title}</span>
                    <button 
                      onClick={() => restoreForm(form.id)}
                      className="text-[#D4AF37] hover:scale-110 transition-transform p-0.5"
                      title="Restore Database"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 border-b border-[#2D2D30] focus-within:border-[#D4AF37] transition-colors pb-1">
                <Search className="w-3 h-3 text-white/50" />
                <input 
                  type="text" 
                  placeholder="Import Jotform ID..." 
                  value={newFormId}
                  onChange={(e) => setNewFormId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManualForm()}
                  className="bg-transparent text-[10px] text-white focus:outline-none placeholder:text-white/50 w-full"
                />
                <button 
                  onClick={addManualForm}
                  className="text-white/70 hover:text-[#D4AF37] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-2 border-b border-[#2D2D30] focus-within:border-[#4ADE80] transition-colors pb-1">
                <Globe className="w-3 h-3 text-white/50" />
                <input 
                  type="text" 
                  placeholder="New App Database..." 
                  value={localFormTitle}
                  onChange={(e) => setLocalFormTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createLocalForm()}
                  className="bg-transparent text-[10px] text-white focus:outline-none placeholder:text-white/50 w-full"
                />
                <button 
                  onClick={createLocalForm}
                  className="text-white/70 hover:text-[#4ADE80] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {showHidden && hiddenForms.map((form) => (
              <div 
                key={form.id} 
                className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] text-white/60 italic truncate border border-dashed border-[#2D2D30]"
              >
                <span className="truncate">{form.title}</span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => restoreForm(form.id)}
                    className="hover:text-[#4ADE80] transition-colors p-1"
                    title="Restore Form"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => permanentDeleteForm(form.id)}
                    className="hover:text-rose-600 transition-colors p-1"
                    title="Delete Permanently"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {sidebarGroups.map((group, idx) => (
          <div key={idx} className="mb-8">
            <span className="text-[11px] uppercase tracking-widest text-white/80 mb-3 block">
              {group.label}
            </span>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeTab === item.value;
                const tabBoosters = item.value === 'ALL' ? boosters : boosters.filter(b => b.status === item.value);
                const count = tabBoosters.length;
                
                // Calculate notifications for this tab
                const notificationLevelCount = tabBoosters.filter(b => getNotificationLevel(b)).length;

                return (
                  <button
                    key={item.value}
                    onClick={() => { setActiveTab(item.value); setSelectedBoosterIds(new Set()); }}
                    className={cn(
                      "w-auto min-w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm transition-all group/tab relative shadow-sm",
                      isActive ? "bg-white/[0.04] text-white ring-1 ring-white/10" : "text-white/50 hover:text-white hover:bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-[#D4AF37]" : "opacity-30 group-hover:opacity-70 dark:group-hover:text-[#D4AF37]")} />
                      <div className="flex flex-col items-start">
                        <span className="leading-tight font-medium tracking-tight whitespace-nowrap">{item.label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-[11px] font-mono font-bold tracking-widest", isActive ? "text-[#D4AF37]" : "text-white/40 group-hover:text-white/60")}>
                            {count.toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isActive && (
                       <motion.div 
                         layoutId="activeTabIndicator"
                         className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                       />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-auto pt-6 border-t border-[#2D2D30]">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-[#A1A1AA] uppercase tracking-tighter">
              Vercel: Production
            </div>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                firebaseStatus === 'ONLINE' ? "bg-[#4ADE80] shadow-[0_0_8px_#4ADE80]" : 
                firebaseStatus === 'OFFLINE' ? "bg-rose-500 shadow-[0_0_8px_#F43F5E]" : 
                "bg-amber-500 animate-pulse"
              )} />
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-widest",
                firebaseStatus === 'ONLINE' ? "text-[#4ADE80]" : 
                firebaseStatus === 'OFFLINE' ? "text-rose-500" : 
                "text-amber-500"
              )}>
                {firebaseStatus}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-white/30 font-mono mt-1 flex justify-between items-center">
            <span>• RUNNING STABLE</span>
            <span className="text-[8px] opacity-50">{firebaseConfig.projectId}</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0A0A0B] h-full overflow-hidden">
        {error && (
          <div className="mx-10 mt-6 bg-rose-500/10 border border-rose-500/20 px-6 py-3 shrink-0 rounded-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium tracking-wide font-serif italic">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-rose-400/50 hover:text-rose-400 transition-colors bg-white/5 p-1 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <header className="min-h-[64px] border-b border-[#2D2D30] flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 flex-shrink-0 bg-[#0A0A0B]/80 backdrop-blur-md z-30 gap-4 py-2">
          <div className="flex items-center gap-3 text-[13px] text-white/90 w-full sm:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-2 h-2 bg-[#4ADE80] rounded-full shadow-[0_0_8px_#4ADE80] hidden xs:block" />
            <span className="truncate max-w-[200px] xs:max-w-none">
              {dashboardMode ? 'Global Dashboard Overview' : (forms.find(f => f.id === selectedForm)?.title || 'Database Initializing...')}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto overflow-x-auto sm:overflow-visible no-scrollbar pb-2 sm:pb-0">
            <div className="flex items-center gap-2 sm:gap-3 bg-[#141416] p-1.5 rounded-xl border border-[#2D2D30] flex-shrink-0 shadow-inner">
              <div className="hidden md:flex items-center gap-2 px-3 border-r border-[#2D2D30]">
                <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-[12px] text-white/70 uppercase tracking-[0.1em] font-bold whitespace-nowrap">Range</span>
              </div>
              <div className="flex items-center gap-2 px-2">
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDateRange(prev => ({ ...prev, start: val }));
                    if (val) localStorage.setItem('booster_filter_start_date', val);
                  }}
                  className="bg-transparent text-[12px] text-white outline-none [color-scheme:dark] w-auto border-none focus:ring-0 cursor-pointer"
                />
                <span className="text-white/40 text-[12px] select-none">—</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-transparent text-[12px] text-white outline-none [color-scheme:dark] w-auto border-none focus:ring-0 cursor-pointer"
                />
                {(dateRange.start || dateRange.end) && (
                  <button 
                    onClick={() => {
                      const currentDay = getGMT3DateString();
                      setDateRange({ start: '', end: currentDay });
                    }}
                    className="ml-1 sm:ml-2 hover:text-rose-400 transition-colors"
                  >
                    <FilterX className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-3">
                {['RESERVE', 'LOST', 'WAITING FOR RECRUITMENT', 'RECRUITMENT IN PROCESS'].includes(activeTab) && (
                  <div className="flex items-center gap-2 border-b border-[#2D2D30] focus-within:border-[#D4AF37] transition-all px-1 pb-1">
                    <Gamepad2 className="w-3.5 h-3.5 text-white/30" />
                    <select 
                      value={gameFilter}
                      onChange={(e) => setGameFilter(e.target.value)}
                      className="bg-transparent text-[11px] text-white outline-none focus:outline-none min-w-[80px] cursor-pointer"
                    >
                      <option value="" className="bg-[#0A0A0B]">All Games</option>
                      {allGames.map(g => (
                        <option key={g} value={g} className="bg-[#0A0A0B]">{g}</option>
                      ))}
                    </select>
                  </div>
                )}

                <SearchInput 
                  value={search}
                  onChange={setSearch}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/20 uppercase font-bold tracking-[0.2em]">Full Database Search</span>
                <SearchInput 
                  value={deepSearch}
                  onChange={setDeepSearch}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-white/70 hover:text-[#D4AF37] transition-colors"
                title="Database Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => fetchData()}
                disabled={refreshing}
                className="p-2 sm:px-6 sm:py-2 bg-white/5 border border-white/10 text-white text-[12px] font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
                title="Manual Sync"
              >
                {refreshing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-2 sm:px-4 xl:px-6 py-4 sm:py-6 relative">
          {dashboardMode ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-1">
                <h1 className="font-serif italic text-4xl text-white tracking-tight">System Dashboard</h1>
                <p className="text-[10px] text-white/40 uppercase tracking-[0.4em] font-bold">Global Recruitment Overview</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {forms.map(form => {
                  const summary = dbSummaries[form.id];
                  const colorClass = getDbColor(form.id);
                  return (
                    <motion.div
                      key={form.id}
                      whileHover={{ y: -5, scale: 1.02 }}
                      onClick={() => { 
                    setSelectedForm(form.id); 
                    setDashboardMode(false); 
                    setSelectedBoosterIds(new Set()); 
                    localStorage.setItem('selected_database', form.id);
                    fetchData(form.id); 
                  }}
                      className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 cursor-pointer group transition-all hover:bg-white/[0.05] hover:border-[#D4AF37]/30 shadow-2xl relative overflow-hidden"
                    >
                      <div className={cn("absolute top-0 left-0 w-1.5 h-full opacity-50 transition-all group-hover:opacity-100", colorClass.replace('text-', 'bg-'))} />
                      
                      <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex flex-col gap-1">
                             <h3 className={cn("text-xl font-black uppercase tracking-[0.2em] transition-colors leading-tight break-words", colorClass)}>
                               {form.title}
                             </h3>
                             <p className="text-[10px] text-white/30 uppercase font-mono tracking-tighter">Endpoint: {form.id}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-white/40 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/10 transition-all">
                             <ExternalLink className="w-5 h-5" />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-8">
                           <div className="flex flex-col gap-1 p-3 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-center">
                              <span className="text-2xl font-black text-rose-500">{summary?.urgent || 0}</span>
                              <span className="text-[8px] text-rose-500/50 uppercase font-bold tracking-widest">Urgent</span>
                           </div>
                           <div className="flex flex-col gap-1 p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-center">
                              <span className="text-2xl font-black text-amber-500">{summary?.stale || 0}</span>
                              <span className="text-[8px] text-amber-500/50 uppercase font-bold tracking-widest">Stale</span>
                           </div>
                           <div className="flex flex-col gap-1 p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-center">
                              <span className="text-2xl font-black text-blue-400">{summary?.new || 0}</span>
                              <span className="text-[8px] text-blue-400/50 uppercase font-bold tracking-widest">New</span>
                           </div>
                        </div>

                        <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5">
                           <div className="flex flex-col">
                              <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Total Records</span>
                              <span className="text-lg font-black text-white">{summary?.total || 0}</span>
                           </div>
                           <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-all">
                              View Database
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <React.Fragment>
          <AnimatePresence>
            {selectedBoosterIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#141416]/95 backdrop-blur-xl border border-[#2D2D30] p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-6"
              >
                <div className="flex items-center gap-3 pr-6 border-r border-[#2D2D30]">
                  <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center text-black font-bold">
                    {selectedBoosterIds.size}
                  </div>
                  <span className="text-xs text-white/90 font-serif italic whitespace-nowrap">Records Selected</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest mr-2 ml-2">Move to:</span>
                  {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <button
                        key={status}
                        onClick={() => bulkUpdateStatus(status)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-md",
                          cfg.color
                        )}
                      >
                        <cfg.icon className="w-3 h-3" />
                        {cfg.funnelLabel}
                      </button>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setSelectedBoosterIds(new Set())}
                  className="p-2 text-white/40 hover:text-white transition-colors ml-4"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {settingsOpen && (
              <motion.div 
                initial={{ opacity: 0, x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: '100%' }}
                className="absolute inset-y-0 right-0 w-full xs:w-[400px] bg-[#141416] border-l border-[#2D2D30] z-50 p-6 sm:p-8 shadow-2xl flex flex-col overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-serif italic text-xl text-white">Settings</h3>
                    <p className="text-[12px] text-white tracking-widest uppercase font-bold">Database Configuration</p>
                  </div>
                  <button 
                    onClick={() => setSettingsOpen(false)}
                    className="p-2 hover:text-[#D4AF37] transition-colors"
                  >
                    <PanelRightClose className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-4 mb-8 border-b border-[#2D2D30]">
                  <button 
                    onClick={() => setConfigTab('FIELDS')}
                    className={cn(
                      "pb-2 text-[10px] uppercase tracking-widest transition-all px-2",
                      configTab === 'FIELDS' ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/80 hover:text-white"
                    )}
                  >
                    Field Visibility
                  </button>
                  {currentForm?.id.startsWith('local_') && (
                    <button 
                      onClick={() => setConfigTab('BUILDER')}
                      className={cn(
                        "pb-2 text-[10px] uppercase tracking-widest transition-all px-2",
                        configTab === 'BUILDER' ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/80 hover:text-white"
                      )}
                    >
                      Database Builder
                    </button>
                  )}
                  <button 
                    onClick={() => setConfigTab('CONNECTION')}
                    className={cn(
                      "pb-2 text-[10px] uppercase tracking-widest transition-all px-2 ml-auto",
                      configTab === 'CONNECTION' ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/80 hover:text-white"
                    )}
                  >
                    API Keys
                  </button>
                  <button 
                    onClick={() => setConfigTab('TOOLS')}
                    className={cn(
                      "pb-2 text-[10px] uppercase tracking-widest transition-all px-2",
                      configTab === 'TOOLS' ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/80 hover:text-white"
                    )}
                  >
                    Tools
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {configTab === 'FIELDS' ? (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-[12px] text-white/90 uppercase italic font-medium">1. Select Recruitment Status context</p>
                        <div className="flex flex-wrap gap-1">
                          {['ALL', ...Object.keys(STATUS_CONFIG)].map(status => (
                            <button
                              key={status}
                              onClick={() => setConfigStatus(status)}
                              className={cn(
                                "px-2 py-1 text-[9px] uppercase tracking-widest rounded-lg border transition-all",
                                configStatus === status 
                                  ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]" 
                                  : "bg-transparent border-[#2D2D30] text-white/80 hover:border-[#D4AF37]/30"
                              )}
                            >
                              {status === 'ALL' ? 'General View' : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].funnelLabel}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[12px] text-white/90 uppercase italic font-medium">2. Manage Columns & Renames</p>
                        <div className="grid grid-cols-1 gap-1">
                          {allDetectedFields.sort().map(field => {
                            const isHidden = (fieldSettings[selectedForm]?.[configStatus] || []).includes(field);
                            return (
                              <div 
                                key={field}
                                className={cn(
                                  "flex items-center gap-2 p-2 border rounded-sm transition-all bg-[#0A0A0B]",
                                  isHidden ? "border-dashed border-[#2D2D30] opacity-50" : "border-[#2D2D30]"
                                )}>
                                <button
                                  onClick={() => toggleFieldVisibility(selectedForm, configStatus, field)}
                                  className={cn(
                                    "p-1.5 rounded transition-all",
                                    isHidden ? "text-white/60 hover:text-white" : "text-[#D4AF37] hover:bg-[#D4AF37]/10"
                                  )}
                                  title={isHidden ? "Show" : "Hide"}>
                                  {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                
                                <input 
                                  type="text"
                                  placeholder={field}
                                  value={columnRenames[field] || ''}
                                  onChange={(e) => renameColumn(field, e.target.value)}
                                  className="flex-1 bg-transparent text-[11px] font-mono text-white outline-none focus:text-[#D4AF37] placeholder:text-white/40"
                                />
                                
                                {!columnRenames[field] && (
                                  <span className="text-[9px] text-white/50 uppercase italic pointer-events-none">Original</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : configTab === 'CONNECTION' ? (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-[12px] text-white/90 uppercase italic font-medium">Jotform API Configuration</p>
                        <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-tighter">
                          Use your own API key to bypass system defaults. Changes are saved to production database.
                        </p>
                        <input 
                          type="password"
                          placeholder="Paste Jotform API Key..."
                          value={jotformKey}
                          onChange={(e) => setJotformKey(e.target.value)}
                          className="w-full bg-[#0A0A0B] border border-[#2D2D30] text-xs px-3 py-3 rounded-sm focus:border-[#D4AF37] outline-none text-white font-mono"
                        />
                        <button 
                          disabled={isTestingKey}
                          onClick={saveJotformKey}
                          className={cn(
                            "w-full py-3 bg-[#D4AF37] text-black text-[10px] uppercase font-bold tracking-[0.2em] rounded-sm hover:bg-[#B4942E] transition-all flex items-center justify-center gap-2",
                            isTestingKey && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isTestingKey ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Verify & Save Key'}
                        </button>
                      </div>
                    </div>
                  ) : configTab === 'TOOLS' ? (
                    <div className="space-y-8">
                      <div className="space-y-4 p-5 rounded-2xl bg-[#0A0A0B] border border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="p-2 rounded-lg bg-[#D4AF37]/10">
                              <RefreshCw className={cn("w-4 h-4 text-[#D4AF37]", isSyncingHistorical && "animate-spin")} />
                           </div>
                           <div>
                              <p className="text-[12px] text-white font-black uppercase tracking-widest">Manual History Sync</p>
                              <p className="text-[10px] text-white/40 italic">Load older Jotform submissions into database</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold text-white/50 pl-1">Start Date</label>
                            <input 
                              type="date"
                              value={syncHistoryRange.start}
                              onChange={(e) => setSyncHistoryRange(prev => ({ ...prev, start: e.target.value }))}
                              className="w-full bg-black/40 border border-[#2D2D30] text-[11px] text-white px-3 py-2.5 rounded-xl outline-none focus:border-[#D4AF37]/50 transition-all font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold text-white/50 pl-1">End Date</label>
                            <input 
                              type="date"
                              value={syncHistoryRange.end}
                              onChange={(e) => setSyncHistoryRange(prev => ({ ...prev, end: e.target.value }))}
                              className="w-full bg-black/40 border border-[#2D2D30] text-[11px] text-white px-3 py-2.5 rounded-xl outline-none focus:border-[#D4AF37]/50 transition-all font-mono"
                            />
                          </div>
                        </div>

                        {isSyncingHistorical ? (
                          <div className="space-y-3 pt-2">
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(syncProgress.current / (syncProgress.total || 1)) * 100}%` }}
                                className="h-full bg-[#D4AF37]"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-mono text-[#D4AF37] uppercase tracking-widest">Processing submissions...</span>
                              <span className="text-[10px] font-mono text-white/60">{syncProgress.current} / {syncProgress.total}</span>
                            </div>
                          </div>
                        ) : (
                          <button 
                            disabled={!syncHistoryRange.start || !syncHistoryRange.end || !jotformKey}
                            onClick={async () => {
                              if (!selectedForm || selectedForm.startsWith('local_')) return;
                              setIsSyncingHistorical(true);
                              setSyncProgress({ current: 0, total: 0 });
                              try {
                                const filter = JSON.stringify({
                                  "created_at:gt": `${syncHistoryRange.start} 00:00:00`,
                                  "created_at:lt": `${syncHistoryRange.end} 23:59:59`
                                });
                                
                                const headers = { 'x-jotform-api-key': jotformKey };
                                const resp = await axios.get('/api/jotform-submissions', { 
                                  params: { formId: selectedForm, filter, limit: 1000 },
                                  headers
                                });
                                
                                const content = resp.data.content || [];
                                setSyncProgress({ current: 0, total: content.length });
                                
                                // Process in background
                                for (let i = 0; i < content.length; i++) {
                                  const sub = content[i];
                                  const sId = String(sub.id);
                                  const answers = sub.answers || {};
                                  
                                  const formatAnswer = (ans: any) => {
                                    if (typeof ans === 'object' && ans !== null) {
                                      const parts: string[] = [];
                                      Object.entries(ans).forEach(([key, val]) => {
                                        if (key !== 'other' && typeof val === 'string') {
                                          parts.push(val);
                                        }
                                      });
                                      if (ans.other && typeof ans.other === 'string') {
                                        parts.push(ans.other);
                                      }
                                      if (parts.length === 0) {
                                        return Object.values(ans).filter(v => typeof v === 'string').join(', ');
                                      }
                                      return parts.join(', ');
                                    }
                                    return String(ans || '');
                                  };

                                  const dynamicFields: Record<string, string> = {};
                                  Object.values(answers).forEach((a: any) => {
                                    if (a.text && a.answer !== undefined) {
                                       dynamicFields[a.text] = formatAnswer(a.answer);
                                    }
                                  });

                                  const getVal = (label: string) => {
                                      const entry: any = Object.values(answers).find((a: any) => a.text?.toLowerCase().includes(label.toLowerCase()));
                                      return entry ? formatAnswer(entry.answer) : '';
                                  };
                                  
                                  await firebaseService.saveBoosterData({
                                    id: sId,
                                    formId: selectedForm,
                                    status: 'WAITING FOR RECRUITMENT',
                                    notes: '',
                                    contactStartedOn: null,
                                    updatedAt: new Date().toISOString(),
                                    fields: dynamicFields,
                                    telegram: getVal('Telegram') || getVal('Contact'),
                                    discord: getVal('Discord'),
                                    email: getVal('email') || getVal('mail'),
                                    games: getVal('game') || getVal('What games'),
                                    workingHours: getVal('How long') || getVal('Working hours'),
                                    region: getVal('region'),
                                  });
                                  
                                  setSyncProgress(prev => ({ ...prev, current: i + 1 }));
                                }
                                
                                setNotification({ message: `Successfully synced ${content.length} historical records`, type: 'SUCCESS' });
                                fetchData();
                              } catch (err: any) {
                                setNotification({ message: `Sync failed: ${err.message}`, type: 'ERROR' });
                              } finally {
                                setIsSyncingHistorical(false);
                              }
                            }}
                            className="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
                          >
                            Execute History Pull
                            {!jotformKey && <span className="block mt-1 text-[8px] text-rose-500 lowercase tracking-normal">Setup API Key first</span>}
                          </button>
                        )}
                      </div>

                      <div className="space-y-4 p-5 rounded-2xl bg-[#0A0A0B] border border-white/5 opacity-60">
                         <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                               <Shield className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                               <p className="text-[12px] text-white font-black uppercase tracking-widest">Database Health</p>
                               <p className="text-[10px] text-white/40 italic">Global duplicate analysis and cleanup</p>
                            </div>
                         </div>
                         <button 
                            onClick={() => scanGlobalDuplicates()}
                            className="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
                         >
                            Run Global Integrity Scan
                         </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-[10px] text-white/80 uppercase italic">Define the required data fields</p>
                      <div className="space-y-3">
                        {(currentForm?.schema || []).map((field, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input 
                              type="text"
                              value={field}
                              onChange={(e) => {
                                const newSchema = [...(currentForm?.schema || [])];
                                newSchema[idx] = e.target.value;
                                updateLocalSchema(selectedForm, newSchema);
                              }}
                              className="flex-1 bg-[#0A0A0B] border border-[#2D2D30] text-xs px-3 py-2 rounded-sm focus:border-[#4ADE80] outline-none"
                            />
                            <button 
                              onClick={() => {
                                const newSchema = (currentForm?.schema || []).filter((_, i) => i !== idx);
                                updateLocalSchema(selectedForm, newSchema);
                              }}
                              className="text-white/60 hover:text-rose-500 p-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const newSchema = [...(currentForm?.schema || []), 'New Field'];
                            updateLocalSchema(selectedForm, newSchema);
                          }}
                          className="w-full py-2 border border-dashed border-[#2D2D30] text-[10px] uppercase tracking-widest text-[#4ADE80] hover:bg-[#4ADE80]/5 transition-all rounded-sm flex items-center justify-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          Add New Field
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-[#2D2D30]">
                   <p className="text-[11px] text-white/60 uppercase tracking-widest">Settings will be saved automatically to local persistent storage.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {error && (
            <div className="mb-8 p-4 bg-rose-500/5 border border-rose-500/10 rounded flex items-center gap-3 text-rose-400 text-xs font-mono uppercase tracking-widest">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {(() => {
            const urgentBoosters = boosters.filter(b => getNotificationLevel(b) === 'URGENT' || getNotificationLevel(b) === 'STALE').slice(0, 3);
            if (urgentBoosters.length === 0) return null;
            return (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-3 bg-rose-500/5 border border-rose-500/10 rounded-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-3 h-3 text-rose-500" />
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Action Required: Stale Applications</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {urgentBoosters.map(b => (
                    <div key={b.id} className="flex items-center gap-2 text-[10px] bg-white/[0.02] px-2 py-1 border border-white/5 rounded">
                      <span className="text-white/70 font-medium italic">{b.telegram || b.discord || 'Unknown Booster'}</span>
                      <span className="text-white/30 truncate max-w-[100px]">— {b.status}</span>
                      <span className="text-rose-400 font-bold ml-1">{getNotificationLevel(b)}</span>
                    </div>
                  ))}
                  {boosters.filter(b => getNotificationLevel(b) === 'URGENT' || getNotificationLevel(b) === 'STALE').length > 3 && (
                    <div className="text-[9px] text-white/40 flex items-center italic">
                      + {boosters.filter(b => getNotificationLevel(b) === 'URGENT' || getNotificationLevel(b) === 'STALE').length - 3} more...
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          <div className="mb-6">
            <div className="flex flex-col gap-1 mb-6">
              <h1 className="font-serif italic text-4xl text-[#E1E1E6] tracking-tight">
                {forms.find(f => f.id === selectedForm)?.title || 'Recruitment Database'}
              </h1>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.4em] font-bold">Booster Application Management System</p>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white/[0.03] border border-white/5 rounded-[1.5rem] w-fit overflow-x-auto no-scrollbar shadow-inner">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    activeTab === 'ALL' 
                      ? "bg-[#D4AF37] text-black shadow-[0_5px_15px_rgba(212,175,55,0.4)] scale-105" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  All Entries
                </button>
                {(Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setActiveTab(status)}
                    className={cn(
                      "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      activeTab === status 
                        ? "bg-[#D4AF37] text-black shadow-[0_5px_15px_rgba(212,175,55,0.4)] scale-105" 
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {STATUS_CONFIG[status].funnelLabel}
                  </button>
                ))}
              </div>

              {/* Enhanced Notification Summary for Database View */}
              <div className="flex items-center gap-4 bg-[#141416]/50 border border-white/5 px-4 py-2 rounded-3xl backdrop-blur-xl">
                 <div className="flex items-center gap-2 pr-3 border-r border-white/5">
                   <Layout className="w-3.5 h-3.5 text-[#D4AF37]" />
                   <span className="text-[12px] font-black text-white/70 uppercase tracking-widest">Pool Status</span>
                 </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#F43F5E] animate-pulse" />
                      <span className="text-[12px] font-black text-rose-500 font-mono">{poolStats.urgent} URGENT</span>
                    </div>
                    <div className="flex items-center gap-1.5 border-l border-white/5 pl-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#F59E0B]" />
                      <span className="text-[10px] font-black text-amber-500 font-mono">{poolStats.stale} STALE</span>
                    </div>
                    <div className="flex items-center gap-1.5 border-l border-white/5 pl-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60A5FA]" />
                      <span className="text-[10px] font-black text-blue-400 font-mono">{poolStats.fresh} NEW</span>
                    </div>
                  </div>
                 <button 
                  onClick={() => scanGlobalDuplicates()}
                  className="flex items-center gap-2 px-4 py-1.5 ml-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black uppercase tracking-widest hover:bg-[#D4AF37]/20 transition-all shadow-sm group/scan"
                  title="Scan and Mark Global Duplicates"
                >
                  <Copy className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  Clean Pool
                </button>
              </div>
            </div>
          </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-1.5 shadow-inner">
                <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Show:</span>
                {[10, 50, 0].map(size => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-lg transition-all",
                      pageSize === size ? "bg-[#D4AF37] text-black shadow-lg" : "text-white/40 hover:text-white"
                    )}
                  >
                    {size === 0 ? 'ALL' : size}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5">
                {pageSize === 0 ? filteredBoosters.length : Math.min(pageSize, filteredBoosters.length)} / {filteredBoosters.length} Active Records
              </span>
            </div>
          
          <div className="w-full">
            {selectedForm?.startsWith('local_') && (
              <div className="mb-10 p-8 border border-white/10 rounded-3xl bg-white/[0.01] shadow-2xl relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <ListPlus className="w-24 h-24" />
                </div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#4ADE80] flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] shadow-[0_0_10px_#4ADE80]" />
                       Add New Entry
                    </p>
                    <p className="text-[11px] text-white/40 italic font-serif">Quick record creation for your local database</p>
                  </div>
                  <button 
                    onClick={() => { setSettingsOpen(true); setConfigTab('BUILDER'); }}
                    className="px-4 py-2 bg-white/5 text-[10px] font-bold text-white/80 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest flex items-center gap-2 rounded-xl shadow-sm border border-white/5"
                  >
                    Structure
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                  {(currentForm?.schema || []).map(field => (
                    <div key={field} className="flex flex-col gap-2">
                      <label className="text-[12px] text-white/70 font-bold uppercase tracking-widest pl-1">{field}</label>
                      <input 
                        type="text"
                        placeholder="..."
                        value={newRowData[field] || ''}
                        onChange={(e) => setNewRowData(prev => ({ ...prev, [field]: e.target.value }))}
                        className="bg-[#0A0A0B] border border-[#2D2D30] text-[11px] px-4 py-2.5 focus:border-[#4ADE80] outline-none text-white rounded-xl min-w-[180px] shadow-inner transition-all focus:ring-1 focus:ring-[#4ADE80]/30"
                      />
                    </div>
                  ))}
                  <button 
                    onClick={addLocalRow}
                    className="px-10 py-2.5 bg-[#4ADE80] text-black text-[11px] uppercase tracking-[0.2em] rounded-xl hover:bg-[#22C55E] transition-all font-black shadow-[0_10px_30px_rgba(34,197,94,0.2)] active:scale-95"
                  >
                    Save Record
                  </button>
                </div>
              </div>
            )}

            <div 
              ref={tableContainerRef}
              className="overflow-x-auto shadow-[0_30px_80px_rgba(0,0,0,0.6)] rounded-[2.5rem] border border-white/5 bg-[#141416]/60 backdrop-blur-xl mb-20 scrollbar-none"
            >
              <table className="min-w-max w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-[#0A0A0B]/80 backdrop-blur-md">
                    <th className="sticky top-0 left-0 z-50 bg-[#0A0A0B] px-3 py-2.5 text-left border-b border-white/10 rounded-tl-[2.5rem]">
                      <div 
                        onClick={() => {
                          if (selectedBoosterIds.size === filteredBoosters.length) {
                             setSelectedBoosterIds(new Set());
                          } else {
                             setSelectedBoosterIds(new Set(filteredBoosters.map(b => b.id)));
                          }
                        }}
                        className={cn(
                          "w-5 h-5 rounded-lg border flex items-center justify-center cursor-pointer transition-all",
                          selectedBoosterIds.size === filteredBoosters.length && filteredBoosters.length > 0
                            ? "bg-[#D4AF37] border-[#D4AF37] text-black" 
                            : "border-white/20 hover:border-[#D4AF37]/50"
                        )}
                      >
                        {selectedBoosterIds.size === filteredBoosters.length && filteredBoosters.length > 0 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </th>
                    <th className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.2em] text-white/60 border-b border-white/10 whitespace-nowrap">
                       Booster Identity & Contacts
                    </th>
                    <th className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.2em] text-white/60 border-b border-white/10 whitespace-nowrap">
                       Games & Skills
                    </th>
                    {activeTab === 'RECRUITED' && (
                      <th className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37] border-b border-white/10 whitespace-nowrap">
                         Master Info
                      </th>
                    )}
                    <th className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.2em] text-white/60 border-b border-white/10 whitespace-nowrap">
                       Progress
                    </th>
                    <th className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.2em] text-white/60 border-b border-white/10 whitespace-nowrap">
                       CRM ACCOUNT
                    </th>
                    <th className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.2em] text-white/60 border-b border-white/10 whitespace-nowrap">
                       Region & Meta
                    </th>
                    {dynamicColumns.map(col => (
                      <th key={col} className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.2em] text-white/60 border-b border-white/10 max-w-[180px]">
                        {getColumnName(col)}
                      </th>
                    ))}
                    <th className="sticky top-0 z-40 bg-[#0A0A0B] px-3 py-2.5 text-right text-xs font-black uppercase tracking-[0.2em] text-white/60 border-b border-white/10 rounded-tr-[2.5rem]">
                       Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = filteredBoosters.slice(
                      pageSize === 0 ? 0 : (currentPage - 1) * pageSize, 
                      pageSize === 0 ? filteredBoosters.length : currentPage * pageSize
                    );

                    // Disable animations for performance when viewing all
                    if (pageSize === 0) {
                      return rows.map((booster) => {
                        const level = getNotificationLevel(booster);
                        const statusConfig = STATUS_CONFIG[booster.status];
                        return (
                          <tr
                            key={booster.id}
                            className={cn(
                              "group hover:bg-white/[0.02] transition-colors relative",
                              selectedBoosterIds.has(booster.id) && "bg-[#D4AF37]/5"
                            )}
                          >
                            <td className="sticky left-0 z-10 bg-[#0A0A0B]/95 group-hover:bg-[#1A1A1C] px-3 py-2 border-b border-white/5 transition-colors">
                              <div 
                                onClick={() => toggleBoosterSelection(booster.id)}
                                className={cn(
                                  "w-4 h-4 rounded-lg border flex items-center justify-center cursor-pointer transition-all",
                                  selectedBoosterIds.has(booster.id) 
                                    ? "bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] scale-110" 
                                    : "border-white/10 group-hover:border-[#D4AF37]/40"
                                )}
                              >
                                {selectedBoosterIds.has(booster.id) && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </td>
                            {renderRowCells(booster, level, statusConfig)}
                          </tr>
                        );
                      });
                    }

                    return (
                      <AnimatePresence mode="popLayout" initial={false}>
                        {rows.map((booster) => {
                          const level = getNotificationLevel(booster);
                          const statusConfig = STATUS_CONFIG[booster.status];
                          return (
                            <motion.tr
                              key={booster.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className={cn(
                                "group hover:bg-white/[0.02] transition-colors relative",
                                selectedBoosterIds.has(booster.id) && "bg-[#D4AF37]/5"
                              )}
                            >
                               <td className="sticky left-0 z-10 bg-[#0A0A0B]/95 group-hover:bg-[#1A1A1C] px-3 py-2 border-b border-white/5 transition-colors">
                              <div 
                                onClick={() => toggleBoosterSelection(booster.id)}
                                className={cn(
                                  "w-4 h-4 rounded-lg border flex items-center justify-center cursor-pointer transition-all",
                                  selectedBoosterIds.has(booster.id) 
                                    ? "bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] scale-110" 
                                    : "border-white/10 group-hover:border-[#D4AF37]/40"
                                )}
                              >
                                {selectedBoosterIds.has(booster.id) && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </td>
                            {renderRowCells(booster, level, statusConfig)}
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {pageSize > 0 && filteredBoosters.length > pageSize && (
              <div className="flex items-center justify-center gap-4 mb-10">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-[#141416] border border-[#2D2D30] text-white/60 hover:text-[#D4AF37] disabled:opacity-30 disabled:hover:text-white/60 transition-all rounded-sm"
                >
                  Previous
                </button>
                <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">
                  Page {currentPage} of {Math.ceil(filteredBoosters.length / pageSize)}
                </span>
                <button
                  disabled={currentPage === Math.ceil(filteredBoosters.length / pageSize)}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-[#141416] border border-[#2D2D30] text-white/60 hover:text-[#D4AF37] disabled:opacity-30 disabled:hover:text-white/60 transition-all rounded-sm"
                >
                  Next
                </button>
              </div>
            )}

            {filteredBoosters.length === 0 && !refreshing && (
              <div className="py-32 text-center border border-dashed border-[#2D2D30] rounded-xl text-white/40">
                No records found matching current criteria.
              </div>
            )}
            </div>
          </React.Fragment>
        )}
      </div>
    </main>

        {/* Floating Quick Navigation "Scroll Wheel" */}
        <div className="fixed bottom-24 right-6 sm:right-10 flex flex-col gap-2 z-30">
          <button 
            onClick={() => scrollToSection('top')}
            className="w-10 h-10 rounded-full bg-[#141416] border border-[#2D2D30] text-white/50 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 flex items-center justify-center transition-all shadow-xl backdrop-blur-md"
            title="Scroll to Top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col p-1 bg-[#141416] border border-[#2D2D30] rounded-full shadow-2xl backdrop-blur-md">
             <button 
              onClick={() => scrollTable('left')}
              className="w-10 h-10 rounded-full text-white/40 hover:text-[#D4AF37] hover:bg-white/5 flex items-center justify-center transition-all"
              title="Scroll Table Left"
             >
                <ChevronLeft className="w-5 h-5" />
             </button>
             
             {/* Dynamic Scroll Indicator "Wheel" */}
             <div className="h-24 w-10 flex flex-col items-center justify-center relative group/wheel cursor-pointer overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#141416] to-transparent z-10" />
                <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[#141416] to-transparent z-10" />
                
                <div className="flex flex-col gap-1.5 py-2 transition-transform duration-300 group-hover:scale-110">
                   {[...Array(6)].map((_, i) => (
                     <div key={i} className={cn(
                       "w-1 h-1 rounded-full transition-all duration-500",
                       i === 2 ? "bg-[#D4AF37] w-3 scale-125 shadow-[0_0_8px_#D4AF37]" : "bg-white/10"
                     )} />
                   ))}
                </div>

                {/* Hidden Real Scrollbar bridge or interactable zone */}
                <input 
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={scrollPercent}
                  className="absolute inset-0 opacity-0 cursor-ew-resize rotate-90 scale-y-[4]"
                  onChange={(e) => {
                    if (tableContainerRef.current) {
                      const percent = parseInt(e.target.value);
                      const max = tableContainerRef.current.scrollWidth - tableContainerRef.current.clientWidth;
                      tableContainerRef.current.scrollLeft = (max * percent) / 100;
                    }
                  }}
                />
             </div>

             <button 
              onClick={() => scrollTable('right')}
              className="w-10 h-10 rounded-full text-white/40 hover:text-[#D4AF37] hover:bg-white/5 flex items-center justify-center transition-all"
              title="Scroll Table Right"
             >
                <ChevronRight className="w-5 h-5" />
             </button>
          </div>

          <button 
            onClick={() => scrollToSection('bottom')}
            className="w-10 h-10 rounded-full bg-[#141416] border border-[#2D2D30] text-white/50 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 flex items-center justify-center transition-all shadow-xl backdrop-blur-md"
            title="Scroll to Bottom"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>

        {/* Footer Toolbar - Now containing the wide scroll control */}
        <footer className="h-20 sm:h-16 pb-4 sm:pb-2 bg-[#0A0A0B] border-t border-[#2D2D30] flex items-center px-6 sm:px-10 flex-shrink-0 z-50 relative group/footer">
           <div className="relative w-full h-3 bg-white/5 border border-white/5 rounded-full overflow-hidden shadow-inner">
              {/* Visual Indicator of Scroll Position */}
              <div 
                className="absolute h-full bg-[#D4AF37]/80 group-hover/footer:bg-[#D4AF37] transition-all rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                style={{ 
                  width: tableContainerRef.current ? `${(tableContainerRef.current.clientWidth / tableContainerRef.current.scrollWidth) * 100}%` : '15%',
                  left: `${scrollPercent}%`,
                  transform: `translateX(-${scrollPercent}%)`
                }}
              />
              {/* Invisible Slider Control */}
              <input 
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={scrollPercent}
                onChange={(e) => {
                  if (tableContainerRef.current) {
                    const percent = parseFloat(e.target.value);
                    const max = tableContainerRef.current.scrollWidth - tableContainerRef.current.clientWidth;
                    tableContainerRef.current.scrollLeft = (max * percent) / 100;
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
           </div>
        </footer>

        {/* CRM Account Prompt Modal */}
        <AnimatePresence>
          {crmPrompt && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCrmPrompt(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-[#141416] border border-[#2D2D30] rounded-3xl p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
                <h3 className="font-serif italic text-2xl text-white mb-2">Connect CRM Account</h3>
                <p className="text-[12px] text-white/60 uppercase tracking-widest mb-6">Assigning Booster to Database</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] text-white/70 uppercase tracking-[0.2em] mb-2 block font-bold pl-1">CRM Account Name</label>
                    <input
                      autoFocus
                      type="text"
                      className="w-full bg-[#0A0A0B] border border-[#2D2D30] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all shadow-inner"
                      placeholder="Enter account name..."
                      value={tempCrmName}
                      onChange={(e) => setTempCrmName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tempCrmName.trim()) {
                          if (crmPrompt.ids.length === 1) {
                            updateStatus(crmPrompt.ids[0], crmPrompt.status, tempCrmName.trim());
                          } else {
                            bulkUpdateStatus(crmPrompt.status, tempCrmName.trim());
                          }
                          setCrmPrompt(null);
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setCrmPrompt(null)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!tempCrmName.trim()}
                      onClick={() => {
                        if (crmPrompt.ids.length === 1) {
                          updateStatus(crmPrompt.ids[0], crmPrompt.status, tempCrmName.trim());
                        } else {
                          bulkUpdateStatus(crmPrompt.status, tempCrmName.trim());
                        }
                        setCrmPrompt(null);
                      }}
                      className="flex-1 py-3 bg-[#D4AF37] hover:bg-[#B8972F] text-black text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all disabled:opacity-30 shadow-lg shadow-[#D4AF37]/20"
                    >
                      Process Assignment
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Application Detail View Modal */}
        <AnimatePresence>
          {viewingBooster && (
            <LogViewModal 
              booster={viewingBooster} 
              onClose={() => setViewingBooster(null)} 
            />
          )}
        </AnimatePresence>

        {/* Global Field Editor Modal (Notes etc) */}
        <AnimatePresence>
          {editingCell && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingCell(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-[#141416] border border-[#2D2D30] rounded-3xl p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-[#D4AF37]" />
                <h3 className="font-serif italic text-2xl text-white mb-2">Edit {editingCell.field}</h3>
                <p className="text-[12px] text-white/60 uppercase tracking-widest mb-6">Updating Record Data</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] text-white/70 uppercase tracking-[0.2em] mb-2 block font-bold pl-1">
                      {editingCell.field === 'notes' ? 'Record Notes' : editingCell.field === 'games' ? 'Select Portfolio Games' : `Value for ${editingCell.field}`}
                    </label>
                    {editingCell.field === 'notes' ? (
                      <textarea
                        autoFocus
                        rows={6}
                        className="w-full bg-[#0A0A0B] border border-[#2D2D30] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all shadow-inner resize-none scrollbar-thin scrollbar-thumb-white/5"
                        placeholder="Enter notes..."
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      />
                    ) : editingCell.field === 'games' ? (
                      <div className="space-y-4">
                         <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {availableGames.length > 0 ? (
                              <div className="grid grid-cols-1 gap-1.5">
                                {[...availableGames].sort((a, b) => a.localeCompare(b)).map((game, i) => {
                                  const currentGames = splitTags(editingCell.value);
                                  const isSelected = currentGames.includes(game);
                                  return (
                                    <div 
                                      key={i}
                                      onClick={() => {
                                        const newGames = isSelected 
                                          ? currentGames.filter(g => g !== game)
                                          : [...currentGames, game];
                                        setEditingCell({ ...editingCell, value: newGames.join(', ') });
                                      }}
                                      className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                                        isSelected 
                                          ? "bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]" 
                                          : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                        isSelected ? "bg-[#D4AF37] border-[#D4AF37] text-black" : "border-white/20"
                                      )}>
                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                      </div>
                                      <span className="text-[11px] font-bold uppercase tracking-widest">{game}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-10 text-white/20 border border-dashed border-white/10 rounded-xl">
                                <Gamepad2 className="w-10 h-10 mb-3 opacity-10" />
                                <p className="text-[11px] uppercase font-bold tracking-widest mb-1 text-white/40">No options found</p>
                                <p className="text-[9px] uppercase tracking-widest text-white/20 mb-4">Check Jotform connection or use manual entry</p>
                                <button 
                                  onClick={() => fetchAvailableGames(selectedForm)}
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-white/10 transition-all flex items-center gap-2"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Try Re-fetching
                                </button>
                              </div>
                            )}
                         </div>
                         <div className="pt-2 border-t border-white/10">
                            <div className="flex items-center justify-between mb-2">
                               <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Manual Entry / Override</label>
                               <button 
                                  onClick={() => fetchAvailableGames(selectedForm)}
                                  className="text-[9px] text-[#D4AF37] hover:underline uppercase font-bold tracking-tighter flex items-center gap-1"
                               >
                                 <RefreshCw className="w-2.5 h-2.5" />
                                 Refresh List
                               </button>
                            </div>
                            <input
                              type="text"
                              className="w-full bg-[#0A0A0B] border border-[#2D2D30] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all shadow-inner"
                              placeholder="Comma separated games..."
                              value={editingCell.value}
                              onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            />
                         </div>
                      </div>
                    ) : (
                      <input
                        autoFocus
                        type="text"
                        className="w-full bg-[#0A0A0B] border border-[#2D2D30] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all shadow-inner"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      />
                    )}
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setEditingCell(null)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updateBoosterField(editingCell.id, editingCell.field, editingCell.value)}
                      className="flex-1 py-3 bg-[#D4AF37] hover:bg-[#B8972F] text-black text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#D4AF37]/20"
                    >
                      Update Record
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {statusPickerAnchor && (
          <StatusPickerPortal 
            boosterId={statusPickerAnchor.id} 
            anchorRect={statusPickerAnchor.rect} 
            onClose={() => setStatusPickerAnchor(null)} 
            onSelect={(newStatus) => {
              updateStatus(statusPickerAnchor.id, newStatus as any);
              setStatusPickerAnchor(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

