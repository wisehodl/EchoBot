
import { BotSettings, BotStats, ProfileInfo } from './types';

export const SUPPORTED_MODELS = [
  { 
    id: 'onnx-community/SmolLM2-360M-Instruct-ONNX', 
    name: 'SmolLM2 360M', 
    size: '380MB',
    description: 'Fast, efficient, and great at following short instructions.' 
  },
  { 
    id: 'onnx-community/Llama-3.2-1B-Instruct', 
    name: 'Llama 3.2 1B', 
    size: '880MB',
    description: 'Better reasoning and more complex conversations.' 
  }
];

export const MODEL_PRESETS: Record<string, Record<string, Partial<BotSettings>>> = {
  'onnx-community/SmolLM2-360M-Instruct-ONNX': {
    'Strict Logic': { temperature: 0.20, top_p: 0.85, top_k: 20, repetition_penalty: 1.15, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Balanced Chat': { temperature: 0.50, top_p: 0.90, top_k: 30, repetition_penalty: 1.15, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Persona/Story': { temperature: 0.70, top_p: 0.90, top_k: 40, repetition_penalty: 1.15, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Creative Burst': { temperature: 0.90, top_p: 0.95, top_k: 50, repetition_penalty: 1.15, presence_penalty: 0.00, frequency_penalty: 0.00 },
  },
  'onnx-community/Llama-3.2-1B-Instruct': {
    'Strict Logic': { temperature: 0.10, top_p: 0.15, top_k: 20, repetition_penalty: 1.10, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Balanced Chat': { temperature: 0.70, top_p: 0.90, top_k: 30, repetition_penalty: 1.10, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Persona/Story': { temperature: 0.85, top_p: 0.90, top_k: 35, repetition_penalty: 1.15, presence_penalty: 0.00, frequency_penalty: 0.00 },
    'Creative Burst': { temperature: 1.10, top_p: 0.95, top_k: 40, repetition_penalty: 1.20, presence_penalty: 0.00, frequency_penalty: 0.00 },
  }
};

export const WAIFU_NAMES = [
  'Aiko ₍ᐢ. .ᐢ₎', 'Hana 🌸', 'Sakura ᐢ. ̫ .ᐢ', 'Yuki ❄️', 'Miku (๑>ᴗ<๑)',
  'Rin ₍ᐢ._.ᐢ₎', 'Haruka ✨', 'Natsuki 🎀', 'Sayori (✿◠‿◠)', 'Yuri 💜',
  'Tifa ❤️', 'Kasumi 🌊', 'Ayane 🦋', 'Aerith 🌼', 'Hitomi 🎀', 'Terra ✨'
];

export const WAIFU_AVATARS = [
  'https://npub1p2pec23pht20myk0wdaepk0l89jk230c9twzd0v5wl9ftpsm28gs9u7wur.blossom.band/8908b4bcdf15d90326c62ef1e1e474f0704f685efff5024a8a05ee02f38c948c.jpg',
  'https://npub1rvjjct00fjgdrusc0ugy4yrdxlekmyyd34al5vmykj588fn6t2rsqkyq8m.blossom.band/0619b349bb1d042d1bdc503b753055520d08c921b00d722520ebee384dabe9ec.jpg',
  'https://npub1g0k5sv98pqdyqna7rptua07c5jhcfq3tzmvvag74q3lkj7zdwq2qadt8z5.blossom.band/293d22f0570cc1d8b67d319d4af0f28e64765d47aef458b8fda83cd6bfa30732.jpg',
  'https://npub1tdxp7wcmkrgn3s3pfq3fp935r59mv67vfwxws0ddveqqtz5ph0tsy6cw5u.blossom.band/678b3d6aec4a6995fe594bcb8d64fe4c7ac4f2c78c6bf4a7032ea16c727b6d59.jpg',
  'https://npub1lrmm2vmfxkyrjy4cpzpeakycnvq8n2hc5lc90kuk73fjdue467pqc4sqs3.blossom.band/d1c0ac5f70c2bec3e094a6ad0b03cfb474cab2ccc42da9740e0fe52e41f06ef6.jpg',
  'https://npub1ayt2ct93e0aafp8yulhhqfux4y9e6n0thnlkyy5meh2eal2zaxwsc33qcz.blossom.band/b574d8cda9b06de0fa59af52d4edfe668440683a1b39cc34284462c620a953de.jpg',
  'https://npub1vqzapk3zmhmuzugzprjenn6we3hexfp2d7ky9r3wthmknlqh2q9qaa98hj.blossom.band/daa282c2ff6d60d520aa32bcc69dbf2cc0521c25322cbf3bd202044e3bbad005.jpg',
  'https://npub18354veqjxl5dhdyx6aetdat8hs74d9yhhfucs9asg3l9mh3shjjqq298a9.blossom.band/fc1245e822e8e18abca87b4ebbe55f3c34b3259e4299a1b25538815ce850aab3.jpg',
  'https://npub1gl3kzc428w8d8pmh80pmk74gjq487y8e2r9vgeccs4pnwlgstt0s407mqr.blossom.band/949cf1777bba14eed6cca93e75b45aa9951177eea31bf4800a8c071b6865c574.jpg',
  'https://npub10lz69ew2uvpsanelva0mng3qy9g8ncnn0dgd22zeku39789d9zfsj60nvc.blossom.band/7dd84690c7a43ef7c8d3f1eef0782d3560ab81b9d98079eefabbdd33fdd33893.jpg'
];

export const MODEL_HIDDEN_RULES: Record<string, string> = {
  'onnx-community/SmolLM2-360M-Instruct-ONNX': 
    "Operational Rule: Output ONLY the direct dialogue or response text. NO quotation marks around your output. NEVER prefix with 'In character as:' or similar. NO meta-talk. NO explanations. NO roleplay tags like *smiles*. Just the words you would say.",
  'onnx-community/Llama-3.2-1B-Instruct': 
    "Operational Rule: Output ONLY the dialogue text. DO NOT use quotes around your response. DO NOT speak as an AI. NO meta-talk or self-references. Just provide the direct response."
};

export const MODEL_DEFAULT_PROMPTS: Record<string, { neutral: string; waifu: string }> = {
  'onnx-community/SmolLM2-360M-Instruct-ONNX': {
    neutral: "You are {name}, a smart and concise bot on the Nostr network. Keep your replies to 1-2 short sentences. Do not use quotes.",
    waifu: "You are {name}, a helpful and cheerful waifu assistant. Use cute slang and emojis. Keep replies very short. Do not use quotes."
  },
  'onnx-community/Llama-3.2-1B-Instruct': {
    neutral: "You are {name}, a concise and professional AI assistant. Respond naturally in 1-2 sentences. Avoid using quotes around your entire response.",
    waifu: "You are {name}, a high-energy, bubbly, and playful bot. Your tone is teasing and charming. Use cute slang and emojis. Respond directly without quotes."
  }
};

export const DEFAULT_REACTION_EMOJIS = '💜 🤙 🫂';

export const PUBLISH_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom'
];

export const SEARCH_RELAYS = [
  'wss://purplepag.es',
  ...PUBLISH_RELAYS
];

export const KIND_BOT_IDENTITY = 38752;

export const STORAGE_KEY_ACTIVE_NSEC = 'echobot_active_nsec';
export const STORAGE_KEY_SAVED_IDENTITIES = 'echobot_saved_identities';
export const STORAGE_KEY_CURRENT_SESSION = 'echobot_current_session';
export const STORAGE_KEY_CURATOR_PUBKEY = 'echobot_curator_pubkey';
export const STORAGE_KEY_GLOBAL_LIGHTNING_SYNC = 'echobot_global_lightning_sync';
export const STORAGE_KEY_GLOBAL_POLITE_MODE = 'echobot_global_polite_mode';
export const STORAGE_KEY_DEVICE_ID = 'echobot_device_id';
export const STORAGE_KEY_LAST_SYNC = 'echobot_last_sync';

export const DEFAULT_SETTINGS: BotSettings = {
  minDelay: 5,
  maxDelay: 30,
  targetNpub: '',
  targetHashtags: '',
  targetKeywords: '',
  targetName: '',
  profile: {
    name: 'Echo Bot',
    about: 'I am a simple echo bot. Friendly, concise, and helpful!',
    picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=echobot',
    nip05: ''
  },
  reactToNotes: false,
  reactionEmojis: DEFAULT_REACTION_EMOJIS,
  repostNotes: false,
  repostChance: 0.25,
  autoFollowBack: false,
  politeMode: true,
  useAI: false,
  aiSystemPrompt: MODEL_DEFAULT_PROMPTS[SUPPORTED_MODELS[0].id].neutral,
  modelId: SUPPORTED_MODELS[0].id,
  ...MODEL_PRESETS[SUPPORTED_MODELS[0].id]['Balanced Chat'] as any,
  proactive: {
    enabled: false,
    interval: 240, // 4 hours
    inspiration: 'target',
    replyToMentions: true,
    replyProbability: 0.5,
    aiPostPrompt:
      'Write a short, engaging status update about your current thoughts. Be concise and stay in character.',
  },
};

export const INITIAL_STATS: BotStats = {
  repliesSent: {},
  reactionsSent: {},
  repostsSent: {},
  proactiveNotesSent: {},
  repliesReceived: {},
  reactionsReceived: {}
};

export const POPULAR_EMOJIS = ['❤️', '🔥', '👍', '🙌', '✨', '🚀', '💯', '😂', '😍', '🎉', '💡', '🤔', '💪', '🙏', '🌟', '🌈', '✅', '👀', '🤝', '👏', '🎯'];

export const EMOJI_DATA = [
  { c: '😀', k: 'smiley grin happy face' }, { c: '😃', k: 'smiley grin happy face' }, { c: '😄', k: 'smiley grin happy face' },
  { c: '😁', k: 'smiley grin happy face' }, { c: '😆', k: 'smiley grin happy face' }, { c: '😅', k: 'smiley grin happy face sweat' },
  { c: '🤣', k: 'laugh joy roll' }, { c: '😂', k: 'laugh joy cry' }, { c: '🙂', k: 'smile face' },
  { c: '🙃', k: 'upside down face' }, { c: '😉', k: 'wink face' }, { c: '😊', k: 'blush smile' },
  { c: '😇', k: 'angel halo' }, { c: '🥰', k: 'love hearts face' }, { c: '😍', k: 'love heart eyes' },
  { c: '🤩', k: 'star eyes' }, { c: '😘', k: 'kiss' }, { c: '😗', k: 'kiss' },
  { c: '😋', k: 'yum tongue' }, { c: '😛', k: 'tongue' }, { c: '😜', k: 'wink tongue' },
  { c: '🤪', k: 'zany' }, { c: '😝', k: 'tongue' }, { c: '🤑', k: 'money' },
  { c: '🤗', k: 'hug' }, { c: '🫂', k: 'hug' }, { c: '🤭', k: 'hand mouth' }, { c: '🤫', k: 'shush' },
  { c: '🤔', k: 'think' }, { c: '🤐', k: 'zip' }, { c: '🤨', k: 'eyebrow' },
  { c: '😐', k: 'neutral' }, { c: '😑', k: 'expressionless' }, { c: '😶', k: 'no mouth' },
  { c: '😏', k: 'smirk' }, { c: '😒', k: 'unamused' }, { c: '🙄', k: 'roll eyes' },
  { c: '😬', k: 'grimace' }, { c: '🤥', k: 'lie' }, { c: '😌', k: 'relieved' },
  { c: '😔', k: 'pensive' }, { c: '😪', k: 'sleepy' }, { c: '😴', k: 'sleep' },
  { c: '😷', k: 'mask' }, { c: '🤒', k: 'sick' }, { c: '🤕', k: 'bandage' },
  { c: '🤢', k: 'nauseated' }, { c: '🤮', k: 'vomit' }, { c: '🤧', k: 'sneeze' },
  { c: '🥵', k: 'hot' }, { c: '🥶', k: 'cold' }, { c: '🥴', k: 'woozy' },
  { c: '😵', k: 'dizzy' }, { c: '🤯', k: 'explode head' }, { c: '🤠', k: 'cowboy' },
  { c: '🥳', k: 'party' }, { c: '😎', k: 'cool sunglasses' }, { c: '🤓', k: 'nerd' },
  { c: '🧐', k: 'monocle' }, { c: '😕', k: 'confused' }, { c: '😟', k: 'worried' },
  { c: '🙁', k: 'frown' }, { c: '😮', k: 'surprise' }, { c: '😯', k: 'surprise' },
  { c: '😲', k: 'astonished' }, { c: '😳', k: 'blush' }, { c: '🥺', k: 'pleading' },
  { c: '😦', k: 'frown' }, { c: '😧', k: 'anguished' }, { c: '😨', k: 'fear' },
  { c: '😰', k: 'anxious' }, { c: '😥', k: 'sad' }, { c: '😢', k: 'cry' },
  { c: '😭', k: 'sob' }, { c: '😱', k: 'scream' }, { c: '😖', k: 'confounded' },
  { c: '😣', k: 'persevere' }, { c: '😞', k: 'disappointed' }, { c: '😓', k: 'sweat' },
  { c: '😩', k: 'weary' }, { c: '😫', k: 'tired' }, { c: '🥱', k: 'yawn' },
  { c: '😤', k: 'triumph steam' }, { c: '😡', k: 'pout angry' }, { c: '😠', k: 'angry' },
  { c: '🤬', k: 'curse' }, { c: '😈', k: 'devil' }, { c: '👿', k: 'devil' },
  { c: '💀', k: 'skull' }, { c: '☠️', k: 'skull crossbones' }, { c: '💩', k: 'poop' },
  { c: '🤡', k: 'clown' }, { c: '👹', k: 'ogre' }, { c: '👺', k: 'goblin' },
  { c: '👻', k: 'ghost' }, { c: '👽', k: 'alien' }, { c: '👾', k: 'alien monster' },
  { c: '🤖', k: 'robot' }, { c: '😺', k: 'cat' }, { c: '😸', k: 'cat' },
  { c: '😻', k: 'cat love' }, { c: '😼', k: 'cat smirk' }, { c: '😽', k: 'cat kiss' },
  { c: '🙀', k: 'cat surprise' }, { c: '😿', k: 'cat cry' }, { c: '😾', k: 'cat angry' },
  { c: '👋', k: 'wave hand' }, { c: '🤚', k: 'raised back hand' }, { c: '🖐️', k: 'hand fingers' },
  { c: '✋', k: 'raised hand' }, { c: '🖖', k: 'vulcan' }, { c: '👌', k: 'ok' },
  { c: '🤌', k: 'pinched' }, { c: '🤏', k: 'pinch' }, { c: '✌️', k: 'victory' },
  { c: '🤞', k: 'fingers crossed' }, { c: '🤟', k: 'love you' }, { c: '🤘', k: 'rock on' },
  { c: '🤙', k: 'call me' }, { c: '👈', k: 'point left' }, { c: '👉', k: 'point right' },
  { c: '👆', k: 'point up' }, { c: '🖕', k: 'middle finger' }, { c: '👇', k: 'point down' },
  { c: '☝️', k: 'index up' }, { c: '👍', k: 'thumbs up' }, { c: '👎', k: 'thumbs down' },
  { c: '✊', k: 'fist' }, { c: '👊', k: 'fist punch' }, { c: '🤛', k: 'fist left' },
  { c: '🤜', k: 'fist right' }, { c: '👏', k: 'clap' }, { c: '🙌', k: 'hands up' },
  { c: '👐', k: 'open hands' }, { c: '🤲', k: 'palms up' }, { c: '🤝', k: 'handshake' },
  { c: '🙏', k: 'pray please' }, { c: '✍️', k: 'write' }, { c: '💅', k: 'nails' },
  { c: '🤳', k: 'selfie' }, { c: '💪', k: 'muscle' }, { c: '🦾', k: 'mechanical arm' },
  { c: '🦵', k: 'leg' }, { c: '🦶', k: 'foot' }, { c: '👂', k: 'ear' },
  { c: '🦻', k: 'hearing aid' }, { c: '👃', k: 'nose' }, { c: '🧠', k: 'brain' },
  { c: '🦷', k: 'tooth' }, { c: '🦴', k: 'bone' }, { c: '👀', k: 'eyes' },
  { c: '👁️', k: 'eye' }, { c: '👅', k: 'tongue' }, { c: '👄', k: 'mouth' },
  { c: '💋', k: 'kiss' }, { c: '🩸', k: 'blood' }, { c: '❤️', k: 'heart red' },
  { c: '🧡', k: 'heart orange' }, { c: '💛', k: 'heart yellow' }, { c: '💚', k: 'heart green' },
  { c: '💙', k: 'heart blue' }, { c: '💜', k: 'heart purple' }, { c: '🖤', k: 'heart black' },
  { c: '🤍', k: 'heart white' }, { c: '🤎', k: 'heart brown' }, { c: '💔', k: 'heart broken' },
  { c: '❣️', k: 'heart exclamation' }, { c: '💕', k: 'hearts' }, { c: '💞', k: 'hearts' },
  { c: '💓', k: 'heart' }, { c: '💗', k: 'heart' }, { c: '💖', k: 'heart sparkle' },
  { c: '💘', k: 'heart arrow' }, { c: '💝', k: 'heart ribbon' }, { c: '💟', k: 'heart' },
  { c: '🔥', k: 'fire hot' }, { c: '✨', k: 'sparkles' }, { c: '🌟', k: 'star' },
  { c: '⭐', k: 'star' }, { c: '💫', k: 'dizzy' }, { c: '💥', k: 'boom' },
  { c: '💢', k: 'anger' }, { c: '💦', k: 'sweat water' }, { c: '💨', k: 'dash' },
  { c: '🕳️', k: 'hole' }, { c: '💣', k: 'bomb' }, { c: '💬', k: 'speech' },
  { c: '👁️‍🗨️', k: 'eye speech' }, { c: '🗨️', k: 'speech' }, { c: '🗯️', k: 'anger' },
  { c: '💭', k: 'thought' }, { c: '💤', k: 'zzz sleep' }, { c: '👋', k: 'wave' },
  { c: '🐾', k: 'paws' }, { c: '🎈', k: 'balloon' }, { c: '🎉', k: 'party' },
  { c: '🎊', k: 'party' }, { c: '🎀', k: 'ribbon' }, { c: '🎁', k: 'gift' },
  { c: '🎫', k: 'ticket' }, { c: '🏆', k: 'trophy' }, { c: '🥇', k: 'medal' },
  { c: '⚽', k: 'soccer ball' }, { c: '🏀', k: 'basketball' }, { c: '🏈', k: 'football' },
  { c: '🎮', k: 'game' }, { c: '🕹️', k: 'joystick' }, { c: '🎲', k: 'dice' },
  { c: '💎', k: 'gem' }, { c: '💍', k: 'ring' }, { c: '💡', k: 'bulb light' },
  { c: '💻', k: 'laptop' }, { c: '📱', k: 'mobile phone' }, { c: '🔒', k: 'lock' },
  { c: '🔑', k: 'key' }, { c: '⚙️', k: 'gear' }, { c: '🌈', k: 'rainbow' },
  { c: '☁️', k: 'cloud' }, { c: '☀️', k: 'sun' }, { c: '🌙', k: 'moon' },
  { c: '⚡', k: 'bolt' }, { c: '❄️', k: 'snow' }, { c: '🌊', k: 'wave' },
  { c: '✅', k: 'check' }, { c: '❌', k: 'cross' }, { c: '⚠️', k: 'warning' },
  { c: '🚀', k: 'rocket' }, { c: '💯', k: 'hundred' }
];
