CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;
SELECT extensions.dblink_connect(
  'diag14',
  pg_catalog.format(
    'host=%s port=%s dbname=%I user=postgres password=postgres',
    pg_catalog.inet_server_addr(),
    pg_catalog.current_setting('port'),
    pg_catalog.current_database()
  )
);
SELECT extensions.dblink_disconnect('diag14');
