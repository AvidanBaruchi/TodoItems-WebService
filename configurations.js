var config = {};

config.connectionURL = process.env.DATABASE_URL + '://postgres:password@localhost:5432/todoItems';
config.facebookConfig = {
  "facebook_api_key"      :     "key",
  "facebook_api_secret"   :     "secret",
  "callback_url"          :     "callback_url"
  "use_database"          :     "true",
  "host"                  :     "localhost",
  "username"              :     "root",
  "password"              :     "password",
  "database"              :     "database name"
};

module.exports = config;