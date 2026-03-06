/**
 * LogData.ts — Log type definitions, English templates, category colors.
 * Mirrors Log.lua tTypes and MainGame_enUS.lua linecodes (lines 2309+).
 * 89 log type keys with ~600 template strings.
 */

// ── Category types ─────────────────────────────────────────────────

export type LogCategory =
  | 'generic' | 'social' | 'duty' | 'health' | 'combat'
  | 'death' | 'food' | 'morale' | 'sleep' | 'activity'
  | 'disaster' | 'brig' | 'monster';

export interface LogLine {
  sLine: string;
  tTags?: string[];
}

export interface LogTypeDef {
  category: LogCategory;
  lines: LogLine[];
  priority?: number; // defaults to 0
}

// ── Category colors (for inspector panel left border) ──────────────

export const LOG_CATEGORY_COLORS: Record<LogCategory, string> = {
  generic: '#888',
  social: '#4af',
  duty: '#dfa200',
  health: '#f44',
  combat: '#f84',
  death: '#f00',
  food: '#8f4',
  morale: '#ff0',
  sleep: '#88f',
  activity: '#4f4',
  disaster: '#f44',
  brig: '#f80',
  monster: '#a44',
};

// ── All 89 log types ───────────────────────────────────────────────

export const LOG_TYPES: Record<string, LogTypeDef> = {
  // ═══════════════════════════════════════════════════════════════════
  // GENERIC (priority 0) — 60 lines
  // ═══════════════════════════════════════════════════════════════════
  GENERIC: {
    category: 'generic',
    priority: 0,
    lines: [
      { sLine: 'These pants are much more comfortable than they look.' },
      { sLine: 'I may have ordered too many business cards.' },
      { sLine: 'Am I too obsessive about tracking calories? How many calories are in Space Lip Balm?', tTags: ['insecure'] },
      { sLine: "I'm the one who started the petition." },
      { sLine: 'Finally listening to the new /RANDOMBAND/. Opinions divided, but better than the first album.' },
      { sLine: 'Had the dream about the spiders again.', tTags: ['anxious'] },
      { sLine: 'My mom emailed me. Emailed! How quaint.' },
      { sLine: "I try to impress crewmates by saying my hand's cybernetic. It's just a normal hand though." },
      { sLine: "There's a petition going around to change this base's pet policy." },
      { sLine: 'I miss /RANDOMPROVENANCE/ coffee.', tTags: ['sentimental'] },
      { sLine: "I honestly didn't mean to use up all the hot water." },
      { sLine: 'I seem to have misplaced my hot sauce. Again.' },
      { sLine: "Don't tell a crewmate they resemble your ex. Even if they do. Trust me." },
      { sLine: 'This is my last clean pair of pants.', tTags: ['neat'] },
      { sLine: "I'm still not really sure what I'm doing here.", tTags: ['insecure', 'sad'] },
      { sLine: 'I think someone threw out my scrap of paper with all my pass codes.' },
      { sLine: "I've narrowed down the list of suspects who may be responsible for the bathroom incident.", tTags: ['neat'] },
      { sLine: 'The opposite of reverse psychology is psychology, right? I mainly get what I want that way.', tTags: ['egoist'] },
      { sLine: "People say they like my new look, so I'm not saying it was the result of a lab accident.", tTags: ['happy', 'scientist'] },
      { sLine: 'I think the snow cone maker is offline because parts of it were used to fix the recyclers.', tTags: ['technician'] },
      { sLine: 'Anyone else hear that? Weird noise coming from this one part of the base...', tTags: ['anxious'] },
      { sLine: 'Are the planets livable again yet? I hate that we have to live in these boxes out in space.', tTags: ['sad'] },
      { sLine: 'I can just barely remember living on a planet. I remember the sky.', tTags: ['sentimental'] },
      { sLine: 'This place is just terrible for dating. Hoping that will change soon.', tTags: ['lonely', 'sad'] },
      { sLine: 'I wanted to be an explorer when I grew up. I kinda got my wish?' },
      { sLine: 'I sure hope the Administrator knows what they\'re doing. Has anyone even seen them, like, in person?', tTags: ['anxious'] },
      { sLine: "When was the last time a trader visited? I'm tired of this old junk." },
      { sLine: 'People used to have to use something called "shoe laces" to keep their shoes on their feet. Ha!' },
      { sLine: 'I joined this base back when it was cool.', tTags: ['hipster'] },
      { sLine: 'I know their title is "Administrator", but I like calling them "Captain". Like in all the old books and vids.', tTags: ['sentimental'] },
      { sLine: 'For a while, the only songs people wrote were about the Collapse. Booo-ring.' },
      { sLine: 'Recently a Jojoban told me the story of Grand Reunification. Gives me hope us Terrans might be able to get it together someday.', tTags: ['g_human', 'n_xenophobe'] },
      { sLine: "Having the females and males of a species commingle seems to cause a lot of social anxiety, but they also seem to enjoy it? It's honestly fascinating.", tTags: ['g_jelly'] },
      { sLine: 'A Terran explained sexual reproduction to me today. Disgusting.', tTags: ['g_shamon', 'g_tobian', 'xenophobe'] },
      { sLine: 'A Terran explained sexual reproduction to me today. Sounds... massively inconvenient?', tTags: ['g_shamon', 'g_tobian'] },
      { sLine: "I'll be honest, it creeps me out when I see people eating Terran food-chickens. It's like they're eating a tiny version of me.", tTags: ['g_chicken'] },
      { sLine: "Don't even ask how I deal with watching people eat food-chickens. Best just to keep a good sense of humor about it.", tTags: ['g_chicken'] },
      { sLine: 'People ask me what it\'s like being outcast from my Clan. Not sure how to explain it in their words. I usually go quiet.', tTags: ['g_cat'] },
      { sLine: 'I often feel like punching something. Does that make me a bad person? If you say yes, I\'ll punch you.', tTags: ['angry'] },
      { sLine: "I got in that Seed Pod thinking I'd be some kind of hero out here in space. Turns out I'm just another breather.", tTags: ['brave'] },
      { sLine: "I actually like it when nothin' much is going on here. Means we're not fighting for our lives.", tTags: ['chill'] },
      { sLine: "I'm not a xenophobe or anything, but I feel kinda... outnumbered here, know what I'm saying?", tTags: ['xenophobe'] },
      { sLine: 'When I\'m gone, someone will read this log and be surprised to find I led a rich inner life.', tTags: ['shy'] },
      { sLine: 'I learned a Terran word today - "fatalistic" - that fits nicely our plight as Fzzt, hunted across the galaxy for centuries.', tTags: ['g_shamon'] },
      { sLine: "I'm thinking about forming a band. Still deciding on a name." },
      { sLine: 'I miss /RANDOMPROVENANCE/ tea.', tTags: ['sentimental'] },
      { sLine: "Terran history sounds pretty awful. I can't believe they let their males run things for so long!", tTags: ['g_jelly'] },
      { sLine: "It's pretty cool that only a short while ago, where I'm standing now was just the unexplored darkness of space." },
      { sLine: "When the person you love stops loving you, they won't tell you for a while.", tTags: ['angry', 'sad'] },
      { sLine: "I wasn't born before the Collapse, but I remember the old holos of the Emperor's council. \"Nothing can be done\", they said." },
      { sLine: 'Wonder if this base will survive? I have a good feeling about it so far.', tTags: ['optimist'] },
      { sLine: 'The history vids talk about this thing people used to do called "dentistry". Sounds horrible.' },
      { sLine: "You think what we're doing here is going to matter? To people in the future, I mean." },
      { sLine: "Ever feel like someone is watching your every move? Besides the Administrator, I mean, cuz yeah they're always watching our every move." },
      { sLine: 'When I was a kid I wanted a pet /RANDOMCREATURE/. Didn\'t realize how deadly they were.' },
      { sLine: "I think I'm allergic to something in the replicator food." },
      { sLine: 'I check what people are posting on this thing way too zurn much. Need a break.' },
      { sLine: "I might take up drawing soon. I've quite an active imagination." },
      { sLine: 'I could use a /RANDOMDRINKNAME/ right now. No special occasion, really.', tTags: ['boozer'] },
      { sLine: 'When I get depressed like this, I eat /FAVORITEFOOD/ a lot. It\'s kind of a problem.', tTags: ['sad'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SOCIAL / NEARBY — proximity reactions
  // ═══════════════════════════════════════════════════════════════════
  LIKE_NEARBY_PERSON: {
    category: 'social',
    lines: [
      { sLine: "I always like seein' /NEARBYPERSON/'s face around here. Good to have friends on this base." },
      { sLine: '/NEARBYPERSON/ is my space-homie. We always do high-fives and such when we pass in the corridor.' },
      { sLine: "I don't trust too many folks on this base, but /NEARBYPERSON/ is rock solid.", tTags: ['anxious', 'pessimist'] },
      { sLine: 'This place would be COMPLETELY uncool if it weren\'t for folks like /NEARBYPERSON/.', tTags: ['hipster'] },
      { sLine: 'I should really talk to /NEARBYPERSON/ more, they seem so nice!', tTags: ['shy'] },
      { sLine: 'Oh hey cool, /NEARBYPERSON/ is here! They rule.' },
    ],
  },

  DISLIKE_NEARBY_PERSON: {
    category: 'social',
    lines: [
      { sLine: "Ugh, not /NEARBYPERSON/ again. We've been trying to avoid each other." },
      { sLine: 'Just look at /NEARBYPERSON/, being a smug jerk over there. Can you believe them?' },
      { sLine: "I'm just gonna look busy tapping away at Spaceface so I don't have to talk to or acknowledge /NEARBYPERSON/. Jerk." },
      { sLine: 'This day was going great before /NEARBYPERSON/ showed up.', tTags: ['happy'] },
      { sLine: "If /NEARBYPERSON/ gets on my nerves one more time, I'm gonna slug em I swear.", tTags: ['angry'] },
      { sLine: "People on this base think I'm quiet anyway, so I'm gonna use that as my excuse for ignoring /NEARBYPERSON/.", tTags: ['shy'] },
    ],
  },

  NEARBY_OBJECT: {
    category: 'social',
    lines: [
      { sLine: "Every notice how these /NEARBYOBJECT/ dealies look like a... you know. Tee hee." },
      { sLine: 'These /NEARBYOBJECT/ are so dumb, why do we even have these around again?', tTags: ['angry'] },
      { sLine: 'I had a weird dream last night about all these /NEARBYOBJECT/ we have on the base. It was pretty unsettling.', tTags: ['angry'] },
      { sLine: "Who designed these /NEARBYOBJECT/ things we have on the base? They're cool-lookin'." },
      { sLine: "This /NEARBYOBJECT/ is one of my favorites. What makes it unique? It's hard to explain." },
      { sLine: 'Man, what is even up with /NEARBYOBJECT/s?', tTags: ['angry'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // JOINED / SPAWN (priority 3)
  // ═══════════════════════════════════════════════════════════════════
  JOINED: {
    category: 'social',
    priority: 3,
    lines: [
      { sLine: "This is /MYNAME/, reporting for duty! Can't wait to get started." },
      { sLine: '/MYNAME/ here. Just arrived at the base. Looking forward to meeting everyone!' },
      { sLine: "Hey everyone, /MYNAME/'s in the house! Let's do this!" },
      { sLine: "First day on the base. Trying to stay positive, but it's all a bit overwhelming.", tTags: ['anxious'] },
      { sLine: "/MYNAME/ here. I'm ready to work hard and prove myself.", tTags: ['hardworking'] },
      { sLine: "New kid on the base. Name's /MYNAME/. Where's the food?", tTags: ['hungry'] },
    ],
  },

  ENEMY_JOINED: {
    category: 'combat',
    priority: 3,
    lines: [
      { sLine: "We're in. Time to loot this place!" },
      { sLine: "This base doesn't look too tough. Easy pickings!" },
      { sLine: "Let's strip this place clean, boys!" },
      { sLine: 'Another day, another base to ransack.' },
      { sLine: "I call dibs on anything that's not bolted down!" },
      { sLine: "Move in and take what you can! Don't leave anything behind!" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // DUTY — work-related logs
  // ═══════════════════════════════════════════════════════════════════
  DUTY_GENERIC: { category: 'duty', lines: [] },

  DUTY_ASSIGNED: {
    category: 'duty',
    priority: 2,
    lines: [
      { sLine: "Unemployed?! There's gotta be something for me to do around here." },
      { sLine: "Unassigned? Seriously?! I'll show them what I'm capable of.", tTags: ['angry'] },
      { sLine: "Unemployed! But I have skills! I'll just wait for someone to notice.", tTags: ['insecure'] },
      { sLine: "Some downtime would be nice, but being totally unassigned isn't great for morale.", tTags: ['lazy'] },
      { sLine: 'I literally have no idea what a /MYDUTY/ does, but I am going to ROCK. IT.', tTags: ['happy'] },
      { sLine: "I'm actually kind of excited that they're making me a /MYDUTY/. Though we'll see how long that lasts.", tTags: ['optimist'] },
      { sLine: "New assignment. I'm a /MYDUTY/ now. I feel kind of weird about it but I guess I'll just go with it.", tTags: ['chill'] },
      { sLine: "Moving on to /MYDUTY/ duty! I've worked hard for this and it feels GREAT.", tTags: ['hardworking', 'lovesjob'] },
      { sLine: "I'm starting /MYDUTY/ duty tomorrow. Gotta say I'm a little nervous but I think I can do this.", tTags: ['anxious'] },
      { sLine: "I managed to talk my way into a new job! But... does anyone know what a /MYDUTY/ does?", tTags: ['happy'] },
      { sLine: 'The Administrator assigned me to /MYDUTY/ duty. Am I being punished?', tTags: ['hatesjob'] },
      { sLine: 'Aw yeez, /MYDUTY/ duty. What did I do to deserve this?!?', tTags: ['hatesjob'] },
      { sLine: "UGH, now I'm on /MYDUTY/ duty. Gonna sulk the whole way through it.", tTags: ['hatesjob'] },
      { sLine: "OMZ, they put me on /MYDUTY/ duty!  Can't wait to start...", tTags: ['hardworking', 'lovesjob'] },
      { sLine: "/MYDUTY/ duty - yessss!  I knew all that brown-nosing would pay off.", tTags: ['gregarious', 'lovesjob'] },
      { sLine: 'Guys guys guys, I\'m on /MYDUTY/ duty now!  Drinks at /RANDOMPUB/ are on me!', tTags: ['boozer', 'lovesjob'] },
      { sLine: "Pleased to announce I'll be starting /MYDUTY/ duty soon! Oh who am I kidding, does anyone even read this?", tTags: ['insecure', 'lovesjob'] },
      { sLine: "Gonna try to adapt to /MYDUTY/ duty as well as I can, but... no promises.", tTags: ['hatesjob'] },
      { sLine: '*SIGH*. /MYDUTY/ duty it is, then. The Administrator clearly has it in for me.', tTags: ['hatesjob'] },
      { sLine: "Hmm... just got assigned to /MYDUTY/ duty. Not my first pick, but we'll see how it goes!", tTags: ['optimist'] },
    ],
  },

  DUTY_UNEMPLOYED: {
    category: 'duty',
    lines: [
      { sLine: "Unemployed?! There's gotta be something for me to do around here." },
      { sLine: "Unassigned? Seriously?! I'll show them what I'm capable of.", tTags: ['angry'] },
      { sLine: "Unemployed! But I have skills! I'll just wait for someone to notice.", tTags: ['insecure'] },
      { sLine: "Some downtime would be nice, but being totally unassigned isn't great for morale.", tTags: ['lazy'] },
      { sLine: "At least being unassigned means no one can yell at me for doing my job wrong!", tTags: ['optimist'] },
    ],
  },

  DUTY_BUILD: {
    category: 'duty',
    lines: [
      { sLine: "Just installed a new /DUTYTARGET/. Because that's what I do." },
      { sLine: 'Just put in a new /DUTYTARGET/. I think I just earned myself a helping of /FAVORITEFOOD/.', tTags: ['happy', 'hungry'] },
      { sLine: "Not to brag, but I don't see how anyone else could install this /DUTYTARGET/ any better than I just did.", tTags: ['egoist'] },
      { sLine: "There wouldn't be any /DUTYTARGET/ on this base if it weren't for me.", tTags: ['egoist'] },
      { sLine: "I just sneezed a bunch of construction dust. I hope this stuff isn't poisonous.", tTags: ['hatesjob', 'pessimist'] },
      { sLine: "I like building out in space because people don't crowd me.", tTags: ['lovesjob', 'shy'] },
      { sLine: "Build, build, build. They don't need us until they need us RIGHT AWAY. Buncha jerks.", tTags: ['angry'] },
    ],
  },

  DUTY_TECH: {
    category: 'duty',
    lines: [
      { sLine: 'Just crushed that routine maintenance task. Me = Best Tech Ever.', tTags: ['egoist', 'lovesjob'] },
      { sLine: "Maintenance work is such joyless drudgery. I'll bet /RANDOMDUTY/ duty is way more exciting than this.", tTags: ['bored', 'hatesjob'] },
      { sLine: "This isn't the sexiest job on the base, but it's important. People would die if I didn't do it well, you know!", tTags: ['lovesjob'] },
      { sLine: 'Truly, the work of a /MYDUTY/ is never done.' },
      { sLine: 'Yessiree, this /DUTYTARGET/ is in good working order!', tTags: ['happy'] },
      { sLine: 'Boring tech duty goes by a lot faster with the new /RANDOMBAND/ album rockin\' my face. \\m//' },
      { sLine: 'Sometimes I feel like I should feign illness and let all the machines break, so people appreciate me more.', tTags: ['insecure'] },
      { sLine: "I found some inefficient subroutines on this /DUTYTARGET/. Didn't bother to fix them though.", tTags: ['hatesjob', 'lazy'] },
      { sLine: 'I could pretty much do an oxygen recycler data circuit reroute blindfolded at this point.' },
      { sLine: "Just used my last space modulator. I'd better order some more." },
      { sLine: "Ugh, this tech duty is SO FRUSTRATING. I'm just about done with this nonsense.", tTags: ['angry', 'hatesjob'] },
    ],
  },

  DUTY_MINE: {
    category: 'duty',
    lines: [
      { sLine: "Builders wouldn't exist if it weren't for miners, but do they ever thank us? Nope." },
      { sLine: 'I mined the crap out of that asteroid.', tTags: ['happy'] },
      { sLine: "I wonder if we'll ever run out of asteroids to mine..." },
      { sLine: 'The key to being a good miner is "mind over matter". Heh.', tTags: ['lovesjob'] },
      { sLine: 'My mining helmet is starting to stink. I should probably wash it.' },
      { sLine: 'Mine. Carry Rocks. Convert to Matter. Repeat.', tTags: ['bored'] },
      { sLine: 'Mining is pretty boring, but I like being out in space.', tTags: ['bored', 'hatesjob', 'shy'] },
      { sLine: 'Mining is a good job for introverts.' },
      { sLine: "I'm so sick of all this crap, I think about just not coming back in sometimes.", tTags: ['angry'] },
    ],
  },

  DUTY_SECURITY_PATROL: {
    category: 'duty',
    lines: [
      { sLine: 'Patrol duty. Walk around, look tough, stay frosty.' },
      { sLine: "All quiet on the base. That's how I like it.", tTags: ['chill'] },
      { sLine: "I can handle any threat this base throws at me. Bring it on.", tTags: ['brave'] },
      { sLine: "I hope we never see real combat, but I'm ready if we do.", tTags: ['brave'] },
      { sLine: "Another boring patrol shift. At least I'm getting paid.", tTags: ['lazy'] },
      { sLine: "Keeping watch. Staying sharp. That's the security life." },
      { sLine: "If I see one more false alarm, I'm going to scream.", tTags: ['angry'] },
      { sLine: 'Patrol is quiet. Good time to catch up on /RANDOMGAME/.', tTags: ['gamer'] },
      { sLine: 'The corridors are secure. For now.', tTags: ['anxious'] },
      { sLine: 'I walk these halls so you all can sleep safely.', tTags: ['brave'] },
      { sLine: "I wish they'd give security more respect around here.", tTags: ['angry'] },
      { sLine: 'Eyes open. Ears open. Gun ready.', tTags: ['brave'] },
    ],
  },

  DUTY_SECURITY_START_EXPLORE: {
    category: 'duty',
    lines: [
      { sLine: "Heading out to explore a new sector. Here's hoping it's not full of hostiles.", tTags: ['anxious'] },
      { sLine: "Exploration time! Let's see what's out there.", tTags: ['brave'] },
      { sLine: "Command wants us to check out a new section. Let's do this.", tTags: ['brave'] },
      { sLine: "I volunteered for exploration duty. I must be crazy.", tTags: ['brave'] },
      { sLine: "Exploration detail. Wish me luck!", tTags: ['optimist'] },
    ],
  },

  DUTY_SECURITY_EXPLORED_COMBAT: {
    category: 'duty',
    priority: 2,
    lines: [
      { sLine: 'We ran into hostiles during exploration. Things got intense.', tTags: ['brave'] },
      { sLine: "That exploration turned into a firefight! I wasn't expecting that.", tTags: ['anxious'] },
      { sLine: "Good thing I had my weapon ready. Exploration got dangerous fast.", tTags: ['brave'] },
      { sLine: 'Combat during exploration. My training kicked in.', tTags: ['brave'] },
      { sLine: "We found hostiles in the new sector. Had to fight our way through.", tTags: ['brave'] },
    ],
  },

  DUTY_SECURITY_EXPLORED_NOCOMBAT: {
    category: 'duty',
    priority: 2,
    lines: [
      { sLine: 'Explored a new area. All clear! No hostiles found.' },
      { sLine: 'Peaceful exploration for once. Nice to not get shot at.' },
      { sLine: 'New sector is clear. Safe for expansion.' },
      { sLine: "Exploration complete. Nothing but empty space and dust.", tTags: ['bored'] },
      { sLine: "The new area is secure. Time to head back.", tTags: ['chill'] },
    ],
  },

  DUTY_BOTANIST_MAINTAIN: {
    category: 'duty',
    lines: [
      { sLine: "Tending plants is more rewarding than I thought it'd be." },
      { sLine: "These plants respond well to careful attention. It's nice to nurture something.", tTags: ['sentimental'] },
      { sLine: "I love watching these plants grow. It's the simple things.", tTags: ['lovesjob'] },
      { sLine: "Plant maintenance is so repetitive. Water, trim, repeat.", tTags: ['hatesjob'] },
      { sLine: "These plants smell amazing! Being a botanist has its perks.", tTags: ['happy'] },
      { sLine: "I'm getting pretty good at this botanist thing. Green thumb and all.", tTags: ['egoist'] },
      { sLine: 'Some of these plants look a little... aggressive? Is that normal?', tTags: ['anxious'] },
      { sLine: "Nature finds a way, even in space. How cool is that?", tTags: ['optimist'] },
      { sLine: 'I talk to the plants sometimes. They seem to listen.', tTags: ['shy'] },
      { sLine: "My plants are thriving! I'm like a space farmer.", tTags: ['happy', 'lovesjob'] },
      { sLine: 'Pruning these plants is oddly meditative.', tTags: ['chill'] },
      { sLine: 'I wish these plants would just take care of themselves.', tTags: ['lazy'] },
    ],
  },

  DUTY_BOTANIST_HARVEST: {
    category: 'duty',
    lines: [
      { sLine: 'Harvest time! Fresh produce for the base.', tTags: ['happy'] },
      { sLine: "Nothing beats freshly harvested space veggies.", tTags: ['gourmand'] },
      { sLine: 'The harvest is looking good this cycle.', tTags: ['lovesjob'] },
    ],
  },

  DUTY_SERVE_DRINK: {
    category: 'duty',
    lines: [
      { sLine: 'Another round served! Being a bartender is pretty fun.', tTags: ['lovesjob'] },
      { sLine: 'I wonder if I should invent a new cocktail.', tTags: ['happy'] },
      { sLine: 'Slinging drinks all day. Could be worse.', tTags: ['chill'] },
      { sLine: 'These people drink way too much. Not judging though.', tTags: ['neat'] },
      { sLine: "I'm getting really good at mixing drinks!", tTags: ['egoist', 'lovesjob'] },
      { sLine: 'The bar is the social hub of this base.', tTags: ['gregarious'] },
      { sLine: 'Making a /RANDOMDRINKNAME/ for the crew. My specialty!' },
    ],
  },

  DUTY_SCIENTIST_RESEARCH_FIRE: {
    category: 'duty',
    lines: [
      { sLine: 'Researching fire specimens. Fascinating and terrifying.', tTags: ['brave'] },
      { sLine: 'I have to be very careful with these fire samples.', tTags: ['anxious'] },
      { sLine: "Fire research is yielding interesting data. Science doesn't care about danger!", tTags: ['lovesjob'] },
      { sLine: 'These fire specimens are incredible. The molecular structure is unlike anything I\'ve seen.', tTags: ['lovesjob'] },
    ],
  },

  DUTY_SCIENTIST_DO_RESEARCH: {
    category: 'duty',
    lines: [
      { sLine: 'The thrill of discovery! Science is the best job on this base.', tTags: ['lovesjob'] },
      { sLine: 'I hope my research leads to something useful for the base.', tTags: ['optimist'] },
      { sLine: 'Lab work can be tedious, but the results are worth it.', tTags: ['hardworking'] },
      { sLine: 'I had a breakthrough today! Well, a minor one. But still!', tTags: ['happy'] },
      { sLine: 'Research log: experiment 47B yielded expected results. Note to self: order more beakers.' },
      { sLine: "This /RESEARCHSUBJECT/ research is going to change everything.", tTags: ['optimist', 'lovesjob'] },
      { sLine: "I don't think people appreciate how important my research is.", tTags: ['insecure'] },
      { sLine: "Another day in the lab. At least it's quiet.", tTags: ['shy'] },
      { sLine: 'If I could just figure out this one variable...', tTags: ['hardworking'] },
    ],
  },

  DUTY_SCIENTIST_COLLECT_RESEARCH: {
    category: 'duty',
    lines: [
      { sLine: 'Collected some interesting samples today. Time to analyze!' },
      { sLine: 'Field data collection is the exciting part of being a scientist.', tTags: ['lovesjob'] },
      { sLine: 'I need to bring these /CARRIEDRESEARCH/ samples back to the lab.', tTags: ['hardworking'] },
    ],
  },

  DUTY_SCIENTIST_DELIVER_RESEARCH: {
    category: 'duty',
    lines: [
      { sLine: 'Delivering research data. Another contribution to our knowledge base.' },
      { sLine: 'My research findings are ready for review. I hope the data is solid.', tTags: ['anxious'] },
      { sLine: 'Just dropped off my /CARRIEDRESEARCH/ findings at the lab.', tTags: ['happy'] },
    ],
  },

  EXPLORED_ROOM: {
    category: 'duty',
    lines: [
      { sLine: "I explored /CURRENTROOM/. It's safe to enter." },
      { sLine: '/CURRENTROOM/ has been cleared. All clear!' },
      { sLine: "The room's been explored. Nothing dangerous inside.", tTags: ['brave'] },
      { sLine: "We've secured this area. Moving on.", tTags: ['brave'] },
      { sLine: "Explored the area. Let's just say I'm glad I brought my weapon.", tTags: ['anxious'] },
      { sLine: "New room explored! I love discovering new parts of the base.", tTags: ['optimist'] },
      { sLine: 'Room secured. Time for someone else to make it look nice.', tTags: ['lazy'] },
      { sLine: "/CURRENTROOM/ exploration complete. Didn't find anything exciting.", tTags: ['bored'] },
      { sLine: 'Exploration duty is done. Now where did I leave my /FAVORITEFOOD/?', tTags: ['hungry'] },
    ],
  },

  DUTY_JANITOR_REFINE_CORPSE_FRIENDLY: {
    category: 'duty',
    priority: 2,
    lines: [
      { sLine: 'I had to process a fallen crewmate today. This job can be rough.', tTags: ['sentimental'] },
      { sLine: "Recycling a friend's remains. I'm not sure I can handle this job much longer.", tTags: ['sad'] },
      { sLine: "It's just matter at this point. I keep telling myself that.", tTags: ['pessimist'] },
      { sLine: "I try not to think about whose body I'm processing.", tTags: ['anxious'] },
      { sLine: "Someone's gotta do it. Might as well be me.", tTags: ['brave'] },
      { sLine: 'Rest in peace, friend. At least your matter will help the base.', tTags: ['optimist'] },
      { sLine: "This is the worst part of being a janitor. Absolutely the worst.", tTags: ['hatesjob'] },
      { sLine: 'Body processing duty again. I need a drink after this.', tTags: ['boozer'] },
      { sLine: 'I try to be respectful when processing remains. They were people.', tTags: ['sentimental'] },
    ],
  },

  DUTY_JANITOR_REFINE_CORPSE_MONSTER: {
    category: 'duty',
    lines: [
      { sLine: 'Cleaning up monster remains. At least this thing is dead.', tTags: ['brave'] },
      { sLine: 'These monster bodies are disgusting. I need stronger gloves.', tTags: ['neat'] },
      { sLine: "Processing alien remains. It's nasty but someone's gotta do it." },
      { sLine: 'I wonder what this thing ate before it died? Actually, I don\'t want to know.', tTags: ['anxious'] },
      { sLine: "Good riddance. Let's turn this monster into something useful.", tTags: ['angry'] },
    ],
  },

  DUTY_JANITOR_REFINE_CORPSE_RAIDER: {
    category: 'duty',
    lines: [
      { sLine: "Processing raider remains. They shouldn't have messed with our base." },
      { sLine: "Cleaning up after another attack. At least we won.", tTags: ['brave'] },
      { sLine: "These raiders got what they deserved. Now I have to clean them up.", tTags: ['angry'] },
      { sLine: 'Another body to process. This base sees too much violence.', tTags: ['sad'] },
      { sLine: "I try not to think about the raider's family when I'm processing them.", tTags: ['sentimental'] },
      { sLine: "Raider body processed. That's one less problem for the base." },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // DOCTOR / HEALTH
  // ═══════════════════════════════════════════════════════════════════
  DUTY_DOCTOR_SCAN_HEALTHY: {
    category: 'health',
    lines: [
      { sLine: 'Patient is healthy. Moving on to the next scan.' },
      { sLine: "Good news! /PATIENT/ is in perfect health. That's what I like to see.", tTags: ['happy'] },
      { sLine: 'Clean bill of health for the patient. Next!' },
      { sLine: "All vital signs normal. I love it when there's nothing wrong.", tTags: ['lovesjob'] },
      { sLine: 'Another healthy patient. Maybe I should find more challenging work.', tTags: ['bored'] },
    ],
  },

  DUTY_DOCTOR_HEAL_ILLNESS: {
    category: 'health',
    lines: [
      { sLine: 'Treating /PATIENT/ for illness. Should be feeling better soon.', tTags: ['lovesjob'] },
      { sLine: "This patient's symptoms are concerning. I'll do my best.", tTags: ['anxious'] },
      { sLine: 'Administering treatment. Modern medicine is wonderful.', tTags: ['optimist'] },
      { sLine: "I've seen worse cases. /PATIENT/ should recover.", tTags: ['brave'] },
    ],
  },

  DUTY_DOCTOR_HEAL_BROKEN_LEG: {
    category: 'health',
    lines: [
      { sLine: 'Setting a broken leg. This is going to hurt.', tTags: ['brave'] },
      { sLine: 'Bone fracture repair complete. Patient needs rest.' },
      { sLine: "That was a nasty break. /PATIENT/ won't be walking for a while.", tTags: ['sentimental'] },
      { sLine: 'Another broken bone fixed. I should write a paper on space-related fractures.', tTags: ['lovesjob'] },
    ],
  },

  DUTY_DOCTOR_HEAL_HP_MAJOR: {
    category: 'health',
    lines: [
      { sLine: 'Major trauma case. This is going to take all my skill.', tTags: ['brave'] },
      { sLine: "/PATIENT/ is in critical condition. I'm doing everything I can.", tTags: ['anxious'] },
      { sLine: 'Severe injuries. We need to stabilize the patient immediately.', tTags: ['hardworking'] },
    ],
  },

  DUTY_DOCTOR_HEAL_HP_MINOR: {
    category: 'health',
    lines: [
      { sLine: 'Minor injuries patched up. Nothing serious.', tTags: ['chill'] },
      { sLine: 'Just a scratch. /PATIENT/ will be fine.' },
    ],
  },

  DUTY_DOCTOR_DIAGNOSE_ILLNESS: {
    category: 'health',
    priority: 2,
    lines: [
      { sLine: "Diagnosing the patient. Let's see what we're dealing with here.", tTags: ['lovesjob'] },
      { sLine: 'Running diagnostic scans on /PATIENT/. Results coming soon.' },
      { sLine: 'I think I know what this is. Better run some more tests to be sure.', tTags: ['anxious'] },
      { sLine: "The symptoms are unusual. I'll need to do more research.", tTags: ['hardworking'] },
    ],
  },

  HEALTH_CITIZEN_SCAN: {
    category: 'health',
    lines: [
      { sLine: 'Getting scanned by the doc. Routine checkup.', tTags: ['chill'] },
      { sLine: "I hope the scan doesn't find anything wrong.", tTags: ['anxious'] },
      { sLine: 'Time for my health scan. I hate these things.', tTags: ['angry'] },
      { sLine: 'The doctor says I need to take better care of myself. Yeah, yeah.', tTags: ['lazy'] },
      { sLine: 'Scan complete! Hopefully everything is normal.', tTags: ['optimist'] },
      { sLine: "I always feel nervous during health scans. What if they find something?", tTags: ['anxious'] },
      { sLine: "The scanning equipment is pretty impressive. Science is cool.", tTags: ['scientist'] },
    ],
  },

  HEALTH_CITIZEN_GETTING_ILL: {
    category: 'health',
    priority: 2,
    lines: [
      { sLine: "I don't feel so good...", tTags: ['sad'] },
      { sLine: 'I think I might be coming down with something.', tTags: ['anxious'] },
      { sLine: "Ugh, my stomach. Something isn't right.", tTags: ['sad'] },
      { sLine: 'Is it hot in here, or am I getting sick?', tTags: ['anxious'] },
      { sLine: "I feel terrible. I should see /DOCTOR/ about this.", tTags: ['sad'] },
      { sLine: "Great, I'm getting sick. Just what I needed.", tTags: ['pessimist'] },
    ],
  },

  HEALTH_CITIZEN_GETTING_FIREPLAGUE: {
    category: 'health',
    priority: 3,
    lines: [
      { sLine: 'My skin feels as though its burning...' },
      { sLine: "I'm so totally on fire." },
      { sLine: 'I feel... terrible. ugh' },
      { sLine: 'My head is pounding!' },
      { sLine: 'I feel as though my skin is melting off' },
      { sLine: 'Is it me or is /CURRENTROOM/ really hot today..' },
      { sLine: 'Is it just me or is /CURRENTROOM/ really really really warm today..' },
      { sLine: 'Why is the station so dang warm!' },
      { sLine: 'No air conditioner in here?' },
      { sLine: 'I have blisters all over my body, it hurts so much...' },
      { sLine: 'I am in so much pain...doctor..i need a doctor...' },
    ],
  },

  HEALTH_CITIZEN_GETTING_HIGH: {
    category: 'health',
    priority: 3,
    lines: [
      { sLine: 'Woah man I feel...great...this happybot is really..you know... like working ...' },
      { sLine: "I'm really feeling it...all my stress is like melting away...man..the happybot." },
      { sLine: 'Dude..double rainbow all the way across the...happybot.' },
      { sLine: 'Dude..double rainbow all the way across the base.' },
      { sLine: "I'm going to like... bring my bongos next time and play... songs, with the happybot." },
      { sLine: 'Dude, I like..wrote song about the happybot..it goes kinda like..woah.....what was I talking about again?' },
      { sLine: 'I Wrote a song... about happybot... The Chords Go like... A G A D Em A D A...' },
      { sLine: 'Dude, i feel it.' },
      { sLine: 'LIKE...WOAHHHHHH' },
      { sLine: 'LIKE...DUDEEEEEEE' },
      { sLine: "Dude...I have no idea why these were banned by the diaspora fleet..like..its so great." },
      { sLine: "I think happy bot should be in charge...it's never lied to me" },
      { sLine: 'Dude.. the HappyBot told me I should be a technician...I could feel its diodes.' },
      { sLine: 'Dude.. the HappyBot is the best thing since ...like anything.' },
      { sLine: 'Dude.. I was sitting in /CURRENTROOM/ by myself and I think happybot said Hi to me.' },
      { sLine: 'Happybot happybot happybot.' },
      { sLine: 'No one here knows how much I love happybot ;).' },
      { sLine: "I'm so nervous im going to confess my undying love to happybot <3." },
      { sLine: 'I proposed to happybot and it said yes. The wedding is happening tomorrow in /CURRENTROOM/' },
      { sLine: 'Dude, whatever chemical is in happybot works alot better then ../RANDOMCREATURE/ extract ..ALOT better...;)' },
      { sLine: 'I wonder if the administrator would be annoyed if I started sing my new song about happybot while working.' },
      { sLine: "Happybot told me to convince the adminsrator to buy more of 'it' for the 'Collective Computational Consiousness' or something..." },
      { sLine: 'Happybot told me to give it all my credits so I gave it my wallet...I hope the administrator doesnt notice' },
      { sLine: 'I think I just saw Happybot buying drinks at the bar.' },
      { sLine: "Dude, I was so depressed a minute ago...now I'm happy..." },
      { sLine: 'Why is everything changing colors like a disco dance floor...' },
      { sLine: "Happybot sent me a private message on spaceface..something about 'overthrowing the administrator' or something...how did it even do that?" },
      { sLine: 'Happybot for administrator!' },
      { sLine: 'I gave Happybot my portable communicator..now we are friends on spaceface..how awesome is that!' },
      { sLine: 'Happybot told me to roll over and he gave me a /RANDOMCREATURE/ treat for doing it.' },
    ],
  },

  HEALTH_CITIZEN_DIAGNOSED: {
    category: 'health',
    priority: 2,
    lines: [
      { sLine: 'The doctor diagnosed me with /DISEASE/. At least I know what it is now.', tTags: ['optimist'] },
      { sLine: "I've been diagnosed with /DISEASE/. Great. Just great.", tTags: ['pessimist'] },
      { sLine: '/DISEASE/? Never heard of it. Hope the doc knows how to treat it.', tTags: ['anxious'] },
    ],
  },

  HEALTH_CITIZEN_INCAPACITATED_ILLNESS: {
    category: 'health',
    priority: 3,
    lines: [
      { sLine: "I can barely move... this /DISEASE/ is really bad. I need help.", tTags: ['sad'] },
      { sLine: "I'm incapacitated. Someone please get a doctor...", tTags: ['anxious'] },
    ],
  },

  HEALTH_CITIZEN_INCAPACITATED_INJURY: {
    category: 'health',
    priority: 3,
    lines: [
      { sLine: "I can't get up. My injuries are too severe.", tTags: ['sad'] },
      { sLine: 'Everything hurts. Please... someone help me.', tTags: ['anxious'] },
      { sLine: "I'm down! MEDIC!", tTags: ['brave'] },
    ],
  },

  HEALTH_CITIZEN_MINOR_INJURY: {
    category: 'health',
    priority: 3,
    lines: [
      { sLine: 'WOW. In so much pain right now.' },
      { sLine: 'OUCH that hurt!' },
      { sLine: 'I hope I survive this...' },
      { sLine: 'This is bad..real bad!' },
      { sLine: 'Oh smeb, these guys mean business!' },
      { sLine: 'AGGHH I\'m hit, IM HIT!' },
      { sLine: "That's not good, I think I'm injured!" },
      { sLine: "I'm hurt, I am hurt very badly!" },
    ],
  },

  HEALTH_CITIZEN_HEAL_ILLNESS: {
    category: 'health',
    priority: 3,
    lines: [
      { sLine: 'Feeling better already! Modern medicine is amazing.', tTags: ['optimist'] },
      { sLine: "The doc fixed me up. I'm back in action!", tTags: ['happy'] },
      { sLine: 'Treatment is working. Thank goodness for doctors.', tTags: ['sentimental'] },
      { sLine: "I never want to be that sick again. That was awful.", tTags: ['anxious'] },
    ],
  },

  HEALTH_CITIZEN_HOSPITAL_CHECKIN: {
    category: 'health',
    priority: 2,
    lines: [
      { sLine: "Checking into the hospital. Hope I'm out of here soon.", tTags: ['anxious'] },
      { sLine: "Hospital again. I'm becoming a regular.", tTags: ['pessimist'] },
      { sLine: 'At least the hospital bed is comfortable.', tTags: ['optimist'] },
      { sLine: "I hate hospitals. The beeping sounds drive me crazy.", tTags: ['angry'] },
    ],
  },

  HEALTH_CITIZEN_IS_THING: {
    category: 'health',
    priority: 3,
    lines: [
      { sLine: '*darts eyes uncontrollably*' },
      { sLine: '*is scheming*' },
      { sLine: '*Stares at a wall*' },
      { sLine: '*Deceivingly staring*' },
      { sLine: 'Hahaha, I figured out the password...errmm.. I mean, I haven\'t written a log in awhile.' },
      { sLine: 'We...er I mean I do love a bit of inf--err..socialization.' },
      { sLine: 'I am feeling extremely hungry today, might feed soon' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CHAT / SOCIAL
  // ═══════════════════════════════════════════════════════════════════
  CHAT_INTRODUCE: {
    category: 'social',
    priority: 3,
    lines: [
      { sLine: "Just met /CHATPARTNER/ for the first time! They seem nice.", tTags: ['gregarious'] },
      { sLine: "Introduced myself to /CHATPARTNER/. A bit awkward, but hopefully we'll get along.", tTags: ['shy'] },
      { sLine: "New face! /CHATPARTNER/ just arrived. Let's see what they're all about.", tTags: ['gregarious'] },
      { sLine: "/CHATPARTNER/ seems interesting. I'm glad there are new people joining the crew.", tTags: ['optimist'] },
    ],
  },

  CHAT_GOOD_GENERIC: {
    category: 'social',
    lines: [
      { sLine: "Had a great chat with /CHATPARTNER/. We really hit it off!", tTags: ['gregarious'] },
      { sLine: '/CHATPARTNER/ is hilarious! Best conversation I\'ve had in weeks.', tTags: ['happy'] },
      { sLine: '/CHATPARTNER/ and I were talking about /CHATTOPIC/. Good times.', tTags: ['gregarious'] },
      { sLine: "I'm glad I took the time to talk to /CHATPARTNER/. Really brightened my day.", tTags: ['optimist'] },
    ],
  },

  CHAT_BAD_GENERIC: {
    category: 'social',
    lines: [
      { sLine: "Ugh, what a terrible conversation with /CHATPARTNER/. We don't agree on anything.", tTags: ['angry'] },
      { sLine: '/CHATPARTNER/ really rubbed me the wrong way today.', tTags: ['angry'] },
      { sLine: "I tried talking to /CHATPARTNER/ but it didn't go well. At all.", tTags: ['sad'] },
      { sLine: '/CHATPARTNER/ is so annoying. I need to avoid them from now on.', tTags: ['angry'] },
      { sLine: "That conversation with /CHATPARTNER/ was painful. Like pulling teeth.", tTags: ['pessimist'] },
      { sLine: 'Note to self: never discuss /CHATTOPIC/ with /CHATPARTNER/ again.', tTags: ['angry'] },
    ],
  },

  CHAT_CHEER_UP: {
    category: 'social',
    priority: 2,
    lines: [
      { sLine: '/CHATPARTNER/ looked down, so I tried to cheer them up. Hope it helped.', tTags: ['gregarious'] },
      { sLine: "I could tell /CHATPARTNER/ was having a rough day. We had a good talk.", tTags: ['sentimental'] },
      { sLine: "Sometimes you just need someone to listen. I think /CHATPARTNER/ needed that today.", tTags: ['gregarious'] },
      { sLine: 'Tried to lift /CHATPARTNER/\'s spirits. We all need support sometimes.', tTags: ['optimist'] },
      { sLine: "I'm not great with words, but I think /CHATPARTNER/ appreciated me trying.", tTags: ['shy'] },
      { sLine: '/CHATPARTNER/ was feeling low. I told them a joke. They laughed! Success!', tTags: ['joker'] },
    ],
  },

  CHAT_TRADE: {
    category: 'social',
    priority: 2,
    lines: [
      { sLine: "Just traded with /TRADEPARTNER/. Got a pretty good deal!", tTags: ['happy'] },
      { sLine: '/TRADEPARTNER/ had some interesting items. Swapped a few things.', tTags: ['gregarious'] },
      { sLine: 'Trading with crewmates is fun. I got a /TRADEITEM/!', tTags: ['happy'] },
      { sLine: 'Gave /TRADEPARTNER/ my /TRADEOTHERITEM/ in exchange for their /TRADEITEM/.', tTags: ['happy'] },
      { sLine: 'I think /TRADEPARTNER/ got the better end of that deal...', tTags: ['insecure'] },
      { sLine: "Trading! It's like gambling but you actually get something!", tTags: ['competitive'] },
      { sLine: "/TRADEPARTNER/ wanted to trade. I drove a hard bargain and got exactly what I wanted.", tTags: ['egoist'] },
    ],
  },

  PICKUP_ITEM: {
    category: 'social',
    priority: 2,
    lines: [
      { sLine: 'Found a /ITEM/! Finders keepers.' },
    ],
  },

  NEED_SHELVING: {
    category: 'social',
    lines: [
      { sLine: 'I really need somewhere to put my stuff. Some shelving would be nice.', tTags: ['neat'] },
      { sLine: "My things are all over the floor. We need some storage around here.", tTags: ['neat'] },
      { sLine: "Where am I supposed to put all my stuff? We need shelves!", tTags: ['angry'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // JUKEBOX (priority 3)
  // ═══════════════════════════════════════════════════════════════════
  JUKEBOX_GENERIC: {
    category: 'activity',
    priority: 3,
    lines: [
      { sLine: 'The Jukebox in /CURRENTROOM/ has every song I like on it!' },
      { sLine: 'Just listened to some pre-collapse tunes on the jukebox, nostalgia baby' },
      { sLine: "I'm so glad the administrator saw it fit to get a jukebox put in /CURRENTROOM/ without it I couldn't listen to my favorite music!" },
      { sLine: 'Just listening to tunes in /CURRENTROOM/ #Nightlife' },
      { sLine: 'This base has quite the nightlife, it reminds me of a Terran city!' },
      { sLine: 'Sliders, music and alcohol heck yeah!' },
      { sLine: "You know its been awhile since I heard songs by /RANDOMBAND/ ." },
      { sLine: 'I was head-banging so hard from this song by /RANDOMBAND/ .', tTags: ['hipster'] },
      { sLine: 'Loving the jukebox in /CURRENTROOM/ .' },
      { sLine: 'I could listen to songs all day in /CURRENTROOM/ but i suppose that would be unhealthy.' },
      { sLine: 'I would rather listen to songs in /CURRENTROOM/ then work but i would do alot of things to avoid work.', tTags: ['lazy'] },
      { sLine: "I'm not sure many of the aliens on this base are capable of appreciating the finer points of music from /RANDOMBAND/ but I listen to it anyway", tTags: ['xenophobe'] },
      { sLine: 'This kind of music always brings me back! #/RANDOMBAND/ in #/CURRENTROOM/', tTags: ['sentimental'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // COMBAT (priority 2)
  // ═══════════════════════════════════════════════════════════════════
  ENTER_BRAWL: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: "That's it, I've had ENOUGH! Time to throw some punches!", tTags: ['angry'] },
      { sLine: "I can't take this anymore. Someone's getting a fist to the face.", tTags: ['angry'] },
      { sLine: "You wanna go?! Let's GO!", tTags: ['brave', 'angry'] },
      { sLine: "I didn't want to resort to violence, but here we are.", tTags: ['sad'] },
      { sLine: "Fighting isn't the answer... but it sure feels good right now.", tTags: ['angry'] },
      { sLine: 'A good brawl every now and then clears the air.', tTags: ['brave'] },
      { sLine: 'I may not be the strongest, but I sure am the angriest right now!', tTags: ['angry'] },
    ],
  },

  ENTER_COMBAT_MELEE: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: "Close quarters combat! This is what I trained for!", tTags: ['brave'] },
      { sLine: "Engaging the enemy hand-to-hand. Let's do this.", tTags: ['brave'] },
      { sLine: 'Too close for lasers! Going melee!', tTags: ['brave'] },
    ],
  },

  ENTER_COMBAT_RANGED: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: 'Opening fire on the target!', tTags: ['brave'] },
      { sLine: 'Engaging hostile at range. Taking the shot.', tTags: ['brave'] },
      { sLine: "I've got a clear line of sight. Firing!", tTags: ['brave'] },
      { sLine: 'Cover me! I\'m taking shots at the enemy!', tTags: ['brave'] },
    ],
  },

  ENTER_COMBAT_RAIDER: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: "Time to earn our pay, boys! Attack!", tTags: ['brave'] },
      { sLine: 'These base dwellers are going down!' },
      { sLine: "Rush 'em! Don't give them time to regroup!" },
    ],
  },

  RAIDER_ATTACK_DOOR: {
    category: 'combat',
    lines: [
      { sLine: "Break down this door! There's loot on the other side!" },
      { sLine: "This door's in my way. It won't be for long." },
    ],
  },

  KILLED_A_THING_MELEE: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: 'Got one! /THINGKILLED/ is down for good!', tTags: ['brave'] },
      { sLine: 'Took down /THINGKILLED/ with my bare hands! Sort of!', tTags: ['egoist'] },
    ],
  },

  KILLED_A_THING_RANGED: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: 'Clean shot! /THINGKILLED/ won\'t be bothering us again.', tTags: ['brave'] },
      { sLine: 'Got /THINGKILLED/ from across the room! Nice shot if I say so myself.', tTags: ['egoist'] },
      { sLine: 'Target /THINGKILLED/ eliminated. Area secure.', tTags: ['brave'] },
    ],
  },

  ER_KILLED_A_THING_MELEE: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: "Security handled it. /THINGKILLED/ won't be a problem anymore.", tTags: ['brave'] },
      { sLine: "Took out /THINGKILLED/ in close combat. That's what we're trained for.", tTags: ['lovesjob'] },
    ],
  },

  ER_KILLED_A_THING_RANGED: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: '/THINGKILLED/ neutralized with precision fire.', tTags: ['brave'] },
      { sLine: "Another clean kill. Security keeps this base safe.", tTags: ['lovesjob'] },
      { sLine: "Dropped /THINGKILLED/ before they could cause more damage.", tTags: ['brave'] },
    ],
  },

  RAIDER_KILLED_A_THING_MELEE: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: "Ha! /THINGKILLED/ went down easy!", tTags: ['brave'] },
      { sLine: "Another one bites the dust! Who's next?", tTags: ['angry'] },
    ],
  },

  RAIDER_KILLED_A_THING_RANGED: {
    category: 'combat',
    priority: 2,
    lines: [
      { sLine: '/THINGKILLED/ dropped! These base dwellers are pathetic!', tTags: ['brave'] },
      { sLine: "Nice shot! /THINGKILLED/ didn't see that coming." },
      { sLine: "Keep 'em coming! We'll take down every last one!", tTags: ['angry'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // DEATH (priority 4)
  // ═══════════════════════════════════════════════════════════════════
  DEATH_REACT_CITIZEN: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: "It's so sad about /DECEASED/. We weren't close, but it's a tragedy." },
      { sLine: "Such a shame to hear /DECEASED/ is gone. What's this place coming to?" },
      { sLine: "Noooo, /DECEASED/! I wish I could've known you better. :[" },
      { sLine: '/DECEASED/ is gone. Well, this is just awful. I give up.', tTags: ['angry'] },
    ],
  },

  DEATH_REACT_ENEMY: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: 'Looks like we got one of those bastards!' },
      { sLine: "Dead! That's what you get when you infiltrate our base!", tTags: ['xenophobe'] },
      { sLine: 'Looks like we took out another one of these trespassers...' },
    ],
  },

  DEATH_REACT_FRIEND: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: "I can't believe /DECEASED/ is really gone. We gotta help each other through this." },
      { sLine: "I'll miss you so much, /DECEASED/." },
      { sLine: "Nothing's the same without /DECEASED/. Taken from us too soon." },
      { sLine: "At this point, I don't really know how I'm going to go on without my friend /DECEASED/.", tTags: ['angry'] },
    ],
  },

  DEATH_REACT_RAIDER_TO_CITZ: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: "Haha. /DECEASED/ is dead. Who's next!" },
      { sLine: 'Who cares if /DECEASED/ is dead. Survival of the fittest!' },
      { sLine: '/DECEASED/ is dead? Did I kill him? I lost track...' },
    ],
  },

  DEATH_REACT_RAIDER_TO_RAIDER: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: 'Man down! Man down!' },
      { sLine: "I can't believe they killed /DECEASED/! These base punks are gonna pay!" },
      { sLine: '/DECEASED/ is dead?! Our numbers are getting too low!' },
      { sLine: "They got /DECEASED/? I knew this wasn't a good idea..." },
    ],
  },

  DEATH_GENERIC: { category: 'death', lines: [] },
  DEATH_FIRE: { category: 'death', lines: [] },

  DEATH_CHESTBURST: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: 'ARRRRGGGGHHH!! WHATS HAPPENING TO ME!!' },
      { sLine: "NOOOO! MY CHEST! SOMETHING'S COMING OUT!" },
      { sLine: "I can feel it moving inside me... this can't be happening!" },
      { sLine: 'AGHHH! IT HURTS! SOMEONE HELP ME!' },
      { sLine: '*horrible gurgling sounds*' },
      { sLine: 'MY INSIDES... SOMETHING IS WRONG... VERY WRONG...' },
      { sLine: 'I KNEW something was off... AHHHHHGGGG!' },
      { sLine: 'THE PAIN! THE PAIIIIN!' },
      { sLine: 'GAAAHH! NO NO NO NO NO!' },
    ],
  },

  DEATH_THING: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: 'Well, I guess its time to transform..ARRRGHHHH' },
      { sLine: 'Foolish breathers...they never expected me..ARGHHHHHH!' },
      { sLine: 'Whom shall I assimilate first..ARGHHHHHH!' },
      { sLine: 'Well, transforming will probably be painful..but I am quite hungry ARGHHHHHHH!' },
      { sLine: 'ARGHHHHHHH!' },
    ],
  },

  DEATH_SUFFOCATION: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: "I can't breathe!" },
      { sLine: "I haven't been breathing for a while. Probably going to die. Whatever.", tTags: ['hipster'] },
      { sLine: "Death by asphyxiation is not as fun as I thought it would be..." },
      { sLine: 'I guess this is it. No more oxygen. No more more me.' },
      { sLine: "I always thought I'd die in a battle with pirates... not by suffocation.", tTags: ['brave'] },
      { sLine: "You hear about bases losing oxygen and suffocating everyone, but you never think it's going to happen to you.", tTags: ['optimist'] },
      { sLine: "Somebody get some oxygen pumping or we're all going to die!" },
      { sLine: 'I can see the light... and it\'s beautiful. Wait, no, I think that\'s a broken O2 recycler.', tTags: ['joker'] },
      { sLine: "I'm dying... and I... still feel like... posting on Spaceface. I have a problem." },
      { sLine: 'Too... hard... to breathe...' },
    ],
  },

  DEATH_STARVATION: {
    category: 'death',
    priority: 4,
    lines: [
      { sLine: 'so... hungry...' },
      { sLine: '...can\'t go on any more...' },
      { sLine: '...food. need food. so badly.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FIRE / DISASTER (priority 3)
  // ═══════════════════════════════════════════════════════════════════
  CAUGHT_FIRE: {
    category: 'disaster',
    priority: 3,
    lines: [
      { sLine: 'My head ignited today while I was trying to stomp out a fire. Now I smell like burnt hair.' },
      { sLine: 'I forgot to stop, drop and roll when I caught fire, and now I need some new pants and a skin graft.' },
      { sLine: 'Today was a day of horror. I caught fire and ruined my new shirt.' },
      { sLine: 'I tried to be the hero today, but I ended up running around on fire. Not my finest hour.' },
      { sLine: 'I seriously need some flame retardant clothes. I keep catching on fire!' },
    ],
  },

  CAUGHT_FIRE_MANY: {
    category: 'disaster',
    priority: 3,
    lines: [
      { sLine: "I can't believe I caught on fire AGAIN. /TIMESBURNED/ times now!" },
      { sLine: 'Who catches on fire /TIMESBURNED/ times? Me. I am an idiot.', tTags: ['insecure'] },
      { sLine: 'My head ignited today while I was trying to stomp out a fire. Now I smell like burnt hair.' },
      { sLine: 'I forgot to stop, drop and roll when I caught fire, and now I need some new pants and a skin graft.' },
      { sLine: 'Today was a day of horror. I caught fire and ruined my new shirt.' },
      { sLine: 'I tried to be the hero today, but I ended up running around on fire. Not my finest hour.' },
      { sLine: 'I seriously need some flame retardant clothes. I keep catching on fire!' },
      { sLine: 'I think the gods hate me. They keep lighting me on fire!', tTags: ['anxious'] },
      { sLine: 'Catching on fire is pretty much the worst thing.' },
    ],
  },

  DISASTER_FIRE: {
    category: 'disaster',
    priority: 3,
    lines: [
      { sLine: 'FIRE! FIRE! Everybody get out!' },
      { sLine: "There's a fire in /CURRENTROOM/! This is bad!", tTags: ['anxious'] },
      { sLine: 'Fire! Someone call... wait, who do we call? Just RUN!' },
      { sLine: "I can't believe this place is on fire. Who's responsible?!", tTags: ['angry'] },
      { sLine: "We need to contain this fire before it spreads!", tTags: ['brave'] },
      { sLine: 'The smoke is getting thick. We need to evacuate.', tTags: ['anxious'] },
      { sLine: "This fire is out of control. I hope we can save /CURRENTROOM/.", tTags: ['sad'] },
      { sLine: "I've seen fires before, but this one is scary.", tTags: ['brave'] },
      { sLine: 'Fire again?! We need better fire suppression systems!', tTags: ['angry'] },
    ],
  },

  DISASTER_MONSTER: { category: 'disaster', lines: [] },
  DISASTER_RAIDER: { category: 'disaster', lines: [] },

  DISASTER_BREACH: {
    category: 'disaster',
    priority: 3,
    lines: [
      { sLine: "Hull breach! The oxygen's venting into space!", tTags: ['anxious'] },
      { sLine: "BREACH! Seal the doors NOW!", tTags: ['brave'] },
      { sLine: "We've got a breach! Everyone get to a sealed room!", tTags: ['brave'] },
      { sLine: "The wall's been breached! Air is escaping!", tTags: ['anxious'] },
      { sLine: "Hull integrity compromised! This is not a drill!", tTags: ['anxious'] },
      { sLine: "I can feel the air rushing out. We need to patch this NOW!", tTags: ['brave'] },
      { sLine: "Breach in /CURRENTROOM/! We're losing atmosphere!", tTags: ['anxious'] },
      { sLine: "Everyone to the escape pods! Just kidding, we don't have those. SEAL THE BREACH!", tTags: ['joker'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // RAMPAGE / BRIG (priority 2-3)
  // ═══════════════════════════════════════════════════════════════════
  RAMPAGE_START: {
    category: 'brig',
    priority: 3,
    lines: [
      { sLine: "THAT'S IT! I CAN'T TAKE IT ANYMORE!", tTags: ['angry'] },
      { sLine: 'EVERYONE GET OUT OF MY WAY!', tTags: ['angry'] },
      { sLine: "I'm DONE playing nice! DONE!", tTags: ['angry'] },
      { sLine: 'RAAAARGH! EVERYTHING IS TERRIBLE!', tTags: ['angry'] },
      { sLine: "I'm going to break EVERYTHING in sight!", tTags: ['angry'] },
    ],
  },

  TANTRUM_START: {
    category: 'brig',
    priority: 3,
    lines: [
      { sLine: '*kicks nearest object*', tTags: ['angry'] },
      { sLine: '*throws things around*', tTags: ['angry'] },
      { sLine: 'Why does everything on this base have to SUCK so much?!', tTags: ['angry'] },
      { sLine: "I'm so frustrated I could SCREAM!", tTags: ['angry'] },
      { sLine: '*stomps around angrily*', tTags: ['angry'] },
    ],
  },

  RAMPAGE_NEARBY: {
    category: 'brig',
    priority: 3,
    lines: [
      { sLine: '/RAMPAGER/ is on a rampage! Everyone get back!', tTags: ['anxious'] },
      { sLine: 'Whoa, /RAMPAGER/ has completely lost it!', tTags: ['anxious'] },
      { sLine: "Someone stop /RAMPAGER/ before they hurt someone!", tTags: ['brave'] },
      { sLine: '/RAMPAGER/ is destroying everything! Security!', tTags: ['anxious'] },
    ],
  },

  TANTRUM_NEARBY: {
    category: 'brig',
    priority: 3,
    lines: [
      { sLine: '/RAMPAGER/ is throwing a tantrum. Yikes.', tTags: ['chill'] },
      { sLine: "I can tell /RAMPAGER/ is having a bad day. I'm staying out of their way.", tTags: ['shy'] },
      { sLine: "Looks like /RAMPAGER/ finally snapped. Can't say I'm surprised.", tTags: ['pessimist'] },
      { sLine: "Poor /RAMPAGER/. Someone should talk to them... but not me.", tTags: ['shy'] },
    ],
  },

  BRIG_ASSIGN_INCAPACITATED: {
    category: 'brig',
    priority: 2,
    lines: [
      { sLine: "They put me in the brig while I'm hurt?! That's cold.", tTags: ['angry'] },
      { sLine: "I'm in the brig AND injured. Great combo.", tTags: ['pessimist'] },
      { sLine: 'At least in the brig I can rest... if they let me.', tTags: ['optimist'] },
      { sLine: "Locked up and wounded. Could things get any worse?", tTags: ['sad'] },
    ],
  },

  BRIG_ASSIGN_NOT_INCAPACITATED: {
    category: 'brig',
    priority: 2,
    lines: [
      { sLine: "The brig. Wonderful. Just wonderful.", tTags: ['pessimist'] },
      { sLine: "I didn't do anything wrong! ...okay maybe I did.", tTags: ['insecure'] },
      { sLine: "Fine, lock me up. See if I care.", tTags: ['angry'] },
      { sLine: "The brig isn't so bad. At least nobody can bother me in here.", tTags: ['shy'] },
    ],
  },

  BRIG_ESCAPE: {
    category: 'brig',
    priority: 2,
    lines: [
      { sLine: "I'm out! Freedom!", tTags: ['happy'] },
      { sLine: "Nobody can keep /MYNAME/ locked up forever!", tTags: ['brave'] },
      { sLine: 'Made it out of the brig. Time to lay low for a while.', tTags: ['anxious'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FOOD / DRINK
  // ═══════════════════════════════════════════════════════════════════
  EAT_REPLICATOR: {
    category: 'food',
    lines: [
      { sLine: "I'll eat this replicated food... but in protest. This crap isn't natural.", tTags: ['gourmand'] },
      { sLine: "Some people swear by cooked food, but that's too much human error for my tastes." },
      { sLine: 'How do replicators work? This thing is crazy!' },
      { sLine: "I don't care if it costs matter, I like having unlimited nutrient paste at the push of a button.", tTags: ['n_gourmand'] },
      { sLine: "I wish they would invent a replicator that just spawns food in your stomach, so I don't have to waste time chewing.", tTags: ['n_gourmand'] },
      { sLine: 'I hate eating food out of machines. What do robots know about cooking?', tTags: ['gourmand'] },
      { sLine: "I'm the only one getting a weird aftertaste from this replicator food? Do I just have an over-educated palette?" },
      { sLine: "We need more recipe codes in this replicator. I'm getting sick of eating the same 10,000 things all the time.", tTags: ['sad'] },
      { sLine: 'I just replicated some more /FAVORITEFOOD/. I think I have a problem.' },
      { sLine: "I'm glad we have a replicator on this base. Means I can get /FAVORITEFOOD/ whenever I want it." },
      { sLine: 'This replicator needs an "Extra Sauce" button.' },
      { sLine: 'This food isn\'t keeping me alive so much as it\'s keeping me from dying.', tTags: ['pessimist'] },
      { sLine: 'This replicator food sure does make me feel like a lab rat! So how does one escape this kind of experiment?', tTags: ['angry'] },
    ],
  },

  ENEMY_EAT_REPLICATOR: {
    category: 'food',
    lines: [
      { sLine: 'Hey, they have a replicator! Snack time!' },
      { sLine: "Taking a break from killing for a sec, so I can replicate some /FAVORITEFOOD/." },
      { sLine: "Maybe I'll replicate some /FAVORITEFOOD/. It's not MY matter!" },
      { sLine: "These fools don't have any proper recipe codes in their replicator! How do they live like this?" },
      { sLine: "They have the /FAVORITEFOOD/ recipe code in their replicator! I'm almost sorry about robbing them." },
      { sLine: 'This replicator needs an "Extra Sauce" button.' },
    ],
  },

  EAT_RAW_FOOD: {
    category: 'food',
    lines: [
      { sLine: "I like plucking my food right off the plant. You can be sure no one has tainted it with artificial crap.", tTags: ['gourmand'] },
      { sLine: 'Can you still call yourself a vegetarian if you eat meat from plants?' },
      { sLine: 'I hate raw food, but at least it doesn\'t use up all of our matter...' },
      { sLine: 'MMMMMMM! Fresh veggies right off the vine! So healthy...', tTags: ['jock'] },
      { sLine: 'These raw vegetables are wreaking havoc on my guts. I\'ll spare you the gory details.' },
      { sLine: 'This metacorn is alright, but I wish someone would figure out how to splice meat and potatoes.' },
      { sLine: 'Seeing fruit bearing plants calms my nerves. Eating them calms my stomach.' },
    ],
  },

  ENEMY_EAT_RAW_FOOD: {
    category: 'food',
    lines: [
      { sLine: 'I love pillaging bases with garden zones. I can pick some food to snack on between murders.' },
      { sLine: 'I love killing people and then eating their vegetables.' },
      { sLine: 'Yeah, I ate your vegetables! What are you going to do about it!' },
      { sLine: "I love stealing fruit and vegetables. Probably more than material possessions. Is that weird?" },
    ],
  },

  EAT_COOKED_MEAL_GOOD: {
    category: 'food',
    priority: 2,
    lines: [
      { sLine: "I'm so glad we teched up to cooked food. I was getting sick to death of nutrient paste and raw vegetables." },
      { sLine: '/MYMEAL/ is so much better freshly cooked! The replicator version is too stingy with the sauce.' },
      { sLine: 'That /MYMEAL/ was delish, but it was a bit too hot. Burned the roof of my mouth.' },
      { sLine: "You haven't had /MYMEAL/ until you've had it cooked fresh. You can't replicate that.", tTags: ['gourmand'] },
      { sLine: "This /MYMEAL/ is pretty tasty, but it can't compare to the best /FAVORITEFOOD/ I've had.", tTags: ['gourmand'] },
    ],
  },

  EAT_COOKED_MEAL_BAD: {
    category: 'food',
    priority: 2,
    lines: [
      { sLine: 'I think this bartender smokes too much. How much pepper does this /MYMEAL/ need?' },
      { sLine: 'Call me low rent, but I prefer replicated food to this cooked garbage.', tTags: ['n_gourmand'] },
      { sLine: 'This /MYMEAL/ is decent, but I think this bartender needs to focus on slinging drinks.' },
      { sLine: "I've had better /MYMEAL/ on other bases. 2 stars.", tTags: ['gourmand'] },
      { sLine: "I should've checked that bar's rating before eating there. I could've replicated better /MYMEAL/.", tTags: ['gourmand'] },
    ],
  },

  EAT_COOKED_MEAL_FAVORITE: {
    category: 'food',
    priority: 3,
    lines: [
      { sLine: 'OMZ. /FAVORITEFOOD/ is my favorite! BEST DAY EVER.' },
    ],
  },

  DRINK_GOOD_MORALE: {
    category: 'food',
    lines: [
      { sLine: "Nothing beats a good /RANDOMDRINKNAME/ after a long shift.", tTags: ['boozer'] },
      { sLine: 'This drink is fantastic! Bartender really outdid themselves.' },
      { sLine: "I'm feeling much better after that drink.", tTags: ['happy'] },
      { sLine: 'A good drink with good company. This is the life.', tTags: ['gregarious'] },
      { sLine: "Cheers! Here's to another day on this crazy base!", tTags: ['optimist'] },
    ],
  },

  DRINK_BAD_MORALE: {
    category: 'food',
    lines: [
      { sLine: 'This drink tastes like engine coolant.', tTags: ['angry'] },
      { sLine: "I'm drinking to forget my problems. It's not working.", tTags: ['sad'] },
      { sLine: "They call this a drink? I've had better from a recycler.", tTags: ['gourmand'] },
      { sLine: 'Even drinking can\'t cheer me up today.', tTags: ['pessimist'] },
      { sLine: 'I think this drink made me feel WORSE.', tTags: ['angry'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MORALE
  // ═══════════════════════════════════════════════════════════════════
  MORALE_GENERIC_GOOD: { category: 'morale', lines: [] },
  MORALE_GENERIC_BAD: { category: 'morale', lines: [] },

  MORALE_HIGH_OXYGEN: {
    category: 'morale',
    priority: 3,
    lines: [
      { sLine: 'Air again! I thought I was going to die!' },
      { sLine: 'That fresh air after an oxygen scare is the best smelling fresh air of my life.' },
      { sLine: 'So glad oxygen is back. Breathing was becoming more of a chore than usual.', tTags: ['lazy'] },
      { sLine: 'Breathing feels good again. Weird that something so basic can make you so dang happy.', tTags: ['happy'] },
      { sLine: "I actually feel really grateful for basic air to breathe. I wonder if that makes me humble or pathetic.", tTags: ['insecure'] },
      { sLine: "Life support restored. I'm going to go do something I enjoy, because that was too close.", tTags: ['optimist'] },
      { sLine: 'I used to take air for granted. Not anymore!', tTags: ['optimist'] },
      { sLine: 'I was really scared there for a minute. I have a new lease on life!' },
      { sLine: "OKAY, I can breathe again. I think maybe I'll leave this room though, just to be safe.", tTags: ['coward'] },
    ],
  },

  MORALE_LOW_OXYGEN: {
    category: 'morale',
    priority: 3,
    lines: [
      { sLine: "The oxygen's getting pretty low in this part of the base." },
      { sLine: 'Is anyone else having trouble breathing?' },
      { sLine: 'Great. Now I\'m wheezing. Who is running Life Support in this place?!', tTags: ['angry'] },
      { sLine: 'Is it just me, or is it getting hard to breathe in here?' },
      { sLine: 'My breathing is getting labored. Maybe I should take it easy...' },
      { sLine: "OK. I'm starting to get worried about the oxygen situation." },
      { sLine: 'They promised me that there would be plenty of oxygen on the base. Well, they lied.', tTags: ['angry'] },
      { sLine: "Funny. You never really think about breathing until you start running out of oxygen." },
      { sLine: "I'm sure someone is looking into the oxygen situation, right? This is ridiculous." },
      { sLine: 'The oxygen quality in this part of the base stinks. No, like literally stinks. It smells bad.', tTags: ['angry'] },
      { sLine: "I'm dying... and I... still feel like... posting on Spaceface. I have a problem." },
      { sLine: 'Too... hard... to breathe...' },
    ],
  },

  MORALE_LOW_DUTY: {
    category: 'morale',
    lines: [
      { sLine: "It's been too long since I did something useful... startin' to get itchy. People gotta feel productive, you know?", tTags: ['happy'] },
      { sLine: 'Booored. Someone point me towards some work!' },
      { sLine: 'I would totally just do random scut work right now if someone told me to. Just wanna be useful!' },
      { sLine: "I've been feeling really unfulfilled lately. I need more meaningful work.", tTags: ['sad'] },
      { sLine: "There's gotta be something I can do around here. Standing around is killing me.", tTags: ['hardworking'] },
      { sLine: "My skills are going to waste. I need a real assignment.", tTags: ['angry'] },
      { sLine: "What's the point of being here if I'm not contributing?", tTags: ['sad'] },
      { sLine: "I wish someone would give me a task. Any task. I'm going crazy!", tTags: ['anxious'] },
      { sLine: "Feeling pretty useless right now. Maybe I should volunteer for something.", tTags: ['insecure'] },
      { sLine: "I miss having a purpose. Work gives me meaning.", tTags: ['hardworking'] },
      { sLine: 'The only thing worse than hard work is no work at all.', tTags: ['hardworking'] },
      { sLine: "I need to be busy. Idle hands and all that.", tTags: ['anxious'] },
      { sLine: "If they don't give me something to do soon, I'm going to start making my own fun.", tTags: ['angry'] },
    ],
  },

  MORALE_LOW_SOCIAL: {
    category: 'morale',
    lines: [
      { sLine: "I haven't talked to anyone in a while. Feeling kind of isolated.", tTags: ['sad'] },
      { sLine: "Would it kill someone to have a conversation with me?", tTags: ['lonely'] },
      { sLine: "I'm starting to feel really lonely. This base can be a cold place.", tTags: ['sad'] },
      { sLine: "Even for me, this amount of isolation is too much. I need to talk to someone.", tTags: ['shy'] },
    ],
  },

  MORALE_LOW_AMUSEMENT: {
    category: 'morale',
    lines: [
      { sLine: "I'm so BORED. We need something fun to do around here!", tTags: ['angry'] },
      { sLine: "This base needs more entertainment. I'm dying of boredom.", tTags: ['sad'] },
      { sLine: "All work and no play... I need a break.", tTags: ['tired'] },
    ],
  },

  MORALE_LOW_ENERGY: {
    category: 'morale',
    lines: [
      { sLine: "I'm exhausted. When was the last time I slept?", tTags: ['tired'] },
      { sLine: "So... tired... can barely keep my eyes open.", tTags: ['tired'] },
      { sLine: "I need a nap. Or ten.", tTags: ['lazy'] },
      { sLine: "Running on fumes here. Need rest ASAP.", tTags: ['tired'] },
    ],
  },

  MORALE_LOW_HUNGER: {
    category: 'morale',
    priority: 2,
    lines: [
      { sLine: "Can't remember last time I ate. Dizzy." },
      { sLine: "My stomach is growling so loud people can hear it.", tTags: ['hungry'] },
      { sLine: "I need food. Like, yesterday.", tTags: ['hungry'] },
      { sLine: "If I don't eat something soon I'm going to lose it.", tTags: ['angry', 'hungry'] },
      { sLine: "Is it too much to ask for regular meals around here?!", tTags: ['angry'] },
    ],
  },

  MORALE_LOW_STUFF: {
    category: 'morale',
    priority: 2,
    lines: [
      { sLine: "I don't have any personal belongings. This is depressing.", tTags: ['sad'] },
      { sLine: "Everyone else has stuff. I have nothing. Nothing!", tTags: ['angry'] },
      { sLine: "I could really use some personal items to make this place feel like home.", tTags: ['sentimental'] },
      { sLine: "I need STUFF. Decorations, trinkets, anything!", tTags: ['angry'] },
      { sLine: "Life without personal possessions is so... empty.", tTags: ['sad'] },
    ],
  },

  MORALE_HIGH_DUTY: {
    category: 'morale',
    lines: [
      { sLine: "I feel so productive today! Best day ever!", tTags: ['happy'] },
      { sLine: "Nothing beats the feeling of a job well done.", tTags: ['hardworking'] },
      { sLine: "I'm in the zone! Everything I do turns out great!", tTags: ['egoist'] },
    ],
  },

  MORALE_HIGH_SOCIAL: {
    category: 'morale',
    lines: [
      { sLine: "Great conversations today. I love this crew!", tTags: ['gregarious'] },
      { sLine: "The people on this base are the best. So glad I'm here.", tTags: ['happy'] },
      { sLine: "I feel so connected to everyone. This is my family now.", tTags: ['sentimental'] },
    ],
  },

  MORALE_HIGH_AMUSEMENT: {
    category: 'morale',
    lines: [
      { sLine: "Had a blast today! This base actually has fun stuff to do!", tTags: ['happy'] },
      { sLine: "Life on a space base isn't so bad when there's entertainment!", tTags: ['optimist'] },
      { sLine: "Best. Day. Off. EVER.", tTags: ['happy'] },
    ],
  },

  MORALE_HIGH_ENERGY: {
    category: 'morale',
    lines: [
      { sLine: "I'm well-rested and ready to tackle anything!", tTags: ['happy'] },
      { sLine: "Slept like a baby. Feeling great!", tTags: ['happy'] },
      { sLine: "Full of energy today. Let's do this!", tTags: ['hardworking'] },
    ],
  },

  MORALE_HIGH_HUNGER: {
    category: 'morale',
    lines: [
      { sLine: "Full stomach, happy heart. Life is good.", tTags: ['happy'] },
      { sLine: "That meal really hit the spot!", tTags: ['gourmand'] },
      { sLine: "Well fed and content. What more could you ask for?", tTags: ['chill'] },
    ],
  },

  MORALE_COOL_PUB: {
    category: 'morale',
    lines: [
      { sLine: "This pub is awesome! Great atmosphere.", tTags: ['happy'] },
      { sLine: "The pub is my favorite room on this base.", tTags: ['boozer'] },
      { sLine: "Nothing like kicking back at the pub after a long shift.", tTags: ['chill'] },
      { sLine: "The pub always cheers me up. Great vibes in here.", tTags: ['gregarious'] },
      { sLine: "I could spend all day in this pub. And I just might.", tTags: ['lazy'] },
    ],
  },

  MORALE_COOL_GARDEN: {
    category: 'morale',
    lines: [
      { sLine: "The garden is so peaceful. I love it here.", tTags: ['chill'] },
      { sLine: "Being around plants calms me down.", tTags: ['chill'] },
      { sLine: "The garden smells amazing! Like a little piece of old Earth.", tTags: ['sentimental'] },
      { sLine: "I wish we had more gardens. Green spaces are good for the soul.", tTags: ['optimist'] },
      { sLine: "This garden is my happy place.", tTags: ['happy'] },
    ],
  },

  MORALE_COOL_ROOM_GENERIC: {
    category: 'morale',
    lines: [
      { sLine: "This room is really well put together. Nice job, builders!", tTags: ['happy'] },
      { sLine: "/CURRENTROOM/ has a nice vibe to it.", tTags: ['chill'] },
      { sLine: "I like this room. It feels... cozy. For a space base, I mean.", tTags: ['optimist'] },
      { sLine: "Every time I'm in /CURRENTROOM/ I feel a little better.", tTags: ['happy'] },
      { sLine: "/CURRENTROOM/ is my favorite room. Don't tell the other rooms.", tTags: ['joker'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SLEEP
  // ═══════════════════════════════════════════════════════════════════
  SLEEP_FLOOR: {
    category: 'sleep',
    priority: 3,
    lines: [
      { sLine: 'Slept on the floor again. My back is killing me.', tTags: ['angry'] },
      { sLine: "Is it too much to ask for a bed? Any bed?", tTags: ['sad'] },
      { sLine: "Floor sleeping. It's as glamorous as it sounds.", tTags: ['pessimist'] },
      { sLine: "I'm getting used to sleeping on the floor. That can't be a good sign.", tTags: ['sad'] },
      { sLine: "The floor is cold and hard but at least it's... no, it's just cold and hard.", tTags: ['pessimist'] },
      { sLine: "I dreamed I had a real bed. Then I woke up on the floor.", tTags: ['sad'] },
      { sLine: "My neck hurts from sleeping on the floor. We NEED more beds.", tTags: ['angry'] },
      { sLine: "At this point I'd sleep anywhere. Even the floor. Oh wait, I already do.", tTags: ['pessimist'] },
      { sLine: "Just woke up on the floor. Again. Living the dream.", tTags: ['joker'] },
      { sLine: "Sleeping on the floor makes me feel like a caveman. A space caveman.", tTags: ['joker'] },
      { sLine: "I've had it with floor-sleeping. Someone build some beds!", tTags: ['angry'] },
      { sLine: "The floor isn't so bad once you're unconscious. The waking up part sucks though." },
    ],
  },

  SLEEP_BED_OWNED: {
    category: 'sleep',
    priority: 2,
    lines: [
      { sLine: 'My own bed! Nothing beats sleeping in your own bed.', tTags: ['happy'] },
      { sLine: "Ahh, my bed. Sweet, sweet bed. I missed you.", tTags: ['sentimental'] },
      { sLine: "Best night's sleep I've had in ages. Thank you, personal bed!", tTags: ['happy'] },
      { sLine: 'Having my own bed makes such a difference for morale.', tTags: ['happy'] },
      { sLine: "I customized my bed with extra pillows. Living the good life.", tTags: ['neat'] },
      { sLine: "My bed is my sanctuary. Nobody else touches it.", tTags: ['neat'] },
      { sLine: "Slept like a log in my own bed. What a luxury.", tTags: ['happy'] },
      { sLine: "My bed. My rules. My eight hours of paradise.", tTags: ['chill'] },
      { sLine: "Woke up feeling refreshed! Sleep is important, people!", tTags: ['happy'] },
      { sLine: "Having a bed assigned to me makes me feel like this place is actually home.", tTags: ['sentimental'] },
      { sLine: "Every time I sleep in my own bed, I wake up grateful.", tTags: ['optimist'] },
    ],
  },

  SLEEP_BED_UNOWNED: {
    category: 'sleep',
    priority: 3,
    lines: [
      { sLine: "I slept in someone else's bed. Hope they don't mind.", tTags: ['anxious'] },
      { sLine: "No beds available, so I crashed in the first one I found.", tTags: ['lazy'] },
      { sLine: "This isn't my bed, but at least it's not the floor.", tTags: ['optimist'] },
      { sLine: "I need my own bed. Sharing is... awkward.", tTags: ['shy'] },
      { sLine: "Borrowing someone's bed without asking. Sorry, not sorry.", tTags: ['chill'] },
      { sLine: "Slept in a random bed. Dreamed I had my own. Woke up sad.", tTags: ['sad'] },
      { sLine: "I don't care whose bed this is. I'm tired.", tTags: ['tired'] },
      { sLine: "Using an unassigned bed. It's fine but it doesn't feel like home.", tTags: ['sad'] },
      { sLine: "Not my bed, but beggars can't be choosers.", tTags: ['pessimist'] },
      { sLine: "I keep taking other people's beds. I'm becoming THAT person.", tTags: ['insecure'] },
      { sLine: "Any bed is better than the floor. Even someone else's.", tTags: ['optimist'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACTIVITIES
  // ═══════════════════════════════════════════════════════════════════
  WORK_OUT: {
    category: 'activity',
    priority: 0,
    lines: [
      { sLine: "Working out! Gotta stay in shape for space living.", tTags: ['jock'] },
      { sLine: "Push-ups, sit-ups, and plenty of air squats. That's my routine.", tTags: ['jock'] },
      { sLine: "I love working out. It's the only time I feel truly alive!", tTags: ['jock'] },
      { sLine: "Exercise is key to maintaining both physical and mental health in space.", tTags: ['hardworking'] },
      { sLine: "Just finished a set. Feeling the burn!", tTags: ['jock'] },
      { sLine: "Working out is better than therapy. And cheaper.", tTags: ['jock'] },
      { sLine: "I could use a workout partner. Any takers?", tTags: ['gregarious'] },
      { sLine: "My muscles are sore but in a good way.", tTags: ['jock'] },
      { sLine: "Does working out in zero-g count? Because I'm counting it.", tTags: ['lazy'] },
      { sLine: "Breaking a sweat! This is what it's all about!", tTags: ['jock'] },
      { sLine: "I try to work out every day. Discipline is everything.", tTags: ['hardworking'] },
      { sLine: "I hate exercising but I hate being out of shape more.", tTags: ['pessimist'] },
      { sLine: "Working out clears my head better than anything.", tTags: ['chill'] },
      { sLine: "New personal record! Nobody cares but ME!", tTags: ['competitive'] },
    ],
  },

  LIFT_WEIGHTS: {
    category: 'activity',
    lines: [
      { sLine: "Heavy lifts today! Getting stronger every session.", tTags: ['jock'] },
      { sLine: "These weights aren't going to lift themselves.", tTags: ['hardworking'] },
      { sLine: "Bench press: new max! Feelin' good!", tTags: ['competitive'] },
      { sLine: "Weight training in space. It's harder than you'd think.", tTags: ['jock'] },
      { sLine: "I could out-lift anyone on this base.", tTags: ['egoist', 'competitive'] },
      { sLine: "Lifting weights is my therapy.", tTags: ['chill'] },
      { sLine: "Squats and deadlifts. The fundamentals.", tTags: ['jock'] },
      { sLine: "I love the feeling of cold iron in my hands.", tTags: ['jock'] },
      { sLine: "Weight room is my happy place.", tTags: ['jock'] },
      { sLine: "Getting jacked in space. Sounds like a book title.", tTags: ['joker'] },
    ],
  },

  PLAY_GAME_SYSTEM: {
    category: 'activity',
    lines: [
      { sLine: "I just spent /PLAYTIME/ hours playing /RANDOMGAME/ and powered down without saving. I want to die.", tTags: ['angry'] },
      { sLine: 'Are you kidding me?! My /RANDOMGAME/ save is corrupted!' },
      { sLine: "I can't stop thinking about playing /RANDOMGAME/. I hope my /MYDUTY/ duties don't suffer..." },
      { sLine: "I can't believe I just played /RANDOMGAME/ for /PLAYTIME/ hours..." },
      { sLine: 'I think /RANDOMGAME/ is an overrated game. Too many crates.' },
      { sLine: "I can't believe how many quick time events there are in /RANDOMGAME/!! Enough already!" },
      { sLine: "It's pretty insane how realistic the graphics are in /RANDOMGAME/." },
      { sLine: 'Guh! I noticed my reflection on screen for a split second and it screwed up my speed run of /RANDOMGAME/.' },
      { sLine: "I wouldn't even call /RANDOMGAME/ a game. It's all cutscenes!" },
      { sLine: 'I think playing /RANDOMGAME/ actually helps my dexterity as a /MYDUTY/.' },
      { sLine: 'Playing this stupid game is such a pitiful escape from the real problems in my life.', tTags: ['angry'] },
      { sLine: "When stuff is going bad, /RANDOMGAME/ usually cheers me up. Not today. Hm.", tTags: ['angry'] },
    ],
  },

  PLAY_GAME_SYSTEM_UNEMPLOYED: {
    category: 'activity',
    lines: [
      { sLine: "I just spent /PLAYTIME/ hours playing /RANDOMGAME/ and powered down without saving. I want to die.", tTags: ['angry'] },
      { sLine: 'Are you kidding me?! My /RANDOMGAME/ save is corrupted!' },
      { sLine: 'The best thing about being unassigned is getting to play /RANDOMGAME/ all day!' },
      { sLine: "I can't believe I just played /RANDOMGAME/ for /PLAYTIME/ hours..." },
      { sLine: 'Games are getting me too frustrated. I hope they assign me to some duty soon.' },
      { sLine: 'I think /RANDOMGAME/ is an overrated game. Too many crates.' },
      { sLine: "I can't believe how many quick time events there are in /RANDOMGAME/!! Enough already!" },
      { sLine: "It's pretty insane how realistic the graphics are in /RANDOMGAME/." },
      { sLine: 'Guh! I noticed my reflection on screen for a split second and it screwed up my speed run of /RANDOMGAME/.' },
      { sLine: "If I used my gaming energy to do duty, I'd be world-class at it by now. But try telling /RANDOMGAME/ that.", tTags: ['gamer', 'lazy'] },
    ],
  },

  WANDER: {
    category: 'activity',
    priority: 0,
    lines: [
      { sLine: "Just wandering around the base. Not much going on.", tTags: ['bored'] },
      { sLine: "Walking the corridors. It's peaceful, at least.", tTags: ['chill'] },
      { sLine: "Nothing to do, so I'm just walking around.", tTags: ['lazy'] },
      { sLine: "Exploring the base. You notice new things when you're not busy.", tTags: ['optimist'] },
      { sLine: "Aimless wandering. The story of my life.", tTags: ['pessimist'] },
      { sLine: "I like to walk around and people-watch. Don't judge me.", tTags: ['shy'] },
      { sLine: "These corridors all look the same after a while.", tTags: ['bored'] },
      { sLine: "Just taking a stroll. Getting my steps in.", tTags: ['jock'] },
      { sLine: "Walking helps me think. And right now I have a lot to think about." },
    ],
  },

  WANDER_SPACE: {
    category: 'activity',
    priority: 0,
    lines: [
      { sLine: "Spacewalking. It's beautiful out here.", tTags: ['brave'] },
      { sLine: "The stars are incredible. Almost makes the danger worth it.", tTags: ['optimist'] },
      { sLine: "I'm walking in SPACE. How cool is that?!", tTags: ['brave'] },
      { sLine: "The void of space is terrifying. And I'm standing in it.", tTags: ['anxious'] },
      { sLine: "Spacewalking is so peaceful. Just me and the cosmos.", tTags: ['chill'] },
      { sLine: "I can see the base from out here. It looks so small.", tTags: ['sentimental'] },
      { sLine: "One small step for me, one... well, just one small step.", tTags: ['joker'] },
      { sLine: "Space is so quiet. I love it.", tTags: ['shy'] },
      { sLine: "These space walks make me appreciate having walls and oxygen.", tTags: ['optimist'] },
      { sLine: "Walking in space. Still weird. Still awesome.", tTags: ['brave'] },
      { sLine: "I really hope my suit holds. The alternative is... not great.", tTags: ['anxious'] },
      { sLine: "Out in the black. Nothing between me and the universe.", tTags: ['brave'] },
      { sLine: "Spacewalking is either the bravest or stupidest thing I do.", tTags: ['brave', 'joker'] },
      { sLine: "The view from out here never gets old." },
      { sLine: "I wonder how far these asteroids go...", tTags: ['anxious'] },
      { sLine: "Walking through space, dodging debris. Just another day.", tTags: ['chill'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // DISEASE / PARASITE
  // ═══════════════════════════════════════════════════════════════════
  INFECTED_PARASITE: {
    category: 'health',
    priority: 2,
    lines: [
      { sLine: "Something feels... off. I can't quite put my finger on it." },
      { sLine: "My stomach has been acting up. Probably nothing." },
      { sLine: "I keep hearing this weird noise. Is it coming from... inside me?", tTags: ['anxious'] },
      { sLine: "I think I ate something bad. My insides are churning." },
      { sLine: "Is it normal to feel movement in your abdomen? Asking for a friend.", tTags: ['anxious'] },
      { sLine: "I'm fine. Everything is fine. Why does my chest hurt?", tTags: ['anxious'] },
      { sLine: "These stomach cramps are getting worse. Maybe I should see the doc." },
      { sLine: "I don't feel right. Something is very, very wrong." },
      { sLine: "HELP. Something is moving inside me. This is NOT normal!" },
    ],
  },

  WORM_STAGE_ONE: {
    category: 'health',
    priority: 2,
    lines: [
      { sLine: 'I keep hearing a little voice in my head. It keeps saying "dig".' },
      { sLine: "I've been having the strangest headaches lately..." },
      { sLine: "I can't explain it but I feel like something is... growing inside me?", tTags: ['anxious'] },
      { sLine: 'My appetite has changed drastically. I crave things I never liked before.' },
      { sLine: "I'm starting to see things that aren't there. At least I think they're not there." },
      { sLine: "Sometimes I black out and wake up in places I don't remember going to." },
      { sLine: "I think there's something wrong with me. But whenever I try to tell the doc, I stop myself." },
      { sLine: "This headache won't go away. It pulses. Like a heartbeat." },
      { sLine: "I've been sleepwalking. Found dirt under my fingernails this morning." },
      { sLine: 'The voice says everything will be fine. Maybe I should listen to it.' },
      { sLine: "I feel different. Not bad. Just... different. Like I'm not alone anymore." },
      { sLine: "My hands shake sometimes. I can't control it." },
    ],
  },

  WORM_STAGE_TWO: {
    category: 'health',
    priority: 2,
    lines: [
      { sLine: 'THE WORM IS MY FRIEND. THE WORM PROVIDES.' },
      { sLine: 'I MUST SPREAD THE GIFT. EVERYONE MUST KNOW THE WORM.' },
      { sLine: 'The worm has shown me the truth. We are all connected.' },
      { sLine: 'Why do they resist? The worm only wants to help.' },
      { sLine: "I tried to tell the others about the worm's love. They don't understand yet." },
      { sLine: "The worm whispers beautiful things to me. I can't wait to share them." },
      { sLine: 'EVERYONE SHOULD HAVE A WORM. IT COMPLETES YOU.' },
      { sLine: "I feel so much better now. The worm takes away all the pain." },
      { sLine: "Before the worm, I was lost. Now I have purpose." },
      { sLine: "The administrator doesn't understand. The worm is the answer to everything." },
      { sLine: 'DIG DIG DIG DIG DIG' },
      { sLine: "I've been trying to convert /NEARBYPERSON/. They'll come around." },
      { sLine: 'The worm says we need more hosts. I agree.' },
      { sLine: 'My body is just a vessel now. And that is beautiful.' },
      { sLine: 'THE COLLECTIVE GROWS. THE WORM REJOICES.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MONSTER / KILLBOT
  // ═══════════════════════════════════════════════════════════════════
  MONSTER_GENERIC: {
    category: 'monster',
    lines: [
      { sLine: '* salivates *' },
      { sLine: '* roars; smacks chops *' },
      { sLine: '* bites at the air *' },
      { sLine: '* licks viscera from teeth *' },
      { sLine: '* gnashes teeth *' },
      { sLine: '* gazes pensively into the middle distance *' },
      { sLine: '* drools *' },
      { sLine: '* shrieks apprehensively *' },
      { sLine: '* emits gas *' },
      { sLine: '* skitters nervously *' },
      { sLine: '* scans for victims *' },
      { sLine: '* ponders own existence *' },
      { sLine: '* hungers *' },
      { sLine: '* breathes menacingly *' },
      { sLine: '* bellows demonstrably *' },
      { sLine: '* clicks teeth *' },
      { sLine: '* belches rudely; unapologetically *' },
      { sLine: '* idles listlessly *' },
      { sLine: '* scrabbles around restlessly *' },
      { sLine: '* spits acid *' },
    ],
  },

  KILLBOT_GENERIC: {
    category: 'monster',
    lines: [
      { sLine: '10010100100010101' },
      { sLine: '10011001' },
      { sLine: '100110101100100110101' },
      { sLine: '10010' },
      { sLine: '100111011111111' },
      { sLine: '0010010001011011011' },
      { sLine: '0101001' },
      { sLine: '0010010' },
      { sLine: '100100111010' },
      { sLine: '10010101' },
      { sLine: '010100001011111' },
    ],
  },
};
