var express = require('express');
var router = express.Router();
var DAO = require('./DAO');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var config = require('./configurations');

// Passport session setup.
passport.serializeUser(function(user, done) 
{
  done(null, user.id);
});

passport.deserializeUser(function(obj, done) 
{
  done(null, obj);
});

// Use the FacebookStrategy within Passport.
passport.use(new FacebookStrategy({
    clientID: config.facebookConfig.facebook_api_key,
    clientSecret: config.facebookConfig.facebook_api_secret ,
    callbackURL: config.facebookConfig.callback_url,
    profileFields : ['id', 'displayName', 'picture']
  },
  function(accessToken, refreshToken, profile, done) 
  {
      //Check whether the User exists or not using profile.id
      //Further DB code.
      
      process.nextTick(function()
      {
        DAO.findOrCreateUser(profile.id, profile.displayName, profile.photos[0].value, function(err, user)
        {
          if(err)
          {
            return done(err);
          }
          
          done(null, user);
        });
      });
  }
));

router.use(cookieParser());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());
router.use(session({ 
    secret: 'keyboard catalyst'//, 
    //key: 'sid',
    //cookie : { maxAge : 60000, secure : true },
    //resave: false,
    //saveUninitialized : false
}));

router.use(passport.initialize());
router.use(passport.session());


router.use(function (req, res, next)
{
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, X-PINGOTHER');

    if ('OPTIONS' == req.method)
    {
      res.header('Access-Control-Max-Age', 20);
      return res.sendStatus(204);
    }
    else 
    {
        next();
    }
});


router.get('/auth/facebook', passport.authenticate('facebook'));
router.get('/auth/facebook/callback', passport.authenticate('facebook'),
/*{ 
   successRedirect : '/user',
   failureRedirect: '/login'
}),*/
function(req, res)
{
    if(req.isAuthenticated())
    {
      if(req.session.theOrigin)
      {
        res.redirect(req.session.theOrigin);
      }
      else
      {
        res.redirect('/login');
      }
    }
    else
    {
      res.redirect('/auth/facebook');
    }
});

function ensureAuthenticated(req, res, next)
{
  if (req.isAuthenticated())
  { 
    return next(); 
  }
  
  return res.json({message: 'failed', reason: 'not authenticated'});
}

/*
* Collections Actions:
*/
// GET: returns all the collection's members!
router.get('/todoitems', ensureAuthenticated, function(request, response)
{
	DAO.getTodoItems(request.user, function(error, result)
	{
		if(error)
		{
			return response.send(error);
		}
    
		response.json({message: 'success', data: result});
	});
});
// POST: create a new entry in the collection.
router.post('/todoitems', ensureAuthenticated, function(request, response)
{
  if(!request.body)
  {
    return response.json({message: 'failed', reason: 'body is empty!'});
  }
  else
  {
    var body = request.body;
    
    if(body.name && body.text && body.expiration)
    {
      DAO.addItem(body.name, body.text, body.expiration, request.user, function(err, result)
      {
        if (err)
        {
          return response.json({message: 'failed', reason: err});
        }
        
        return response.json({message: 'success', data: result});
      });
    }
    else
    {
      return response.json({message: 'failed', reason: 'body should contain json element representing todo item! (name, text and expiration properties)'});
    }
  }
});
// PUT: Replace the entire collection with another collection
router.put('/todoitems', ensureAuthenticated, function(request, response)
{
  var body = request.body;
  var collection;
  
  try
  {
    collection = JSON.parse(body["collection"]);
  }
  catch(e)
  { 
    return response.json({message: 'failed', reason: 'BROKEN JSON'});
  }
  
  if(collection)
  {
    if(collection[0].name && collection[0].text && collection[0].expiration)
    {
      DAO.replaceCollection(request.user, collection, function(err, result)
      {
        if(err)
        {
          return response.json({message: 'faild', reason: 'wrong parameters'});
        }
        
        return response.json({message: 'success', data: result});
      });    
    }
    else
    {
      response.json({message: 'failed', reason: 'collection should contain elements with the name, text and expiration-time properties'});
    }
  }
  else
  {
    response.json({message: 'failed', reason: 'data should contain json with an array named "collection"'});
  }
});
// delete the entire collection
router.delete('/todoitems', ensureAuthenticated, function(request, response)
{
  DAO.deleteCollection(request.user, function(err, result)
  {
    if(err) 
    { 
      return response.json({message: 'failed', reason: err});
    }
    
    return response.json({message: 'success'});
  });
});

/*
* Items Actions:
*/
// GET: returns the specified item.
router.get('/todoitems/item:itemId', ensureAuthenticated, function(request, response)
{
  var itemId = request.params.itemId;
  
  if(isNaN(itemId))
  {
    return response.json({message: 'failed', reason: 'url must end with id number'});
  }
  else
  {
    DAO.getSingleItem(request.user, itemId, function(err, result)
    {
      if(err)
      {
        return response.json({message: 'failed', reason: 'database error:' + err});
      }
      
      return response.json({message: 'success', data: result.rows});
    });  
  }
});
// PUT: replace the specified item; if not exist, create it!
router.put('/todoitems/item:itemId', ensureAuthenticated, function(request, response) 
{
  var body = request.body;
  var todoItem;
  var itemId = request.params.itemId;
  
  if(isNaN(itemId))
  {
    return response.json({message: 'failed', reason: 'url must end with id number'});
  }
  
  try
  {
    todoItem = JSON.parse(body["item"]);
  }
  catch(e)
  { 
    return response.json({message: 'failed', reason: 'BROKEN JSON'});
  }
  
  todoItem.id = itemId;
  
  if(todoItem.id && todoItem.name && todoItem.text && todoItem.expiration)
  {
    DAO.replaceOrCreateItem(todoItem, request.user, function(err, result)
    {
      if(err)
      {
        return response.json({message: 'failed', reason: 'database error: ' + err});
      }
      
      return response.json({message: 'success', data: result});
    });
  }
  else
  {
    response.json({message: 'failed', reason: '?!'});
  }
});

// DELETE: delete the specified item.
router.delete('/todoitems/item:itemId', ensureAuthenticated, function(request, response)
{
  var itemId = request.params.itemId;
  
  if(isNaN(itemId))
  {
    return response.json({message: 'failed', reason: 'url must end with id number'});
  }
  else
  {
    DAO.deleteItem(request.user, itemId, function(err, result)
    {
      if(err)
      {
        return response.json({message: 'failed', reason: err});
      }
      
      return response.json({message: 'success', data: result});
    });
  }
});


/*
* Sign In/Out Operations:
*/
router.get('/user', ensureAuthenticated, function(request, response) 
{
  DAO.findUserById(request.user, function(err, result)
  {
    if(err)
    {
      return response.json({message: 'failed', reason: 'database error' + err});
    }
    
    return response.json({message: 'success', data: result});
  });
});

router.get('/logout', ensureAuthenticated, function(req, res)
{
  req.logout();
  
  if(req.headers.referer && !req.headers.origin)
  {
    return res.redirect(req.headers.referer);
  }

  return res.json({message: 'success', data: null});
});

router.get('/signin', function(req, res) 
{
  
});

router.get('/login', function(req, res) 
{
    //res.send('login page');    
    if(req.isAuthenticated())
    {
      if(req.session.theOrigin)
      {
        res.redirect(req.headers.referer);
      }
      else
      {
        res.json({message: 'success', data: null});
      }
    }
    else
    {
      req.session.theOrigin = req.headers.referer;
      res.redirect('/auth/facebook');
    }
    
    //http://localhost/facebook/indexjohny.html
});

router.get('/welcome', function (request, response)
{
    response.json({message: 'success', data:'Welcome'});
});

module.exports = router;