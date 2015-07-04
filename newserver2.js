var express = require('express');
var app = express();
var router = require('./router2');

app.set('port', process.env.PORT);
app.use(router);
app.listen(app.get('port'), function() 
{
    console.log("Node app is running at localhost:" + app.get('port'));
});