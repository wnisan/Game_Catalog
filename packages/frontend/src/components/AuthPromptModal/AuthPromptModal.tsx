import { useNavigate } from 'react-router-dom';
import './AuthPromptModal.css';

interface AuthPromptModalProps {
  onClose: () => void;
  message?: string;
}

const AuthPromptModal = ({
  onClose,
  message = 'Создайте аккаунт или войдите, чтобы продолжить.',
}: AuthPromptModalProps) => {
  const navigate = useNavigate();

  return (
    <div className="auth-prompt__overlay" onClick={onClose}>
      <div className="auth-prompt__modal" onClick={(e) => e.stopPropagation()}>
        <h3>Требуется вход</h3>
        <p>{message}</p>
        <div className="auth-prompt__btns">
          <button
            className="auth-prompt__primary"
            onClick={() => navigate('/auth')}
          >
            Вход / Регистрация
          </button>
          <button className="auth-prompt__secondary" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPromptModal;
