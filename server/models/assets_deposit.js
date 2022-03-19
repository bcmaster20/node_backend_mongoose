const mongoose = require('mongoose');
const shortid = require('shortid');

const Schema = mongoose.Schema;

//資産の入金情報を表すモデルです。
const AssetsDepositSchema = new Schema({
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
  amount: { //入金額
    type: Number,
    required: true,
  },
  depositedAt: { //入金された日付です。この日付は銀行の入金日を目視で確認します。
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  }
});

AssetsDepositSchema.pre('save', function (next) {
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

AssetsDepositSchema.pre("findOneAndUpdate", async function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('AssetsDeposit', AssetsDepositSchema);
