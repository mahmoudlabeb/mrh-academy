curl.exe -s -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d @login_body.json -o login_response.json
type login_response.json
