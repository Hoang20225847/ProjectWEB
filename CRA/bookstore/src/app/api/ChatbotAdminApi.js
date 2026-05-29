import axios from '../../components/axios/axios.customize';

export function getChatbotOverview(params = {}) {
  return axios.get('/api/chatbot/admin/analytics/overview', { params });
}

export function getChatbotDaily(params = {}) {
  return axios.get('/api/chatbot/admin/analytics/daily', { params });
}

export function getChatbotTopTools(params = {}) {
  return axios.get('/api/chatbot/admin/analytics/top-tools', { params });
}

export function getChatbotFeedbacks(params = {}) {
  return axios.get('/api/chatbot/admin/feedbacks', { params });
}

export function getChatbotSessions(params = {}) {
  return axios.get('/api/chatbot/admin/sessions', { params });
}
