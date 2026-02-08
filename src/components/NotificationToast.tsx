import React, { useEffect } from 'react';
import '../styles/NotificationToast.css';

interface NotificationToastProps {
  message: string;
  type?: 'info' | 'success' | 'alert';
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // 4초 뒤 자동 사라짐

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification-toast ${type}`}>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
};

export default NotificationToast;