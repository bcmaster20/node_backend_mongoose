const User = require('../models/user');
const AssetDeposit = require('../models/assets_deposit');
const AssetWithdraw = require('../models/assets_withdraw');
const IncrementRate = require('../models/increment_rate');
const AssetMonthlyLog = require('../models/assets_monthly_log');

const controller = {
  //バッチ処理:  月末 00:00 にユーザの資産を増加させる。
  async calculateProfit(){
    try {
      const curDate = new Date();
      const year = curDate.getFullYear();
      const month = curDate.getMonth() + 1;
      const firstDateOfMonth = new Date(year, month-1, 1);
      const lastDateOfMonth = new Date(year, month, 0);
      const daysOfMonth = lastDateOfMonth.getDate();
      const incrementRate = await IncrementRate.findOne({ year,month }, { rate: 1 });
      if (!incrementRate) {
        console.log("Increment rate is not registered.");
        return;
      }
      const rate = incrementRate.rate / 100.0;
      console.log('rate:',rate);
      const users = await User.find({}, {_id:0, password:0, bankAccount:0});
      for(let i = 0; i < users.length; i++) {
        const user = users[i];
        const deposits = await AssetDeposit.find({ userId: user.id, depositedAt: { $gte:firstDateOfMonth, $lte:lastDateOfMonth } });
        var profit = 0, amountOfThisMonth = 0;
        //今月中に入金した資産の利益を入金時点別に計算
        for(let j = 0; j < deposits.length; j++) {
          const deposit = deposits[j];
          const partProfit = deposit.amount * rate * (daysOfMonth - deposit.depositedAt.getDate()) / daysOfMonth;
          profit += partProfit;
          amountOfThisMonth += deposit.amount;
          console.log(j+1, "- amount:", deposit.amount, "profit:", partProfit, "applied days:", daysOfMonth - deposit.depositedAt.getDate());
        }
        const pastAmount = user.balance - amountOfThisMonth; //現在の資産から今月の入金分をひくと先月末時点の資産が得られる
        //今月以前から既に資産がある場合の利益も計算
        profit = Math.round(profit + pastAmount * rate);
        console.log("0 - amount:", pastAmount, "profit:", pastAmount * rate);
        
        const balance = Math.round(user.balance + profit);
        await User.findOneAndUpdate({ id: user.id }, { $set:{ balance } });
        
        const assetsMonthlyLog = new AssetMonthlyLog({ userId: user.id, year: year, month: month, rate: incrementRate.rate, amount: balance, profit: profit });
        await assetsMonthlyLog.save();

        console.log("user:", user.email, "total amount:", balance, "profit:", profit);
      }
    } catch (err) {
      console.log(err);
    }
  },

  //バッチ処理:  月末 00:00 にタイプ`all, gains`の出金申請の振込額を更新する。
  async updateWithdrawAmount(){
    try {
      const curDate = new Date().setHours(0,0,0,0);
      const assets = await AssetWithdraw.find({ confirmed: false, transferDate: { $gte: curDate }, type: { $ne: 'fixed' } }, { _id: 0 });
      for(let i = 0; i < assets.length; i++) {
        let amount = 0;
        const asset = assets[i];
        if (asset.type == 'all') {
          const user = await User.findOne({ id: asset.userId }, { id: 1, balance: 1 });
          if (user) {
            amount = user.balance;
          }
        } else if (asset.type == 'gains') {
          const date = new Date();
          const assetLog = await AssetMonthlyLog.findOne({ userId: asset.userId, year: date.getFullYear(), month: date.getMonth() + 1 });
          if (assetLog) {
            amount = assetLog.profit;
          }
        }
        if(amount) {
          await AssetWithdraw.findOneAndUpdate({ id: asset.id }, { $set: { amount } });
          console.log("user:", asset.userId, "asset:", asset.id, asset.type, "amount:", amount);
        }
      }
      
    } catch (err) {
      console.log(err);
    }
  },
}

module.exports = controller;