const express = require('express');

const AssetDeposit = require('../models/assets_deposit');
const AssetWithdraw = require('../models/assets_withdraw');
const AssetMonthlyLog = require('../models/assets_monthly_log');
const IncrementRate = require('../models/increment_rate');
const User = require('../models/user');

const { authenticate } = require('../middleware/authenticate');
// const { csrfCheck } = require('../middleware/csrfCheck');

const router = express.Router();

router.all('*', authenticate);

//現在資産の取得
router.get('/', async (req, res) => {
  const { userId } = req.session;
  User.findOne({ id: userId }, { balance: 1 }).exec(function (error, user){
    if(error) {
      res.status(500).json({
        message: 'Internal server error',
        errorMessage: error,
      });
    } else {
      res.json({
        assets:user.balance
      });
    }
  });
});

//資産推移を取得(月次)
router.get('/monthly', async (req, res) => {
  try {
    const { userId } = req.session;
    const { startYear, startMonth, endYear, endMonth } = req.body;
    if( !startYear || !startMonth || !endYear || !endMonth ) throw new Error();
    var data = [];
    const assets = await AssetMonthlyLog.find({ userId, createdAt: { $gt: new Date(startYear, startMonth - 1, 1), $lt: new Date(endYear, endMonth, 1) } }, { _id: 0 }).sort({createdAt:1});
    for ( let i = 0; i < assets.length; i++ ) {
      const {year, month, amount, createdAt} = assets[i];
      data.push({year: year, month: month, amount: amount});
    }
    res.json(data);

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

//資産推移を取得(日次)
router.get('/daily', async (req, res) => {
  try {
    const { userId } = req.session;
    const { year, month } = req.body;
    if( !year || !month ) throw new Error();
    const today = new Date();
    if (new Date(today.getFullYear, today.getMonth() + 1, 1) <= new Date(year, month - 1, 1)) {
      res.status(400).json({error:"No data because over this month."});
      return;
    }
    const firstDateOfMonth = new Date(year, month-1, 1);
    const lastDateOfMonth = new Date(year, month, 0);
    const daysOfMonth = lastDateOfMonth.getDate();
    const incrementRate = await IncrementRate.findOne({ year, month }, { rate: 1 });
    if (!incrementRate) {
      res.status(500).json({error:"Increment rate is not registered."});
      return;
    }
    const rate = incrementRate.rate / 100.0;
    const isThisMonth = (today.getFullYear() == year && today.getMonth() + 1 == month);
    var balanceOfMonth = 0;
    if(isThisMonth) {
      const user = await User.findOne({ id: userId }, { balance: 1, _id: 0 });
      balanceOfMonth = user.balance;
    } else {
      const asset = await AssetMonthlyLog.findOne({ userId, year, month }, { _id: 0 });
      if(asset)
        balanceOfMonth = asset.amount;
    }
    const deposits = await AssetDeposit.find({ userId, depositedAt:{ $gte:firstDateOfMonth, $lte:lastDateOfMonth } });
    const endDay = isThisMonth ? today.getDate() : daysOfMonth;
    //前月末時点の資産を取得
    var depositTotal = 0;
    for(let j = 0; j < deposits.length; j++) {
      depositTotal += deposits[j].amount;
    }
    const pastAmount = balanceOfMonth - depositTotal; //当月の資産から当月の入金分をひくと前月末時点の資産が得られる
    var data = [];
    for( let i = 1; i <= endDay; i++ ) {
      var profit = pastAmount * rate, depositAmount = 0;
      //当月中に入金した資産の利益を入金時点別に計算
      for(let j = 0; j < deposits.length; j++) {
        const {depositedAt, amount} = deposits[j];
        if( depositedAt.getDate() <= i ) {
          profit += amount * rate * (i - depositedAt.getDate()) / daysOfMonth;
          depositAmount += amount;
        }
      }
      data.push({day: i, amount: Math.round(pastAmount + depositAmount + profit)});
    }
    
    res.json(data);

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

//出金一覧の取得
router.get('/withdraw', async (req, res) => {
  try {
    const { userId } = req.session;
    AssetWithdraw.find({ userId }, { _id: 0 }).sort({createdAt:-1}).exec(function(error, result){
      if (error) {
        res.status(500).json({
          message: 'Internal server error',
          errorMessage: error,
        });
      } else {
        /* if (! result) {
          res.status(400).json({
            message: "Can't find withdraw with userId " + userId + "."
          });
          return;
        } */
        res.json({
          result
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

//出金申請
router.post('/withdraw', async (req, res) => {
  try {
    const { userId } = req.session;
    const { type } = req.body;
    var amount = req.body.amount ? req.body.amount : 0;
    
    const user = await User.findOne({ id: userId }, { _id: 0 });
    if (!user) {
      res.status(400).json({
        message: "Can't find user with userId " + userId + "."
      });
      return;
    }
    
    if (type == 'fixed') {
      if (amount > user.balance) {
        res.status(400).json({
          message: "Fixed withdraw amount (overbalanced) can't exceed the current balance."
        });
        return;
      }
    } else {
      amount = 0;
    }
    
    const date = new Date();
    const today = date.getDate();

    var transferDate;
    if(today > 10) {
      transferDate = new Date(date.getFullYear(), date.getMonth() + 2, 0);
    } else {
      transferDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    if( AssetWithdraw.exists({ userId, transferDate }) ) {
      res.status(400).json({
        message: "Can't make the monthly request twice."
      });
      return;
    }
    
    const assetWithdraw = new AssetWithdraw({ userId, type, amount, transferDate });
    assetWithdraw.save(function (error) {
      if (error) {
        res.status(500).json({
          errors: [
            {
              message: 'Internal server error',
              errorMessage: error.message,
            },
          ],
        });
        return;
      }

      res.json(assetWithdraw);
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

//出金申請のキャンセル
router.put('/withdraw', async (req, res) => {
  try {
    const { id } = req.body;
    const withdraw = await AssetWithdraw.findOne({ id }, { _id: 0 });
    if (!withdraw) {
      res.status(404).json({
        message: "Can't find withdraw with id " + id + "."
      });
      return;
    }

    const { transferDate } = withdraw;
    const date = new Date();
    date.setHours(0,0,0,0);
    console.log(date, transferDate);
    if(date < transferDate) {
      const asset = await AssetWithdraw.findOneAndDelete({ id });
      res.json({
        message: 'Withdraw Cancel',
        success: (asset != null),
      });
    } else {
      res.status(403).json({
        errors: [
          {
            message: 'Can\'t cancel after transfer date',
          },
        ],
      });
      return;
    }

  } catch (err) {
    res.status(500).json({
      errors: [
        {
          message: 'Internal server error',
          errorMessage: err.message,
        },
      ],
    });
  }
});

//入金一覧の取得
router.get('/deposits', async (req, res) => {
  try {
    const { userId } = req.session;
    AssetDeposit.find({ userId }, { _id: 0 }).sort({createdAt:-1}).exec(function(error, result){
      if (error) {
        res.status(500).json({
          message: 'Internal server error'
        });
  
        throw error;
      }
  
      if (! result) {
        res.status(404).json({
          message: "Can't find deposit with userId " + userId + "."
        });
  
        return;
      }

      res.json(result);
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

module.exports = router;
