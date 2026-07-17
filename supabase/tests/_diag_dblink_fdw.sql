CREATE SERVER IF NOT EXISTS nlrpc_test_srv FOREIGN DATA WRAPPER dblink_fdw
  OPTIONS (host '127.0.0.1', port '5432', dbname 'postgres');
DROP USER MAPPING IF EXISTS FOR postgres SERVER nlrpc_test_srv;
CREATE USER MAPPING FOR postgres SERVER nlrpc_test_srv
  OPTIONS (user 'postgres', password 'postgres');
SELECT extensions.dblink_connect('diag11', 'nlrpc_test_srv');
SELECT extensions.dblink_disconnect('diag11');
DROP SERVER nlrpc_test_srv CASCADE;
