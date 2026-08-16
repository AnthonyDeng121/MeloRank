const express = require('express');
const router = express.Router();
const { saveUserData, getUserData, getAllUserData, deleteUserData, getAllReviews } = require('../controllers/dataController');
const { protect } = require('../middleware/auth');

// All data routes are protected
router.post('/', protect, saveUserData);
router.get('/:type', protect, getUserData);
router.get('/', protect, getAllUserData);
router.delete('/:type', protect, deleteUserData);

// Get all reviews from all users - public access
router.get('/reviews', getAllReviews);

module.exports = router;