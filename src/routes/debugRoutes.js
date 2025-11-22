const express = require('express');
const router = express.Router();
const { resetDb, seedDb } = require('../controllers/debugController');

// Lưu ý: Trong môi trường thực tế (Production), nên bảo vệ các route này
// hoặc tắt chúng đi. Ở đây để public cho mục đích test/demo.

router.post('/reset', resetDb);
router.post('/seed', seedDb);

module.exports = router;


