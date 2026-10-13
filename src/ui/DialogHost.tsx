import { useEffect, useRef, useState } from 'react';
import { closeDialog, hideToast, useUiStore, type Dialog } from './store';

function TextBody({ d }: { d: Extract<Dialog, { kind: 'text' }> }) {
  const [value, setValue] = useState(d.current);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 60); return () => clearTimeout(t); }, []);
  return (
    <div className="confirm-card" style={{ textAlign: 'left' }}>
      <h3 id="textTitle" style={{ textAlign: 'center' }}>{d.title}</h3>
      <input ref={ref} type="text" id="textInput" placeholder={d.placeholder} value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if(e.key === 'Enter' && !e.nativeEvent.isComposing) closeDialog(value.trim()); }} />
      <div className="cf-btns" style={{ marginTop: 14 }}>
        <button className="ghost" id="textCancel" onClick={() => closeDialog(null)}>취소</button>
        <button className="secondary" id="textOk" onClick={() => closeDialog(value.trim())}>{d.okLabel}</button>
      </div>
    </div>
  );
}

/** legacy #textModal, #confirmModal, #toast. 페이지의 다른 창보다 뒤에 그려서 위에 뜨게 한다. */
export function DialogHost() {
  const dialog = useUiStore(s => s.dialog);
  const toast = useUiStore(s => s.toast);

  useEffect(() => {
    if(!toast.show) return;
    const t = setTimeout(hideToast, 1800);
    return () => clearTimeout(t);
  }, [toast.n, toast.show]);

  const text = dialog?.kind === 'text' ? dialog : null;
  const confirm = dialog?.kind === 'confirm' ? dialog : null;
  return (
    <>
      <div className={'modal-bg' + (text ? ' show' : '')} id="textModal" style={{ alignItems: 'center' }}
        onClick={e => { if(e.target === e.currentTarget) closeDialog(null); }}>
        {text && <TextBody key={text.seq} d={text} />}
      </div>
      <div className={'modal-bg' + (confirm ? ' show' : '')} id="confirmModal" style={{ alignItems: 'center' }}
        onClick={e => { if(e.target === e.currentTarget) closeDialog(false); }}>
        {confirm && (
          <div className="confirm-card">
            <div className="cf-icon" id="confirmIcon">{confirm.icon}</div>
            <h3 id="confirmTitle">{confirm.title}</h3>
            <p id="confirmMsg">{confirm.message}</p>
            <div className="cf-btns">
              <button className="ghost" id="confirmCancel" onClick={() => closeDialog(false)}>취소</button>
              <button className="danger" id="confirmOk" onClick={() => closeDialog(true)}>{confirm.okLabel}</button>
            </div>
          </div>
        )}
      </div>
      <div id="toast" className={toast.show ? 'show' : undefined}>{toast.msg}</div>
    </>
  );
}
