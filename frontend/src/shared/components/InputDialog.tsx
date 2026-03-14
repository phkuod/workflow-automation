import { useState, useCallback, createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { Edit3, X } from 'lucide-react';

interface InputOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface InputContextValue {
  prompt: (options: InputOptions) => Promise<string | null>;
}

const InputContext = createContext<InputContextValue | null>(null);

export function useInput() {
  const context = useContext(InputContext);
  if (!context) {
    throw new Error('useInput must be used within an InputProvider');
  }
  return context;
}

interface InputState extends InputOptions {
  isOpen: boolean;
  resolve: ((value: string | null) => void) | null;
}

export function InputProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InputState>({
    isOpen: false,
    title: '',
    message: '',
    placeholder: '',
    defaultValue: '',
    confirmText: 'Create',
    cancelText: 'Cancel',
    resolve: null,
  });
  
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const prompt = useCallback((options: InputOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setInputValue(options.defaultValue || '');
      setState({
        isOpen: true,
        ...options,
        confirmText: options.confirmText || 'Create',
        cancelText: options.cancelText || 'Cancel',
        resolve,
      });
    });
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.isOpen]);

  const handleConfirm = useCallback(() => {
    const value = inputValue.trim();
    state.resolve?.(value || null);
    setState((s) => ({ ...s, isOpen: false, resolve: null }));
    setInputValue('');
  }, [state.resolve, inputValue]);

  const handleCancel = useCallback(() => {
    state.resolve?.(null);
    setState((s) => ({ ...s, isOpen: false, resolve: null }));
    setInputValue('');
  }, [state.resolve]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleConfirm, handleCancel, inputValue]);

  return (
    <InputContext.Provider value={{ prompt }}>
      {children}
      
      {state.isOpen && (
        <div 
          className="modal-overlay"
          onClick={handleCancel}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              animation: 'inputScaleIn 0.2s ease-out',
            }}
          >
            <style>
              {`
                @keyframes inputScaleIn {
                  from {
                    transform: scale(0.95);
                    opacity: 0;
                  }
                  to {
                    transform: scale(1);
                    opacity: 1;
                  }
                }
              `}
            </style>
            
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(139, 92, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Edit3 size={20} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                  {state.title}
                </h3>
              </div>
              <button
                onClick={handleCancel}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem' }}>
              {state.message && (
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
                  {state.message}
                </p>
              )}
              <input
                ref={inputRef}
                type="text"
                className="form-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={state.placeholder || 'Enter a name...'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
            }}>
              <button
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                {state.cancelText}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={!inputValue.trim()}
                style={{
                  opacity: inputValue.trim() ? 1 : 0.5,
                }}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </InputContext.Provider>
  );
}
