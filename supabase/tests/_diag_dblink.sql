SELECT extensions.dblink_connect(
  'diag10',
  'host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres'
);
SELECT extensions.dblink_disconnect('diag10');
