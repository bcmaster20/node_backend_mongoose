const express = require('express');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const Session = require('../models/session');
const { authenticate } = require('../middleware/authenticate');
const { csrfCheck } = require('../middleware/csrfCheck');
const { initSession, isEmail } = require('../utils/utils');

const router = express.Router();

//ユーザー登録
router.post('/my', async (req, res) => {
  try {
    const { email, password, name, kanaName, birthday } = req.body;
    if (!isEmail(email)) {
      throw new Error('Email must be a valid email address.');
    }
    if (typeof password !== 'string') {
      throw new Error('Password must be a string.');
    }
    const user = new User({ email, password, name, kanaName, birthday });
    const persistedUser = await user.save();
    const userId = persistedUser.id;

    const session = await initSession(userId);

    res
      .cookie('token', session.token, {
        httpOnly: true,
        sameSite: true,
        maxAge: 1209600000,
        // secure: process.env.NODE_ENV === 'production',
      })
      .status(201)
      .json({
        message: 'User Registration Successful',
        detail: 'Successfully registered new user',
        // csrfToken: session.csrfToken,
      });
  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Registration Error',
          detail: 'Something went wrong during registration process.',
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.all('*', authenticate);

//自分のアカウント情報を更新します。
router.put('/my', async (req, res) => {
  try {
    const { userId } = req.session;
    /* const user = await User.findOne({ id: userId });
    if(req.body.name)
      user.name = req.body.name;
    if(req.body.kanaName)
      user.kanaName = req.body.kanaName;
    if(req.body.birthday)
      user.birthday = req.body.birthday;
    if(req.body.password)
      user.password = req.body.password;
    await user.save(); */
    delete req.body.id;
    delete req.body.password;
    delete req.body.balance;
    const user = await User.findOneAndUpdate({ id: userId }, { $set: req.body });
    res.json({
      user
    });
  } catch (err) {
    res.status(401).json({
      errors: [
        {
          message: 'Unauthorized',
          detail: 'Not authorized to access this route',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//自分のアカウント情報を取得します。
router.get('/my', async (req, res) => {
  try {
    const { userId } = req.session;
    const user = await User.findOne({ id: userId }, { _id: 0, password: 0 });

    res.json({
      user,
    });
  } catch (err) {
    res.status(401).json({
      errors: [
        {
          message: 'Unauthorized',
          detail: 'Not authorized to access this route',
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.delete('/my', async (req, res) => {
  try {
    const { userId } = req.session;
    const { password } = req.body;
    if (typeof password !== 'string') {
      throw new Error();
    }
    const user = await User.findOne({ id: userId });

    const passwordValidated = await bcrypt.compare(password, user.password);
    if (!passwordValidated) {
      throw new Error();
    }

    await Session.expireAllTokensForUser(userId);
    res.clearCookie('token');
    await User.findOneAndDelete({ id: userId });
    res.json({
      message: 'Account Deleted',
      detail: 'Account with credentials provided has been successfuly deleted',
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

router.put('/logout', async (req, res) => {
  try {
    const { session } = req;
    await session.expireToken(session.token);
    res.clearCookie('token');

    res.json({
      message: 'Logout Successful',
      detail: 'Successfuly expired login session',
    });
  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Logout Failed',
          detail: 'Something went wrong during the logout process.',
          errorMessage: err.message,
        },
      ],
    });
  }
});

module.exports = router;
