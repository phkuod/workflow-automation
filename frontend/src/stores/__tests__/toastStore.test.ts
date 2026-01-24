import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore, toast } from '../../stores/toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useToastStore.setState({ toasts: [] });
  });

  describe('addToast', () => {
    it('should add a toast to the store', () => {
      const { addToast } = useToastStore.getState();
      
      addToast('success', 'Test message');
      
      const updatedToasts = useToastStore.getState().toasts;
      expect(updatedToasts).toHaveLength(1);
      expect(updatedToasts[0].type).toBe('success');
      expect(updatedToasts[0].message).toBe('Test message');
    });

    it('should generate unique IDs for each toast', () => {
      const { addToast } = useToastStore.getState();
      
      addToast('success', 'Toast 1');
      addToast('error', 'Toast 2');
      
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });

    it('should set default duration of 5000ms', () => {
      const { addToast } = useToastStore.getState();
      
      addToast('info', 'Test');
      
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].duration).toBe(5000);
    });

    it('should allow custom duration', () => {
      const { addToast } = useToastStore.getState();
      
      addToast('warning', 'Test', 10000);
      
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].duration).toBe(10000);
    });
  });

  describe('removeToast', () => {
    it('should remove a toast by ID', () => {
      const { addToast } = useToastStore.getState();
      addToast('success', 'Test');
      
      const toastId = useToastStore.getState().toasts[0].id;
      useToastStore.getState().removeToast(toastId);
      
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('should not affect other toasts', () => {
      const { addToast } = useToastStore.getState();
      addToast('success', 'Toast 1');
      addToast('error', 'Toast 2');
      
      const toasts = useToastStore.getState().toasts;
      useToastStore.getState().removeToast(toasts[0].id);
      
      const remainingToasts = useToastStore.getState().toasts;
      expect(remainingToasts).toHaveLength(1);
      expect(remainingToasts[0].message).toBe('Toast 2');
    });
  });

  describe('clearAll', () => {
    it('should remove all toasts', () => {
      const { addToast, clearAll } = useToastStore.getState();
      addToast('success', 'Toast 1');
      addToast('error', 'Toast 2');
      addToast('warning', 'Toast 3');
      
      clearAll();
      
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('toast convenience functions', () => {
    it('should create success toast', () => {
      toast.success('Success!');
      
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].type).toBe('success');
    });

    it('should create error toast', () => {
      toast.error('Error!');
      
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].type).toBe('error');
    });

    it('should create warning toast', () => {
      toast.warning('Warning!');
      
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].type).toBe('warning');
    });

    it('should create info toast', () => {
      toast.info('Info!');
      
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].type).toBe('info');
    });
  });
});
