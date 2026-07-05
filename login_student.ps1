$body = '{"email":"student.verify@test.com","password":"Test1234"}'
$response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 5
$response.accessToken | Out-File -FilePath "c:\Users\user\Downloads\Free_job\موقع تعليم\student_token.txt" -Encoding ascii
