var database = require('pg');
var config = require("./configurations");

function DAO(){};

database.poolSize = 50;
/*
* Collection Items Operations:
*/
DAO.prototype.getTodoItems = function(user_id, callback)
{
    database.connect(config.connectionURL, function(err, client, done) 
	{
	    if(err)
	    {
	       return callback(new Error(err));
	    }
	    
		client.query("SELECT * FROM items WHERE u_id=$1;", [user_id], function(err, result)
		{
			done();
		  
			if (err)
			{ 
				//dbError = new Error(err);
				return callback(new Error(err));
			}
			else
			{ 
				//response.send(result.rows); 
				//dbResult = result.rows;
				callback(null, result.rows);
			}
		});
		
		/*if(dbError)
		{
		    callback(dbError);
		}
		else
		{
		    callback(null, dbResult);   
		}*/
	});
};

DAO.prototype.addItem = function(name, text, expiration, userId, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
		if(err)
		{
			return callback(err);
		}
		
		var modified = Date.now();
		
		client.query("INSERT INTO items values (DEFAULT, $1, $2, $3, $4, $5) RETURNING *;", 
		[name, text, expiration, userId, modified], 
		function(err, result)
		{
			done();
			
			if(err)
			{
				return callback(err);
			}
			
			callback(null, result.rows[0]);
		});
	});
};

DAO.prototype.replaceCollection = function(userId, collection, callback)
{
	var rollback = function(client, done) 
	{
  		client.query('ROLLBACK', function(err) 
  		{
		    //if there was a problem rolling back the query
		    //something is seriously messed up.  Return the error
		    //to the done function to close & remove this client from
		    //the pool.  If you leave a client in the pool with an unaborted
		    //transaction weird, hard to diagnose problems might happen.
		    done(err);
  		});
	};
	
	database.connect(config.connectionURL, function(err, client, done)
	{
		if(err)
		{
			return callback(err);
		}
		
		if(collection.length == 0)
		{
			done();
			return callback(new Error("collection is empty"));
		}
		
		var modified = Date.now();
		
		var text = "INSERT INTO items (id, name, text, expiration, u_id, modified) VALUES (DEFAULT, '" + collection[0].name + "', '"
			+ collection[0].text + "', " + collection[0].expiration + ", "
			+ userId + ", " + modified + ")";
		
		for(var i=1; i < collection.length; i++)
		{
			text += ", ";
			text += "(DEFAULT, '"; // id incerements
			text += collection[i].name + "', '";
			text += collection[i].text + "', ";
			text += collection[i].expiration + ", ";
			text += userId + ", ";
			text += modified + ")";
		}
		
		text += ' RETURNING *;';
		
	  	client.query('BEGIN', function(err) 
	  	{
    		if(err) 
    		{
    			return rollback(client, done);
    		}
		    //as long as we do not call the `done` callback we can do 
		    //whatever we want...the client is ours until we call `done`
		    //on the flip side, if you do call `done` before either COMMIT or ROLLBACK
		    //what you are doing is returning a client back to the pool while it 
		    //is in the middle of a transaction.  
		    //Returning a client while its in the middle of a transaction
		    //will lead to weird & hard to diagnose errors.
	    	client.query("DELETE FROM items WHERE u_id=$1", [userId], function(err, result) 
	      	{
	        	if(err) 
	        	{
	        		rollback(client, done);	
	        		return callback(err);
	        	}
	        	
	        	client.query(text, function(err, result) 
	        	{
	          		if(err) 
	          		{
	          			console.log(err);
	          			rollback(client, done);
	          			return callback(err);
	          		}
	          		
	          		client.query('COMMIT', done);
	          		return callback(null, result.rows);
	        	});
	      	});
  		});
	});	
};

DAO.prototype.deleteCollection = function(userId, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
		if(err) { return callback(err); }
		
		client.query("DELETE from items WHERE u_id=$1", [userId], function(err, result)
		{
			done();
			
			if(err) { return callback(err); }
			
			return callback(null, result);
		});
	});
};

/*
* Single Items Operations:
*/
DAO.prototype.getSingleItem = function(userId, item_id, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
		if(err)
		{
			return callback(err);
		}
		
		client.query("SELECT * FROM items WHERE id=$1 and u_id=$2", [item_id, userId], function(err, result)
		{
			done();
			if(err)
			{
				return callback(err);
			}
			
			callback(null, result);
		});
	});
};

DAO.prototype.replaceOrCreateItem = function(todoItem, userId, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
		if(err)
		{
			return callback(err);
		}
		
		client.query("SELECT * FROM items WHERE id=$1 and u_id=$2;", [todoItem.id, userId], function(err, result)
		{
			if(err)
			{
				return callback(err);
			}
			
			var modified = Date.now();
			
			if(result.rows.length == 0) // item not exist CREATE!
			{
				client.query("INSERT INTO items VALUES (DEFAULT,$1,$2,$3,$4, $5);", 
				[todoItem.name, todoItem.text, todoItem.expiration, userId, modified],
				function(err, result) 
				{
					done();
					
				    if(err)
				    {
				    	return callback(err);
				    }
				    
				    return callback(null, result.rows);
				});
			}
			else // item exists! UPDATE!
			{
				client.query("UPDATE items SET (name, text, expiration, modified) = ($1,$2,$3,$4) WHERE id=$5 RETURNING *;", 
				[todoItem.name, todoItem.text, todoItem.expiration, modified, todoItem.id],
				function(err, result) 
				{
					done();
					
					if(err)
					{
						return callback(err);
					}
					
					return callback(null, result.rows[0]);
				});
			}
		});
	});
};

DAO.prototype.deleteItem = function(userId, itemId, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
		if(err)
		{
			return callback(err);
		}
		
		client.query("DELETE FROM items WHERE id=$1 and u_id=$2", [itemId, userId],
		function(err, result)
		{
			done();
			
			if(err)
			{
				return callback(err);
			}
			
			return callback(null, result.rows);
		});
	});
};

/*
* Users Operations: 
*/
DAO.prototype.findOrCreateUser = function(userId, userName, picture, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
		if(err)
		{
			return callback(new Error(err));
		}
		
		client.query("INSERT INTO users values ($1, $2, $3) returning *", [userId, userName, picture], 
		function(err, result)
		{
			if(err)
			{
				//callback(err);
			}
		});
		
		client.query("Select * from users where id=$1", [userId], function(err, result) 
		{
			done();
			
			if(err)
		   	{
   				return callback(new Error(err));
		   	}
		   	
		   	return callback(null, result.rows[0]);
		});
	});	
};

DAO.prototype.addUser = function(userId, name, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
		if(err)
		{
			return callback(new Error(err));
		}
		
		client.query("insert into users values ($1, $2)", [userId, name], function(err, result)
		{
			done();
			
			if(err)
			{
				return callback(new Error(err));
			}
			
			callback(null, result);
		});
	});
}

DAO.prototype.findUserById = function(userId, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
	    if(err)
	    {
	    	return callback(new Error(err));
	    }
	    
	    client.query("select * from users where id=$1", [userId], function(err, result)
	    {
	    	done();
	    	
	    	if(err)
	    	{
	    		return callback(new Error(err));
	    	}
	    	
	    	callback(null, result.rows[0]);
	    });
	});
};

DAO.prototype.updateUserLastUpdate = function(userId, callback)
{
	database.connect(config.connectionURL, function(err, client, done) 
	{
	    if(err)
	    {
	    	return callback(err);
	    }
	    
	    client.query("");
	});	
};

module.exports = new DAO();