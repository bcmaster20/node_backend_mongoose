const express = require('express');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const Admin = require('../models/admin');
const Session = require('../models/session');
const IncrementRate = require('../models/increment_rate');
const AssetWithdraw = require('../models/assets_withdraw');
const AssetDeposit = require('../models/assets_deposit');
const AssetMonthlyLog = require('../models/assets_monthly_log');

const { authenticateAdmin } = require('../middleware/authenticate');
const { csrfCheck } = require('../middleware/csrfCheck');
const { initSession, isEmail } = require('../utils/utils');

const router = express.Router();

//管理者認証
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
    const admin = await Admin.findOne({ email });
    if (!admin) {
      throw new Error();
    }
    
    const passwordValidated = await bcrypt.compare(password, admin.password);
    if (!passwordValidated) {
      throw new Error();
    }
    const session = await initSession(admin.id, true);

    res
      .cookie('token', session.token, {
        httpOnly: true,
        sameSite: true,
        maxAge: 1209600000,
        // secure: process.env.NODE_ENV === 'production',
      })
      .json({
        message: 'Login Successful',
        detail: 'Successfully validated admin credentials',
        // csrfToken: session.csrfToken,
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

//管理者登録
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!isEmail(email)) {
      throw new Error('Email must be a valid email address.');
    }
    if (typeof password !== 'string') {
      throw new Error('Password must be a string.');
    }
    const admin = new Admin({ email, name, password });
    const persistedAdmin = await admin.save();
    const adminId = persistedAdmin.id;

    const session = await initSession(adminId, true);

    res
      .cookie('token', session.token, {
        httpOnly: true,
        sameSite: true,
        maxAge: 1209600000,
        // secure: process.env.NODE_ENV === 'production',
      })
      .status(201)
      .json({
        message: 'Admin Registration Successful',
        detail: 'Successfully registered new admin',
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

/* router.all('*', function(req, res, next) {
  if (req.url === '/' || req.url === '/auth') return next();
  authenticateAdmin();
    next();
}); */
router.all('*', authenticateAdmin);

//月次増加率の登録
router.post('/increment-rates', async (req, res) => {
  try {
    // var date = new Date(req.body.year, req.body.month - 1, 1);
    var mm = req.body.month;
    if(mm < 10) mm='0'+mm;
    req.body.ym = `${req.body.year}${mm}`;
    // console.log(req.body);
    if( await IncrementRate.exists({year:req.body.year,month:req.body.month}) ) {
      res.status(400).json({
        errors: [
          {
            message: 'The increment rate already exists.',
          },
        ],
      });
      return;
    }

    const incrementRate = new IncrementRate(req.body);
    const savedIncrementRate = await incrementRate.save();

    res.json(savedIncrementRate);

  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Bad request error',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//月次増加率の修正
router.put('/increment-rates/:IncrementRateId', async (req, res) => {
  try {
    const { IncrementRateId } = req.params;
    const updatedData = await IncrementRate.findOneAndUpdate({ id: IncrementRateId }, { $set:req.body }, {new: true});

    res.json(updatedData);

  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Bad request error',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//月次増加率の一覧取得
router.get('/Increment-rates', async (req, res) => {
  IncrementRate.find({}, { _id: 0 }).sort({createdAt:1}).exec(function(error, result){
    if (error) {
      res.status(500).json({
        message: 'Internal server error'
      });
    } else {
      res.json(result);
    }
  });
});

//ユーザー一覧の取得
router.get('/users', async (req, res) => {
  try {
    User.find({}, { _id: 0, password: 0 }).sort({createdAt:1}).exec(function(error, result){
      if (error) {
        res.status(500).json({
          message: 'Internal server error',
          errorMessage: error.message,
        });
      } else {  
        res.json(result);
      }
    });

  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Bad request error',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//ユーザーの更新
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    /* const user = await User.findOne({ id: userId }).exec();
    if(req.body.name)
      user.name = req.body.name;
    if(req.body.kanaName)
      user.kanaName = req.body.kanaName;
    if(req.body.birthday)
      user.birthday = req.body.birthday;
    if(req.body.password)
      user.password = req.body.password;
    if(req.body.balance)
      user.password = req.body.balance;
    await user.save(); */
    delete req.body.id;
    delete req.body.password;
    const user = await User.findOneAndUpdate({ id: userId }, { $set: req.body }, {new: true});
    res.json(user);
  } catch (err) {
    res.status(500).json({
      message: 'Internal server error',
      errorMessage: err.message,
    });
  }
});

//ユーザーの削除
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await Session.expireAllTokensForUser(userId);
    const deleted = await User.findOneAndDelete({ id: userId });
    res.json({
      success: (deleted != null)
    });
  } catch (err) {
    res.status(500).json({
      message: 'Internal server error',
      errorMessage: err.message,
    });
  }
});

//ユーザーの取得
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ id: userId }, { _id: 0, password: 0 });
    res.json(user);
  } catch (err) {
    res.status(500).json({
      message: 'Internal server error',
      errorMessage: err.message,
    });
  }
});

//全ユーザの資産合計取得
router.get('/assets/users', async (req, res) => {
  try {
    User.aggregate([ { $group: {_id:null, total:{$sum:'$balance'}} } ]).exec(function(error, result) {
      if (error) {
        res.status(500).json({
          message: 'Internal server error',
          errorMessage: error.message,
        });
      } else {
        res.json({
          totalAmount: result[0].total
        });
      }
    });

  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Bad request error',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//ユーザの資産取得
router.get('/assets/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ id: userId }, { balance: 1 });
    console.log(user);
    res.json({
      amount: user.balance
    });
  } catch (err) {
    res.status(500).json({
      message: 'Internal server error',
      errorMessage: error,
    });
  }
});

//出金申請一覧の取得
router.get('/assets/withdraws', async (req, res) => {
  try {
    AssetWithdraw.find({}, { _id: 0 }).sort({createdAt:-1}).exec(function(error, result){
      if (error) {
        res.status(500).json({
          message: 'Internal server error',
          errorMessage: error,
        });
      } else {
        res.json(result);
      }
    });

  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Bad request error',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//出金の確定します。 確定と同時に、ユーザの資産が減少します。 また、振り込み予定日(transferDate) より前に実行することはできません。
router.put('/assets/withdraws/:withdrawId', async (req, res) => {
  try {
    const { withdrawId } = req.params;
    
    const asset = await AssetWithdraw.findOne({ id: withdrawId }, { _id: 0 });
    if (! asset) {
      res.status(404).json({
        message: "Can't find withdraw with withdrawId " + withdrawId + "."
      });

      return;
    }

    if (asset.confirmed) {
      res.status(403).json({
        message: "It was already withdrawn"
      });
    }

    const currentDate = new Date().setHours(0,0,0,0);
    if (currentDate > asset.transferDate) {
      res.status(403).json({
        errors: [
          {
            message: 'Can\'t withdraw before transfer date',
          },
        ],
      });

    } else {
      const user = await User.findOne({ id: asset.userId }, { id: 1, balance: 1 });
      if (!user) {
        res.status(400).json({
          message: "Can't find user with userId " + userId + "."
        });
        return;
      }
      var amount = asset.amount;
      if (amount > user.balance) {
        res.status(400).json({
          message: "Withdraw amount " + amount + " can't exceed the current balance " + user.balance + "."
        });
        return;
      }
      if (asset.type == 'all') {
        amount = user.balance;
      } else if (asset.type == 'gains') {
        const date = new Date();
        const assetLog = await AssetMonthlyLog.findOne({ userId: user.id, year: date.getFullYear(), month: date.getMonth() + 1 });
        amount = assetLog ? assetLog.profit : 0;
      }

      const updatedUser = await User.findOneAndUpdate({ id: user.id }, { $inc:{balance: -amount} }, { new: true });
      const result = await AssetWithdraw.findOneAndUpdate({ id: withdrawId }, { $set:{amount, confirmed:true} }, { new: true });
      res.json(result);
    }

  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Bad request error',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//入金情報の登録
router.post('/assets/deposits', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!await User.exists({ id: userId })) {
      res.status(400).json({
        message: "Can't find user with userId " + userId + "."
      });
      return;
    }
    
    const assetDeposit = new AssetDeposit(req.body);
    assetDeposit.save(function (error) {
      if (error) {
        res.status(500).json({
          errors: [
            {
              message: 'AssetDeposit save error',
              errorMessage: error.message,
            },
          ],
        });
        return;
      }
      User.findOneAndUpdate({ id: userId }, { $inc: {balance: amount} }).exec(function (error, user){
        if (error) {
          res.status(500).json({
            errors: [
              {
                message: 'User balance increment error',
                errorMessage: error.message,
              },
            ],
          });
          return;
        }
        res.json(assetDeposit);
      });
    });

  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: 'Bad request error',
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

//テスト用
const controller = require('../controller');
router.post('/crontest', async (req, res) => {
  await controller.calculateProfit();
  await controller.updateWithdrawAmount();
  res.status(200).json({message:'executed'});
});

module.exports = router;
