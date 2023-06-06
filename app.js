//jshint esversion:6
require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const encrypt = require('mongoose-encryption');
const md5 = require("md5");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
    secret: "our little secret.",
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/usersDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// const secret = process.env.SECRET
// userSchema.plugin(encrypt, {secret: secret, encryptedFields: ["password"]})

const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {id: user.id,username: user.username});
    });
  });
   
  passport.deserializeUser(function(user, cb) { //deletes the cookie.
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
})

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
passport.authenticate('google', { failureRedirect: '/login' }),
function(req, res) {
// Successful authentication, redirect home.
res.redirect('/secrets');
});

app.get("/login", function(req, res){
    res.render("login");
})

app.get("/register", function(req, res){
    res.render("register");
})

app.get("/secrets", function(req, res){
    User.find({"secret":{$ne:null}})
    .then(function (foundUsers) {
      res.render("secrets",{usersWithSecrets:foundUsers});
      })
    .catch(function (err) {
      console.log(err);
      })
})

app.get("/submit", function(req, res){
    if(req.isAuthenticated())
        res.render("submit");
    else
        res.redirect("login");
})

app.post("/submit", function(req, res){
    // const submittedSecret = req.body.secret;
    // User.updateOne({id:req.user.id}, {secret:req.body.secret}).then(function(guy){
    //     console.log(guy.secret)
    //     console.log("updated");
    //     res.redirect("/secrets");
    // }).catch(function(err){
    //     console.log(err);
    // })
    User.findById(req.user.id).then(function(foundUser){
            if(foundUser)
            {
                // console.log(foundUser.username);
                // console.log(submittedSecret);
                foundUser.secret = req.body.secret;
                foundUser.save().then(function(err) {
                    if (!err) {
                      console.log("Successfully Added to th DataBase.");
                    } else {
                        console.log(err);
                    }
                  });
                res.redirect("/secrets");
                
            }
    }).catch(function(err){
        console.log(err);
    })
})

app.get("/logout", function(req, res){
    req.logout(function(err) {
        if (err) { return next(err); }
    })
    res.redirect("/");
})

app.post("/register", function(req, res){
    User.register({ username: req.body.username }, req.body.password, (err, user) => {
        if (err) {
            console.log(err);
            res.redirect("/register");
            return;
        }
        passport.authenticate("local")(req, res, () => {
            res.redirect("/secrets");
        });
    });
})

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if(err){
        console.log(err);
    }
    else{
        passport.authenticate("local")(req, res, () => {
            res.redirect("/secrets");
        });
    }
  })
})


app.listen(3000, function(){
    console.log("running....");
})