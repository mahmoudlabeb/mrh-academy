@echo off
echo ===STUDENT PROFILE===
curl.exe -s -i http://localhost:3000/student/profile -o test5_student_full.txt
type test5_student_full.txt
echo.
echo ===TUTOR PROFILE===
curl.exe -s -i http://localhost:3000/tutor/profile -o test5_tutor_full.txt
type test5_tutor_full.txt
