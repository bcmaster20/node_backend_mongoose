const mongoose = require('mongoose');
const shortid = require('shortid');

const Schema = mongoose.Schema;

//過去の月次増加率、利益分、資産（月末）を残すモデルです。
const AssetsMonthlyLogSchema = new Schema({
  id: {
    type: String,
    unique: true,
    default: shortid.generate
  },
  userId: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number,
    required: true,
  },
  rate: {
    type: Number,
    default: 0,
  },
  amount: {
    type: Number,
    default: 0,
  },
  profit: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  }
});

AssetsMonthlyLogSchema.pre('save', function (next) {
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

module.exports = mongoose.model('AssetsMonthlyLog', AssetsMonthlyLogSchema);
