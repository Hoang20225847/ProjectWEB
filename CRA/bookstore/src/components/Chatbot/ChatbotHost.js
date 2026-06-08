import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Chatbot from './index';

const HIDDEN_PREFIXES = ['/admin'];
const HIDDEN_EXACT = ['/login', '/regis', '/forgot-password', '/reset-password'];

function ChatbotHost() {
  const { pathname } = useLocation();
  const hidden =
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) || HIDDEN_EXACT.includes(pathname);
  if (hidden) return null;
  return createPortal(<Chatbot />, document.body);
}

export default ChatbotHost;
