const express = require('express');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { friendRequestLimiter } = require('../middleware/rateLimiter');
const {
  sendRequestValidators,
  requestIdValidators,
  friendIdValidators,
  sosCircleValidators,
} = require('../validators/friendValidators');
const {
  getMyFriendInfo,
  listFriends,
  listRequests,
  sendRequest,
  acceptRequest,
  removeRequest,
  removeFriend,
  setSosCircle,
} = require('../controllers/friendController');

const router = express.Router();

router.use(protect);

router.get('/me', getMyFriendInfo);
router.get('/', listFriends);
router.get('/requests', listRequests);
// Rate-limited so friend codes can't be guessed by trying lots of them.
router.post('/requests', friendRequestLimiter, sendRequestValidators, validate, sendRequest);
router.post('/requests/:id/accept', requestIdValidators, validate, acceptRequest);
router.delete('/requests/:id', requestIdValidators, validate, removeRequest);
router.delete('/:friendId', friendIdValidators, validate, removeFriend);
router.patch('/:friendId/sos', sosCircleValidators, validate, setSosCircle);

module.exports = router;
