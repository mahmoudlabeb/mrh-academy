@echo off
echo ===HOME PAGE===
curl.exe -s -i http://localhost:3000/ -o test5_home.txt
type test5_home.txt | findstr /B "HTTP" 
echo ===LOGIN PAGE===
curl.exe -s -i http://localhost:3000/login -o test5_login.txt
type test5_login.txt | findstr /B "HTTP"
