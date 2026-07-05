curl.exe -s -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"delete.me@test.com\",\"password\":\"Test1234\"}" -o test4b_login.json
type test4b_login.json
