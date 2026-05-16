import React, { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle, HelpCircle, Trash2 } from 'lucide-react';
import { Button } from './Button';

export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'delete';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string | React.ReactNode;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

const iconMap = {
  info: { icon: Info, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
  success: { icon: CheckCircle, bg: 'bg-emerald-100 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400' },
  error: { icon: AlertCircle, bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-600 dark:text-red-400' },
  confirm: { icon: HelpCircle, bg: 'bg-violet-100 dark:bg-violet-900/30', color: 'text-violet-600 dark:text-violet-400' },
  delete: { icon: Trash2, bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-600 dark:text-red-400' },
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = true,
}) => {
  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const iconConfig = iconMap[type];
  const IconComponent = iconConfig.icon;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-2xl shadow-black/20 max-w-md w-full animate-in zoom-in-95 fade-in duration-200 overflow-hidden border border-white/80 dark:border-gray-800/80 backdrop-blur-xl">
        {/* Header accent line */}
        <div className={`h-1.5 w-full ${
          type === 'success' ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
          type === 'error' || type === 'delete' ? 'bg-gradient-to-r from-red-400 to-rose-500' :
          type === 'warning' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
          type === 'confirm' ? 'bg-gradient-to-r from-violet-400 to-purple-500' :
          'bg-gradient-to-r from-blue-400 to-indigo-500'
        }`} />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-3xl ${iconConfig.bg} flex items-center justify-center mx-auto mb-5 shadow-sm`}>
            <IconComponent size={32} className={iconConfig.color} />
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-3">
            {title}
          </h3>

          {/* Message */}
          <div className="text-gray-600 dark:text-gray-400 text-center text-sm leading-relaxed">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>

        {/* Actions */}
        <div className={`p-4 bg-gray-50 dark:bg-gray-800/50 flex gap-3 ${showCancel ? 'justify-end' : 'justify-center'}`}>
          {showCancel && (
            <Button
              variant="secondary"
              onClick={onClose}
              className="min-w-[100px]"
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant={type === 'delete' || type === 'error' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            className="min-w-[100px]"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Hook for easier modal usage
interface ModalState {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  type: ModalType;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

export const useModal = () => {
  const [modalState, setModalState] = React.useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showModal = (options: Omit<ModalState, 'isOpen'>) => {
    setModalState({ ...options, isOpen: true });
  };

  const hideModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const alert = (title: string, message: string, type: ModalType = 'info') => {
    showModal({ title, message, type, showCancel: false, confirmText: 'OK' });
  };

  const confirm = (
    title: string, 
    message: string | React.ReactNode, 
    onConfirm: () => void,
    options?: { type?: ModalType; confirmText?: string; cancelText?: string }
  ) => {
    showModal({
      title,
      message,
      type: options?.type || 'confirm',
      onConfirm,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      showCancel: true,
    });
  };

  return {
    modalState,
    showModal,
    hideModal,
    alert,
    confirm,
    Modal: () => (
      <Modal
        isOpen={modalState.isOpen}
        onClose={hideModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />
    ),
  };
};

export default Modal;
