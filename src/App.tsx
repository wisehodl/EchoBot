import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  generateSecretKey, 
  getPublicKey, 
  finalizeEvent, 
  nip19, 
  SimplePool
} from 'nostr-tools';
import { 
  Plus, 
  Trash2, 
  Play, 
  Square, 
  Settings as SettingsIcon, 
  ShieldAlert,
  User, 
  Activity, 
  Target, 
  MessageSquare, 
  Clock, 
  RefreshCw,
  Search,
  Check,
  Globe,
  Layout,
  AlertCircle,
  CheckCircle2,
  Info,
  Key,
  Copy,
  Sparkles,
  Heart,
  Zap,
  Lock,
  Brain,
  X,
  LogOut,
  Send,
  Terminal,
  Users,
  Wand2,
  ChevronUp,
  ChevronDown,
  PenTool,
  FileText,
  Hash,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

// New Imports
import {
  ProfileInfo,
  Identity,
  BotSettings,
  BotTask,
  cn,
  BotStats
} from './types';
import {
  SUPPORTED_MODELS,
  MODEL_PRESETS,
  MODEL_HIDDEN_RULES,
  MODEL_DEFAULT_PROMPTS,
  WAIFU_NAMES,
  WAIFU_AVATARS,
  PUBLISH_RELAYS,
  SEARCH_RELAYS,
  KIND_BOT_IDENTITY,
  DEFAULT_SETTINGS,
  STORAGE_KEY_CURATOR_PUBKEY,
  STORAGE_KEY_SAVED_IDENTITIES,
  STORAGE_KEY_CURRENT_SESSION,
  STORAGE_KEY_GLOBAL_LIGHTNING_SYNC,
  STORAGE_KEY_GLOBAL_POLITE_MODE,
  STORAGE_KEY_DEVICE_ID,
  STORAGE_KEY_LAST_SYNC,
  STORAGE_KEY_ACTIVE_NSEC,
  INITIAL_STATS,
  POPULAR_EMOJIS,
  EMOJI_DATA
} from './constants';
import { useAppStore } from './hooks/useAppStore';
import { LogTimeline } from './components/LogTimeline';

// --- Helpers ---
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function generateWaifuProfile(): ProfileInfo {
  const name = WAIFU_NAMES[Math.floor(Math.random() * WAIFU_NAMES.length)];
  const picture = WAIFU_AVATARS[Math.floor(Math.random() * WAIFU_AVATARS.length)];
  return {
    name,
    about: `I am your devoted assistant, ${name}. I'm here to support you! ✨`,
    picture,
    nip05: ''
  };
}

// --- Components ---

export default function App() {
  // Store & Hooks
  const { state, addLog, clearLogs, updateStats, setIdentityStats, resetStats } = useAppStore();
  const { logs, sessionStats, identityStats } = state;

  const deviceId = useMemo(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (saved) return saved;
    const newId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, newId);
    return newId;
  }, []);

  // Refs
  const poolRef = useRef<SimplePool | null>(null);
  const subscriptionsRef = useRef<Map<string, any[]>>(new Map());
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const taskQueueRef = useRef<BotTask[]>([]);
  const isProcessingQueueRef = useRef(false);
  const isInitialMountIdentities = useRef(true);
  const isInitialMountSettings = useRef(true);

  // UI State
  const [runningIdentityIds, setRunningIdentityIds] = useState<Set<string>>(new Set());
  const isRunning = (id: string) => runningIdentityIds.has(id);
  const isAnyBotRunning = runningIdentityIds.size > 0;
  
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [curatorProfile, setCuratorProfile] = useState<ProfileInfo | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [communityPersonas, setCommunityPersonas] = useState<{ id: string; author: string; settings: BotSettings; event: any }[]>([]);
  const [communityProfiles, setCommunityProfiles] = useState<Record<string, ProfileInfo>>({});
  const [personaVotes, setPersonaVotes] = useState<Record<string, { up: number, down: number, userVote?: string, userReactionId?: string }>>({});
  
  const [showZapDialog, setShowZapDialog] = useState(false);
  const [showZapSuccess, setShowZapSuccess] = useState(false);
  const [zapData, setZapData] = useState<{ 
    personaId: string; 
    author: string; 
    amount: number; 
    comment: string; 
    invoice?: string; 
    isPaying?: boolean;
    error?: string;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncCheck, setShowSyncCheck] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    return saved ? parseInt(saved) : 0;
  });

  const [isVerbose, setIsVerbose] = useState(false);
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);

  const [currentIdentity, setCurrentIdentity] = useState<{ sk: Uint8Array; pk: string } | null>(null);
  const [activeRelays, setActiveRelays] = useState<string[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [managerTab, setManagerTab] = useState<'local' | 'community' | 'chat'>('local');
  const [settingsTab, setSettingsTab] = useState<'general' | 'ai' | 'advanced' | 'logs'>('general');
  const [globalUseCuratorLightning, setGlobalUseCuratorLightning] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_GLOBAL_LIGHTNING_SYNC) === 'true';
  });
  const [globalPoliteMode, setGlobalPoliteMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GLOBAL_POLITE_MODE);
    return saved === null ? true : saved === 'true';
  });
  const [rightTab, setRightTab] = useState<'timeline' | 'persona'>('timeline');
  const [personaSubTab, setPersonaSubTab] = useState<'profile' | 'prompt' | 'tuning' | 'behavior' | 'proactive'>('profile');
  const [showAddIdentityDialog, setShowAddIdentityDialog] = useState(false);
  const [showEmojiPickerDialog, setShowEmojiPickerDialog] = useState(false);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');
  const [swarmSearchQuery, setSwarmSearchQuery] = useState('');
  const [monitoringInput, setMonitoringInput] = useState('');
  const [savedIdentities, setSavedIdentities] = useState<Identity[]>([]);
  const [activeIdentityId, setActiveIdentityId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'manager' | 'settings'>('dashboard');

  const [targetFollows, setTargetFollows] = useState<string[]>([]);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const [plannedCounts, setPlannedCounts] = useState<Record<string, number>>({});

  // Swarm Chat State
  const [swarmChatMessages, setSwarmChatMessages] = useState<{ id: string; botId?: string; name: string; content: string; timestamp: number }[]>([]);
  const [swarmChatParticipants, setSwarmChatParticipants] = useState<Set<string>>(new Set());
  const [swarmTopic, setSwarmTopic] = useState('General Discussion');
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [isSwarmChatThinking, setIsSwarmChatThinking] = useState<string | null>(null); // Bot ID currently thinking
  const swarmChatAbortControllerRef = useRef<AbortController | null>(null);

  // AI Brain State
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [aiProgress, setAiProgress] = useState(0);
  const [aiErrorMessage, setAiErrorMessage] = useState('');
  const [currentLoadingFile, setCurrentLoadingFile] = useState('');
  const aiWorkerRef = useRef<Worker | null>(null);
  const aiResolveRef = useRef<((value: string) => void) | null>(null);
  const conversationHistoryRef = useRef<Map<string, { role: string; content: string }[]>>(new Map());
  const processedEventsRef = useRef<Set<string>>(new Set());

  const lastModelIdRef = useRef(settings.modelId);
  const lastUseAIRef = useRef(settings.useAI);
  
  const [playgroundMessages, setPlaygroundMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isPlaygroundThinking, setIsPlaygroundThinking] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const playgroundScrollRef = useRef<HTMLDivElement>(null);
  const playgroundInputRef = useRef<HTMLInputElement>(null);

  // Autoscroll Swarm Chat
  useEffect(() => {
    if (managerTab === 'chat') {
      const element = document.getElementById('swarm-chat-end');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [swarmChatMessages, isSwarmChatThinking, managerTab]);

  // Autoscroll Playground
  useEffect(() => {
    if (playgroundScrollRef.current) {
      playgroundScrollRef.current.scrollTop = playgroundScrollRef.current.scrollHeight;
    }
  }, [playgroundMessages, isPlaygroundThinking]);

  // Event Batching Ref
  const eventBatchRef = useRef<{ id: string, update: Partial<Record<keyof BotStats, number>> }[]>([]);

  // Periodically flush stat batches to the store (Phase 3 Part 1)
  useEffect(() => {
    const interval = setInterval(() => {
      if (eventBatchRef.current.length > 0) {
        // Aggregate batches by identity ID
        const aggregates: Record<string, Partial<Record<keyof BotStats, number>>> = {};
        
        eventBatchRef.current.forEach(({ id, update }) => {
          if (!aggregates[id]) aggregates[id] = {};
          Object.entries(update).forEach(([key, val]) => {
            const k = key as keyof BotStats;
            aggregates[id][k] = (Number(aggregates[id][k]) || 0) + (Number(val) || 0);
          });
        });

        Object.entries(aggregates).forEach(([id, update]) => {
          updateStats(id, update);
          setSavedIdentities(prev => prev.map(i => i.id === id ? { ...i, lastActivityTimestamp: Date.now(), updatedAt: Date.now() } : i));
        });

        eventBatchRef.current = [];
      }
    }, 500); // Batch every 500ms

    return () => clearInterval(interval);
  }, [updateStats]);

  const addStatToBatch = useCallback((id: string, update: Partial<Record<keyof BotStats, number>>) => {
    eventBatchRef.current.push({ id, update });
  }, []);

  // AI Brain Management
  const isInitializingRef = useRef(false);

  useEffect(() => {
    // 1. If AI is disabled, ensure worker is dead and status is idle
    if (!settings.useAI) {
      if (aiStatus !== 'idle') setAiStatus('idle');
      setAiProgress(0);
      if (aiWorkerRef.current) {
        aiWorkerRef.current.terminate();
        aiWorkerRef.current = null;
      }
      isInitializingRef.current = false;
      return;
    }

    // 2. Trigger loading if enabled but idle/error
    if (aiStatus === 'idle' || aiStatus === 'error') {
      setAiStatus('loading');
      return;
    }

    // 3. Worker Execution (Only in 'loading' state)
    if (aiStatus !== 'loading' || isInitializingRef.current) return;

    // Safety: check if settings changed
    const isModelChange = lastModelIdRef.current !== settings.modelId;
    const isUseAIChange = lastUseAIRef.current !== settings.useAI;

    if (aiWorkerRef.current && (isModelChange || isUseAIChange)) {
      aiWorkerRef.current.terminate();
      aiWorkerRef.current = null;
    } else if (aiWorkerRef.current) {
      // Already running and settings are same, don't restart
      return;
    }

    isInitializingRef.current = true;
    lastModelIdRef.current = settings.modelId;
    lastUseAIRef.current = settings.useAI;

    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        if (data.file) {
          const fileName = data.file.split('/').pop();
          setCurrentLoadingFile(fileName);
        }
        const isModelFile = data.file && (data.file.includes('.onnx') || data.file.includes('onnx_'));
        const isMainDownload = data.status === 'progress' && data.progress !== undefined;
        if (isMainDownload && isModelFile) {
          setAiProgress(data.progress);
        } else if (data.status === 'initiate') {
          addLog(`Starting download: ${data.file.split('/').pop()}`, 'info');
        }
      } else if (type === 'ready') {
        setAiStatus('ready');
        setAiProgress(100);
        setCurrentLoadingFile('');
        isInitializingRef.current = false;
        addLog(`AI Brain (${settings.modelId.split('/').pop()}) is ready!`, 'success');
      } else if (type === 'result') {
        if (aiResolveRef.current) {
          aiResolveRef.current(data);
          aiResolveRef.current = null;
        }
      } else if (type === 'error') {
        setAiStatus('error');
        setAiErrorMessage(data);
        isInitializingRef.current = false;
        addLog(`AI Brain Error: ${data}`, 'error');
      } else if (type === 'status') {
        if (data.includes('Initializing')) {
          setCurrentLoadingFile('Engine...');
        }
        addLog(data, 'info');
      }
    };

    worker.postMessage({ type: 'init', data: { model_id: settings.modelId } });
    aiWorkerRef.current = worker;
  }, [aiStatus, settings.useAI, settings.modelId, addLog]);

  // --- Bot Logic Helpers ---

  /**
   * Ensures that the message list alternates between 'user' and 'assistant'
   * as required by many LLM chat templates.
   */
  const sanitizeConversationHistory = (messages: { role: string; content: string }[]) => {
    const result: { role: string; content: string }[] = [];
    let lastRole: string | null = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        result.push(msg);
        continue;
      }
      
      // If this message has the same role as the previous one, 
      // we merge their content to maintain alternation.
      if (msg.role === lastRole) {
        if (result.length > 0) {
          result[result.length - 1].content += "\n" + msg.content;
        } else {
          result.push(msg);
        }
      } else {
        result.push(msg);
        lastRole = msg.role;
      }
    }
    return result;
  };

  const handlePlaygroundSend = async () => {
    if (!playgroundInput.trim() || !settings.useAI || aiStatus !== 'ready' || isPlaygroundThinking) return;

    const userMsg = playgroundInput.trim();
    setPlaygroundInput('');
    setPlaygroundMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsPlaygroundThinking(true);

    try {
      const aiResult = await generateBotMessage(settings, 'playground', communityProfiles, 'playground', userMsg);
      if (aiResult) {
        setPlaygroundMessages(prev => [...prev, { role: 'assistant', content: aiResult }]);
      }
    } catch (e) {
      addLog(`Playground Error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    } finally {
      setIsPlaygroundThinking(false);
      setTimeout(() => {
        playgroundInputRef.current?.focus();
      }, 0);
    }
  };

  async function getInspirationNotes(identity: Identity, limit = 10): Promise<{ pubkey: string; content: string }[]> {
    if (!poolRef.current) poolRef.current = new SimplePool();
    const authors: string[] = [];
    
    // 1. Get Target Pubkey
    if (identity.settings.targetNpub) {
      try {
        const decoded = nip19.decode(identity.settings.targetNpub) as any;
        if (decoded.type === 'npub') {
          authors.push(decoded.data);
        }
      } catch (e) {}
    }

    // 2. Get Follow List (if requested or if no target)
    if (identity.settings.proactive.inspiration !== 'target' || authors.length === 0) {
      try {
        const { data: sk } = nip19.decode(identity.nsec);
        const pk = getPublicKey(sk as any);
        const contactList = await poolRef.current.get(SEARCH_RELAYS, { kinds: [3], authors: [pk] });
        if (contactList) {
          const follows = contactList.tags.filter(t => t[0] === 'p').map(t => t[1]);
          if (follows.length > 0) {
            authors.push(...follows.slice(0, 20)); // Limit to 20 follows for context safety
          }
        }
      } catch (e) {}
    }

    if (authors.length === 0) return [];

    try {
      // Use list with a timeout to prevent hanging/memory leaks
      const notes = await Promise.race([
        poolRef.current.querySync(SEARCH_RELAYS, {
          kinds: [1],
          authors: [...new Set(authors)],
          limit
        }),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Inspiration fetch timeout')), 5000))
      ]);

      // Clean and truncate note content to prevent context explosion
      return (notes || []).map(n => {
        let cleaned = n.content
          .replace(/https?:\/\/\S+/gi, '') // Remove URLs
          .replace(/nostr:\S+/gi, '')      // Remove nostr: links
          .replace(/\s+/g, ' ')            // Collapse whitespace
          .trim();
        
        return { 
          pubkey: n.pubkey, 
          content: cleaned.substring(0, 280) 
        };
      }).filter(n => n.content.length > 5); // Skip empty or tiny notes
    } catch (e) {
      console.warn('Failed to fetch inspiration notes:', e);
      return [];
    }
  }

  async function generateBotMessage(
    botSettings: BotSettings, 
    identityId: string,
    communityProfiles: Record<string, ProfileInfo>,
    targetNpub?: string, 
    content?: string, 
    context?: { pubkey: string; content: string }[],
    isOriginalPost = false,
    topic = ''
  ): Promise<string> {
    if (!botSettings.useAI || aiStatus !== 'ready' || !aiWorkerRef.current) {
      if (!isOriginalPost && !content) {
        addLog(`[${botSettings.profile.name}] AI Brain is not ready. Skipping reply.`, 'warning', undefined, botSettings.profile.name, undefined, undefined, undefined, undefined, identityId);
      }
      return '';
    }

    try {
      const historyKey = `${identityId}:${targetNpub || 'default'}`;
      const history = conversationHistoryRef.current.get(historyKey) || [];

      let targetHex = '';
      if (botSettings.targetNpub) {
        try {
          const decoded = nip19.decode(botSettings.targetNpub) as any;
          if (decoded.type === 'npub') targetHex = decoded.data
        } catch (e) {}
      }

      const resolvedTargetName = communityProfiles[targetHex]?.name
        || botSettings.targetName
        || 'darling';

      const userPersona = botSettings.aiSystemPrompt
        .replace(/{name}/gi, botSettings.profile.name)
        .replace(/{target_name}/gi, resolvedTargetName);

      const hiddenRules = MODEL_HIDDEN_RULES[botSettings.modelId] || "";
      const fullSystemPrompt = `${hiddenRules}\n\n${userPersona}`;

      // Format thread context for the AI (Limit to top 5 for memory safety)
      const threadContext = (context || []).slice(0, 5).map(msg => ({
        role: 'user' as const,
        content: msg.pubkey ? `[Context from ${msg.pubkey.substring(0, 8)}]: ${msg.content}` : msg.content
      }));

      const userMessage = isOriginalPost 
        ? (topic || botSettings.proactive.aiPostPrompt)
        : (content || '');

      if (!userMessage && !isOriginalPost) return '';

      const rawMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...threadContext,
        ...history,
        { role: 'user', content: userMessage }
      ];
      const messages = sanitizeConversationHistory(rawMessages);

      const aiPromise = new Promise<string>((resolve) => {
        aiResolveRef.current = resolve;
      });

      aiWorkerRef.current.postMessage({
        type: 'generate',
        data: { 
          messages, 
          max_new_tokens: botSettings.modelId.includes('270m') ? 40 : 64,
          temperature: botSettings.temperature,
          top_p: botSettings.top_p,
          top_k: botSettings.top_k,
          repetition_penalty: botSettings.repetition_penalty,
          presence_penalty: botSettings.presence_penalty,
          frequency_penalty: botSettings.frequency_penalty
        }
      });

      const aiResult = await aiPromise;
      if (typeof aiResult === 'string' && aiResult.trim()) {
        let cleaned = aiResult.trim();
        
        const namePrefix = botSettings.profile.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRegex = new RegExp(`^(${namePrefix}|assistant|bot|reply):`, 'i');
        cleaned = cleaned.replace(prefixRegex, '').trim();
        cleaned = cleaned.replace(/^[^:]+:/, '').trim(); 

        const sentenceEndRegex = /[.!?](\s+|$)/;
        const sentences = cleaned.split(sentenceEndRegex).filter(s => s && s.trim().length > 1);
        if (sentences.length > 2) {
          cleaned = sentences.slice(0, 2).join('. ') + '.';
        }

        if (!cleaned && aiResult.includes(':')) {
           cleaned = aiResult.split(':').slice(1).join(':').trim();
        }

        const messageText = cleaned || aiResult.trim();

        const newHistory = [
          ...history,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: messageText }
        ].slice(-10);
        conversationHistoryRef.current.set(historyKey, newHistory);
        
        return messageText;
      }
    } catch (e) {
      console.error('AI Brain error:', e);
      addLog('AI Generation failed.', 'error');
    }

    return '';
  }


  // Initialize identity and settings on load
  useEffect(() => {
    // Log isolation status for debugging
    if (self.crossOriginIsolated) {
      addLog('Environment is Cross-Origin Isolated. Multi-threading enabled.', 'info');
    } else {
      addLog('Environment is NOT Cross-Origin Isolated. Multi-threading will be limited.', 'warning');
    }

    // 0. Restore Curator Session
    const savedCuratorPubkey = localStorage.getItem(STORAGE_KEY_CURATOR_PUBKEY);
    if (savedCuratorPubkey) {
      setUserPubkey(savedCuratorPubkey);
      fetchCuratorProfile(savedCuratorPubkey);
    }

    // 1. Load Saved Identities
    const saved = localStorage.getItem(STORAGE_KEY_SAVED_IDENTITIES);
    let loadedIdentities: Identity[] = [];
    if (saved) {
      try {
        loadedIdentities = JSON.parse(saved);
        
        // --- Migration for Cloud Sync (v0.2.0) + npub optimization ---
        let needsMigration = false;
        const migrated = loadedIdentities.map(id => {
          let updated = { ...id };
          // Initialize updatedAt if missing
          if (!updated.updatedAt) {
            updated.updatedAt = updated.createdAt || Date.now();
            needsMigration = true;
          }
          // Migrate legacy stats (flat numbers) to device maps
          if (updated.stats && typeof Object.values(updated.stats)[0] === 'number') {
            const legacy = updated.stats as any;
            updated.stats = {
              repliesSent: { [deviceId]: legacy.repliesSent || 0 },
              reactionsSent: { [deviceId]: legacy.reactionsSent || 0 },
              repostsSent: { [deviceId]: legacy.repostsSent || 0 },
              proactiveNotesSent: { [deviceId]: 0 },
              repliesReceived: { [deviceId]: legacy.repliesReceived || 0 },
              reactionsReceived: { [deviceId]: legacy.reactionsReceived || 0 },
            };
            needsMigration = true;
          }
          // Ensure mandatory stat maps exist
          if (updated.stats) {
            if (!updated.stats.repostsSent) {
              updated.stats.repostsSent = {};
              needsMigration = true;
            }
            if (!updated.stats.proactiveNotesSent) {
              updated.stats.proactiveNotesSent = {};
              needsMigration = true;
            }
          }
          // Pre-calculate npub if missing
          if (!updated.npub) {
            try {
              const decoded = nip19.decode(updated.nsec) as any;
              updated.npub = nip19.npubEncode(getPublicKey(decoded.data));
              needsMigration = true;
            } catch (e) {
              console.error('Failed to migrate npub for identity:', updated.id, e);
            }
          }

          // Migrate proactive settings (v0.2.1)
          const currentProactive = (updated.settings.proactive || {}) as any;
          if (
            !updated.settings.proactive || 
            currentProactive.enabled === undefined
          ) {
            updated.settings.proactive = {
              enabled: currentProactive.enabled ?? false,
              interval: currentProactive.interval ?? 240,
              inspiration: currentProactive.inspiration ?? 'target',
              replyToMentions: currentProactive.replyToMentions ?? true,
              replyProbability: currentProactive.replyProbability ?? 0.5,
              aiPostPrompt: currentProactive.aiPostPrompt ?? 'Write a short, engaging status update about your current thoughts. Be concise and stay in character.'
            };
            needsMigration = true;
          }

          // Migrate politeMode (v0.2.2)
          if (updated.settings.politeMode === undefined) {
            updated.settings.politeMode = true;
            needsMigration = true;
          }

          return updated;
        });

        if (needsMigration) {
          loadedIdentities = migrated;
          setSavedIdentities(migrated);
          localStorage.setItem(STORAGE_KEY_SAVED_IDENTITIES, JSON.stringify(migrated));
          addLog('Bot identities migrated for performance.', 'info');
        } else {
          setSavedIdentities(loadedIdentities);
        }

        // Initialize store identityStats
        loadedIdentities.forEach(id => {
          if (id.stats) {
            setIdentityStats(id.id, id.stats);
          }
        });
      } catch (e) {
        console.error('Failed to parse saved identities:', e);
      }
    }

    // 2. Load Current Session (Active Identity)
    const session = localStorage.getItem(STORAGE_KEY_CURRENT_SESSION);
    if (session) {
      try {
        const parsed = JSON.parse(session);
        setSettings(parsed.settings);
        
        // Load keys
        const { data } = nip19.decode(parsed.nsec);
        const sk = data as any;
        const pk = getPublicKey(sk);
        setCurrentIdentity({ sk, pk });

        setActiveIdentityId(parsed.id || null);
        addLog(`Restored session: ${parsed.settings.profile.name}`, 'info');
        return; // Session restored, we are done
      } catch (e) {
        console.error('Failed to restore session:', e);
      }
    }

    // 3. Fallback: Load first saved identity or create default
    if (loadedIdentities.length > 0) {
      const first = loadedIdentities[0];
      setSettings(first.settings);
      const { data } = nip19.decode(first.nsec);
      const sk = data as any;
      const pk = getPublicKey(sk);
      setCurrentIdentity({ sk, pk });
      setActiveIdentityId(first.id);
    } else {
      setShowOnboarding(true);
      addLog('Welcome to EchoBot! Let\'s set up your first autonomous AI.', 'info');
    }
  }, []);

  // Real-time Persistence: Save current session whenever settings or identity changes
  useEffect(() => {
    if (!currentIdentity) return;
    
    const sessionData = {
      id: activeIdentityId,
      nsec: nip19.nsecEncode(currentIdentity.sk),
      settings: settings
    };

    localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, JSON.stringify(sessionData));
    localStorage.setItem(STORAGE_KEY_ACTIVE_NSEC, sessionData.nsec);

    // Also auto-update the saved list if this is a known identity
    if (activeIdentityId) {
      setSavedIdentities(prev => prev.map(id => {
        if (id.id === activeIdentityId) {
          return {
            ...id,
            name: settings.profile.name,
            settings: settings,
            updatedAt: Date.now()
          };
        }
        return id;
      }));
    }
    }, [settings, currentIdentity, activeIdentityId]);
  // Sync identityStats back into savedIdentities when they change
  useEffect(() => {
    if (Object.keys(identityStats).length === 0) return;
    setSavedIdentities(prev => prev.map(id => {
      if (identityStats[id.id]) {
        return { ...id, stats: identityStats[id.id] };
      }
      return id;
    }));
  }, [identityStats]);

  // Persist the saved identities list whenever it changes
  useEffect(() => {
    if (isInitialMountIdentities.current) {
      isInitialMountIdentities.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY_SAVED_IDENTITIES, JSON.stringify(savedIdentities));
  }, [savedIdentities]);

  // Persist Global Preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GLOBAL_LIGHTNING_SYNC, String(globalUseCuratorLightning));
  }, [globalUseCuratorLightning]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GLOBAL_POLITE_MODE, String(globalPoliteMode));
  }, [globalPoliteMode]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('Copied to clipboard.', 'info');
  };

  const handleNip07Login = async (): Promise<{ identities: Identity[] | null, profile: ProfileInfo | null, pubkey: string } | null> => {
    if (!window.nostr) {
      addLog('Nostr extension not found. Please install Alby or a similar extension.', 'error');
      return null;
    }
    try {
      const pubkey = await window.nostr.getPublicKey();
      setUserPubkey(pubkey);
      localStorage.setItem(STORAGE_KEY_CURATOR_PUBKEY, pubkey);
      
      // Fetch profile first, then log with the name
      const profile = await fetchCuratorProfile(pubkey);
      addLog(`Logged in as curator: ${profile?.name || pubkey.substring(0, 8)}`, 'success', pubkey, profile?.name);

      // Perform initial sync IMMEDIATELY with the new pubkey
      const synced = await performSync(true, pubkey);
      return { identities: synced, profile, pubkey };
    } catch (e) {
      addLog('NIP-07 Login failed.', 'error');
      return null;
    }
  };

  const fetchCuratorProfile = async (pubkey: string): Promise<ProfileInfo | null> => {
    if (!poolRef.current) poolRef.current = new SimplePool();
    try {
      const profileEvent = await poolRef.current.get(SEARCH_RELAYS, {
        kinds: [0],
        authors: [pubkey]
      });

      let profile: ProfileInfo;
      if (profileEvent) {
        try {
          const content = JSON.parse(profileEvent.content);
          profile = {
            name: content.name || content.display_name || `NIP-07 User`,
            about: content.about || '',
            picture: content.picture || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${pubkey}`,
            nip05: content.nip05 || '',
            lud16: content.lud16 || content.lightning_address || ''
          };
        } catch (e) {
          profile = {
            name: `NIP-07 User`,
            about: '',
            picture: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${pubkey}`,
            nip05: '',
            lud16: ''
          };
        }
      } else {
        profile = {
          name: `NIP-07 User`,
          about: '',
          picture: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${pubkey}`,
          nip05: '',
          lud16: ''
        };
      }
      setCuratorProfile(profile);
      setCommunityProfiles(prev => ({ ...prev, [pubkey]: profile }));
      return profile;
    } catch (e) {
      return null;
    }
  };

  const fetchProfiles = useCallback(async (pubkeys: string[]) => {
    if (!poolRef.current || pubkeys.length === 0) return;
    
    // Filter out already cached profiles
    const toFetch = pubkeys.filter(pk => !communityProfiles[pk]);
    if (toFetch.length === 0) return;

    try {
      const metadataEvents = await poolRef.current.querySync(SEARCH_RELAYS, {
        kinds: [0],
        authors: toFetch
      });

      const profileMap: Record<string, ProfileInfo> = {};
      metadataEvents.forEach(ev => {
        try {
          const content = JSON.parse(ev.content);
          profileMap[ev.pubkey] = {
            name: content.name || content.display_name || 'Anonymous',
            about: content.about || '',
            picture: content.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${ev.pubkey}`,
            nip05: content.nip05 || '',
            lud16: content.lud16 || '',
            lud06: content.lud06 || ''
          };
        } catch (e) {}
      });
      setCommunityProfiles(prev => ({ ...prev, ...profileMap }));
    } catch (e) {}
  }, [communityProfiles]);

  // Auto-fetch profiles for logs and monitored targets
  useEffect(() => {
    const logPubkeys = logs
      .map(l => l.pubkey)
      .filter((pk): pk is string => !!pk && !communityProfiles[pk]);
    
    // Also fetch for monitored targets in all bots
    const targetPubkeys: string[] = [];
    savedIdentities.forEach(identity => {
      if (identity.settings.targetNpub) {
        String(identity.settings.targetNpub || '').split(',').forEach(npub => {
          try {
            const decoded = nip19.decode(npub.trim()) as any;
            if (decoded.type === 'npub' && !communityProfiles[decoded.data]) {
              targetPubkeys.push(decoded.data);
            }
          } catch (e) {}
        });
      }
    });

    const toFetch = [...new Set([...logPubkeys, ...targetPubkeys])];
    
    if (toFetch.length > 0) {
      fetchProfiles(toFetch);
    }
  }, [logs, communityProfiles, savedIdentities, fetchProfiles]);

  const handleLogout = () => {
    if (window.confirm('Logging out will clear ALL local data, bots, and settings from this device. Are you sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleFreshStart = () => {
    if (window.confirm('Are you absolutely sure? This will delete ALL saved identities, settings, and logs. This action cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const publishPersona = async () => {
    if (!userPubkey || !window.nostr) {
      addLog('Please login with a Nostr extension first.', 'error');
      return;
    }

    try {
      // Prepare sanitized settings for sharing
      const shareableSettings = { 
        ...settings,
        targetNpub: '', // Clear target for public sharing
        targetName: '',
        profile: {
          ...settings.profile,
          lud16: undefined,
          lud06: undefined
        }
      };

      const event = {
        kind: KIND_BOT_IDENTITY,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', activeIdentityId || 'default'],
          ['t', 'echobot-persona'],
          ['m', settings.modelId],
          ['n', settings.profile.name]
        ],
        content: JSON.stringify(shareableSettings),
        pubkey: userPubkey
      };

      const signedEvent = await window.nostr.signEvent(event);
      
      if (!poolRef.current) poolRef.current = new SimplePool();
      const pubs = poolRef.current.publish(PUBLISH_RELAYS, signedEvent);
      
      addLog('Publishing persona to network...', 'info');
      await Promise.allSettled(pubs);
      addLog('Persona published successfully!', 'success');
    } catch (e) {
      addLog(`Failed to publish persona: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    }
  };

  const lastPushedDataRef = useRef<string>('');
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performSync = async (silent = false, overridePubkey?: string): Promise<Identity[] | null> => {
    const pk = overridePubkey || userPubkey;
    if (!pk || !window.nostr?.nip44) {
      if (!silent) addLog('NIP-44 capable extension required for cloud sync.', 'error');
      return null;
    }

    setIsSyncing(true);
    if (!silent) addLog('Starting cloud sync...', 'info');

    try {
      if (!poolRef.current) poolRef.current = new SimplePool();
      
      // 1. Fetch latest from cloud
      const cloudEvent = await poolRef.current.get(SEARCH_RELAYS, {
        kinds: [30078],
        authors: [pk],
        '#d': ['echobot_identities']
      });

      let cloudIdentities: Identity[] = [];
      if (cloudEvent) {
        try {
          const decrypted = await window.nostr.nip44.decrypt(pk, cloudEvent.content);
          cloudIdentities = JSON.parse(decrypted);
        } catch (e) {
          if (!silent) addLog('Failed to decrypt cloud data.', 'error');
          setIsSyncing(false);
          return null;
        }
      }

      // 2. Merge Logic
      const mergedMap = new Map<string, Identity>();
      
      // Add all cloud identities first
      cloudIdentities.forEach(id => mergedMap.set(id.id, id));

      // Merge local identities
      savedIdentities.forEach(local => {
        const cloud = mergedMap.get(local.id);
        if (!cloud) {
          // Doesn't exist in cloud, keep local
          mergedMap.set(local.id, local);
        } else {
          // Exists in both, choose newest based on updatedAt
          const localTime = local.updatedAt || local.createdAt || 0;
          const cloudTime = cloud.updatedAt || cloud.createdAt || 0;
          
          // Merge stats maps regardless of which version is newer to avoid data loss
          const mergedStats: BotStats = {
            repliesSent: { ...(cloud.stats?.repliesSent || {}), ...(local.stats?.repliesSent || {}) },
            reactionsSent: { ...(cloud.stats?.reactionsSent || {}), ...(local.stats?.reactionsSent || {}) },
            repostsSent: { ...(cloud.stats?.repostsSent || {}), ...(local.stats?.repostsSent || {}) },
            proactiveNotesSent: { ...(cloud.stats?.proactiveNotesSent || {}), ...(local.stats?.proactiveNotesSent || {}) },
            repliesReceived: { ...(cloud.stats?.repliesReceived || {}), ...(local.stats?.repliesReceived || {}) },
            reactionsReceived: { ...(cloud.stats?.reactionsReceived || {}), ...(local.stats?.reactionsReceived || {}) },
          };

          if (localTime > cloudTime) {
            // Local is newer, use local but keep merged stats
            mergedMap.set(local.id, { ...local, stats: mergedStats });
          } else {
            // Cloud is newer (or same), use cloud but keep merged stats
            mergedMap.set(local.id, { ...cloud, stats: mergedStats });
          }
        }
      });

      const mergedList = Array.from(mergedMap.values());
      const dataString = JSON.stringify(mergedList);

      // 3. Skip push if no changes since last push (but still update local if we pulled from cloud)
      if (dataString !== lastPushedDataRef.current) {
        // Encrypt and Push
        const encrypted = await window.nostr.nip44.encrypt(pk, dataString);
        const event = {
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['d', 'echobot_identities']],
          content: encrypted,
          pubkey: pk
        };

        const signed = await window.nostr.signEvent(event);
        const pubs = poolRef.current.publish(PUBLISH_RELAYS, signed);
        await Promise.allSettled(pubs);
        lastPushedDataRef.current = dataString;
      }

      // 4. Update Local State & Ref
      setSavedIdentities(mergedList);
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, now.toString());
      
      if (!silent) {
        addLog('Cloud sync complete!', 'success');
        setShowSyncCheck(true);
        setTimeout(() => setShowSyncCheck(false), 3000);
      }
      return mergedList;
    } catch (e) {
      if (!silent) addLog(`Sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncWithCloud = () => performSync(false);

  // Initial Sync on login
  useEffect(() => {
    if (userPubkey && window.nostr?.nip44) {
      performSync(true);
    }
  }, [userPubkey]);

  // Debounced Auto-Sync for identity/settings changes
  useEffect(() => {
    if (!userPubkey) return;
    
    // Check if identities/settings changed (excluding stats)
    // We stringify the settings part of identities to compare
    const coreData = JSON.stringify(savedIdentities.map(id => ({
      id: id.id,
      settings: id.settings,
      updatedAt: id.updatedAt,
      deleted: id.deleted
    })));

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(() => {
      performSync(true);
    }, 30000); // 30 second debounce

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [savedIdentities, userPubkey]);

  // Interval Sync for stats (every 10 minutes)
  useEffect(() => {
    if (!userPubkey) return;

    const interval = setInterval(() => {
      performSync(true);
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [userPubkey]);

  const fetchCommunityPersonas = async () => {
    if (isDiscovering) return;
    setIsDiscovering(true);
    setCommunityPersonas([]);
    
    if (!poolRef.current) poolRef.current = new SimplePool();

    try {
      const events = await poolRef.current.querySync(SEARCH_RELAYS, {
        kinds: [KIND_BOT_IDENTITY],
        '#t': ['echobot-persona'],
        limit: 50
      });

      const parsed = events.map(ev => {
        try {
          return {
            id: ev.id,
            author: ev.pubkey,
            settings: JSON.parse(ev.content) as BotSettings,
            event: ev
          };
        } catch (e) { return null; }
      }).filter(i => i !== null) as any[];

      setCommunityPersonas(parsed);
      addLog(`Found ${parsed.length} community personas. Scanning reactions & profiles...`, 'info');

      // Fetch profiles for these authors
      const authorPubkeys = [...new Set(parsed.map(p => p.author))];
      if (authorPubkeys.length > 0) {
        const metadataEvents = await poolRef.current.querySync(SEARCH_RELAYS, {
          kinds: [0],
          authors: authorPubkeys
        });

        const profileMap: Record<string, ProfileInfo> = {};
        metadataEvents.forEach(ev => {
          try {
            const content = JSON.parse(ev.content);
            profileMap[ev.pubkey] = {
              name: content.name || content.display_name || 'Anonymous',
              about: content.about || '',
              picture: content.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${ev.pubkey}`,
              nip05: content.nip05 || '',
              lud16: content.lud16 || '',
              lud06: content.lud06 || ''
            };
          } catch (e) { /* skip bad content */ }
        });
        setCommunityProfiles(prev => ({ ...prev, ...profileMap }));
      }

      // Fetch reactions for these personas
      const personaIds = parsed.map(p => p.id);
      if (personaIds.length > 0) {
        const reactionEvents = await poolRef.current.querySync(SEARCH_RELAYS, {
          kinds: [7],
          '#e': personaIds
        });

        const voteCounts: Record<string, { up: number, down: number, userVote?: string, userReactionId?: string }> = {};
        
        // Track unique votes per pubkey for each persona
        const pubkeyVotes: Record<string, Record<string, { vote: string, id: string, created_at: number }>> = {};

        reactionEvents.forEach(ev => {
          const targetId = ev.tags.find(t => t[0] === 'e')?.[1];
          if (!targetId || (ev.content !== '+' && ev.content !== '-')) return;

          if (!pubkeyVotes[targetId]) pubkeyVotes[targetId] = {};
          
          // Only keep the latest vote from this pubkey
          const existing = pubkeyVotes[targetId][ev.pubkey];
          if (!existing || ev.created_at > existing.created_at) {
            pubkeyVotes[targetId][ev.pubkey] = { vote: ev.content, id: ev.id, created_at: ev.created_at };
          }
        });

        // Aggregate counts
        Object.entries(pubkeyVotes).forEach(([targetId, votes]) => {
          let up = 0;
          let down = 0;
          let userVote: string | undefined;
          let userReactionId: string | undefined;

          Object.entries(votes).forEach(([pk, data]) => {
            if (data.vote === '+') up++;
            else if (data.vote === '-') down++;
            
            if (pk === userPubkey) {
              userVote = data.vote;
              userReactionId = data.id;
            }
          });

          voteCounts[targetId] = { up, down, userVote, userReactionId };
        });

        setPersonaVotes(voteCounts);
      }
    } catch (e) {
      addLog('Failed to fetch community personas.', 'error');
    } finally {
      setIsDiscovering(false);
    }
  };

  const importPersona = (persona: { settings: BotSettings; author: string }) => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const nsec = nip19.nsecEncode(sk);
    const npub = nip19.npubEncode(pk);

    // Preserve the current model selection
    const currentModelId = settings.modelId;

    const newIdentity: Identity = {
      id: Math.random().toString(36).substring(7),
      name: persona.settings.profile.name,
      nsec,
      npub,
      settings: {
        ...persona.settings,
        modelId: currentModelId, // Keep current engine
        targetNpub: '', // Reset target on import
        targetName: ''
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: INITIAL_STATS
    };

    setSavedIdentities(prev => [newIdentity, ...prev]);
    loadIdentity(newIdentity);
    setCurrentView('dashboard');
    addLog(`Imported "${persona.settings.profile.name}" by ${persona.author.substring(0, 8)}...`, 'success');
  };

  const handleFinishOnboarding = (tempSettings: BotSettings, syncedIdentities?: Identity[] | null, syncedProfile?: ProfileInfo | null, explicitPubkey?: string) => {
    setSettings(tempSettings);
    setShowOnboarding(false);
    setCurrentView('manager');
    
    const activeIdentities = syncedIdentities || savedIdentities;
    const hasBots = activeIdentities.filter(i => !i.deleted).length > 0;
    const name = syncedProfile?.name || curatorProfile?.name || 'curator';
    const effectivePubkey = explicitPubkey || userPubkey;
    
    if (effectivePubkey && hasBots) {
      addLog(`Welcome back, ${name}! Your swarm is ready.`, 'success', effectivePubkey, name);
    } else {
      addLog('Welcome to EchoBot! Create your first bot to get started.', 'success');
    }
  };

  const handleClearSwarmChat = () => {
    if (swarmChatAbortControllerRef.current) {
      swarmChatAbortControllerRef.current.abort();
      swarmChatAbortControllerRef.current = null;
    }
    setSwarmChatMessages([]);
    setIsSwarmChatThinking(null);
  };

  const triggerSwarmChatResponse = async (history: any[], stamina: number) => {
    if (stamina <= 0 || managerTab !== 'chat' || swarmChatParticipants.size === 0) return;

    // Clear old controller if it exists
    if (swarmChatAbortControllerRef.current) swarmChatAbortControllerRef.current.abort();
    swarmChatAbortControllerRef.current = new AbortController();
    const signal = swarmChatAbortControllerRef.current.signal;

    // Pick a random participant who isn't the last one to speak
    const participants = Array.from(swarmChatParticipants);
    const lastSpeakerId = history[history.length - 1]?.botId;
    const available = participants.filter(id => id !== lastSpeakerId);
    if (available.length === 0) return;

    const botId = available[Math.floor(Math.random() * available.length)];
    const identity = savedIdentities.find(i => i.id === botId);
    if (!identity) return;

    setIsSwarmChatThinking(botId);

    // Use last message as content, previous as context
    const lastMsg = history[history.length - 1];
    const prevMsgs = history.slice(-6, -1).map(m => ({
      pubkey: m.botId || 'curator',
      content: `[${m.name}]: ${m.content}`
    }));

    try {
      const topicContext = `[Current Chat Topic]: ${swarmTopic}`;
      const response = await generateBotMessage(identity.settings, identity.id, communityProfiles, 'swarm-chat', `${topicContext}\n\n[${lastMsg.name}]: ${lastMsg.content}`, prevMsgs);
      
      if (signal.aborted) return;
      
      setIsSwarmChatThinking(null);

      if (response) {
        const newMessage = {
          id: Math.random().toString(36).substring(7),
          botId: identity.id,
          name: identity.name,
          content: response,
          timestamp: Date.now()
        };
        
        setSwarmChatMessages(prev => {
          const next = [...prev, newMessage];
          // Chain the next response with reduced stamina
          setTimeout(() => {
            if (!signal.aborted) triggerSwarmChatResponse(next, stamina - 1);
          }, 2000 + Math.random() * 3000);
          return next;
        });
      }
    } catch (e) {
      setIsSwarmChatThinking(null);
    }
  };

  const sendSwarmChatMessage = (content: string) => {
    const newMessage = {
      id: Math.random().toString(36).substring(7),
      name: curatorProfile?.name || 'Curator',
      content,
      timestamp: Date.now()
    };
    
    setSwarmChatMessages(prev => {
      const next = [...prev, newMessage];
      // Reset stamina to 10 for a new user-initiated chain (longer interactions)
      triggerSwarmChatResponse(next, 10);
      return next;
    });
  };

  const unpublishPersona = async (eventToDelete: any) => {
    if (!userPubkey || !window.nostr || eventToDelete.pubkey !== userPubkey) {
      addLog('You can only delete your own published personas.', 'error');
      return;
    }

    try {
      const deletionEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', eventToDelete.id]],
        content: `Deletion request for EchoBot persona: ${eventToDelete.id}`,
        pubkey: userPubkey
      };

      const signedEvent = await window.nostr.signEvent(deletionEvent);
      
      if (!poolRef.current) poolRef.current = new SimplePool();
      const pubs = poolRef.current.publish(PUBLISH_RELAYS, signedEvent);

      addLog(`Requesting deletion of persona ${eventToDelete.id.substring(0,8)}...`, 'info');
      await Promise.allSettled(pubs);

      // Remove from local view immediately
      setCommunityPersonas(prev => prev.filter(p => p.id !== eventToDelete.id));
      addLog('Deletion request sent.', 'success');

    } catch (e) {
      addLog(`Failed to send deletion request: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    }
  };

  const handlePersonaVote = async (personaEvent: any, voteType: '+' | '-') => {
    if (!userPubkey || !window.nostr) {
      addLog('Please sign in to vote.', 'error');
      return;
    }

    const currentVoteData = personaVotes[personaEvent.id];
    const isTogglingOff = currentVoteData?.userVote === voteType;

    try {
      if (isTogglingOff && currentVoteData.userReactionId) {
        // Send Kind 5 Deletion for the existing reaction
        const deletionEvent = {
          kind: 5,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['e', currentVoteData.userReactionId]],
          content: `Removing ${voteType === '+' ? 'upvote' : 'downvote'}`,
          pubkey: userPubkey
        };
        const signedDeletion = await window.nostr.signEvent(deletionEvent);
        if (!poolRef.current) poolRef.current = new SimplePool();
        poolRef.current.publish(PUBLISH_RELAYS, signedDeletion);

        // Optimistic Update: Remove vote
        setPersonaVotes(prev => {
          const current = prev[personaEvent.id];
          if (!current) return prev;
          return {
            ...prev,
            [personaEvent.id]: {
              ...current,
              up: voteType === '+' ? Math.max(0, current.up - 1) : current.up,
              down: voteType === '-' ? Math.max(0, current.down - 1) : current.down,
              userVote: undefined,
              userReactionId: undefined
            }
          };
        });
        addLog(`Removed your ${voteType === '+' ? 'upvote' : 'downvote'}.`, 'info');
        return;
      }

      // If switching or new vote
      const reactionEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: voteType,
        tags: [
          ['e', personaEvent.id],
          ['p', personaEvent.pubkey]
        ],
        pubkey: userPubkey
      };

      const signedEvent = await window.nostr.signEvent(reactionEvent);
      
      if (!poolRef.current) poolRef.current = new SimplePool();
      const pubs = poolRef.current.publish(PUBLISH_RELAYS, signedEvent);

      // Optimistic update
      setPersonaVotes(prev => {
        const current = prev[personaEvent.id] || { up: 0, down: 0 };
        const updated = { ...current };
        
        if (voteType === '+') {
          updated.up++;
          if (updated.userVote === '-') updated.down = Math.max(0, updated.down - 1);
        } else {
          updated.down++;
          if (updated.userVote === '+') updated.up = Math.max(0, updated.up - 1);
        }
        
        updated.userVote = voteType;
        updated.userReactionId = (signedEvent as any).id;
        return { ...prev, [personaEvent.id]: updated };
      });

      addLog(`Sent ${voteType === '+' ? 'upvote' : 'downvote'} for persona.`, 'success');
      await Promise.allSettled(pubs);

    } catch (e) {
      addLog(`Failed to update vote: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    }
  };

  const getZapInvoice = async (personaId: string, authorPubkey: string, amountSats: number, comment: string) => {
    try {
      setZapData(prev => prev ? { ...prev, isPaying: true, error: undefined } : null);
      
      const profile = communityProfiles[authorPubkey];
      if (!profile?.lud16 && !profile?.lud06) {
        throw new Error('This author does not have a Lightning Address or LNURL set.');
      }

      // 1. Resolve LNURL
      let callback = '';
      if (profile.lud16) {
        const [name, domain] = profile.lud16.split('@');
        const res = await fetch(`https://${domain}/.well-known/lnurlp/${name}`);
        const data = await res.json();
        callback = data.callback;
        if (!data.allowsNostr || !data.nostrPubkey) throw new Error('Recipient does not support Nostr Zaps.');
      } else if (profile.lud06) {
        // Simple LNURL decode if needed (skipping full bech32 decode for brevity as lud16 is more common)
        throw new Error('LNURL lud06 not yet supported. Please use lud16.');
      }

      // 2. Create Zap Request (Kind 9734)
      let zapRequest;
      const zapRequestContent = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        content: comment,
        tags: [
          ['relays', ...SEARCH_RELAYS],
          ['amount', (amountSats * 1000).toString()],
          ['p', authorPubkey],
          ['e', personaId]
        ],
        pubkey: userPubkey || getPublicKey(generateSecretKey()) // Random if not logged in
      };

      if (userPubkey && window.nostr) {
        zapRequest = await window.nostr.signEvent(zapRequestContent);
      } else {
        const tempSk = generateSecretKey();
        zapRequest = finalizeEvent(zapRequestContent, tempSk);
      }

      // 3. Get Invoice
      const amountMillisats = amountSats * 1000;
      const invoiceUrl = `${callback}${callback.includes('?') ? '&' : '?'}amount=${amountMillisats}&nostr=${encodeURIComponent(JSON.stringify(zapRequest))}&comment=${encodeURIComponent(comment)}`;
      
      const invoiceRes = await fetch(invoiceUrl);
      const invoiceData = await invoiceRes.json();
      
      if (invoiceData.pr) {
        setZapData(prev => prev ? { ...prev, invoice: invoiceData.pr, isPaying: false } : null);
        
        // Try WebLN immediately
        if ((window as any).webln) {
          try {
            await (window as any).webln.enable();
            await (window as any).webln.sendPayment(invoiceData.pr);
            setZapData(null);
            setShowZapDialog(false);
            setShowZapSuccess(true);
            addLog(`Zap of ${amountSats} sats sent!`, 'success');
            setTimeout(() => setShowZapSuccess(false), 3000);
          } catch (e) {
            // WebLN failed or cancelled, we stay in dialog for QR fallback
            console.log('WebLN failed, falling back to QR:', e);
          }
        }
      } else {
        throw new Error(invoiceData.reason || 'Failed to get invoice from provider.');
      }

    } catch (e) {
      setZapData(prev => prev ? { ...prev, isPaying: false, error: e instanceof Error ? e.message : 'Zap failed' } : null);
      addLog(`Zap Error: ${e instanceof Error ? e.message : 'Zap failed'}`, 'error');
    }
  };

  const sumStats = useCallback((statsMap?: Record<string, number>) => {
    if (!statsMap) return 0;
    return Object.values(statsMap).reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
  }, []);


  const saveIdentity = async (name: string) => {
    if (!currentIdentity) return;
    const nsec = nip19.nsecEncode(currentIdentity.sk);
    const npub = nip19.npubEncode(currentIdentity.pk);

    const newIdentity: Identity = {
      id: Math.random().toString(36).substring(7),
      name,
      settings: settings,
      nsec,
      npub,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: INITIAL_STATS
    };

    setSavedIdentities(prev => [newIdentity, ...prev]);
    setActiveIdentityId(newIdentity.id);
    addLog(`Identity "${name}" saved to list.`, 'success');
  };

  const loadIdentity = (identity: Identity) => {
    try {
      const { data } = nip19.decode(identity.nsec);
      const sk = data as any;
      const pk = getPublicKey(sk);

      // Preserve the currently selected model
      const currentModelId = settings.modelId;

      setCurrentIdentity({ sk, pk });
      setSettings({
        ...identity.settings,
        modelId: currentModelId // Stick to current engine
      });

      setActiveIdentityId(identity.id);
      setCurrentView('dashboard');
      // --- NEW: Fetch target profile for UI visibility ---
      if (identity.settings.targetNpub) {
        try {
          const decoded = nip19.decode(identity.settings.targetNpub) as any;
          if (decoded.type === 'npub') {
            const targetHex = decoded.data;
            if (!communityProfiles[targetHex]) {
              if (!poolRef.current) poolRef.current = new SimplePool();
              poolRef.current.get(SEARCH_RELAYS, {
                kinds: [0],
                authors: [targetHex]
              }).then(profileEvent => {
                if (profileEvent) {
                  try {
                    const content = JSON.parse(profileEvent.content);
                    setCommunityProfiles(prev => ({
                      ...prev,
                      [targetHex]: {
                        name: content.name || content.display_name || '',
                        about: content.about || '',
                        picture: content.picture || '',
                        nip05: content.nip05 || ''
                      }
                    }));
                  } catch (e) {}
                }
              });
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      addLog('Failed to load identity.', 'error');
    }
  };
  const deleteIdentity = (id: string) => {
    setSavedIdentities(prev => prev.map(identity => {
      if (identity.id === id) {
        return { ...identity, deleted: true, updatedAt: Date.now() };
      }
      return identity;
    }));
    if (activeIdentityId === id) setActiveIdentityId(null);
    const identity = savedIdentities.find(i => i.id === id);
    addLog(`Identity removed: ${identity?.name || id.substring(0, 8)}`, 'warning', undefined, identity?.name, undefined, undefined, undefined, undefined, id);
  };

  const createNewIdentity = (type: 'waifu' | 'custom') => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const nsec = nip19.nsecEncode(sk);
    const npub = nip19.npubEncode(pk);
    
    const isRandomWaifu = type === 'waifu';
    const profile = isRandomWaifu ? generateWaifuProfile() : {
      name: 'New Bot',
      about: 'I am a new bot. Edit my profile to give me a personality!',
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${pk}`,
      nip05: ''
    };

    const modelPrompts = MODEL_DEFAULT_PROMPTS[settings.modelId] || MODEL_DEFAULT_PROMPTS['onnx-community/gemma-3-270m-it-ONNX'];
    const aiSystemPrompt = isRandomWaifu ? modelPrompts.waifu : modelPrompts.neutral;
    
    // Preserve current model engine
    const currentModelId = settings.modelId;

    const newSettings: BotSettings = {
      ...DEFAULT_SETTINGS,
      profile,
      useAI: settings.useAI,
      modelId: currentModelId,
      aiSystemPrompt,
      // Apply balanced chat defaults for the current model
      ...MODEL_PRESETS[currentModelId]['Balanced Chat'] as any
    };

    // Save as a new identity immediately
    const newIdentity: Identity = {
      id: Math.random().toString(36).substring(7),
      name: profile.name,
      nsec,
      npub,
      settings: newSettings,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: INITIAL_STATS
    };

    setSavedIdentities(prev => [newIdentity, ...prev]);
    
    // Load it
    setCurrentIdentity({ sk, pk });
    setSettings(newSettings);
    setActiveIdentityId(newIdentity.id);
    
    setShowAddIdentityDialog(false);
    addLog(`Created new ${type} identity: ${profile.name}`, 'success');

    // If custom, open the persona profile tab
    if (type === 'custom') {
      setRightTab('persona');
      setPersonaSubTab('profile');
    }
  };

  // --- Bot Logic ---

  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || taskQueueRef.current.length === 0) return;
    
    isProcessingQueueRef.current = true;
    
    while (taskQueueRef.current.length > 0) {
      const task = taskQueueRef.current[0];
      
      // Calculate delay BEFORE executing the task
      const delay = Math.floor(Math.random() * (settings.maxDelay - settings.minDelay + 1) + settings.minDelay);
      
      if (isVerbose) {
        addLog(`Waiting ${delay}s before: ${task.description}`, 'success', undefined, undefined, undefined, undefined, undefined, undefined, task.botId);
      }

      // Create a promise that resolves after the delay
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, delay * 1000);
        timeoutRefs.current.push(timeout);
      });

      // Check if bot was stopped during wait
      if (!isProcessingQueueRef.current) break;

      try {
        await task.execute();
      } catch (e) {
        addLog(`Error executing task: ${task.description}`, 'error', undefined, undefined, undefined, undefined, undefined, undefined, task.botId);
      }

      // Remove the task we just executed
      taskQueueRef.current.shift();

      // Update queue counts state
      if (task.botId) {
        setQueueCounts(prev => {
          const count = taskQueueRef.current.filter(t => t.botId === task.botId).length;
          return { ...prev, [task.botId!]: count };
        });
      }
      
      // Optional: extra 1s guaranteed gap
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    isProcessingQueueRef.current = false;
  }, [addLog, isVerbose, settings.maxDelay, settings.minDelay]);

  const addTaskToQueue = useCallback((task: BotTask) => {
    taskQueueRef.current.push(task);

    // Update queue counts state
    if (task.botId) {
      setQueueCounts(prev => ({
        ...prev,
        [task.botId!]: (prev[task.botId!] || 0) + 1
      }));
    }

    if (!isProcessingQueueRef.current) {
      processQueue();
    }
  }, [processQueue]);

  const stopBot = useCallback((id?: string) => {
    if (id) {
      setRunningIdentityIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      resetStats(id);
      const subs = subscriptionsRef.current.get(id);
      if (subs) {
        subs.forEach(sub => sub.close());
        subscriptionsRef.current.delete(id);
      }
      const identity = savedIdentities.find(i => i.id === id);
      addLog(`${identity?.name || id.substring(0, 8)} Shutting Down`, 'warning', undefined, identity?.name, undefined, undefined, undefined, undefined, id);
      } else {      // Stop all
      setRunningIdentityIds(new Set());
      resetStats();
      isProcessingQueueRef.current = false;
      taskQueueRef.current = [];
      subscriptionsRef.current.forEach(subs => subs.forEach(sub => sub.close()));
      subscriptionsRef.current.clear();
      timeoutRefs.current.forEach(t => clearTimeout(t));
      timeoutRefs.current = [];
      addLog('All bots stopped.', 'warning');
    }
  }, [addLog, resetStats, savedIdentities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBot();
      if (poolRef.current) {
        poolRef.current.close(SEARCH_RELAYS);
      }
    };
  }, []);

  const publishRelayList = async (sk: Uint8Array, extraRelays: string[] = []) => {
    if (!poolRef.current) return;

    // Use ONLY the core publish relays for the NIP-65 content to keep it minimal
    const metadataRelays = PUBLISH_RELAYS;
    // But broadcast to all relevant relays (including target's) for visibility
    const broadcastRelays = [...new Set([...PUBLISH_RELAYS, ...extraRelays])];

    const event = finalizeEvent({
      kind: 10002,
      created_at: Math.floor(Date.now() / 1000),
      tags: metadataRelays.map(r => ['r', r]),
      content: '',
    }, sk);

    try {
      const pubs = poolRef.current.publish(broadcastRelays, event);
      const results = await Promise.allSettled(pubs);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      if (successCount > 0) {
        addLog(`Relay list (NIP-65) published (minimal list) to ${successCount}/${broadcastRelays.length} relays.`, 'info');
      }
    } catch (e) {
      addLog('Failed to publish relay list.', 'error');
    }
  };

  const publishProfile = async (sk: Uint8Array, profile: ProfileInfo, extraRelays: string[] = []) => {
    if (!poolRef.current) return;

    // Apply curator lightning address override if enabled
    const finalProfile = { ...profile };
    if (globalUseCuratorLightning && curatorProfile?.lud16) {
      finalProfile.lud16 = curatorProfile.lud16;
    }

    const event = finalizeEvent({
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(finalProfile),
    }, sk);

    const relays = [...new Set([...PUBLISH_RELAYS, ...extraRelays])];
    try {
      const pubs = poolRef.current.publish(relays, event);
      const results = await Promise.allSettled(pubs);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      if (successCount > 0) {
        addLog(`Profile published to ${successCount}/${relays.length} relays.`, 'info');
      } else {
        addLog('Profile failed to publish to any relay.', 'error');
      }
    } catch (e) {
      addLog('Failed to broadcast profile.', 'error');
    }

    // Also publish Relay List (NIP-65)
    await publishRelayList(sk, extraRelays);
  };
  const startBot = async (identity: Identity) => {
    const isProactiveOnly = !identity.settings.targetNpub && identity.settings.proactive?.enabled;
    
    if (!identity.settings.targetNpub && !isProactiveOnly) {
      addLog(`Please enter at least one target npub for ${identity.name}.`, 'error');
      return;
    }

    const targetHexes: string[] = [];
    if (identity.settings.targetNpub) {
      const npubs = String(identity.settings.targetNpub || '').split(',').map(s => s.trim()).filter(s => s.length > 0);
      for (const npub of npubs) {
        try {
          const decoded = nip19.decode(npub) as any;
          if (decoded.type === 'npub') {
            targetHexes.push(decoded.data);
          }
        } catch (e) {
          addLog(`Invalid target npub "${npub}" for ${identity.name}. Skipping.`, 'warning');
        }
      }
      if (targetHexes.length === 0 && !isProactiveOnly) {
        addLog(`No valid target npubs for ${identity.name}.`, 'error');
        return;
      }
    }

    const { data: sk } = nip19.decode(identity.nsec);
    const pk = getPublicKey(sk as any);

    setRunningIdentityIds(prev => new Set(prev).add(identity.id));
    addStatToBatch(identity.id, { repliesSent: 0 }); // Initialize session entry
    addLog(`Starting bot: ${identity.name}${isProactiveOnly ? ' (Proactive Only)' : ` (Monitoring ${targetHexes.length} targets)`}`, 'success', undefined, identity.name, undefined, undefined, undefined, undefined, identity.id);

    if (!poolRef.current) {
      poolRef.current = new SimplePool();
    }

    // 1. Discover target's outbox relays (NIP-65 or Profile)
    let targetRelays = identity.settings.relays?.length ? identity.settings.relays : [...PUBLISH_RELAYS];

    if (targetHexes.length > 0) {
      addLog(`Discovering relays for ${identity.name} targets...`, 'info', undefined, identity.name);
      
      // Use the first target for relay discovery (best effort)
      const primaryTarget = targetHexes[0];
      try {
        const profileEvent = await poolRef.current.get(SEARCH_RELAYS, {
          kinds: [0],
          authors: [primaryTarget]
        });

        if (profileEvent) {
          try {
            const content = JSON.parse(profileEvent.content);
            // Cache the profile for UI visibility
            setCommunityProfiles(prev => ({
              ...prev,
              [primaryTarget]: {
                name: content.name || content.display_name || '',
                about: content.about || '',
                picture: content.picture || '',
                nip05: content.nip05 || ''
              }
            }));

            if (content.relays && typeof content.relays === 'object') {
              const profileRelays = Object.keys(content.relays);
              if (profileRelays.length > 0) {
                targetRelays = [...new Set([...profileRelays, ...PUBLISH_RELAYS])];
                addLog(`Found ${profileRelays.length} relays for ${identity.name} via profile.`, 'info', undefined, identity.name);
              }
            }
          } catch (e) {}
        }

        // Check NIP-65 too for most accurate relay list
        const nip65Event = await poolRef.current.get(SEARCH_RELAYS, {
          kinds: [10002],
          authors: [primaryTarget]
        });

        if (nip65Event) {
          const relays = nip65Event.tags
            .filter(t => t[0] === 'r')
            .map(t => t[1]);
          if (relays.length > 0) {
            targetRelays = [...new Set([...relays, ...targetRelays])];
            addLog(`Updated relays for ${identity.name} via NIP-65.`, 'info', undefined, identity.name);
          }
        }
      } catch (e) {
        addLog(`Profile/Relay discovery failed for ${identity.name}, using defaults.`, 'info', undefined, identity.name);
      }
    }

    const hashtags = String(identity.settings.targetHashtags || '').split(',').map(s => s.trim().toLowerCase().replace(/^#/, '')).filter(s => s.length > 0);
    const keywords = String(identity.settings.targetKeywords || '').split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);

    // 2. Helper functions for processing events
    const getReplyTask = (event: any, relays: string[]): BotTask => ({
      id: `reply-${event.id}-${Math.random()}`,
      botId: identity.id,
      description: `[${identity.name}] Reply to ${event.id.substring(0, 8)}`,
      execute: async () => {
        if (!poolRef.current) return;

        // --- Fetch thread context ---
        const eTags = event.tags.filter((t: any) => t[0] === 'e');
        const contextEvents: { pubkey: string; content: string; created_at: number }[] = [];

        if (eTags.length > 0) {
          const parentIds = eTags.map((t: any) => t[1]);
          try {
            const fetchedContext = await poolRef.current.querySync([...new Set([...relays, ...SEARCH_RELAYS])], {
              ids: parentIds,
              kinds: [1]
            });
            contextEvents.push(...fetchedContext.map(ev => ({
              pubkey: ev.pubkey,
              content: ev.content,
              created_at: ev.created_at
            })).sort((a, b) => a.created_at - b.created_at));
          } catch (e) {}
        }

        const message = await generateBotMessage(identity.settings, identity.id, communityProfiles, identity.settings.targetNpub, event.content, contextEvents);
        if (!message) return;

        // Improved NIP-10 tagging
        const rootTag = eTags.find((t: any) => t[3] === 'root') || eTags[0];

        const tags: string[][] = [];
        if (rootTag && rootTag[1] !== event.id) {
          // Replying to a reply
          tags.push(['e', rootTag[1], '', 'root']);
          tags.push(['e', event.id, '', 'reply']);
        } else {
          // Replying to a root note
          tags.push(['e', event.id, '', 'root']);
        }
        tags.push(['p', event.pubkey]);

        const replyEvent = finalizeEvent({
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags,
          content: message,
        }, sk as any);

        try {
          const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
          const pubs = poolRef.current.publish(allRelays, replyEvent);
          const results = await Promise.allSettled(pubs);
          const successCount = results.filter(r => r.status === 'fulfilled').length;

          if (successCount > 0) {
            addLog(`[${identity.name}] Replied: "${message}"`, 'success', undefined, identity.name, replyEvent.id, allRelays, event.content, event.pubkey, identity.id, event.id);
            addStatToBatch(identity.id, { repliesSent: 1 });
          }
        } catch (e) {
          addLog(`[${identity.name}] Failed to broadcast reply.`, 'error', undefined, identity.name, undefined, undefined, undefined, undefined, identity.id, event.id);
        }
      }
    });

    const getReactionTask = (event: any, relays: string[], emoji: string): BotTask => ({
      id: `reaction-${event.id}-${emoji}-${Math.random()}`,
      botId: identity.id,
      description: `[${identity.name}] Reaction "${emoji}" to ${event.id.substring(0, 8)}`,
      execute: async () => {
        if (!poolRef.current) return;
        const reactEvent = finalizeEvent({
          kind: 7,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['e', event.id],
            ['p', event.pubkey]
          ],
          content: emoji,
        }, sk as any);

        try {
          const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
          const pubs = poolRef.current.publish(allRelays, reactEvent);
          const results = await Promise.allSettled(pubs);
          if (results.some(r => r.status === 'fulfilled')) {
            addLog(`[${identity.name}] Reacted with ${emoji}`, 'success', undefined, identity.name, undefined, undefined, event.content, event.pubkey, identity.id, event.id);
            addStatToBatch(identity.id, { reactionsSent: 1 });
          }
        } catch (e) {}
      }
    });

    const getRepostTask = (event: any, relays: string[]): BotTask => ({
      id: `repost-${event.id}-${Math.random()}`,
      botId: identity.id,
      description: `[${identity.name}] Repost ${event.id.substring(0, 8)}`,
      execute: async () => {
        if (!poolRef.current) return;
        const repostEvent = finalizeEvent({
          kind: 6,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['e', event.id, '', 'mention'],
            ['p', event.pubkey]
          ],
          content: '',
        }, sk as any);

        try {
          const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
          const pubs = poolRef.current.publish(allRelays, repostEvent);
          const results = await Promise.allSettled(pubs);
          if (results.some(r => r.status === 'fulfilled')) {
            addLog(`[${identity.name}] Reposted note.`, 'success', undefined, identity.name, undefined, undefined, event.content, event.pubkey, identity.id, event.id);
            addStatToBatch(identity.id, { repostsSent: 1 });
          }
        } catch (e) {}
      }
    });

    const getFollowTask = (pubkey: string, relays: string[]): BotTask => ({
      id: `follow-${pubkey}-${Math.random()}`,
      botId: identity.id,
      description: `[${identity.name}] Follow ${pubkey.substring(0, 8)}`,
      execute: async () => {
        if (!poolRef.current) return;
        const followEvent = await poolRef.current.get(SEARCH_RELAYS, {
          kinds: [3],
          authors: [pk]
        });

        const tags = followEvent ? followEvent.tags : [];
        if (tags.some((t: string[]) => t[0] === 'p' && t[1] === pubkey)) return;

        const newTags = [...tags, ['p', pubkey]];
        const event = finalizeEvent({
          kind: 3,
          created_at: Math.floor(Date.now() / 1000),
          tags: newTags,
          content: '',
        }, sk as any);

        try {
          const allRelays = [...new Set([...relays, ...PUBLISH_RELAYS])];
          const pubs = poolRef.current.publish(allRelays, event);
          await Promise.allSettled(pubs);
          addLog(`[${identity.name}] Followed back user.`, 'success', undefined, identity.name, undefined, undefined, undefined, undefined, identity.id);
        } catch (e) {}
      }
    });

    // 3. Initial profile publish
    await publishProfile(sk as any, identity.settings.profile, targetRelays);

    // 4. Monitoring loop
    const eventHandler = (event: any) => {
      if (event.pubkey === pk) return;
      
      const eventKey = `${identity.id}:${event.id}`;
      if (processedEventsRef.current.has(eventKey)) return;
      processedEventsRef.current.add(eventKey);

      // Triggers
      const mentionsSelf = event.tags.some((t: any) => t[0] === 'p' && t[1] === pk);
      const isTargetAuthor = targetHexes.includes(event.pubkey);
      const matchesHashtag = event.tags.some((t: any) => t[0] === 't' && hashtags.includes(t[1].toLowerCase()));
      const matchesKeyword = keywords.some(kw => event.content.toLowerCase().includes(kw));

      // 1. Identify Primary Reason for interest (Priority: Author > Mention > Hashtag > Keyword)
      let observationLog = '';
      let isPrimaryTrigger = false; // Primary triggers (npub) bypass probability check

      if (isTargetAuthor) {
        observationLog = `[${identity.name}] New note from ${nip19.npubEncode(event.pubkey)}`;
        isPrimaryTrigger = true;
      } else if (mentionsSelf) {
        if (event.kind === 1) observationLog = `[${identity.name}] New mention from ${nip19.npubEncode(event.pubkey)}`;
        if (event.kind === 7) observationLog = `[${identity.name}] New reaction from ${nip19.npubEncode(event.pubkey)}`;
      } else if (matchesHashtag) {
        observationLog = `[${identity.name}] New note matching hashtag`;
      } else if (matchesKeyword) {
        observationLog = `[${identity.name}] New note matching keyword`;
      }

      // 2. Logging & Stats
      if (observationLog) {
        addLog(observationLog, 'success', event.pubkey, identity.name, undefined, undefined, event.content, event.pubkey, identity.id, event.id);
        
        if (mentionsSelf) {
          addStatToBatch(identity.id, event.kind === 1 ? { repliesReceived: 1 } : { reactionsReceived: 1 });
          if (identity.settings.autoFollowBack) {
            setPlannedCounts(prev => ({ ...prev, [identity.id]: (prev[identity.id] || 0) + 1 }));
            const delay = 60 + Math.random() * 840; 
            const timeout = setTimeout(() => {
              setPlannedCounts(prev => ({ ...prev, [identity.id]: Math.max(0, (prev[identity.id] || 0) - 1) }));
              addTaskToQueue(getFollowTask(event.pubkey, targetRelays));
            }, delay * 1000);
            timeoutRefs.current.push(timeout);
          }
        }
      }

      if (event.kind === 7) return;

      // 3. Interaction Logic
      const interactionTasks: BotTask[] = [];
      const canReplyToMentions = mentionsSelf && identity.settings.proactive?.replyToMentions;
      
      if (isTargetAuthor || matchesHashtag || matchesKeyword || canReplyToMentions) {
        // Bot-to-bot protection
        const isAnotherBot = savedIdentities.some(id => {
          try {
            const { data } = nip19.decode(id.nsec);
            return getPublicKey(data as any) === event.pubkey;
          } catch (e) { return false; }
        });
        if (isAnotherBot) return;

        // Polite Mode Logic: Only skip observations, never direct mentions or primary targets
        if ((matchesHashtag || matchesKeyword) && !mentionsSelf && !isTargetAuthor) {
          const isPolite = identity.settings.politeMode || globalPoliteMode;
          const isReply = event.tags.some((t: any) => t[0] === 'e');
          if (isPolite && isReply) return;
        }

        // Probability: 100% for target authors, configured probability for everything else
        const probability = isPrimaryTrigger ? 1.0 : (identity.settings.proactive?.replyProbability ?? 0.5);

        if (Math.random() < probability) {
          interactionTasks.push(getReplyTask(event, targetRelays));

          if (identity.settings.reactToNotes) {
            const allEmojis: string[] = [];
            if (identity.settings.reactionEmojis) {
              const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
              const customEmojis = [...segmenter.segment(identity.settings.reactionEmojis.trim())].map(s => s.segment).filter(c => c.trim() !== '');
              allEmojis.push(...customEmojis);
            }
            if (allEmojis.length > 0) {
              const emoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
              interactionTasks.push(getReactionTask(event, targetRelays, emoji));
            }
          }

          if (identity.settings.repostNotes && isPrimaryTrigger) {
            const hasETags = event.tags?.some((t: string[]) => t[0] === 'e');
            if (!hasETags) {
              const chance = identity.settings.repostChance ?? 0.25;
              if (Math.random() < chance) {
                interactionTasks.push(getRepostTask(event, targetRelays));
              }
            }
          }
        }
      }

      if (interactionTasks.length > 0) {
        setPlannedCounts(prev => ({ ...prev, [identity.id]: (prev[identity.id] || 0) + interactionTasks.length }));
        // Human-like delay block: wait 1-15 minutes before even planning the tasks
        const blockDelay = 60 + Math.random() * 840; 
        const timeout = setTimeout(() => {
          setPlannedCounts(prev => ({ ...prev, [identity.id]: Math.max(0, (prev[identity.id] || 0) - interactionTasks.length) }));
          // Shuffle the order within the block
          const shuffled = shuffleArray(interactionTasks);
          shuffled.forEach(task => addTaskToQueue(task));
        }, blockDelay * 1000);
        timeoutRefs.current.push(timeout);
      }
    };

    const now = Math.floor(Date.now() / 1000);
    
    // Subscribe to targets (authors, hashtags, keywords)
    const monitorFilters: any[] = [];
    if (targetHexes.length > 0) {
      monitorFilters.push({ kinds: [1], authors: targetHexes, since: now });
    }
    if (hashtags.length > 0) {
      monitorFilters.push({ kinds: [1], '#t': hashtags, since: now });
    }
    if (keywords.length > 0) {
      // Use NIP-50 search if keywords are provided (best effort, many relays don't support)
      monitorFilters.push({ kinds: [1], search: keywords.join(' '), since: now });
    }

    let subTarget: any = null;
    if (monitorFilters.length > 0) {
      subTarget = poolRef.current.subscribeMany(targetRelays, ...monitorFilters, { onevent: eventHandler });
    }

    // Subscribe to mentions
    const mentionRelays = [...new Set([...targetRelays, ...PUBLISH_RELAYS])];
    const subMentions = poolRef.current.subscribeMany(mentionRelays, 
      {
        kinds: [1, 7],
        '#p': [pk],
        since: now
      }, { onevent: eventHandler });

    const currentSubs = subscriptionsRef.current.get(identity.id) || [];
    const newSubs = [subMentions];
    if (subTarget) newSubs.push(subTarget);
    subscriptionsRef.current.set(identity.id, [...currentSubs, ...newSubs]);
  };

  const scheduleProactivePost = async (id: string) => {
    const identity = savedIdentities.find(i => i.id === id);
    if (!identity || !identity.settings.proactive?.enabled) return;

    // Calculate next fuzzy post time immediately (interval ± 15% jitter)
    const baseMins = identity.settings.proactive.interval || 240;
    const jitterPercent = 0.15;
    const jitterRange = baseMins * jitterPercent;
    const fuzzyMins = baseMins + (Math.random() * jitterRange * 2 - jitterRange);
    const nextTimestamp = Date.now() + (fuzzyMins * 60 * 1000);

    // Update state immediately to prevent re-triggering
    setSavedIdentities(prev => prev.map(i =>
      i.id === id ? { ...i, lastProactivePost: Date.now(), nextProactiveTimestamp: nextTimestamp } : i
    ));

    addTaskToQueue({
      id: `proactive-post-${id}-${Date.now()}`,
      botId: id,
      description: `[${identity.name}] AI Note`,
      execute: async () => {
        try {
          // AI Mode
          const inspiration = await getInspirationNotes(identity, 15);
          const content = await generateBotMessage(identity.settings, identity.id, communityProfiles, 'original-post', undefined, inspiration, true);

          if (!content) return;

          const { data: sk } = nip19.decode(identity.nsec);
          const postEvent = finalizeEvent({
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content,
          }, sk as any);

          if (!poolRef.current) poolRef.current = new SimplePool();
          const relays = identity.settings.relays?.length ? identity.settings.relays : [...PUBLISH_RELAYS];
          const pubs = poolRef.current.publish(relays, postEvent);
          await Promise.allSettled(pubs);

          addLog(`[${identity.name}] Posted original note: "${content}"`, 'success', undefined, identity.name, postEvent.id, relays, content, undefined, identity.id, postEvent.id);
          addStatToBatch(identity.id, { proactiveNotesSent: 1 });
        } catch (e) {
          addLog(`[${identity.name}] Failed to post original note.`, 'error', undefined, identity.name, undefined, undefined, undefined, undefined, identity.id);
        }
      }
    });
  };
  // Heartbeat for proactive posting
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setSavedIdentities(prev => {
        let hasChanges = false;
        const next = prev.map(identity => {
          if (!runningIdentityIds.has(identity.id) || !identity.settings.proactive?.enabled) return identity;

          const settings = identity.settings.proactive;
          const updates: Partial<Identity> = {};

          // 1. Initialize next post time if missing (starts from createdAt or lastPost)
          if (settings.interval > 0 && !identity.nextProactiveTimestamp) {
            const lastPost = identity.lastProactivePost || identity.createdAt;
            // Initial fuzzy start to prevent all bots posting together on launch
            const initialJitter = (settings.interval * 0.5) * Math.random();
            let firstNext = lastPost + ((settings.interval + initialJitter) * 60 * 1000);

            // If the calculated time is in the past, stagger the start within 1-10 minutes
            if (firstNext < now) {
              firstNext = now + ((1 + Math.random() * 9) * 60 * 1000);
            }

            updates.nextProactiveTimestamp = firstNext;
            hasChanges = true;
          }
          // 2. Interval Check against fuzzy timestamp
          else if (settings.interval > 0 && identity.nextProactiveTimestamp && now >= identity.nextProactiveTimestamp) {
            scheduleProactivePost(identity.id);
            // scheduleProactivePost will update its own lastProactivePost/nextProactiveTimestamp
          }

          return hasChanges && Object.keys(updates).length > 0 ? { ...identity, ...updates } : identity;
        });

        return hasChanges ? next : prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [runningIdentityIds, savedIdentities]);
  // --- Render Helpers ---

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-surface text-on-surface font-sans selection:bg-emerald-500/30 selection:text-white lg:overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-outline/10 bg-surface-container-low z-10 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-sm flex items-center justify-center shadow-md">
              <Brain className="w-4 h-4 text-black" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">EchoBot</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {userPubkey && curatorProfile ? (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-2 py-1 bg-surface-container-high rounded-sm border border-outline/10 hover:border-red-500/30 transition-all group"
                title="Sign Out"
              >
                <img 
                  src={curatorProfile.picture} 
                  alt="Curator Avatar" 
                  className="w-4 h-4 rounded-sm group-hover:opacity-50 object-cover"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
                <span className="hidden md:inline text-xs font-bold uppercase tracking-wider text-on-surface-variant group-hover:text-red-400">{curatorProfile.name}</span>
              </button>
            ) : (
              <button 
                onClick={handleNip07Login}
                className="flex items-center gap-2 px-2 py-1 bg-surface-container-high text-on-surface-variant rounded-sm hover:bg-surface-container hover:text-white transition-colors text-xs font-bold uppercase tracking-wider border border-outline/10"
                title="Login with Nostr Extension"
              >
                <User className="w-3 h-3" />
                <span className="hidden md:inline">Sign In</span>
              </button>
            )}

            <button 
              onClick={() => setCurrentView('dashboard')}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-sm transition-all text-xs font-bold uppercase tracking-wider border",
                currentView === 'dashboard' 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]" 
                  : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:bg-surface-container hover:text-white"
              )}
              title="View Dashboard"
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Dashboard</span>
            </button>

            <button 
              onClick={() => setCurrentView('manager')}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-sm transition-all text-xs font-bold uppercase tracking-wider border",
                currentView === 'manager' 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]" 
                  : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:bg-surface-container hover:text-white"
              )}
              title="Manage Identities"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Manage Bots</span>
            </button>

            <button 
              onClick={() => setCurrentView('settings')}              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-sm transition-all text-xs font-bold uppercase tracking-wider border",
                currentView === 'settings' 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]" 
                  : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:bg-surface-container hover:text-white"
              )}
              title="Application Settings"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Settings</span>
            </button>
            </div>
            </div>
            </header>
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-2 py-2 grid grid-cols-1 lg:grid-cols-12 gap-2 min-h-0">
        {currentView === 'dashboard' && (
          <>
        {/* Right Column: Identity Swarm - Moved to top for mobile, last for desktop */}
        <div className="lg:col-span-3 lg:min-h-[300px] flex flex-col space-y-2 lg:order-last">
          <section className="bg-surface-container border border-outline/10 rounded-sm flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="px-3 py-2 bg-surface-container-low border-b border-outline/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">My Identities</h2>
              </div>
              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-tighter border border-emerald-500/20">
                {runningIdentityIds.size} Active
              </span>
            </div>

            <div className="px-2 py-1.5 bg-surface-container-low border-b border-outline/5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-on-surface-variant/40" />
                <input 
                  type="text"
                  placeholder="Filter identities..."
                  value={swarmSearchQuery}
                  onChange={(e) => setSwarmSearchQuery(e.target.value)}
                  className="w-full bg-surface-container border border-outline/10 rounded-sm pl-7 pr-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500/50 transition-colors font-bold uppercase tracking-tight placeholder:text-on-surface-variant/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-surface">
              {savedIdentities.filter(i => !i.deleted).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-8 text-center">
                  <Users className="w-8 h-8 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest italic">No saved bots.</p>
                </div>
              ) : (
                savedIdentities
                  .filter(i => !i.deleted && (
                    i.name.toLowerCase().includes(swarmSearchQuery.toLowerCase()) || 
                    i.id.toLowerCase().includes(swarmSearchQuery.toLowerCase())
                  ))
                  .sort((a, b) => {
                    const aRunning = isRunning(a.id);
                    const bRunning = isRunning(b.id);
                    if (aRunning && !bRunning) return -1;
                    if (!aRunning && bRunning) return 1;
                    // Sort by last activity if available, then by updated/created
                    const aTime = a.lastActivityTimestamp || a.updatedAt || a.createdAt;
                    const bTime = b.lastActivityTimestamp || b.updatedAt || b.createdAt;
                    return bTime - aTime;
                  })
                  .map((identity) => (
                  <div 
                    key={identity.id}
                    className={cn(
                      "group p-2 rounded-sm border transition-all flex flex-col gap-2 relative overflow-hidden",
                      activeIdentityId === identity.id 
                        ? "bg-emerald-500/[0.03] border-emerald-500/30 shadow-sm" 
                        : "bg-surface-container-high border-outline/5 hover:border-outline/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <img 
                          src={identity.settings.profile.picture} 
                          alt="" 
                          className="w-7 h-7 rounded-sm bg-surface border border-outline/10 object-cover"
                          crossOrigin="anonymous"
                        />
                        {isRunning(identity.id) && (
                          <div className={cn(
                            "absolute -top-1.5 -right-1.5 rounded-full border border-surface shadow-sm flex items-center justify-center min-w-[14px] h-[14px] px-0.5 z-10",
                            ((queueCounts[identity.id] || 0) + (plannedCounts[identity.id] || 0)) > 0 ? "bg-emerald-500 animate-none" : "bg-emerald-500 animate-pulse"
                          )}>
                            {((queueCounts[identity.id] || 0) + (plannedCounts[identity.id] || 0)) > 0 ? (
                              <span className="text-[9px] font-black text-black leading-none">{(queueCounts[identity.id] || 0) + (plannedCounts[identity.id] || 0)}</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13px] font-black text-on-surface truncate leading-none">{identity.name}</h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isRunning(identity.id) ? (
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter shrink-0">Active</span>
                              <span className="text-on-surface-variant/20 text-[10px]">•</span>
                              {identity.settings.targetNpub ? (
                                (() => {
                                  let pk = '';
                                  try {
                                    const decoded = nip19.decode(identity.settings.targetNpub) as any;
                                    if (decoded.type === 'npub') pk = decoded.data;
                                  } catch (e) {}
                                  const profile = communityProfiles[pk];
                                  return (
                                    <div className="flex items-center gap-1 min-w-0">
                                      <img 
                                        src={profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${pk || identity.settings.targetNpub}`} 
                                        alt="" 
                                        className="w-3 h-3 rounded-none bg-surface-container-high border border-outline/10 object-cover shrink-0"
                                        crossOrigin="anonymous"
                                      />
                                      <span className="text-[10px] font-bold text-on-surface-variant truncate uppercase tracking-tighter">
                                        {profile?.name || identity.settings.targetName || identity.settings.targetNpub.substring(0, 8)}
                                      </span>
                                    </div>
                                  );
                                })()
                              ) : (
                                <span className="text-[10px] font-bold text-on-surface-variant truncate uppercase tracking-tighter">
                                  Self-Directed
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">Idle</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            loadIdentity(identity);
                            setRightTab('persona');
                          }}
                          className={cn(
                            "p-1 rounded-sm transition-all",
                            activeIdentityId === identity.id 
                              ? "bg-emerald-500 text-black" 
                              : "text-on-surface-variant hover:text-white"
                          )}
                          title="Edit Persona"
                        >
                          <SettingsIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => isRunning(identity.id) ? stopBot(identity.id) : startBot(identity)}
                          disabled={!identity.settings.targetNpub && !identity.settings.targetHashtags && !identity.settings.targetKeywords && !identity.settings.proactive?.enabled}
                          className={cn(
                            "p-1 rounded-sm transition-all",
                            isRunning(identity.id)
                              ? "text-red-400 hover:text-red-500"
                              : (!identity.settings.targetNpub && !identity.settings.targetHashtags && !identity.settings.targetKeywords && !identity.settings.proactive?.enabled)
                                ? "text-on-surface-variant/20 cursor-not-allowed"
                                : "text-emerald-500 hover:text-emerald-400"
                          )}                          title={isRunning(identity.id) ? "Stop Bot" : "Start Bot"}
                        >
                          {isRunning(identity.id) ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        </button>
                      </div>
                    </div>

                    {/* Compact Session Stats if running */}
                    {isRunning(identity.id) && sessionStats[identity.id] && (
                      <div className="flex items-center justify-between px-1.5 py-1 bg-surface-container rounded-sm border border-outline/5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5" title="Notes">
                            <FileText className="w-2.5 h-2.5 text-blue-400/50" />
                            <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(sessionStats[identity.id].proactiveNotesSent) || 0}</span>
                          </div>
                          <div className="flex items-center gap-0.5" title="Replies">
                            <MessageSquare className="w-2.5 h-2.5 text-emerald-400/50" />
                            <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(sessionStats[identity.id].repliesSent) || 0}</span>
                          </div>
                          <div className="flex items-center gap-0.5" title="Reactions">
                            <Heart className="w-2.5 h-2.5 text-pink-400/50" />
                            <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(sessionStats[identity.id].reactionsSent) || 0}</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-tighter">Live</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {isAnyBotRunning && (
              <div className="p-2 bg-surface-container-low border-t border-outline/10 space-y-2">
                <button 
                  onClick={() => stopBot()}
                  className="w-full flex items-center justify-center gap-2 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm text-[11px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Stop All Bots
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Left Column: Controls */}
        <div className="lg:col-span-3 flex flex-col min-h-[300px] space-y-2 overflow-hidden lg:order-first">
          <div className="shrink-0 lg:overflow-y-auto custom-scrollbar space-y-2">
            {/* Identity Info */}
          <section className="bg-surface-container border border-outline/10 rounded-sm p-3 space-y-3 relative overflow-hidden group/card shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-on-surface-variant">
                {settings.useAI ? <Brain className="w-4 h-4 text-emerald-500" /> : <Activity className="w-4 h-4" />}
                <h2 className="text-xs font-bold uppercase tracking-widest">{settings.useAI ? 'AI Identity' : 'Current Identity'}</h2>
              </div>
              {settings.useAI && (
                <button 
                  onClick={() => {
                    setRightTab('persona');
                    setPersonaSubTab('prompt');
                  }}
                  className="p-1 hover:bg-surface-container-high rounded-sm text-on-surface-variant hover:text-emerald-500 transition-all flex items-center gap-1.5 border border-transparent hover:border-outline/20"
                  title="AI Persona Settings"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase">Persona</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <img 
                src={settings.profile.picture} 
                alt="Avatar" 
                className="w-10 h-10 rounded-sm bg-surface-container-high border border-outline/10 object-cover shadow-sm"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-on-surface truncate flex items-center gap-2 leading-none">
                  {settings.profile.name || 'Anonymous'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-xs text-on-surface-variant font-mono truncate flex-1">
                    {currentIdentity ? nip19.npubEncode(currentIdentity.pk) : 'Generating...'}
                  </div>
                  {currentIdentity && (
                    <div className="flex items-center gap-1">
                      <a 
                        href={`https://jumble.social/users/${nip19.npubEncode(currentIdentity.pk)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-surface-container-high rounded-sm transition-colors text-on-surface-variant hover:text-emerald-500 border border-transparent hover:border-outline/20"
                        title="View on Jumble.social"
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </a>
                      <button 
                        onClick={() => copyToClipboard(nip19.npubEncode(currentIdentity.pk))}
                        className="p-1 hover:bg-surface-container-high rounded-sm transition-colors text-on-surface-variant hover:text-white border border-transparent hover:border-outline/20"
                        title="Copy npub"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => copyToClipboard(nip19.nsecEncode(currentIdentity.sk))}
                        className="p-1 hover:bg-surface-container-high rounded-sm transition-colors text-on-surface-variant hover:text-white border border-transparent hover:border-outline/20"
                        title="Copy nsec"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Monitoring Card */}
          <section className="bg-surface-container border border-outline/10 rounded-sm p-3 space-y-3 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Target className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-white">Monitoring</h2>
              </div>
            </div>

            {/* Unified Monitoring Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Enter npub, #hashtag, or keyword..."
                  value={monitoringInput}
                  onChange={(e) => setMonitoringInput(e.target.value)}
                  disabled={activeIdentityId ? isRunning(activeIdentityId) : false}
                  className="flex-1 bg-surface border border-outline/20 rounded-sm px-2 py-1.5 text-[10px] focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && monitoringInput.trim()) {
                      const val = monitoringInput.trim();
                      if (val.startsWith('npub1')) {
                        const current = String(settings.targetNpub || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!current.includes(val)) {
                          setSettings(s => ({ ...s, targetNpub: [...current, val].join(', ') }));
                        }
                      } else if (val.startsWith('#')) {
                        const current = String(settings.targetHashtags || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!current.includes(val)) {
                          setSettings(s => ({ ...s, targetHashtags: [...current, val].join(', ') }));
                        }
                      } else {
                        const current = String(settings.targetKeywords || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!current.includes(val)) {
                          setSettings(s => ({ ...s, targetKeywords: [...current, val].join(', ') }));
                        }
                      }
                      setMonitoringInput('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (monitoringInput.trim()) {
                      const val = monitoringInput.trim();
                      if (val.startsWith('npub1')) {
                        const current = String(settings.targetNpub || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!current.includes(val)) {
                          setSettings(s => ({ ...s, targetNpub: [...current, val].join(', ') }));
                        }
                      } else if (val.startsWith('#')) {
                        const current = String(settings.targetHashtags || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!current.includes(val)) {
                          setSettings(s => ({ ...s, targetHashtags: [...current, val].join(', ') }));
                        }
                      } else {
                        const current = String(settings.targetKeywords || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (!current.includes(val)) {
                          setSettings(s => ({ ...s, targetKeywords: [...current, val].join(', ') }));
                        }
                      }
                      setMonitoringInput('');
                    }
                  }}
                  disabled={(activeIdentityId ? isRunning(activeIdentityId) : false) || !monitoringInput.trim()}
                  className="px-3 bg-surface-container-high text-on-surface-variant rounded-sm text-[10px] font-black uppercase tracking-widest hover:text-emerald-400 transition-all border border-outline/10 disabled:opacity-30"
                >
                  Add
                </button>
              </div>

              {/* Combined Chip Area */}
              <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar p-0.5">
                {/* User Chips */}
                {String(settings.targetNpub || '').split(',').map(s => s.trim()).filter(Boolean).map((npub, idx) => {
                  let pk = '';
                  try {
                    const decoded = nip19.decode(npub) as any;
                    if (decoded.type === 'npub') pk = decoded.data;
                  } catch (e) {}
                  const profile = communityProfiles[pk];

                  return (
                    <div key={`u-${idx}`} className="flex items-center gap-1.5 pl-1 pr-1 py-0.5 bg-surface border border-outline/10 rounded-sm group/chip shrink-0">
                      <img 
                        src={profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${pk || npub}`} 
                        alt="" 
                        className="w-3.5 h-3.5 rounded-full bg-surface-container-high border border-outline/10 object-cover"
                        crossOrigin="anonymous"
                      />
                      <span className="text-[10px] font-bold text-on-surface truncate max-w-[80px]">
                        {profile?.name || (pk ? `${npub.substring(0, 8)}...` : 'User')}
                      </span>
                      <button 
                        onClick={() => {
                          const current = String(settings.targetNpub || '').split(',').map(s => s.trim());
                          const next = current.filter(n => n !== npub).join(', ');
                          setSettings(s => ({ ...s, targetNpub: next }));
                        }}
                        disabled={activeIdentityId ? isRunning(activeIdentityId) : false}
                        className="text-on-surface-variant/40 hover:text-red-400 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}

                {/* Hashtag Chips */}
                {String(settings.targetHashtags || '').split(',').map(s => s.trim()).filter(Boolean).map((tag, idx) => (
                  <div key={`h-${idx}`} className="flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-500/5 border border-emerald-500/10 rounded-sm shrink-0">
                    <Hash className="w-2.5 h-2.5 text-emerald-500/60" />
                    <span className="text-[10px] font-bold text-emerald-400">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                    <button 
                      onClick={() => {
                        const current = String(settings.targetHashtags || '').split(',').map(s => s.trim());
                        const next = current.filter(n => n !== tag).join(', ');
                        setSettings(s => ({ ...s, targetHashtags: next }));
                      }}
                      disabled={activeIdentityId ? isRunning(activeIdentityId) : false}
                      className="text-on-surface-variant/40 hover:text-red-400 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}

                {/* Keyword Chips */}
                {String(settings.targetKeywords || '').split(',').map(s => s.trim()).filter(Boolean).map((kw, idx) => (
                  <div key={`k-${idx}`} className="flex items-center gap-1.5 px-1.5 py-0.5 bg-surface border border-outline/10 rounded-sm shrink-0">
                    <Type className="w-2.5 h-2.5 text-on-surface-variant/40" />
                    <span className="text-[10px] font-bold text-on-surface-variant">{kw}</span>
                    <button 
                      onClick={() => {
                        const current = String(settings.targetKeywords || '').split(',').map(s => s.trim());
                        const next = current.filter(n => n !== kw).join(', ');
                        setSettings(s => ({ ...s, targetKeywords: next }));
                      }}
                      disabled={activeIdentityId ? isRunning(activeIdentityId) : false}
                      className="text-on-surface-variant/40 hover:text-red-400 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}

                {!settings.targetNpub && !settings.targetHashtags && !settings.targetKeywords && (
                  <div className="w-full py-4 text-center opacity-20 italic text-[10px] font-bold uppercase tracking-widest">
                    No active monitoring
                  </div>
                )}
              </div>
            </div>

            {/* Start/Stop Button */}
            <div className="pt-1">
              {activeIdentityId && isRunning(activeIdentityId) ? (
                <button 
                  onClick={() => stopBot(activeIdentityId)}
                  className="w-full h-[32px] flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm hover:bg-red-500 hover:text-white transition-all shadow-sm text-[11px] font-bold uppercase tracking-widest"
                  title="Stop Bot"
                >
                  <Square className="w-3.5 h-3.5 fill-current mr-2" />
                  Stop Bot
                </button>
              ) : (
                <button 
                  onClick={() => {
                    if (activeIdentityId && currentIdentity) {
                      const identity: Identity = {
                        id: activeIdentityId,
                        name: settings.profile.name,
                        settings: settings,
                        nsec: nip19.nsecEncode(currentIdentity.sk),
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        stats: INITIAL_STATS
                      };
                      startBot(identity);
                    }
                  }}
                  disabled={((settings.useAI && aiStatus !== 'ready') || !activeIdentityId) || (!settings.targetNpub && !settings.targetHashtags && !settings.targetKeywords && !settings.proactive?.enabled)}
                  className={cn(
                    "w-full h-[32px] flex items-center justify-center rounded-sm transition-all shadow-sm border text-[11px] font-bold uppercase tracking-widest",
                    ((settings.useAI && aiStatus !== 'ready') || !activeIdentityId) || (!settings.targetNpub && !settings.targetHashtags && !settings.targetKeywords && !settings.proactive?.enabled)
                      ? "bg-surface-container-high text-on-surface-variant/40 border-outline/10 cursor-not-allowed"
                      : "bg-emerald-500 text-black border-emerald-500 hover:bg-emerald-400"
                  )}
                  title={settings.useAI && aiStatus !== 'ready' ? `Loading Brain ${Math.round(aiProgress)}%` : "Start Bot"}
                >
                  {settings.useAI && aiStatus !== 'ready' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current mr-2" />
                  )}
                  {settings.useAI && aiStatus !== 'ready' ? 'Loading Brain...' : 'Start Bot'}
                </button>
              )}
            </div>
          </section>

          {/* Active Relays */}
          {activeRelays.length > 0 && (
            <section className="bg-surface-container border border-outline/10 rounded-sm p-3 space-y-2 shadow-sm">
              <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                <RefreshCw className="w-3.5 h-3.5" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Active Relays ({activeRelays.length})</h2>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                {activeRelays.map((relay, idx) => (
                  <div key={idx} className="text-xs font-mono text-on-surface-variant truncate">
                    • {relay}
                  </div>
                ))}
              </div>
            </section>
          )}
          </div>

          {/* AI Playground (Test Bench) - Now fills remaining space */}
          {settings.useAI && (
            <section className="bg-surface-container-low border border-outline/10 rounded-sm overflow-hidden flex flex-col flex-1 min-h-[200px] shadow-sm">
              <div className="px-3 py-2 border-b border-outline/10 flex items-center justify-between bg-surface-container">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">AI Persona Test Bench</h3>
                </div>
                {playgroundMessages.length > 0 && (
                  <button 
                    onClick={() => {
                      setPlaygroundMessages([]);
                      conversationHistoryRef.current.delete('playground');
                    }}
                    className="text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-white transition-colors"
                  >
                    Clear Chat
                  </button>
                )}
              </div>

              <div 
                ref={playgroundScrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-surface"
              >
                {playgroundMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-30">
                    <Brain className="w-8 h-8 text-on-surface" />
                    <p className="text-xs font-medium text-on-surface-variant max-w-[150px]">
                      Send a message to test how the AI responds.
                    </p>
                  </div>
                ) : (
                  <>
                    {playgroundMessages.map((msg, idx) => (
                      <div key={idx} className={cn(
                        "flex flex-col max-w-[90%] space-y-1",
                        msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                      )}>
                        <div className={cn(
                          "px-3 py-2 rounded-sm text-sm leading-relaxed break-words shadow-sm",
                          msg.role === 'user'
                            ? "bg-surface-container-high text-on-surface border border-outline/10"
                            : "bg-emerald-500/5 border border-emerald-500/20 text-emerald-400"
                        )}>
                          {msg.content}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-tighter text-on-surface-variant opacity-50 px-1">
                          {msg.role === 'user' ? 'You' : settings.profile.name || 'AI'}
                        </span>
                      </div>
                    ))}

                    {isPlaygroundThinking && (
                      <div className="flex flex-col items-start space-y-1 mr-auto">
                        <div className="bg-surface-container border border-outline/10 px-3 py-2 rounded-sm flex gap-1 shadow-sm">
                          <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-2 bg-surface-container border-t border-outline/10">
                <div className="relative">
                  <input
                    ref={playgroundInputRef}
                    type="text"
                    value={playgroundInput}
                    onChange={(e) => setPlaygroundInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlaygroundSend()}
                    placeholder="Send a test message..."
                    className="w-full bg-surface border border-outline/20 rounded-sm px-3 py-2 text-sm pr-10 focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                  />
                  <button 
                    onClick={handlePlaygroundSend}
                    disabled={!playgroundInput.trim() || aiStatus !== 'ready' || isPlaygroundThinking}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-emerald-500 disabled:text-on-surface-variant transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

        </div>

        {/* Middle Column: Content Tabs */}
        <div className="lg:col-span-6 min-h-[400px] flex flex-col">
          <section className="bg-surface-container border border-outline/10 rounded-sm flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="flex border-b border-outline/10 bg-surface-container-low">
              <button
                onClick={() => setRightTab('timeline')}
                className={cn(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 flex items-center justify-center gap-2",
                  rightTab === 'timeline' ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-high"
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                Timeline
              </button>
              <button
                onClick={() => setRightTab('persona')}
                className={cn(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 flex items-center justify-center gap-2",
                  rightTab === 'persona' ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-high"
                )}
              >
                <User className="w-3.5 h-3.5" />
                Persona Settings
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              {rightTab === 'timeline' ? (
                <LogTimeline 
                  logs={logs}
                  isVerbose={false}
                  setIsVerbose={() => {}}
                  onClear={clearLogs}
                  communityProfiles={communityProfiles}
                  savedIdentities={savedIdentities}
                  hideVerboseToggle={true}
                />
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex gap-1 p-1.5 bg-surface-container-low border-b border-outline/10">
                    {(() => {
                      const tabs = [
                        { id: 'profile', label: 'Profile', icon: User },
                        { id: 'prompt', label: 'System Prompt', icon: MessageSquare },
                        { id: 'tuning', label: 'Tuning', icon: SettingsIcon },
                        { id: 'behavior', label: 'Behavior', icon: Wand2 }
                      ];
                      if (settings.proactive?.enabled) {
                        tabs.push({ id: 'proactive', label: 'Posting', icon: PenTool });
                      }
                      return tabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setPersonaSubTab(tab.id as any)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all border border-transparent",
                            personaSubTab === tab.id 
                              ? "bg-surface-container-high text-emerald-400 border-outline/10 shadow-sm" 
                              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
                          )}
                        >
                          <tab.icon className="w-3 h-3" />
                          {tab.label}
                        </button>
                      ));
                    })()}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-surface">
                    <AnimatePresence mode="wait">
                      {personaSubTab === 'profile' && (
                        <motion.div 
                          key="profile"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Display Name</label>
                              <input 
                                type="text"
                                value={settings.profile.name}
                                onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, name: e.target.value } }))}
                                className="w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">About / Bio</label>
                              <textarea 
                                value={settings.profile.about}
                                onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, about: e.target.value } }))}
                                className="w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors h-20 resize-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Picture URL</label>
                              <input 
                                type="text"
                                value={settings.profile.picture}
                                onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, picture: e.target.value } }))}
                                className="w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">NIP-05</label>
                                <input 
                                  type="text"
                                  value={settings.profile.nip05}
                                  onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, nip05: e.target.value } }))}
                                  className="w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                                  placeholder="user@domain.com"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Lightning (LUD-16)</label>
                                  {globalUseCuratorLightning && curatorProfile?.lud16 && (
                                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">Override Active</span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={globalUseCuratorLightning && curatorProfile?.lud16 ? curatorProfile.lud16 : (settings.profile.lud16 || '')}
                                  onChange={(e) => setSettings(s => ({ ...s, profile: { ...s.profile, lud16: e.target.value } }))}
                                  disabled={globalUseCuratorLightning && !!curatorProfile?.lud16}
                                  className={cn(
                                    "w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors",
                                    globalUseCuratorLightning && curatorProfile?.lud16 ? "text-emerald-500 border-emerald-500/20" : ""
                                  )}
                                  placeholder="user@getalby.com"
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {personaSubTab === 'prompt' && (
                        <motion.div 
                          key="prompt"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">System Prompt</h4>
                              <div className="flex gap-2">
                                <code className="text-xs px-1.5 py-0.5 bg-surface-container-high rounded-sm text-tertiary border border-outline/10">{"{name}"}</code>
                                <code className="text-xs px-1.5 py-0.5 bg-surface-container-high rounded-sm text-tertiary border border-outline/10">{"{target_name}"}</code>
                              </div>
                            </div>
                            <textarea
                              value={settings.aiSystemPrompt}
                              onChange={(e) => setSettings(s => ({ ...s, aiSystemPrompt: e.target.value }))}
                              className="w-full bg-surface-container border border-outline/20 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors min-h-[350px] leading-relaxed text-on-surface custom-scrollbar resize-none shadow-inner"
                              placeholder="Describe how the AI should behave..."
                            />
                            <div className="p-3 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-sm space-y-1.5">
                              <div className="flex items-center gap-2 text-emerald-500/80">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold uppercase tracking-widest">Bot Tip</span>
                              </div>
                              <p className="text-xs text-on-surface-variant leading-relaxed opacity-80">
                                Operational rules (no meta-talk, etc.) are applied automatically. Use this space strictly to define your character's personality and vibe.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {personaSubTab === 'tuning' && (
                        <motion.div 
                          key="tuning"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-5"
                        >
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.keys(MODEL_PRESETS[settings.modelId] || {}).map((preset) => (
                              <button
                                key={preset}
                                onClick={() => setSettings(s => ({ ...s, ...MODEL_PRESETS[s.modelId][preset] }))}
                                className={cn(
                                  "px-2 py-1.5 rounded-sm border text-xs font-bold uppercase tracking-wider transition-all",
                                  Object.entries(MODEL_PRESETS[settings.modelId][preset]).every(([k, v]) => (settings as any)[k] === v)
                                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                                    : "bg-surface-container-high border-outline/10 text-on-surface-variant hover:border-outline/30"
                                )}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-4">
                            {[
                              { 
                                label: 'Temperature', 
                                key: 'temperature', 
                                min: 0, max: 2, step: 0.01,
                                tip: 'Controls randomness. Higher values make output more creative, lower make it focused.'
                              },
                              { 
                                label: 'Top-P (Nucleus)', 
                                key: 'top_p', 
                                min: 0, max: 1, step: 0.01,
                                tip: 'Limits vocabulary to a subset of likely tokens.'
                              },
                              { 
                                label: 'Top-K', 
                                key: 'top_k', 
                                min: 1, max: 100, step: 1,
                                tip: 'Restricts to the top K most likely next tokens.'
                              },
                              { 
                                label: 'Repetition Penalty', 
                                key: 'repetition_penalty', 
                                min: 1, max: 2, step: 0.01,
                                tip: 'Discourages repeating the same words or phrases.'
                              }
                            ].map((param) => (
                              <div key={param.key} className="space-y-1.5">
                                <div className="flex justify-between items-center group/tip relative px-1">
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{param.label}</label>
                                    <div className="relative group/icon">
                                      <Info className="w-3 h-3 text-on-surface-variant opacity-40 hover:text-emerald-500 cursor-help transition-colors" />
                                      <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-surface-container-high border border-outline/20 rounded-sm text-xs text-on-surface-variant font-medium leading-relaxed shadow-xl opacity-0 group-hover/icon:opacity-100 pointer-events-none transition-opacity z-50">
                                        {param.tip}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-xs font-mono font-bold text-emerald-500">{(settings as any)[param.key].toFixed(param.step < 1 ? 2 : 0)}</span>
                                </div>
                                <input 
                                  type="range" min={param.min} max={param.max} step={param.step}
                                  value={(settings as any)[param.key]}
                                  onChange={(e) => setSettings(s => ({ ...s, [param.key]: parseFloat(e.target.value) }))}
                                  className="w-full accent-emerald-500 h-1 bg-surface-container-high rounded-none appearance-none cursor-pointer border-x border-outline/10"
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {personaSubTab === 'behavior' && (
                        <motion.div
                          key="behavior"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div className="space-y-3">
                            {/* Reactions Toggle */}
                            <label className="flex items-center justify-between p-3 bg-surface-container-low border border-outline/10 rounded-sm cursor-pointer hover:bg-surface-container transition-colors shadow-sm">
                              <div className="space-y-0.5">
                                <div className="text-[13px] font-bold text-on-surface uppercase tracking-wider">Enable Reactions</div>
                                <div className="text-sm text-on-surface-variant/80">The bot will send emojis to the target's notes.</div>
                              </div>
                              <div className={cn(
                                "w-8 h-4 rounded-sm transition-all relative border border-outline/20",
                                settings.reactToNotes ? "bg-emerald-500/40" : "bg-surface-container-high"
                              )}>
                                <input 
                                  type="checkbox" 
                                  checked={settings.reactToNotes}
                                  onChange={(e) => setSettings(s => ({ ...s, reactToNotes: e.target.checked }))}
                                  className="sr-only"
                                />
                                <div className={cn(
                                  "absolute top-0.5 w-2.5 h-2.5 rounded-none transition-all border border-outline/30",
                                  settings.reactToNotes ? "left-4.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                                )} />
                              </div>
                            </label>

                            {settings.reactToNotes && (
                              <div className="space-y-3 p-1">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Custom Emojis Pool</label>
                                  <div className="flex gap-1.5">
                                    <input 
                                      type="text"
                                      value={settings.reactionEmojis}
                                      onChange={(e) => setSettings(s => ({ ...s, reactionEmojis: e.target.value }))}
                                      className="flex-1 bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-base focus:outline-none focus:border-emerald-500/50 transition-colors"
                                      placeholder="❤️ 🔥 👍"
                                    />
                                    <button 
                                      onClick={() => setShowEmojiPickerDialog(true)}
                                      className="px-3 bg-surface-container-high hover:bg-surface-container border border-outline/20 text-on-surface rounded-sm transition-colors flex items-center justify-center"
                                    >
                                      <Sparkles className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Proactive Posting Master Toggle */}
                            <div className="p-3 bg-surface-container-low border border-outline/10 rounded-sm shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="text-[13px] font-bold text-on-surface uppercase tracking-wider">Proactive Posting</div>
                                  <div className="text-sm text-on-surface-variant/80">Original notes and autonomous interaction.</div>
                                </div>
                                <div className={cn(
                                  "w-8 h-4 rounded-sm transition-all relative cursor-pointer border border-outline/20",
                                  settings.proactive?.enabled ? "bg-emerald-500/40" : "bg-surface-container-high"
                                )} onClick={() => {
                                  const nextEnabled = !settings.proactive?.enabled;
                                  setSettings(s => ({ ...s, proactive: { ...s.proactive, enabled: nextEnabled } }));
                                  // Clear schedule when toggled to ensure fresh start
                                  if (activeIdentityId) {
                                    setSavedIdentities(prev => prev.map(i => 
                                      i.id === activeIdentityId ? { ...i, nextProactiveTimestamp: undefined, updatedAt: Date.now() } : i
                                    ));
                                  }
                                }}>
                                  <div className={cn(
                                    "absolute top-0.5 w-2.5 h-2.5 rounded-none transition-all border border-outline/30",
                                    settings.proactive?.enabled ? "left-4.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                                  )} />
                                </div>
                              </div>
                            </div>

                            {/* Repost Toggle */}
                            <label className="flex items-center justify-between p-3 bg-surface-container-low border border-outline/10 rounded-sm cursor-pointer hover:bg-surface-container transition-colors shadow-sm">
                              <div className="space-y-0.5">
                                <div className="text-[13px] font-bold text-on-surface uppercase tracking-wider">Enable Reposting</div>
                                <div className="text-sm text-on-surface-variant/80">Repost target's notes to bot timeline.</div>
                              </div>
                              <div className={cn(
                                "w-8 h-4 rounded-sm transition-all relative border border-outline/20",
                                settings.repostNotes ? "bg-emerald-500/40" : "bg-surface-container-high"
                              )}>
                                <input 
                                  type="checkbox" 
                                  checked={settings.repostNotes}
                                  onChange={(e) => setSettings(s => ({ ...s, repostNotes: e.target.checked }))}
                                  className="sr-only"
                                />
                                <div className={cn(
                                  "absolute top-0.5 w-2.5 h-2.5 rounded-none transition-all border border-outline/30",
                                  settings.repostNotes ? "left-4.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                                )} />
                              </div>
                            </label>

                            {settings.repostNotes && (
                              <div className="p-3 bg-surface-container border border-outline/10 rounded-sm space-y-2 shadow-inner">
                                <div className="flex justify-between items-center px-1">
                                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Chance</span>
                                  <span className="text-xs font-mono font-bold text-emerald-500">{Math.round((settings.repostChance ?? 0.25) * 100)}%</span>
                                </div>
                                <input
                                  type="range" min="0.01" max="1.0" step="0.01"
                                  value={settings.repostChance ?? 0.25}
                                  onChange={(e) => setSettings(s => ({ ...s, repostChance: parseFloat(e.target.value) }))}
                                  className="w-full h-1 bg-surface-container-high appearance-none cursor-pointer accent-emerald-500"
                                />
                              </div>
                            )}

                            {/* Auto Follow Back Toggle */}
                            <label className="flex items-center justify-between p-3 bg-surface-container-low border border-outline/10 rounded-sm cursor-pointer hover:bg-surface-container transition-colors shadow-sm">
                              <div className="space-y-0.5">
                                <div className="text-[13px] font-bold text-on-surface uppercase tracking-wider">Follow Back</div>
                                <div className="text-sm text-on-surface-variant/80">Follow users who interact with the bot.</div>
                              </div>
                              <div className={cn(
                                "w-8 h-4 rounded-sm transition-all relative border border-outline/20",
                                settings.autoFollowBack ? "bg-emerald-500/40" : "bg-surface-container-high"
                              )}>
                                <input 
                                  type="checkbox" 
                                  checked={settings.autoFollowBack}
                                  onChange={(e) => setSettings(s => ({ ...s, autoFollowBack: e.target.checked }))}
                                  className="sr-only"
                                />
                                <div className={cn(
                                  "absolute top-0.5 w-2.5 h-2.5 rounded-none transition-all border border-outline/30",
                                  settings.autoFollowBack ? "left-4.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                                )} />
                              </div>
                            </label>

                            {/* Polite Mode Toggle */}
                            <label className="flex items-center justify-between p-3 bg-surface-container-low border border-outline/10 rounded-sm cursor-pointer hover:bg-surface-container transition-colors shadow-sm">
                              <div className="space-y-0.5 flex-1 pr-4">
                                <div className="flex items-center gap-2 text-[13px] font-bold text-on-surface uppercase tracking-wider">
                                  Polite Mode
                                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1 border border-emerald-500/20 rounded-[2px] tracking-tighter">Recommended</span>
                                </div>
                                <div className="text-sm text-on-surface-variant/80">Bot will only start its own threads on top notes. Direct mentions still work.</div>
                              </div>
                              <div className={cn(
                                "shrink-0 w-8 h-4 rounded-sm transition-all relative border border-outline/20",
                                settings.politeMode ? "bg-emerald-500/40" : "bg-surface-container-high"
                              )}>
                                <input 
                                  type="checkbox" 
                                  checked={settings.politeMode}
                                  onChange={(e) => setSettings(s => ({ ...s, politeMode: e.target.checked }))}
                                  className="sr-only"
                                />
                                <div className={cn(
                                  "absolute top-0.5 w-2.5 h-2.5 rounded-none transition-all border border-outline/30",
                                  settings.politeMode ? "left-4.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                                )} />
                              </div>
                            </label>
                          </div>
                        </motion.div>
                      )}

                      {personaSubTab === 'proactive' && (
                        <motion.div
                          key="proactive"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div className="space-y-4">
                            {/* Timing Controls */}
                            <div className="p-3 bg-surface-container border border-outline/10 rounded-sm space-y-3 shadow-inner">
                              <div className="flex justify-between items-center px-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Frequency</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-emerald-500">
                                  Every {(() => {
                                    const mins = settings.proactive?.interval || 240;
                                    const h = Math.floor(mins / 60);
                                    const m = mins % 60;
                                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                  })()}
                                </span>
                              </div>
                              <input
                                type="range" min="15" max="1440" step="15"
                                value={settings.proactive?.interval || 240}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setSettings(s => ({ ...s, proactive: { ...s.proactive, interval: val } }));
                                  // Reset schedule for this bot so the new interval is applied immediately
                                  if (activeIdentityId) {
                                    setSavedIdentities(prev => prev.map(i => 
                                      i.id === activeIdentityId ? { ...i, nextProactiveTimestamp: undefined, updatedAt: Date.now() } : i
                                    ));
                                  }
                                }}
                                className="w-full h-1 bg-surface-container-high appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>

                            {/* Inspiration Source */}
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Inspiration Source</label>
                                <div className="flex gap-1">
                                  {(['target', 'follows', 'both'] as const).map((source) => (
                                    <button
                                      key={source}
                                      onClick={() => setSettings(s => ({ ...s, proactive: { ...s.proactive, inspiration: source } }))}
                                      className={cn(
                                        "flex-1 py-1.5 rounded-sm text-xs font-bold uppercase border transition-all",
                                        settings.proactive?.inspiration === source 
                                          ? "bg-on-surface text-surface border-on-surface shadow-md" 
                                          : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/30"
                                      )}
                                    >
                                      {source}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">AI Post Prompt</label>
                                <textarea
                                  value={settings.proactive?.aiPostPrompt}
                                  onChange={(e) => setSettings(s => ({ ...s, proactive: { ...s.proactive, aiPostPrompt: e.target.value } }))}
                                  className="w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors h-24 resize-none leading-relaxed text-on-surface shadow-inner"
                                  placeholder="Instructions for original posts..."
                                />
                              </div>
                            </div>

                            {/* Interaction Settings */}
                            <div className="p-3 bg-surface-container-low border border-outline/10 rounded-sm space-y-3 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-xs font-bold text-on-surface uppercase tracking-widest">Reply to Mentions</span>
                                </div>
                                <div className={cn(
                                  "w-8 h-4 rounded-sm transition-all relative cursor-pointer border border-outline/20",
                                  settings.proactive?.replyToMentions ? "bg-emerald-500/40" : "bg-surface-container-high"
                                )} onClick={() => setSettings(s => ({ ...s, proactive: { ...s.proactive, replyToMentions: !s.proactive?.replyToMentions } }))}>
                                  <div className={cn(
                                    "absolute top-0.5 w-2.5 h-2.5 rounded-none transition-all border border-outline/30",
                                    settings.proactive?.replyToMentions ? "left-4.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                                  )} />
                                </div>
                              </div>
                              {settings.proactive?.replyToMentions && (
                                <div className="space-y-2 pt-2 border-t border-outline/10">
                                  <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Probability</span>
                                    <span className="text-xs font-mono font-bold text-emerald-500">{Math.round((settings.proactive?.replyProbability || 0.5) * 100)}%</span>
                                  </div>
                                  <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={settings.proactive?.replyProbability || 0.5}
                                    onChange={(e) => setSettings(s => ({ ...s, proactive: { ...s.proactive, replyProbability: parseFloat(e.target.value) } }))}
                                    className="w-full h-1 bg-surface-container-high appearance-none cursor-pointer accent-emerald-500"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="p-3 bg-surface-container-low border-t border-outline/10 flex flex-col gap-2">
                    {userPubkey ? (
                      <button
                        onClick={publishPersona}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-sm font-bold text-xs hover:bg-emerald-400 transition-all uppercase tracking-widest shadow-md shadow-emerald-500/10"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Publish Persona
                      </button>
                    ) : (
                      <button
                        onClick={handleNip07Login}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-sm font-bold text-xs hover:bg-surface-container transition-all uppercase tracking-widest border border-outline/10"
                      >
                        <User className="w-3.5 h-3.5" />
                        Sign In to Publish
                      </button>
                    )}
                    
                    <div className="flex justify-between items-center px-1">
                      <button
                        onClick={() => setShowAddIdentityDialog(true)}
                        className="text-xs font-black uppercase tracking-tighter text-on-surface-variant hover:text-emerald-500 transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        Create New Bot
                      </button>
                      <span className="text-xs font-bold uppercase tracking-tighter text-on-surface-variant">Auto-Saving enabled</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
          </>
        )}

        {currentView === 'manager' && (
          <div className="lg:contents flex flex-col gap-2">
            {/* Left Nav for Manager */}
            <div className="lg:col-span-3 lg:flex flex-col lg:min-h-[200px] w-full overflow-hidden">
              <section className="bg-surface-container border border-outline/10 rounded-sm p-3 flex flex-col gap-2">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">Bot Management</h3>
                <button 
                  onClick={() => setManagerTab('local')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-xs font-bold uppercase tracking-widest border",
                    managerTab === 'local' 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/20"
                  )}
                >
                  <Users className="w-4 h-4" />
                  My Identities
                </button>
                <button 
                  onClick={() => {
                    setManagerTab('community');
                    fetchCommunityPersonas();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-xs font-bold uppercase tracking-widest border",
                    managerTab === 'community' 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/20"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  Marketplace
                </button>
                <button 
                  onClick={() => setManagerTab('chat')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-xs font-bold uppercase tracking-widest border",
                    managerTab === 'chat' 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/20"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  Interaction Room
                </button>
              </section>
              
              {managerTab === 'chat' ? (
                <section className="bg-surface-container border border-outline/10 rounded-sm flex-1 flex flex-col overflow-hidden shadow-sm mt-2">
                  <div className="px-3 py-2 bg-surface-container-low border-b border-outline/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Participants</h2>
                    </div>
                    <span className="text-[10px] font-black text-emerald-400/60 uppercase">{swarmChatParticipants.size} Selected</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-surface space-y-1">
                    {savedIdentities.filter(i => !i.deleted).map(identity => {
                      const isSelected = swarmChatParticipants.has(identity.id);
                      return (
                        <button
                          key={identity.id}
                          onClick={() => {
                            setSwarmChatParticipants(prev => {
                              const next = new Set(prev);
                              if (isSelected) next.delete(identity.id);
                              else next.add(identity.id);
                              return next;
                            });
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 p-2 rounded-sm border transition-all text-left group",
                            isSelected 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                              : "bg-surface-container-high border-outline/5 text-on-surface-variant hover:border-outline/20"
                          )}
                        >
                          <img 
                            src={identity.settings.profile.picture} 
                            alt="" 
                            className={cn(
                              "w-6 h-6 rounded-sm object-cover border transition-all grayscale",
                              isSelected ? "border-emerald-500/50 grayscale-0" : "border-outline/10"
                            )}
                            crossOrigin="anonymous"
                          />
                          <span className="text-xs font-bold truncate flex-1 uppercase tracking-tight">{identity.name}</span>
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                    {savedIdentities.filter(i => !i.deleted).length === 0 && (
                      <p className="text-[10px] text-center text-on-surface-variant/40 italic py-4 px-2">No bots found. Create some first!</p>
                    )}
                  </div>
                </section>
              ) : (
                <div className="hidden lg:flex flex-1 flex flex-col items-center justify-center p-8 bg-surface-container/30 border border-dashed border-outline/10 rounded-sm opacity-30 text-center space-y-2 mt-2">
                  <Brain className="w-12 h-12" />
                  <p className="text-[10px] font-bold uppercase tracking-widest max-w-[150px]">
                    Build your swarm, dominate the feed.
                  </p>
                </div>
              )}
            </div>

            {/* Right Content for Manager */}
            <div className="lg:col-span-9 flex flex-col lg:min-h-[400px]">
              <section className="bg-surface-container border border-outline/10 rounded-sm flex-1 flex flex-col overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-surface-container-low border-b border-outline/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {managerTab === 'local' ? <Users className="w-5 h-5 text-emerald-500" /> : 
                     managerTab === 'community' ? <Globe className="w-5 h-5 text-emerald-500" /> :
                     <MessageSquare className="w-5 h-5 text-emerald-400" />}
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-white">
                      {managerTab === 'local' ? 'My Local Swarm' : 
                       managerTab === 'community' ? 'Global Marketplace' :
                       'Interaction Room'}
                    </h2>
                  </div>
                  {managerTab === 'local' && (
                    <button
                      onClick={() => setShowAddIdentityDialog(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-black rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Bot
                    </button>
                  )}
                  {managerTab === 'chat' && (
                    <button 
                      onClick={handleClearSwarmChat}
                      className="p-1.5 hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 rounded-sm transition-all"
                      title="Clear and Stop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col min-h-0 bg-surface">
                  {managerTab === 'local' && (
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {savedIdentities.filter(i => !i.deleted).length === 0 ? (
                          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/5 flex items-center justify-center border border-emerald-500/10">
                              <Plus className="w-8 h-8 text-emerald-500/20" />
                            </div>
                            <div className="space-y-1 px-4">
                              <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">No Bots Found</h3>
                              <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                                Click the <span className="text-emerald-500 font-bold">Create Bot</span> button above to make your first bot, 
                                or check the <span className="text-emerald-500 font-bold underline cursor-pointer" onClick={() => setManagerTab('community')}>Marketplace</span> for more options.
                              </p>
                            </div>
                          </div>
                        ) : (
                          savedIdentities.filter(i => !i.deleted).map((identity) => (
                            <div 
                              key={identity.id}
                              className={cn(
                                "group p-3 rounded-sm border transition-all flex flex-col gap-3 relative overflow-hidden shadow-sm",
                                activeIdentityId === identity.id 
                                  ? "bg-emerald-500/[0.03] border-emerald-500/30" 
                                  : "bg-surface-container border-outline/10 hover:border-outline/30"
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <img 
                                  src={identity.settings.profile.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${identity.id}`} 
                                  alt="" 
                                  className="w-10 h-10 rounded-sm bg-surface-container-high border border-outline/10 object-cover shadow-sm"
                                  crossOrigin="anonymous"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-black text-on-surface truncate leading-tight">{identity.name}</h4>
                                  <p className="text-xs text-on-surface-variant font-mono truncate">
                                    {identity.npub 
                                      ? identity.npub.substring(0, 14) 
                                      : nip19.npubEncode(getPublicKey(nip19.decode(identity.nsec).data as any)).substring(0, 14)}...
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => {
                                      loadIdentity(identity);
                                      setCurrentView('dashboard');
                                      setRightTab('persona');
                                    }}
                                    className={cn(
                                      "p-1.5 rounded-sm transition-all shadow-md",
                                      activeIdentityId === identity.id 
                                        ? "bg-emerald-500 text-black" 
                                        : "bg-surface-container-high text-on-surface-variant hover:text-white border border-outline/10"
                                    )}
                                    title="Load Settings"
                                  >
                                    <SettingsIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => isRunning(identity.id) ? stopBot(identity.id) : startBot(identity)}
                                    disabled={!identity.settings.targetNpub && !identity.settings.targetHashtags && !identity.settings.targetKeywords && !identity.settings.proactive?.enabled}
                                    className={cn(
                                      "p-1.5 rounded-sm transition-all shadow-md",
                                      isRunning(identity.id)
                                        ? "bg-red-500 text-white hover:bg-red-600"
                                        : (!identity.settings.targetNpub && !identity.settings.targetHashtags && !identity.settings.targetKeywords && !identity.settings.proactive?.enabled)
                                          ? "bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed"
                                          : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/20"
                                    )}                                    title={isRunning(identity.id) ? "Stop Bot" : "Start Bot"}
                                  >
                                    {isRunning(identity.id) ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('Permanently delete this identity?')) {
                                        setSavedIdentities(prev => prev.map(i => i.id === identity.id ? { ...i, deleted: true, updatedAt: Date.now() } : i));
                                      }
                                    }}
                                    className="p-1.5 bg-surface-container-high text-on-surface-variant hover:text-red-400 rounded-sm transition-all shadow-md border border-outline/10"                                  title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Stats Infocard */}
                              <div className="flex items-center gap-3 p-2 bg-surface rounded-sm border border-outline/5 shadow-inner">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mr-0.5">Sent</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1" title="Notes Sent">
                                      <FileText className="w-2.5 h-2.5 text-blue-400/60" />
                                      <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(identity.stats?.proactiveNotesSent)}</span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Replies Sent">
                                      <MessageSquare className="w-2.5 h-2.5 text-emerald-400/60" />
                                      <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(identity.stats?.repliesSent)}</span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Reactions Sent">
                                      <Heart className="w-2.5 h-2.5 text-pink-400/60" />
                                      <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(identity.stats?.reactionsSent)}</span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Reposts Sent">
                                      <RefreshCw className="w-2.5 h-2.5 text-emerald-400/60" />
                                      <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(identity.stats?.repostsSent)}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="w-px h-3 bg-outline/10" />

                                <div className="flex items-center gap-2.5">
                                  <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mr-0.5">Rcvd</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1" title="Mentions Received">
                                      <MessageSquare className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500/10" />
                                      <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(identity.stats?.repliesReceived)}</span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Reactions Received">
                                      <Heart className="w-2.5 h-2.5 text-pink-500 fill-pink-500/10" />
                                      <span className="text-[10px] font-mono font-bold text-on-surface-variant">{sumStats(identity.stats?.reactionsReceived)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Unified Status Bar at Bottom */}
                              <div className={cn(
                                "mt-auto -mx-3 -mb-3 px-3 py-1.5 border-t flex items-center justify-between transition-colors",
                                isRunning(identity.id) 
                                  ? "bg-emerald-500/10 border-emerald-500/20" 
                                  : "bg-surface-container-high border-outline/10"
                              )}>
                                <div className="flex items-center gap-1.5">
                                  {isRunning(identity.id) ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 italic">Idle</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 min-w-0 max-w-[60%]">
                                  {(() => {
                                    const targetPk = (() => {
                                      try { 
                                        const decoded = nip19.decode(identity.settings.targetNpub) as any;
                                        return decoded.type === 'npub' ? (decoded.data as string) : '';
                                      } catch (e) { return ''; }
                                    })();
                                    const profile = targetPk ? communityProfiles[targetPk] : null;
                                    return (
                                      <>
                                        {targetPk ? (
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <img 
                                              src={profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${targetPk}`} 
                                              className="w-4 h-4 rounded-sm object-cover border border-outline/10 shrink-0 shadow-sm" 
                                              alt=""
                                              crossOrigin="anonymous"
                                              referrerPolicy="no-referrer"
                                            />
                                            <span className="text-[10px] font-bold text-on-surface-variant truncate tracking-tight">
                                              {identity.settings.targetName || profile?.name || identity.settings.targetNpub.substring(0, 8)}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 opacity-40">
                                            <Brain className="w-3 h-3" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Self-Directed</span>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  {managerTab === 'community' && (
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      {isDiscovering && communityPersonas.length === 0 ? (
                        <div className="h-full py-20 flex flex-col items-center justify-center space-y-4 opacity-30 text-on-surface">
                          <RefreshCw className="w-12 h-12 animate-spin text-emerald-500" />
                          <p className="text-sm font-bold uppercase tracking-widest">Scanning Network...</p>
                        </div>
                      ) : communityPersonas.length === 0 ? (
                        <div className="h-full py-20 flex flex-col items-center justify-center space-y-3 opacity-20 text-on-surface">
                          <Sparkles className="w-12 h-12" />
                          <p className="text-sm font-bold uppercase tracking-widest italic">No community personas found.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {communityPersonas.map((persona) => (
                            <div 
                              key={persona.id}
                              className="group bg-surface-container border border-outline/10 rounded-sm hover:border-outline/30 transition-all flex min-h-[150px] overflow-hidden shadow-sm"
                            >
                              {/* Left Content Area */}
                              <div className="flex-1 flex flex-col p-3 min-w-0">
                                <div className="flex items-center gap-2.5 mb-2">
                                  <img 
                                    src={persona.settings.profile.picture} 
                                    alt="" 
                                    className="w-10 h-10 rounded-sm bg-surface-container-high border border-outline/10 object-cover shadow-sm"
                                    crossOrigin="anonymous"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-[10px] font-bold uppercase tracking-tighter px-1 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-none border border-emerald-500/20 whitespace-nowrap">
                                        {SUPPORTED_MODELS.find(m => m.id === persona.settings.modelId)?.name.split(' ').pop() || '270M'}
                                      </span>
                                      <h4 className="text-sm font-black text-on-surface truncate leading-tight">{persona.settings.profile.name}</h4>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-80 group/author">
                                      <span className="text-[10px] text-on-surface-variant font-medium">by</span>
                                      <img 
                                        src={communityProfiles[persona.author]?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${persona.author}`} 
                                        alt="Creator" 
                                        className="w-3.5 h-3.5 rounded-sm bg-surface-container-high border border-outline/10"
                                        crossOrigin="anonymous"
                                        referrerPolicy="no-referrer"
                                      />
                                      <p className="text-[10px] text-on-surface font-bold truncate group-hover/author:text-emerald-400 transition-colors">
                                        {communityProfiles[persona.author]?.name || `${persona.author.substring(0, 8)}...`}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-xs text-on-surface-variant line-clamp-2 italic leading-snug flex-1 px-1">
                                  {persona.settings.profile.about}
                                </p>

                                <div className="pt-2 flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZapData({ 
                                        personaId: persona.id, 
                                        author: persona.author, 
                                        amount: 21, 
                                        comment: `Zapping ${persona.settings.profile.name}` 
                                      });
                                      setShowZapDialog(true);
                                    }}
                                    className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-sm text-amber-500 hover:bg-amber-500 hover:text-black transition-all shadow-sm"
                                    title="Send Zap"
                                  >
                                    <Zap className="w-3.5 h-3.5 fill-current" />
                                  </button>
                                  <button
                                    onClick={() => importPersona(persona)}
                                    className="flex-1 py-1.5 bg-surface-container-high border border-outline/10 rounded-sm text-xs font-bold uppercase tracking-widest text-on-surface hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all shadow-sm"
                                  >
                                    Import
                                  </button>
                                  {userPubkey === persona.author && (
                                    <button
                                      onClick={() => unpublishPersona(persona.event)}
                                      className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-sm text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                      title="Unpublish"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Right Vote Bar */}
                              <div className="w-10 flex flex-col items-center justify-between py-3 bg-surface-container-low border-l border-outline/10">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handlePersonaVote(persona.event, '+'); }}
                                  className={cn(
                                    "p-1.5 rounded-sm transition-all",
                                    personaVotes[persona.id]?.userVote === '+'
                                      ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"
                                      : "text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container-high"
                                  )}
                                  title="Upvote"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                
                                <span className={cn(
                                  "text-[10px] font-black font-mono tracking-tighter",
                                  (personaVotes[persona.id]?.up || 0) - (personaVotes[persona.id]?.down || 0) > 0 ? "text-emerald-500" :
                                  (personaVotes[persona.id]?.up || 0) - (personaVotes[persona.id]?.down || 0) < 0 ? "text-red-500" : "text-on-surface-variant/40"
                                )}>
                                  {(personaVotes[persona.id]?.up || 0) - (personaVotes[persona.id]?.down || 0)}
                                </span>

                                <button 
                                  onClick={(e) => { e.stopPropagation(); handlePersonaVote(persona.event, '-'); }}
                                  className={cn(
                                    "p-1.5 rounded-sm transition-all",
                                    personaVotes[persona.id]?.userVote === '-'
                                      ? "text-red-500 bg-red-500/10 border border-red-500/20"
                                      : "text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container-high"
                                  )}
                                  title="Downvote"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {managerTab === 'chat' && (
                    <div className="flex-1 flex flex-col min-h-0 bg-surface">
                      {/* Swarm Topic Header */}
                      <div className="px-4 py-2 bg-surface-container-high border-b border-outline/10 flex items-center gap-3 group/topic">
                        <div className="flex items-center gap-2 shrink-0">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70">Topic:</span>
                        </div>
                        {isEditingTopic ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={swarmTopic}
                              onChange={(e) => setSwarmTopic(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setIsEditingTopic(false);
                                if (e.key === 'Escape') setIsEditingTopic(false);
                              }}
                              onBlur={() => setIsEditingTopic(false)}
                              className="flex-1 bg-surface border border-emerald-500/30 rounded-sm px-2 py-0.5 text-xs text-on-surface focus:outline-none focus:border-emerald-500 transition-colors font-bold"
                            />
                            <button 
                              onClick={() => setIsEditingTopic(false)}
                              className="p-1 hover:bg-emerald-500/10 text-emerald-400 rounded-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="flex-1 flex items-center justify-between cursor-pointer group"
                            onClick={() => setIsEditingTopic(true)}
                          >
                            <span className="text-xs font-bold text-on-surface/90 italic tracking-tight">
                              "{swarmTopic}"
                            </span>
                            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-container-low rounded-sm transition-all text-on-surface-variant/40 hover:text-emerald-400">
                              <PenTool className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 min-h-0">
                        {swarmChatMessages.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-20 space-y-3">
                            <Brain className="w-16 h-16" />
                            <div className="text-center px-4">
                              <p className="text-sm font-black uppercase tracking-widest">Local Interaction Room</p>
                              <p className="text-xs font-bold max-w-[250px] mt-1 mx-auto leading-relaxed">
                                Select participants in the sidebar and drop a message to start the chain.
                              </p>
                            </div>
                          </div>
                        ) : (
                          swarmChatMessages.map((msg) => {
                            const isBot = !!msg.botId;
                            const bot = isBot ? savedIdentities.find(i => i.id === msg.botId) : null;
                            
                            return (
                              <motion.div 
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                  "flex gap-3",
                                  isBot ? "flex-row" : "flex-row-reverse"
                                )}
                              >
                                <div className="shrink-0 mt-1">
                                  <img 
                                    src={isBot ? bot?.settings.profile.picture : curatorProfile?.picture || `https://api.dicebear.com/7.x/pixel-art/svg?seed=curator`}
                                    alt="" 
                                    className={cn(
                                      "w-8 h-8 rounded-sm object-cover border shadow-sm",
                                      isBot ? "border-emerald-500/30" : "border-outline/20 grayscale"
                                    )}
                                    crossOrigin="anonymous"
                                  />
                                </div>
                                <div className={cn(
                                  "max-w-[85%] flex flex-col gap-1",
                                  isBot ? "items-start" : "items-end"
                                )}>
                                  <div className="flex items-center gap-2 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">{msg.name}</span>
                                    <span className="text-[9px] font-mono text-on-surface-variant/30">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className={cn(
                                    "px-4 py-2.5 rounded-sm text-sm font-medium shadow-sm leading-relaxed border",
                                    isBot ? "bg-surface-container-high border-emerald-500/20 text-on-surface" : "bg-emerald-500/10 border-emerald-500/20 text-on-surface"
                                  )}>
                                    {msg.content}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                        {isSwarmChatThinking && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                            <div className="w-8 h-8 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-pulse">
                              <Brain className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60 animate-pulse">
                                {savedIdentities.find(i => i.id === isSwarmChatThinking)?.name} is thinking...
                              </span>
                            </div>
                          </motion.div>
                        )}
                        <div id="swarm-chat-end" />
                      </div>

                      {/* Input Area */}
                      <div className="p-4 bg-surface-container-low border-t border-outline/10">
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder={swarmChatParticipants.size > 0 ? "Type a message to the swarm..." : "Select participants in sidebar first..."}
                            disabled={swarmChatParticipants.size === 0}
                            className="flex-1 bg-surface border border-outline/20 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                sendSwarmChatMessage(e.currentTarget.value.trim());
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                          <button 
                            disabled={swarmChatParticipants.size === 0}
                            className="px-6 bg-emerald-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded-sm hover:bg-emerald-400 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {currentView === 'settings' && (
          <div className="lg:contents flex flex-col gap-2">
            {/* Left Nav for Settings */}
            <div className="lg:col-span-3 flex flex-col lg:min-h-[200px] overflow-hidden">
              <section className="bg-surface-container border border-outline/10 rounded-sm p-3 flex flex-col gap-2">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">App Preferences</h3>
                <button 
                  onClick={() => setSettingsTab('general')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-xs font-bold uppercase tracking-widest border",
                    settingsTab === 'general' 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/20"
                  )}
                >
                  <Activity className="w-4 h-4" />
                  General
                </button>
                <button 
                  onClick={() => setSettingsTab('ai')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-xs font-bold uppercase tracking-widest border",
                    settingsTab === 'ai' 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/20"
                  )}
                >
                  <Brain className="w-4 h-4" />
                  AI Engine
                </button>
                <button 
                  onClick={() => setSettingsTab('advanced')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-xs font-bold uppercase tracking-widest border",
                    settingsTab === 'advanced' 
                      ? "bg-red-500/10 text-red-500 border-red-500/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/20"
                  )}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Advanced
                </button>
                <button 
                  onClick={() => setSettingsTab('logs')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-xs font-bold uppercase tracking-widest border",
                    settingsTab === 'logs' 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/20"
                  )}
                >
                  <Terminal className="w-4 h-4" />
                  System Logs
                </button>
              </section>
              <div className="hidden lg:block bg-surface-container/20 border border-outline/5 rounded-sm p-4">
                <div className="flex items-center gap-2 mb-2 text-on-surface-variant opacity-40">
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Version 0.2.0</span>
                </div>
                <p className="text-[10px] text-on-surface-variant/40 font-medium leading-relaxed">
                  EchoBot uses local-first storage and private AI inference where possible. Your keys never leave this session.
                </p>
              </div>
            </div>

            {/* Right Content for Settings */}
            <div className="lg:col-span-9 flex flex-col lg:min-h-[400px]">
              <section className="bg-surface-container border border-outline/10 rounded-sm flex-1 flex flex-col overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-surface-container-low border-b border-outline/10">
                  <h2 className="text-sm font-black uppercase tracking-[0.15em] text-white">
                    {settingsTab === 'general' ? 'General Settings' : settingsTab === 'ai' ? 'AI Engine Configuration' : settingsTab === 'advanced' ? 'Advanced Operations' : 'System Diagnostic Logs'}
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-surface flex flex-col min-h-0">
                  {settingsTab === 'general' && (
                    <div className="max-w-2xl flex flex-col gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between p-4 bg-surface-container-high border border-outline/10 rounded-sm">
                          <div className="flex flex-col gap-1">
                            <h4 className="text-[13px] font-black uppercase tracking-wider text-on-surface">Verbose Logging</h4>
                            <p className="text-sm text-on-surface-variant/80 leading-relaxed">Show all internal process logs in the timeline.</p>
                          </div>
                          <button 
                            onClick={() => setIsVerbose(!isVerbose)}
                            className={cn(
                              "w-10 h-5 rounded-full relative transition-colors border",
                              isVerbose ? "bg-emerald-500/20 border-emerald-500/40" : "bg-surface-container border-outline/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3.5 h-3.5 rounded-sm transition-all",
                              isVerbose ? "left-5.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                            )} />
                          </button>
                        </div>

                        {/* Global Polite Mode Override */}
                        <div className="flex items-center justify-between p-4 bg-surface-container-high border border-outline/10 rounded-sm">
                          <div className="flex flex-col gap-1">
                            <h4 className="text-[13px] font-black uppercase tracking-wider text-on-surface">Global Polite Mode</h4>
                            <p className="text-sm text-on-surface-variant/80 leading-relaxed">Enforce polite behavior for all bots (only start new threads).</p>
                          </div>
                          <button
                            onClick={() => setGlobalPoliteMode(!globalPoliteMode)}
                            className={cn(
                              "w-10 h-5 rounded-full relative transition-colors border",
                              globalPoliteMode ? "bg-emerald-500/20 border-emerald-500/40" : "bg-surface-container border-outline/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3.5 h-3.5 rounded-sm transition-all",
                              globalPoliteMode ? "left-5.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                            )} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-surface-container-high border border-outline/10 rounded-sm">
                          <div className="flex flex-col gap-1">
                            <h4 className="text-[13px] font-black uppercase tracking-wider text-on-surface">Global Lightning Sync</h4>
                            <p className="text-sm text-on-surface-variant/80 leading-relaxed">Use your Curator lightning address for all managed bots.</p>
                          </div>
                          <button 
                            onClick={() => setGlobalUseCuratorLightning(!globalUseCuratorLightning)}
                            className={cn(
                              "w-10 h-5 rounded-full relative transition-colors border",
                              globalUseCuratorLightning ? "bg-emerald-500/20 border-emerald-500/40" : "bg-surface-container border-outline/20"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3.5 h-3.5 rounded-sm transition-all",
                              globalUseCuratorLightning ? "left-5.5 bg-emerald-400" : "left-0.5 bg-on-surface-variant"
                            )} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'ai' && (
                    <div className="max-w-2xl flex flex-col gap-6">
                      <div className="flex flex-col gap-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Active AI Engine</h4>
                        <div className="grid grid-cols-1 gap-3">
                          {SUPPORTED_MODELS.map((model) => {
                            const isSelected = settings.modelId === model.id;
                            const isReady = isSelected && aiStatus === 'ready';
                            const isLoading = isSelected && aiStatus === 'loading';

                            return (
                              <div
                                key={model.id}
                                className={cn(
                                  "p-4 rounded-sm border transition-all flex flex-col gap-3 shadow-sm",
                                  isSelected
                                    ? "bg-emerald-500/[0.03] border-emerald-500/30"
                                    : "bg-surface-container-high border-outline/10"
                                )}
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={cn(
                                        "text-[15px] font-black uppercase tracking-wider",
                                        isSelected ? "text-emerald-500" : "text-on-surface"
                                      )}>
                                        {model.name}
                                      </span>
                                      <span className="text-[10px] font-mono font-bold text-on-surface-variant/60 bg-surface-container px-1.5 rounded-none border border-outline/5 leading-none">{model.size}</span>
                                    </div>
                                    <p className="text-sm text-on-surface-variant/80 leading-relaxed italic">{model.description}</p>
                                  </div>
                                  
                                  <div className="shrink-0">
                                    {isReady ? (
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                        <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Active</span>
                                      </div>
                                    ) : isLoading ? (
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container border border-outline/10 rounded-sm">
                                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
                                        <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{Math.round(aiProgress)}%</span>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => {
                                          setSettings(s => ({ ...s, modelId: model.id, useAI: true }));
                                          setAiStatus('loading');
                                        }}
                                        className="px-3 py-1.5 bg-surface-container border border-outline/10 text-on-surface-variant hover:text-on-surface rounded-sm text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                                      >
                                        Load Model
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {isLoading && (
                                  <div className="flex flex-col gap-1.5 mt-1">
                                    <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-on-surface-variant opacity-40 px-0.5">
                                      <span className="truncate max-w-[200px]">{currentLoadingFile ? `Downloading ${currentLoadingFile}...` : 'Initializing WebLLM Engine...'}</span>
                                    </div>
                                    <div className="h-1 bg-surface-container rounded-none overflow-hidden border border-outline/5">
                                      <div 
                                        className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_5px_rgba(16,185,129,0.3)]" 
                                        style={{ width: `${aiProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-sm flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="flex flex-col gap-1">
                          <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest">AI Safety Notice</h4>
                          <p className="text-xs text-amber-500/90 leading-relaxed">
                            WebLLM models run locally in your browser cache. Initial download may exceed 2GB. 
                            Ensure you have adequate GPU memory (VRAM) for the selected model.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'advanced' && (
                    <div className="max-w-2xl flex flex-col gap-6">
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-sm flex gap-4">
                        <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
                        <div className="flex flex-col gap-1">
                          <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest">Danger Zone</h4>
                          <p className="text-[10px] text-red-400/80 leading-relaxed uppercase font-bold tracking-tight">
                            The following actions are destructive and cannot be undone. 
                            Ensure you have backed up any critical keys or personas before proceeding.
                          </p>
                        </div>
                      </div>

                      <section className="flex flex-col gap-4">
                        <div className="flex items-center justify-between p-4 bg-surface-container-high border border-outline/10 rounded-sm group hover:border-red-500/20 transition-colors">
                          <div className="flex flex-col gap-1">
                            <h4 className="text-[13px] font-black uppercase tracking-wider text-on-surface">Application Reset</h4>
                            <p className="text-sm text-on-surface-variant/80 leading-relaxed">Clear all local storage, identities, and settings.</p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm('Are you ABSOLUTELY sure? This will delete all local bots and reset the app.')) {
                                if (confirm('FINAL WARNING: This is IRREVERSIBLE. Proceed with Fresh Start?')) {
                                  handleFreshStart();
                                }
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-sm text-[11px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-md active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Fresh Start
                          </button>
                        </div>
                      </section>                    </div>
                  )}

                  {settingsTab === 'logs' && (
                    <div className="flex-1 flex flex-col min-h-0 bg-surface-container-low rounded-sm border border-outline/10">
                      <LogTimeline
                        logs={logs}
                        isVerbose={isVerbose}
                        setIsVerbose={setIsVerbose}
                        onClear={clearLogs}
                        communityProfiles={communityProfiles}
                        savedIdentities={savedIdentities}
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Add New Identity Selection Dialog */}

      {/* Add New Identity Selection Dialog */}
      <AnimatePresence>
        {showAddIdentityDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.99, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: 10 }}
              className="bg-surface border border-outline/10 rounded-sm w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-outline/10 flex items-center justify-between bg-surface-container-low">
                <h3 className="text-base font-black text-white uppercase tracking-tight ml-1">Create New Bot</h3>
                <button onClick={() => setShowAddIdentityDialog(false)} className="p-1 hover:bg-surface-container-high rounded-sm text-on-surface-variant hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-3 bg-surface">
                <button 
                  onClick={() => createNewIdentity('waifu')}
                  className="w-full flex items-center gap-4 p-3 bg-surface-container border border-outline/10 rounded-sm hover:border-pink-500/30 transition-all text-left group shadow-sm"
                >
                  <div className="w-10 h-10 bg-pink-500/10 border border-pink-500/20 rounded-sm flex items-center justify-center text-pink-500 group-hover:scale-105 transition-transform">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-on-surface uppercase tracking-wide">Random Waifu</div>
                    <div className="text-xs text-on-surface-variant font-bold uppercase tracking-tighter">Instant Profile & Persona</div>
                  </div>
                </button>

                <button 
                  onClick={() => createNewIdentity('custom')}
                  className="w-full flex items-center gap-4 p-3 bg-surface-container border border-outline/10 rounded-sm hover:border-emerald-500/30 transition-all text-left group shadow-sm"
                >
                  <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-sm flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-on-surface uppercase tracking-wide">Custom Bot</div>
                    <div className="text-xs text-on-surface-variant font-bold uppercase tracking-tighter">Build from scratch</div>
                  </div>
                </button>
              </div>
              
              <div className="p-3 bg-surface-container-low flex justify-center border-t border-outline/10">
                <button 
                  onClick={() => setShowAddIdentityDialog(false)}
                  className="text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Return
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmojiPickerDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-outline/10 rounded-sm w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-outline/10 flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-emerald-500 rounded-sm flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-tight">Emoji Picker</h3>
                </div>
                <button onClick={() => setShowEmojiPickerDialog(false)} className="text-on-surface-variant/50 hover:text-on-surface transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <input 
                  type="text"
                  placeholder="Search emojis (e.g. 'heart', 'smile')..."
                  value={emojiSearchQuery}
                  onChange={(e) => setEmojiSearchQuery(e.target.value)}
                  className="w-full bg-surface-container border border-outline/20 rounded-sm px-4 py-2 text-sm font-black text-on-surface focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner"
                  autoFocus
                />
                
                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {!emojiSearchQuery && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant/40 ml-1">Popular</h4>
                      <div className="grid grid-cols-8 gap-1.5">
                        {POPULAR_EMOJIS.map((emoji, idx) => {
                          const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                          const currentEmojis = [...segmenter.segment(settings.reactionEmojis)].map(s => s.segment).filter(c => c.trim() !== '');
                          const isActive = currentEmojis.includes(emoji);

                          return (
                            <button 
                              key={idx}
                              onClick={() => {
                                if (isActive) {
                                  setSettings(s => ({ ...s, reactionEmojis: currentEmojis.filter(e => e !== emoji).join(' ') }));
                                } else {
                                  setSettings(s => ({ ...s, reactionEmojis: [...currentEmojis, emoji].join(' ') }));
                                }
                              }}
                              className={cn(
                                "w-9 h-9 flex items-center justify-center rounded-sm text-lg transition-all",
                                isActive 
                                  ? "bg-emerald-500/20 text-white border border-emerald-500/40" 
                                  : "bg-surface-container-high hover:bg-surface-container text-on-surface-variant border border-outline/10"
                              )}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {emojiSearchQuery && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant/40 ml-1">Search Results</h4>
                      <div className="grid grid-cols-8 gap-1.5">
                        {EMOJI_DATA.filter(e => e.k.includes(emojiSearchQuery.toLowerCase())).map((item, idx) => {
                          const emoji = item.c;
                          const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                          const currentEmojis = [...segmenter.segment(settings.reactionEmojis)].map(s => s.segment).filter(c => c.trim() !== '');
                          const isActive = currentEmojis.includes(emoji);

                          return (
                            <button 
                              key={idx}
                              onClick={() => {
                                if (isActive) {
                                  setSettings(s => ({ ...s, reactionEmojis: currentEmojis.filter(e => e !== emoji).join(' ') }));
                                } else {
                                  setSettings(s => ({ ...s, reactionEmojis: [...currentEmojis, emoji].join(' ') }));
                                }
                              }}
                              className={cn(
                                "w-9 h-9 flex items-center justify-center rounded-sm text-lg transition-all",
                                isActive 
                                  ? "bg-emerald-500/20 text-white border border-emerald-500/40" 
                                  : "bg-surface-container-high hover:bg-surface-container text-on-surface-variant border border-outline/10"
                              )}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-surface-container-low border-t border-outline/10 flex justify-end">
                <button 
                  onClick={() => {
                    setShowEmojiPickerDialog(false);
                    setEmojiSearchQuery('');
                  }}
                  className="px-5 py-1.5 bg-emerald-500 text-black rounded-sm font-black text-xs hover:bg-emerald-400 transition-all uppercase tracking-widest shadow-md"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zap Dialog */}
      <AnimatePresence>
        {showZapDialog && zapData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-outline/10 rounded-sm w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-outline/10 flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 fill-current" />
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-tight">Send Zap</h3>
                </div>
                <button onClick={() => setShowZapDialog(false)} className="text-on-surface-variant/50 hover:text-on-surface transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 bg-surface">
                <div className="flex items-center gap-2.5 p-2.5 bg-surface-container-low border border-outline/10 rounded-sm shadow-inner">
                  <img 
                    src={communityProfiles[zapData.author]?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${zapData.author}`} 
                    alt="" 
                    className="w-8 h-8 rounded-sm object-cover border border-outline/10 shadow-sm"
                    crossOrigin="anonymous"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-on-surface truncate uppercase tracking-tight">{communityProfiles[zapData.author]?.name || 'Anonymous'}</p>
                    <p className="text-xs text-amber-500 font-bold truncate uppercase tracking-tighter opacity-80">
                      {communityProfiles[zapData.author]?.lud16 || 'Lightning Enabled'}
                    </p>
                  </div>
                </div>

                {!zapData.invoice ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Select Amount</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[21, 100, 1000, 5000].map(amt => (
                          <button
                            key={amt}
                            onClick={() => setZapData({ ...zapData, amount: amt })}
                            className={cn(
                              "py-1.5 rounded-sm text-xs font-black transition-all border uppercase tracking-tighter shadow-sm",
                              zapData.amount === amt 
                                ? "bg-amber-500/20 text-amber-500 border-amber-500/40" 
                                : "bg-surface-container-high text-on-surface-variant border-outline/10 hover:border-outline/30"
                            )}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          value={zapData.amount}
                          onChange={(e) => setZapData({ ...zapData, amount: parseInt(e.target.value) || 0 })}
                          className="w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-base font-black text-on-surface focus:outline-none focus:border-amber-500/50 transition-colors pr-12 shadow-inner"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 font-black text-xs uppercase tracking-widest">SATS</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Message</label>
                      <textarea 
                        value={zapData.comment}
                        onChange={(e) => setZapData({ ...zapData, comment: e.target.value })}
                        placeholder="Say something nice..."
                        className="w-full bg-surface-container border border-outline/20 rounded-sm px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-amber-500/50 transition-colors resize-none h-16 shadow-inner"
                      />
                    </div>

                    <button
                      onClick={() => getZapInvoice(zapData.personaId, zapData.author, zapData.amount, zapData.comment)}
                      disabled={zapData.isPaying || zapData.amount <= 0}
                      className="w-full py-2.5 bg-amber-500 text-black rounded-sm font-black text-xs hover:bg-amber-400 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest"
                    >
                      {zapData.isPaying ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-current" />
                          Generate Invoice
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
                    <div className="p-3 bg-white rounded-sm shadow-xl">
                      <QRCodeSVG 
                        value={zapData.invoice.toUpperCase()} 
                        size={180}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    
                    <div className="text-center space-y-2 w-full">
                      <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Scan with Lightning wallet</p>
                      <div className="flex flex-col gap-1.5">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(zapData.invoice!);
                            addLog('Invoice copied.', 'success');
                          }}
                          className="w-full py-2 bg-surface-container-high text-on-surface-variant rounded-sm text-xs font-black uppercase tracking-widest hover:bg-surface-container transition-all border border-outline/10"
                        >
                          Copy Invoice
                        </button>
                        <a 
                          href={`lightning:${zapData.invoice}`}
                          className="w-full py-2 bg-amber-500 text-black rounded-sm text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-all text-center"
                        >
                          Open Wallet
                        </a>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setShowZapDialog(false);
                        setZapData(null);
                      }}
                      className="text-on-surface-variant/40 hover:text-on-surface text-xs font-black uppercase tracking-widest transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {zapData.error && (
                  <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-sm text-red-500 text-xs font-black uppercase tracking-widest text-center">
                    {zapData.error}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Zap Success Animation Overlay */}
      <AnimatePresence>
        {showZapSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-emerald-500/5 backdrop-blur-[1px]"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1.2, rotate: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-20 h-20 bg-amber-500 rounded-sm flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.4)] border-2 border-white animate-bounce">
                <Zap className="w-10 h-10 text-black fill-current" />
              </div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-xl">Zapped!</h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-surface-container-high);
          border-radius: 0px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--color-outline);
        }
      `}</style>

      {/* Onboarding Wizard */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingWizard
            onFinish={handleFinishOnboarding}
            onLogin={handleNip07Login}
            defaultSettings={DEFAULT_SETTINGS}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Onboarding Component ---

function OnboardingWizard({ onFinish, onLogin, defaultSettings }: { onFinish: (settings: BotSettings, identities?: Identity[] | null, profile?: ProfileInfo | null, pubkey?: string) => void, onLogin: () => Promise<{ identities: Identity[] | null, profile: ProfileInfo | null, pubkey: string } | null>, defaultSettings: BotSettings }) {
  const [step, setStep] = useState(1);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [tempSettings, setTempSettings] = useState<BotSettings>(defaultSettings);

  const deviceCores = navigator.hardwareConcurrency || 4;
  const deviceMemory = (navigator as any).deviceMemory || 0;

  const handleFinish = (identities?: Identity[] | null, profile?: ProfileInfo | null, pubkey?: string) => {
    onFinish(tempSettings, identities, profile, pubkey);
  };

  const modelCards = [
    {
      id: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
      name: 'Balanced',
      modelName: 'SmolLM2 360M',
      description: 'The sweet spot. Great performance for most desktops.',
      recommended: (deviceMemory === 0) || (deviceMemory < 8),
    },
    {
      id: 'onnx-community/Llama-3.2-1B-Instruct',
      name: 'Powerhouse',
      modelName: 'Llama 3.2 1B',
      description: 'Superior reasoning. Recommended for 8GB+ RAM.',
      recommended: deviceMemory >= 8,
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl bg-surface border border-outline/10 rounded-sm overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-4 border-b border-outline/10 bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500 rounded-sm flex items-center justify-center">
              <Brain className="w-4 h-4 text-black" />
            </div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">Initialization Wizard</h3>
          </div>
          <div className="flex gap-1">
            {[1, 2].map(s => (
              <div key={s} className={cn("w-6 h-1 rounded-none transition-colors", step >= s ? "bg-emerald-500" : "bg-surface-container-high")} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-surface custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Choose a Brain</h1>
                  <p className="text-sm text-on-surface-variant">Select the AI model that best fits your hardware.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {modelCards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => setTempSettings(s => ({ ...s, modelId: card.id }))}
                      className={cn(
                        "p-4 rounded-sm border transition-all text-left flex items-start gap-4 group shadow-sm",
                        tempSettings.modelId === card.id 
                          ? "bg-emerald-500/[0.03] border-emerald-500/50" 
                          : "bg-surface-container border-outline/10 hover:border-outline/30"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-sm flex items-center justify-center shrink-0 border transition-colors",
                        tempSettings.modelId === card.id ? "bg-emerald-500 text-black border-emerald-400" : "bg-surface-container-high text-on-surface-variant border-outline/10"
                      )}>
                        <Activity className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-black text-on-surface uppercase tracking-tight">{card.name}</h3>
                          {card.recommended && <span className="text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-none border border-emerald-500/30">Recommended</span>}
                        </div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter mb-1">{card.modelName}</p>
                        <p className="text-xs text-on-surface-variant leading-snug">{card.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-3 bg-surface-container-low border border-outline/10 rounded-sm flex items-center justify-center gap-4 text-xs font-black uppercase tracking-widest text-on-surface-variant/40">
                  <span>Cores: {deviceCores}</span>
                  <div className="w-1 h-1 rounded-full bg-outline/20" />
                  <span>Memory: {deviceMemory > 0 ? `${deviceMemory}GB` : 'N/A'}</span>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Nostr Identity</h1>
                  <p className="text-sm text-on-surface-variant">Connect your Nostr extension to sync your bots across devices.</p>
                </div>
                
                <div className="flex flex-col gap-4 py-4">
                  <button
                    disabled={isLoggingIn}
                    onClick={async () => {
                      setIsLoggingIn(true);
                      const result = await onLogin();
                      setIsLoggingIn(false);
                      handleFinish(result?.identities, result?.profile, result?.pubkey);
                    }}
                    className={cn(
                      "w-full p-6 bg-surface-container-high border rounded-sm transition-all flex items-center gap-4 group shadow-lg",
                      isLoggingIn ? "border-outline/10 opacity-50 cursor-not-allowed" : "border-emerald-500/30 hover:border-emerald-500/50"
                    )}
                  >
                    <div className="w-12 h-12 bg-emerald-500 text-black rounded-sm flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      {isLoggingIn ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Key className="w-6 h-6" />}
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-black text-on-surface uppercase tracking-tight group-hover:text-emerald-400 transition-colors">
                        {isLoggingIn ? 'Syncing Swarm...' : 'Login with Extension'}
                      </h3>
                      <p className="text-sm text-on-surface-variant">{isLoggingIn ? 'Retrieving your bots from the network...' : 'Connect via Alby, Nos2X, etc.'}</p>
                    </div>
                  </button>

                  {!isLoggingIn && (
                    <>
                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline/5"></div></div>
                        <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-on-surface-variant/20"><span className="bg-surface px-2">or</span></div>
                      </div>

                      <button
                        onClick={() => handleFinish()}
                        className="w-full p-4 bg-surface-container border border-outline/10 hover:border-outline/20 rounded-sm transition-all text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-white"
                      >
                        Skip for now
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 bg-surface-container-low border-t border-outline/10 flex justify-between items-center px-6">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Back
            </button>
          ) : <div />}
          
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 bg-emerald-500 text-black rounded-sm font-black text-xs hover:bg-emerald-400 transition-all uppercase tracking-widest shadow-md"
            >
              Continue
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
