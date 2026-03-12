import { GameRules } from '../core/GameRules';
import { Base } from '../core/Base';
import type { Character } from '../characters/Character';

export interface DialogueLine {
  id: string;
  text: string;
  duration: number;
  priority: number;
}

export type DialogueType = 
  | 'greeting'
  | 'complaint'
  | 'social'
  | 'work'
  | 'panic'
  | 'combat'
  | 'death'
  | 'random';

export class DialogueSystem {
  private activeBubbles: Map<number, {
    text: string;
    startTime: number;
    duration: number;
  }> = new Map();
  private dialogueQueue: Map<number, DialogueLine[]> = new Map();
  private lastDialogueTime: Map<number, number> = new Map();
  private readonly MIN_DIALOGUE_INTERVAL = 10;
  private readonly DEFAULT_DURATION = 3;

  private dialoguePools: Record<DialogueType, string[]> = {
    greeting: [
      "Hey there!",
      "Hello!",
      "Hi!",
      "Greetings!",
      "Welcome!",
    ],
    complaint: [
      "I'm hungry...",
      "So tired...",
      "It's cold in here.",
      "I need a break.",
      "This place is a mess.",
    ],
    social: [
      "Did you hear the news?",
      "Nice weather we're having!",
      "How's it going?",
      "Great chatting with you!",
      "We should hang out more.",
    ],
    work: [
      "Working hard!",
      "Almost done!",
      "This is taking forever...",
      "Job's done!",
      "On it!",
    ],
    panic: [
      "HELP!",
      "We're under attack!",
      "Fire! FIRE!",
      "I can't breathe!",
      "EVACUATE!",
    ],
    combat: [
      "Take that!",
      "For the base!",
      "Die, monster!",
      "I've got your back!",
      "Hostiles inbound!",
    ],
    death: [
      "Tell my family...",
      "Not like this...",
      "Goodbye...",
      "Argh!",
      "*gurgle*",
    ],
    random: [
      "Hmm...",
      "Interesting...",
      "I wonder...",
      "Space is big.",
      "What's for dinner?",
    ],
  };

  showBubble(charId: number, text: string, duration = this.DEFAULT_DURATION) {
    const now = GameRules.simTime;
    
    const lastTime = this.lastDialogueTime.get(charId) ?? 0;
    if (now - lastTime < this.MIN_DIALOGUE_INTERVAL) {
      const queue = this.dialogueQueue.get(charId) ?? [];
      queue.push({
        id: `dlg_${Date.now()}`,
        text,
        duration,
        priority: 1,
      });
      this.dialogueQueue.set(charId, queue);
      return;
    }

    this.activeBubbles.set(charId, {
      text,
      startTime: now,
      duration,
    });
    this.lastDialogueTime.set(charId, now);
  }

  sayRandom(charId: number, type: DialogueType) {
    const pool = this.dialoguePools[type];
    const text = pool[Math.floor(Math.random() * pool.length)];
    this.showBubble(charId, text);
  }

  onTick(dt: number) {
    const now = GameRules.simTime;

    for (const [charId, bubble] of this.activeBubbles) {
      if (now - bubble.startTime > bubble.duration) {
        this.activeBubbles.delete(charId);
        
        const queue = this.dialogueQueue.get(charId);
        if (queue && queue.length > 0) {
          const next = queue.shift()!;
          this.showBubble(charId, next.text, next.duration);
        }
      }
    }
  }

  getBubbleText(charId: number): string | null {
    const bubble = this.activeBubbles.get(charId);
    return bubble?.text ?? null;
  }

  hasActiveBubble(charId: number): boolean {
    return this.activeBubbles.has(charId);
  }

  clearBubble(charId: number) {
    this.activeBubbles.delete(charId);
  }

  clearAll() {
    this.activeBubbles.clear();
    this.dialogueQueue.clear();
    this.lastDialogueTime.clear();
  }

  onCharacterDeath(char: Character) {
    this.showBubble(char.id, this.dialoguePools.death[Math.floor(Math.random() * this.dialoguePools.death.length)], 2);
  }

  onCombatStart(charId: number) {
    if (Math.random() < 0.3) {
      this.sayRandom(charId, 'combat');
    }
  }

  onPanic(charId: number) {
    this.sayRandom(charId, 'panic');
  }
}

export const dialogueSystem = new DialogueSystem();
