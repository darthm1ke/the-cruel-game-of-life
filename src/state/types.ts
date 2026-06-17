/** The full mutable state of a run. Every number is a lever the systems fight over. */
export interface Stats {
  weight: number; // kg
  hunger: number; // 0..100 (high = danger)
  energy: number; // 0..100
  mood: number; // 0..100 (low = depression)
  control: number; // 0..100 (0 = game plays itself, badly)
  healthRisk: number; // 0..100 (100 = crash)
  hope: number; // 0..100
  money: number; // dollars
  debt: number; // dollars
}

export type ActionId =
  | 'work'
  | 'walk'
  | 'exercise'
  | 'cook'
  | 'snack'
  | 'skip'
  | 'search'
  | 'rest'
  | 'fridge'
  | 'med';

export interface ActionResult {
  id: ActionId;
  ok: boolean; // false if it couldn't run (gated)
  message: string; // darkly-funny line for the popup/log
  /** Stat deltas already applied to state; kept for the UI + verification logs. */
  deltas: Partial<Stats>;
  endsDay?: boolean; // some events burn the rest of the day
}

export type Cause =
  | 'alive'
  | 'won'
  | 'starved'
  | 'crash'
  | 'heart'
  | 'debt'
  | 'gaveup';

export interface PopupEvent {
  text: string;
  tone: 'bad' | 'good' | 'neutral';
}
