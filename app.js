const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bodyParser = require('body-parser');
const session = require('express-session')
const dateFormat = require('dateformat')

const indexRouter = require('./routes/index');
const homeRouter = require('./routes/home');

const app = express();
app.locals.dateFormat = dateFormat
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
// to treat post request parameters
app.use(bodyParser.urlencoded({extended: false}))
app.use(session({secret: 'niuniu', resave: true, saveUninitialized: false}))
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', require('./middleware/loginGuard'))

app.use('/admin', indexRouter);
app.use('/home', homeRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  let param = []
  const result = JSON.parse(err)
  for (let key in result) {
    if (key != 'path') {
      param.push(key + '=' + result[key])
    }
  }
  res.redirect(`${result.path}?${param.join('&')}`)
});

module.exports = app;
