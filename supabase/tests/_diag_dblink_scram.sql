SELECT extensions.dblink_connect(
  'diag12',
  'host=172.19.0.2 port=5432 dbname=postgres user=postgres password=postgres'
);
SELECT extensions.dblink_disconnect('diag12');
