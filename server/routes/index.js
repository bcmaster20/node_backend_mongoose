var express = require('express');
var router = express.Router();
const bcrypt = require('bcryptjs');
const usersRoute = require('./users');
const assetsRoute = require('./assets');
const adminRoute = require('./admin');
const { initSession, isEmail } = require('../utils/utils');
const IncrementRate = require('../models/increment_rate');
const User = require('../models/user');

router.use('/users', usersRoute);
router.use('/assets', assetsRoute);
router.use('/admin', adminRoute);

//ユーザー認証
router.post('/auth', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isEmail(email)) {
      return res.status(400).json({
        errors: [
          {
            message: 'Bad Request',
            detail: 'Email must be a valid email address',
          },
        ],
      });
    }
    if (typeof password !== 'string') {
      return res.status(400).json({
        errors: [
          {
            message: 'Bad Request',
            detail: 'Password must be a string',
          },
        ],
      });
    }
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error();
    }
    const userId = user.id;

    const passwordValidated = await bcrypt.compare(password, user.password);
    if (!passwordValidated) {
      throw new Error();
    }

    const session = await initSession(userId);

    res
      .cookie('token', session.token, {
        httpOnly: true,
        sameSite: true,
        maxAge: 1209600000,
        // secure: process.env.NODE_ENV === 'production',
      })
      .json({
        message: 'Login Successful',
        detail: 'Successfully validated user credentials',
        csrfToken: session.csrfToken,
      });
  } catch (err) {
    res.status(401).json({
      errors: [
        {
          message: 'Invalid Credentials',
          detail: 'Check email and password combination',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//月次増加率 一覧を取得
router.get('/Increment-rates', async (req, res) => {
  const date = new Date();
  var mm = date.getMonth()+1;
  if(mm < 10) mm='0'+mm;
  const ym = `${date.getFullYear()}${mm}`;
  IncrementRate.find({ym: {$lt: ym}}, { _id: 0 }).sort({createdAt:1}).exec(function(error, result){
    if (error) {
      res.status(500).json({
        message: 'Internal server error'
      });

      throw error;
    }

    res.json(result);
  });
});

module.exports = router;