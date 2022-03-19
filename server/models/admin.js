const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const bcrypt = require('bcryptjs');
const shortid = require('shortid');

const Schema = mongoose.Schema;

const AdminSchema = new Schema({
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
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  }
});

AdminSchema.plugin(uniqueValidator);

AdminSchema.pre('save', function(next) {
  let admin = this;
  if (!admin.isModified || !admin.isNew) {
    return next();
  }

  // get the current date
  var currentDate = new Date();
  
  // change the updated_at field to current date
  this.updatedAt = currentDate;

  // if created_at doesn't exist, add to that field
  if (! this.createdAt) {
    this.createdAt = currentDate;
  }

  if (!admin.isModified('password')) {
    return next();
  }

  bcrypt
    .genSalt(12)
    .then((salt) => {
      return bcrypt.hash(admin.password, salt);
    })
    .then((hash) => {
      admin.password = hash;
      next();
    })
    .catch((err) => next(err));
});

AdminSchema.pre("findOneAndUpdate", async function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('Admin', AdminSchema);