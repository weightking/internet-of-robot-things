var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', require('./home/homePage'));

module.exports = router;
