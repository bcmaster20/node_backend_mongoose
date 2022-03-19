const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require("node-cron")

const { getSecret } = require('./secrets');
const apiRoute = require('./routes');
const controller = require('./controller');

mongoose.Promise = global.Promise;
mongoose.connect(getSecret('dbUri'), { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false }).then(
  () => {
    console.log('Connected to mongoDB');
  },
  (err) => console.log('Error connecting to mongoDB', err)
);

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Enable the use of request body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(cookieParser());
app.use('/api', apiRoute);

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

//バッチ処理:  月末 00:00 にユーザの資産を増加させる。
cron.schedule("0 0 * * *", function() {
  try{
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (today.getMonth() !== tomorrow.getMonth()) {
      console.log("calculating monthly profit at 00:00 on the last day of the month");
      controller.calculateProfit();
      controller.updateWithdrawAmount();
    }
  }catch(ex){
      console.log(ex);
  }
});

module.exports = { app };
