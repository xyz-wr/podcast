import { create } from 'zustand';

interface ConfirmDialog {
  kind: 'confirm'; title: string; message: string; okLabel: string; icon: string;
  resolve: (v: boolean) => void;
}
interface TextDialog {
  kind: 'text'; title: string; current: string; placeholder: string; okLabel: string;
  resolve: (v: string | null) => void;
}
export type Dialog = ConfirmDialog | TextDialog;
export interface Toast { msg: string; n: number; show: boolean }

interface UiState { dialog: Dialog | null; toast: Toast }
export const useUiStore = create<UiState>()(() => ({ dialog: null, toast: { msg: '', n: 0, show: false } }));

/** 떠 있는 창을 닫고 값을 돌려준다. 확인창은 boolean, 입력창은 string|null. */
export function closeDialog(value: boolean | string | null): void {
  const d = useUiStore.getState().dialog;
  if(!d) return;
  useUiStore.setState({ dialog: null });
  if(d.kind === 'confirm') d.resolve(value === true);
  else d.resolve(typeof value === 'string' ? value : null);
}

function open(d: Dialog): void {
  closeDialog(null);   // 앞의 창은 취소로 끝낸다 (확인창이면 false, 입력창이면 null)
  useUiStore.setState({ dialog: d });
}

/** legacy askConfirm(title, message, okLabel, icon) */
export function askConfirm(title: string, message: string, okLabel = '삭제', icon = '🗑️'): Promise<boolean> {
  return new Promise(resolve => open({ kind: 'confirm', title, message, okLabel, icon, resolve }));
}

/** legacy askText(title, current, placeholder, okLabel) — 확인하면 앞뒤 공백을 뺀 값, 취소하면 null */
export function askText(title: string, current = '', placeholder = '', okLabel = '확인'): Promise<string | null> {
  return new Promise(resolve => open({ kind: 'text', title, current, placeholder, okLabel, resolve }));
}

/** legacy toast(m): 1.8초 동안 표시 */
export function toast(msg: string): void {
  useUiStore.setState(s => ({ toast: { msg, n: s.toast.n + 1, show: true } }));
}
export function hideToast(): void {
  useUiStore.setState(s => ({ toast: { ...s.toast, show: false } }));
}
