import { useState, useCallback, useRef } from 'react';

let toastId = 0;
let globalShowToast = null;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const show = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    timersRef.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete timersRef.current[id];
    }, 4000);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  // Expose globally so non-component code can use it
  globalShowToast = show;

  return { toasts, show, dismiss };
}

// For use outside React components
export function showToast(message, type = 'info') {
  if (globalShowToast) globalShowToast(message, type);
}

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => onDismiss(toast.id)}>&times;</button>
        </div>
      ))}
    </div>
  );
}
