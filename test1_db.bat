@echo off
set PGPASSWORD=09912013
psql -U postgres -h localhost -d mrh_academy -f test1_query.sql
