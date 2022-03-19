const mongoose = require('mongoose');
const shortid = require('shortid');

const Schema = mongoose.Schema;

//月次増加率を表すモデルです。
const IncrementRateSchema = new Schema({
  id: {
    type: String,
    unique: true,
    default: shortid.generate,
    immutable: true
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
    required: true,
  },
  ym: { //yyyymm
    type: String,
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  }
});

IncrementRateSchema.pre('save', function (next) {
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

IncrementRateSchema.pre("findOneAndUpdate", async function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('IncrementRate', IncrementRateSchema);
