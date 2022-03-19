const mongoose = require('mongoose');
const shortid = require('shortid');

const Schema = mongoose.Schema;

//資産の出金情報を表すモデルです。
const AssetsWithdrawSchema = new Schema({
  id: {
    type: String,
    unique: true,
    default: shortid.generate,
    immutable: true
  },
  userId: {
    type: String,
    required: true,
  },
  type: { //出金申請のタイプ
    type: String,
    enum: ['all','fixed','gains'],
    required: true,
  },
  amount: { //type `fixed` 以外は振り込み日まで金額は確定されないため、amountは存在しない場合があります。
    type: Number,
    default: 0,
  },
  transferDate: { //振り込み日もしくは、振り込み予定日です。この日付は、出金申請時に当日の日付から計算されます。
    type: Date,
    required: true,
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  }
});

AssetsWithdrawSchema.pre('save', function (next) {
  // get the current date
  var currentDate = new Date();
  
  // change the updated_at field to current date
  this.updatedAt = currentDate;

  // if created_at doesn't exist, add to that field
  if (! this.createdAt) {
    this.createdAt = currentDate;
  }

  next();
});

AssetsWithdrawSchema.pre("findOneAndUpdate", async function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('AssetsWithdraw', AssetsWithdrawSchema);
