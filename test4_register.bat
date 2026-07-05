curl.exe -s -X POST http://localhost:4000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"delete.me@test.com\",\"password\":\"Test1234\",\"firstName\":\"Delete\",\"lastName\":\"Me\",\"role\":\"student\"}" -o test4_register.json
type test4_register.json
