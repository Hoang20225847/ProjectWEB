const express = require('express');
const ChatbotController = require('./controllers/ChatbotController');
const ChatbotAdminController = require('./controllers/ChatbotAdminController');

const router = express.Router();

/** API người dùng / khách */
router.post('/session', (req, res, next) => ChatbotController.createSession(req, res, next));
router.get('/sessions', (req, res, next) => ChatbotController.listSessions(req, res, next));
router.get('/session/:id', (req, res, next) => ChatbotController.getSession(req, res, next));
router.get('/session/:id/messages', (req, res, next) => ChatbotController.getMessages(req, res, next));
router.post('/session/:id/message', (req, res, next) => ChatbotController.sendMessage(req, res, next));
router.post('/session/:id/close', (req, res, next) => ChatbotController.closeSession(req, res, next));
router.post('/session/:id/continue', (req, res, next) => ChatbotController.continueSession(req, res, next));
router.post('/session/:id/issue-resolved', (req, res, next) => ChatbotController.submitIssueResolved(req, res, next));
router.post('/session/:id/rate', (req, res, next) => ChatbotController.rateSession(req, res, next));

/** Admin analytics */
router.get('/admin/analytics/overview', (req, res, next) => ChatbotAdminController.overview(req, res, next));
router.get('/admin/analytics/daily', (req, res, next) => ChatbotAdminController.daily(req, res, next));
router.get('/admin/analytics/top-tools', (req, res, next) => ChatbotAdminController.topTools(req, res, next));
router.get('/admin/feedbacks', (req, res, next) => ChatbotAdminController.feedbacks(req, res, next));
router.get('/admin/sessions', (req, res, next) => ChatbotAdminController.listSessions(req, res, next));

/** Semantic metadata — LLM suggest + optional persist + đồng bộ vector */
router.post('/admin/books/:id/suggest-semantic-labels', (req, res, next) =>
  ChatbotAdminController.suggestBookSemanticLabels(req, res, next),
);

module.exports = router;
