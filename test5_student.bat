curl.exe -s -o test5_student.html -w "HTTP_STATUS:%{http_code}\nCONTENT_TYPE:%{content_type}\n" http://localhost:3000/student/profile
echo ---STUDENT-PROFILE-RESPONSE-HEAD---
type test5_student.html
