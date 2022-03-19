const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const bcrypt = require('bcryptjs');
const shortid = require('shortid');

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  id: {
    type: String,
    unique: true,
    default: shortid.generate,
    immutable: true
  },
  email: {
    type: String,
    required: true,
    minlength: 1,
    trim: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  kanaName: {
    type: String,
    required: true,
    trim: true,
  },
  birthday: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  balance: { //現在の残額
    type: Number,
    default: 0,
  },
  bankAccount:{
    bankName: { //金融機関名
      type: String,
    },
    bankBranchNumber: { //支店番号
      type: String,
    },
    type: { //口座種別
      type: String,
    },
    number: { //口座番号
      type: String,
    },
    name: { //口座名義
      type: String,
    },
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  }
});

UserSchema.plugin(uniqueValidator);

UserSchema.pre('save', function(next) {
  let user = this;

  if (!user.isModified || !user.isNew) {
    return next();
  }

  if (user.isModified('id')) {
    return next(new Error('Trying to modify restricted data'));
  }

  // get the current date
  var currentDate = new Date();
  
  // change the updated_at field to current date
  this.updatedAt = currentDate;

  // if created_at doesn't exist, add to that field
  if (! this.createdAt) {
    this.createdAt = currentDate;
  }

  if (!user.isModified('password')) {
    return next();
  }

  bcrypt
    .genSalt(12)
    .then((salt) => {
      return bcrypt.hash(user.password, salt);
    })
    .then((hash) => {
      user.password = hash;
      next();
    })
    .catch((err) => next(err));
});

UserSchema.pre("findOneAndUpdate", async function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('User', UserSchema);
